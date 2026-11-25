<?php

namespace Tests\Feature;

use App\Console\Commands\CleanupStaleMonitoringJobs;
use App\Console\Commands\RunLambdaUptimeChecks;
use App\Console\Commands\RunUptimeChecks;
use App\Jobs\CreateClickUpTaskJob;
use App\Jobs\DispatchWebhookJob;
use App\Jobs\ProcessBatchUptimeResultsJob;
use App\Jobs\ProcessExternalUptimeResultJob;
use App\Jobs\ProcessIncidentEnrichmentJob;
use App\Jobs\ProcessUptimeCheckJob;
use App\Jobs\SendSmsAlertJob;
use App\Jobs\SendWhatsAppAlertJob;
use App\Models\Domain;
use App\Models\DomainStatusEvent;
use App\Models\Incident;
use App\Models\MonitoringRegion;
use App\Models\Webhook;
use App\Models\Workspace;
use App\Services\DomainHealthService;
use App\Services\IncidentRecorderService;
use App\Services\MonitoringDispatcherService;
use App\Services\MonitoringService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Mockery\MockInterface;
use Tests\TestCase;

class MonitoringOptimizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_run_uptime_checks_only_dispatches_due_local_domains()
    {
        Queue::fake();

        // 1. Create a MonitoringRegion so active regions exist
        MonitoringRegion::create([
            'name' => 'Mumbai',
            'aws_region' => 'ap-south-1',
            'lambda_function_name' => 'boomerr-monitor',
            'is_active' => true,
        ]);

        $localWorkspace = Workspace::factory()->create();
        $multiRegionWorkspace = Workspace::factory()->create();

        // Mock feature check on multiRegionWorkspace
        // If billing config or hasFeature is used
        $dueLocalDomain = Domain::factory()->create([
            'workspace_id' => $localWorkspace->id,
            'is_active' => true,
            'check_interval' => 5,
            'next_check_at' => now()->subMinute(),
        ]);

        $futureLocalDomain = Domain::factory()->create([
            'workspace_id' => $localWorkspace->id,
            'is_active' => true,
            'check_interval' => 5,
            'next_check_at' => now()->addMinutes(4),
        ]);

        $inactiveDomain = Domain::factory()->create([
            'workspace_id' => $localWorkspace->id,
            'is_active' => false,
            'next_check_at' => null,
        ]);

        $this->artisan('monitor:run-uptime-checks')->assertSuccessful();

        // Only dueLocalDomain should be dispatched
        Queue::assertPushed(ProcessUptimeCheckJob::class, function ($job) use ($dueLocalDomain) {
            return $job->domainId === $dueLocalDomain->id;
        });

        Queue::assertNotPushed(ProcessUptimeCheckJob::class, function ($job) use ($futureLocalDomain) {
            return $job->domainId === $futureLocalDomain->id;
        });

        Queue::assertNotPushed(ProcessUptimeCheckJob::class, function ($job) use ($inactiveDomain) {
            return $job->domainId === $inactiveDomain->id;
        });

        // Verify next_check_at was updated for the dispatched domain
        $this->assertTrue($dueLocalDomain->fresh()->next_check_at->isFuture());
    }

    public function test_monitoring_jobs_implement_uniqueness_and_correct_queues()
    {
        $domain = Domain::factory()->create();

        $uptimeJob = new ProcessUptimeCheckJob($domain->id);
        $this->assertInstanceOf(ShouldBeUnique::class, $uptimeJob);
        $this->assertEquals((string) $domain->id, $uptimeJob->uniqueId());
        $this->assertEquals('monitoring', $uptimeJob->queue);
        $this->assertEquals(60, $uptimeJob->timeout);
        $this->assertEquals(1, $uptimeJob->tries);

        $externalJob = new ProcessExternalUptimeResultJob($domain->id, 'up', 200, null, 150, 'us-east-1', 'N. Virginia');
        $this->assertInstanceOf(ShouldBeUnique::class, $externalJob);
        $this->assertEquals((string) $domain->id, $externalJob->uniqueId());
        $this->assertEquals('monitoring', $externalJob->queue);
        $this->assertEquals(60, $externalJob->timeout);

        $batchJob = new ProcessBatchUptimeResultsJob(['results' => []]);
        $this->assertEquals('monitoring', $batchJob->queue);
        $this->assertEquals(120, $batchJob->timeout);

        $smsJob = new SendSmsAlertJob('1234567890', 'test');
        $this->assertEquals('notifications', $smsJob->queue);

        $waJob = new SendWhatsAppAlertJob('1234567890', 'test');
        $this->assertEquals('notifications', $waJob->queue);

        $clickUpJob = new CreateClickUpTaskJob('1', '1');
        $this->assertEquals('notifications', $clickUpJob->queue);
    }

    public function test_incident_creation_is_non_blocking_and_dispatches_enrichment_job()
    {
        Queue::fake();

        $domain = Domain::factory()->create();
        $recorder = app(IncidentRecorderService::class);

        $incident = $recorder->recordIncident($domain, [
            'http_status' => 500,
            'duration_ms' => 300,
            'exception' => 'Internal Server Error',
        ]);

        $this->assertNotNull($incident->id);
        $this->assertEquals('ongoing', $incident->status);
        $this->assertEquals(500, $incident->http_status);

        // Verify ProcessIncidentEnrichmentJob was dispatched to background queue
        Queue::assertPushed(ProcessIncidentEnrichmentJob::class, function ($job) use ($incident) {
            return $job->incidentId === $incident->id && $job->queue === 'default';
        });
    }

    public function test_monitoring_service_idempotency_prevents_duplicate_events()
    {
        $domain = Domain::factory()->create();
        $service = app(MonitoringService::class);

        $payload = [
            'website_id' => $domain->id,
            'status' => 200,
            'response_time' => 150,
            'checked_at' => '2026-08-29 10:00:00',
            'region' => 'ap-south-1',
            'source' => 'lambda',
        ];

        // First call records event
        $service->storeResult($payload);
        $this->assertEquals(1, DomainStatusEvent::where('domain_id', $domain->id)->count());

        // Second duplicate call with exact same timestamp and region should be skipped
        $service->storeResult($payload);
        $this->assertEquals(1, DomainStatusEvent::where('domain_id', $domain->id)->count());
    }

    public function test_queue_cleanup_command_dry_run_and_force_deletion()
    {
        // Insert sample pending jobs into jobs table
        $now = time();
        $fifteenMinutesAgo = $now - (15 * 60);

        // Stale ProcessUptimeCheckJob (15m old)
        $staleUptimeJobId = DB::table('jobs')->insertGetId([
            'queue' => 'monitoring',
            'payload' => json_encode(['displayName' => 'App\Jobs\ProcessUptimeCheckJob', 'job' => 'Illuminate\Queue\CallQueuedHandler@call']),
            'attempts' => 0,
            'reserved_at' => null,
            'available_at' => $fifteenMinutesAgo,
            'created_at' => $fifteenMinutesAgo,
        ]);

        // Stale ProcessBatchUptimeResultsJob (15m old)
        $staleBatchJobId = DB::table('jobs')->insertGetId([
            'queue' => 'monitoring',
            'payload' => json_encode(['displayName' => 'App\Jobs\ProcessBatchUptimeResultsJob', 'job' => 'Illuminate\Queue\CallQueuedHandler@call']),
            'attempts' => 0,
            'reserved_at' => null,
            'available_at' => $fifteenMinutesAgo,
            'created_at' => $fifteenMinutesAgo,
        ]);

        // Protected CreateClickUpTaskJob (15m old - should NOT be deleted)
        $protectedClickUpJobId = DB::table('jobs')->insertGetId([
            'queue' => 'notifications',
            'payload' => json_encode(['displayName' => 'App\Jobs\CreateClickUpTaskJob', 'job' => 'Illuminate\Queue\CallQueuedHandler@call']),
            'attempts' => 0,
            'reserved_at' => null,
            'available_at' => $fifteenMinutesAgo,
            'created_at' => $fifteenMinutesAgo,
        ]);

        // Recent ProcessUptimeCheckJob (2m old - should NOT be deleted)
        $recentUptimeJobId = DB::table('jobs')->insertGetId([
            'queue' => 'monitoring',
            'payload' => json_encode(['displayName' => 'App\Jobs\ProcessUptimeCheckJob', 'job' => 'Illuminate\Queue\CallQueuedHandler@call']),
            'attempts' => 0,
            'reserved_at' => null,
            'available_at' => $now - 120,
            'created_at' => $now - 120,
        ]);

        // 1. Dry run should NOT delete anything
        $this->artisan('queue:cleanup-stale-monitoring --dry-run --age=10')
            ->assertSuccessful();

        $this->assertEquals(4, DB::table('jobs')->count());

        // 2. Force run should delete ONLY the 2 stale monitoring jobs
        $this->artisan('queue:cleanup-stale-monitoring --force --age=10')
            ->assertSuccessful();

        $this->assertEquals(2, DB::table('jobs')->count());

        // Verify protected and recent jobs still exist
        $this->assertNotNull(DB::table('jobs')->find($protectedClickUpJobId));
        $this->assertNotNull(DB::table('jobs')->find($recentUptimeJobId));

        // Verify stale monitoring jobs were deleted
        $this->assertNull(DB::table('jobs')->find($staleUptimeJobId));
        $this->assertNull(DB::table('jobs')->find($staleBatchJobId));
    }
}
