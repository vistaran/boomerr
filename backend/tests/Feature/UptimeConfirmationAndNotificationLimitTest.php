<?php

namespace Tests\Feature;

use App\Jobs\ProcessUptimeConfirmationJob;
use App\Models\Domain;
use App\Models\Incident;
use App\Models\Workspace;
use App\Services\DomainHealthService;
use App\Services\IncidentRecorderService;
use App\Services\SystemLogService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class UptimeConfirmationAndNotificationLimitTest extends TestCase
{
    use RefreshDatabase;

    protected DomainHealthService $healthService;
    protected Workspace $workspace;

    protected function setUp(): void
    {
        parent::setUp();
        $this->healthService = app(DomainHealthService::class);
        $this->workspace = Workspace::factory()->create();
    }

    public function test_initial_failed_local_uptime_check_does_not_mark_domain_down_and_dispatches_confirmation_job(): void
    {
        Queue::fake();
        Http::fake([
            '*' => Http::response('Server Error', 500),
        ]);

        $domain = Domain::factory()->create([
            'workspace_id' => $this->workspace->id,
            'url' => 'https://test-site-alpha.com',
            'status' => 'up',
            'is_active' => true,
        ]);

        $this->healthService->runUptimeCheck($domain);

        $domain->refresh();

        // 1. Domain remains UP on initial failure
        $this->assertEquals('up', $domain->status);

        // 2. No incident created
        $this->assertEquals(0, Incident::where('domain_id', $domain->id)->count());

        // 3. Confirmation check #2 queued with 2-second delay
        Queue::assertPushed(ProcessUptimeConfirmationJob::class, function ($job) use ($domain) {
            return $job->domainId === $domain->id
                && $job->attempt === 2
                && $job->delay !== null;
        });
    }

    public function test_temporary_failure_dismissed_when_confirmation_check_succeeds(): void
    {
        Queue::fake();
        Http::fake([
            '*' => Http::response('OK', 200),
        ]);

        $domain = Domain::factory()->create([
            'workspace_id' => $this->workspace->id,
            'url' => 'https://test-site-bravo.com',
            'status' => 'up',
            'is_active' => true,
        ]);

        Cache::put("domain_down_confirmation_{$domain->id}", true, 60);

        // Run confirmation check #2, which succeeds (HTTP 200)
        $this->healthService->runConfirmationCheck($domain, 2, 500, 'HTTP 500', 'local');

        $domain->refresh();

        // Domain stays UP, no incident, confirmation lock cleared
        $this->assertEquals('up', $domain->status);
        $this->assertEquals(0, Incident::where('domain_id', $domain->id)->count());
        $this->assertFalse(Cache::has("domain_down_confirmation_{$domain->id}"));
        Queue::assertNotPushed(ProcessUptimeConfirmationJob::class);
    }

    public function test_second_confirmation_check_failure_schedules_third_confirmation_check(): void
    {
        Queue::fake();
        Http::fake([
            '*' => Http::response('Bad Gateway', 502),
        ]);

        $domain = Domain::factory()->create([
            'workspace_id' => $this->workspace->id,
            'url' => 'https://test-site-charlie.com',
            'status' => 'up',
            'is_active' => true,
        ]);

        // Run confirmation check #2, which fails
        $this->healthService->runConfirmationCheck($domain, 2, 500, 'HTTP 500', 'local');

        $domain->refresh();

        // Domain still UP pending 3rd check
        $this->assertEquals('up', $domain->status);
        $this->assertEquals(0, Incident::where('domain_id', $domain->id)->count());

        // Confirmation check #3 dispatched with 2-second delay
        Queue::assertPushed(ProcessUptimeConfirmationJob::class, function ($job) use ($domain) {
            return $job->domainId === $domain->id
                && $job->attempt === 3
                && $job->delay !== null;
        });
    }

    public function test_third_failed_confirmation_check_confirms_domain_down_and_creates_incident(): void
    {
        Queue::fake();
        Http::fake([
            '*' => Http::response('Service Unavailable', 503),
        ]);

        $domain = Domain::factory()->create([
            'workspace_id' => $this->workspace->id,
            'url' => 'https://test-site-delta.com',
            'status' => 'up',
            'is_active' => true,
        ]);

        Cache::put("domain_down_confirmation_{$domain->id}", true, 60);

        // Run confirmation check #3, which fails
        $this->healthService->runConfirmationCheck($domain, 3, 503, 'HTTP 503 Service Unavailable', 'local');

        $domain->refresh();

        // Domain is now CONFIRMED DOWN
        $this->assertEquals('down', $domain->status);

        // Ongoing Incident created
        $incident = Incident::where('domain_id', $domain->id)->first();
        $this->assertNotNull($incident);
        $this->assertEquals('ongoing', $incident->status);

        // Alert count incremented to 1
        $this->assertEquals(1, $domain->consecutive_down_alert_count);
        $this->assertFalse(Cache::has("domain_down_confirmation_{$domain->id}"));
    }

    public function test_initial_lambda_down_result_initiates_confirmation_and_keeps_domain_up(): void
    {
        Queue::fake();

        $domain = Domain::factory()->create([
            'workspace_id' => $this->workspace->id,
            'url' => 'https://test-site-echo.com',
            'status' => 'up',
            'is_active' => true,
        ]);

        $this->healthService->processExternalUptimeResult(
            $domain,
            'down',
            504,
            'Gateway Timeout',
            500,
            'us-east-1',
            'N. Virginia'
        );

        $domain->refresh();

        // Domain remains UP on initial Lambda failure
        $this->assertEquals('up', $domain->status);
        $this->assertEquals(0, Incident::where('domain_id', $domain->id)->count());

        // Confirmation check dispatched
        Queue::assertPushed(ProcessUptimeConfirmationJob::class, function ($job) use ($domain) {
            return $job->domainId === $domain->id
                && $job->attempt === 2
                && $job->source === 'lambda';
        });
    }

    public function test_ongoing_incident_is_not_recreated_when_curl_error_string_fluctuates(): void
    {
        $domain = Domain::factory()->create([
            'workspace_id' => $this->workspace->id,
            'url' => 'https://test-site-foxtrot.com',
            'status' => 'down',
            'last_response_status' => 'cURL error 28: Operation timed out after 10002 milliseconds',
            'consecutive_down_alert_count' => 1,
            'is_active' => true,
        ]);

        $incident = Incident::create([
            'domain_id' => $domain->id,
            'workspace_id' => $this->workspace->id,
            'status' => 'ongoing',
            'started_at' => now()->subMinutes(5),
            'http_status' => null,
            'error_message' => 'cURL error 28: Operation timed out after 10002 milliseconds',
        ]);

        Http::fake([
            '*' => function () {
                throw new \Illuminate\Http\Client\ConnectionException('cURL error 28: Operation timed out after 10014 milliseconds');
            },
        ]);

        $this->healthService->runUptimeCheck($domain);

        $domain->refresh();
        $incident->refresh();

        // Must NOT resolve the ongoing incident or create duplicate incident
        $this->assertEquals('ongoing', $incident->status);
        $this->assertEquals(1, Incident::where('domain_id', $domain->id)->count());
        $this->assertEquals(1, Incident::where('domain_id', $domain->id)->where('status', 'ongoing')->count());
    }

    public function test_down_alert_count_stops_sending_alerts_after_3_consecutive_checks(): void
    {
        $domain = Domain::factory()->create([
            'workspace_id' => $this->workspace->id,
            'url' => 'https://test-site-golf.com',
            'status' => 'down',
            'last_response_status' => 500,
            'consecutive_down_alert_count' => 3,
            'failure_count' => 3,
            'is_active' => true,
        ]);

        Incident::create([
            'domain_id' => $domain->id,
            'workspace_id' => $this->workspace->id,
            'status' => 'ongoing',
            'started_at' => now()->subMinutes(15),
            'http_status' => 500,
            'error_message' => 'HTTP 500',
        ]);

        Http::fake([
            '*' => Http::response('Internal Server Error', 500),
        ]);

        $this->healthService->runUptimeCheck($domain);

        $domain->refresh();

        // consecutive_down_alert_count must not exceed 3 or reset
        $this->assertEquals(3, $domain->consecutive_down_alert_count);
    }

    public function test_recovery_resets_consecutive_down_alert_count_and_resolves_incident(): void
    {
        $domain = Domain::factory()->create([
            'workspace_id' => $this->workspace->id,
            'url' => 'https://test-site-hotel.com',
            'status' => 'down',
            'last_response_status' => 500,
            'consecutive_down_alert_count' => 3,
            'failure_count' => 3,
            'is_active' => true,
        ]);

        $incident = Incident::create([
            'domain_id' => $domain->id,
            'workspace_id' => $this->workspace->id,
            'status' => 'ongoing',
            'started_at' => now()->subMinutes(30),
            'http_status' => 500,
            'error_message' => 'HTTP 500',
        ]);

        Http::fake([
            '*' => Http::response('OK', 200),
        ]);

        $this->healthService->runUptimeCheck($domain);

        $domain->refresh();
        $incident->refresh();

        // Domain recovered
        $this->assertEquals('up', $domain->status);
        $this->assertEquals(200, $domain->last_response_status);

        // Incident resolved
        $this->assertEquals('resolved', $incident->status);
        $this->assertNotNull($incident->resolved_at);

        // Counter reset to 0
        $this->assertEquals(0, $domain->consecutive_down_alert_count);
        $this->assertEquals(0, $domain->failure_count);
    }
}
