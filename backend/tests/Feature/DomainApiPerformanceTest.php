<?php

namespace Tests\Feature;

use App\Models\Domain;
use App\Models\DomainStatusEvent;
use App\Models\Incident;
use App\Models\MonitoringRegion;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DomainApiPerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_get_domains_executes_without_n_plus_one_aggregate_queries()
    {
        $workspace = Workspace::factory()->create();
        $user = User::factory()->create();
        $user->workspaces()->attach($workspace->id, ['is_current' => true, 'role' => 'owner']);

        // Create 10 domains
        $domains = Domain::factory()->count(10)->create([
            'workspace_id' => $workspace->id,
            'is_active' => true,
        ]);

        // Create a few status events for each domain
        foreach ($domains as $domain) {
            DomainStatusEvent::create([
                'domain_id' => $domain->id,
                'status' => 'up',
                'response_time_ms' => 120,
                'checked_at' => now(),
                'region' => 'ap-south-1',
            ]);
        }

        // Count queries executed during /api/domains
        DB::enableQueryLog();

        $response = $this->actingAs($user)->getJson('/api/domains');

        $queries = DB::getQueryLog();
        $queryCount = count($queries);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data',
                'subscription_past_due',
            ]);

        $this->assertCount(10, $response->json('data'));

        // Query count should be constant and minimal (< 10 queries total, NOT 10*2 = 20+ queries)
        $this->assertLessThan(10, $queryCount, "Expected minimal query count, got {$queryCount}");
    }

    public function test_get_regional_status_returns_consolidated_stats()
    {
        $workspace = Workspace::factory()->create();
        $user = User::factory()->create();
        $user->workspaces()->attach($workspace->id, ['is_current' => true, 'role' => 'owner']);

        $domain = Domain::factory()->create([
            'workspace_id' => $workspace->id,
            'is_active' => true,
        ]);

        MonitoringRegion::create([
            'name' => 'Mumbai',
            'aws_region' => 'ap-south-1',
            'lambda_function_name' => 'boomerr-monitor',
            'is_active' => true,
        ]);

        MonitoringRegion::create([
            'name' => 'Virginia',
            'aws_region' => 'us-east-1',
            'lambda_function_name' => 'boomerr-monitor',
            'is_active' => true,
        ]);

        // Add events
        DomainStatusEvent::create([
            'domain_id' => $domain->id,
            'region' => 'ap-south-1',
            'location' => 'Mumbai, India',
            'status' => 'up',
            'response_time_ms' => 80,
            'checked_at' => now()->subMinutes(5),
        ]);

        DomainStatusEvent::create([
            'domain_id' => $domain->id,
            'region' => 'us-east-1',
            'location' => 'N. Virginia, USA',
            'status' => 'up',
            'response_time_ms' => 180,
            'checked_at' => now()->subMinutes(5),
        ]);

        $response = $this->actingAs($user)->getJson("/api/domains/{$domain->ulid}/regional-status");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'region',
                        'region_name',
                        'location',
                        'status',
                        'response_time_ms',
                        'min_response_time_ms',
                        'max_response_time_ms',
                        'avg_response_time_ms',
                        'uptime_percent',
                        'total_checks_24h',
                        'checked_at',
                    ]
                ]
            ]);

        $data = $response->json('data');
        $this->assertCount(2, $data);
    }
}
