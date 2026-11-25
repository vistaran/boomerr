<?php

namespace Tests\Feature;

use App\Jobs\ProcessExternalUptimeResultJob;
use App\Jobs\ProcessUptimeCheckJob;
use App\Jobs\ProcessUptimeConfirmationJob;
use App\Jobs\RunDomainHealthChecks;
use App\Models\Domain;
use App\Models\DomainStatusEvent;
use App\Models\Incident;
use App\Models\Plan;
use App\Models\PlanPrice;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workspace;
use App\Services\Billing\WorkspaceBillingService;
use App\Services\DomainHealthService;
use App\Services\MonitoringService;
use App\Services\PlanLimitService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class PlanDowngradeMonitorLimitTest extends TestCase
{
    use RefreshDatabase;

    private function createWorkspaceWithOwner(string $planCode = 'free'): array
    {
        $workspace = Workspace::create([
            'name' => 'Acme Monitoring',
            'slug' => 'acme-' . uniqid(),
            'primary_contact_email' => 'owner@example.com',
            'timezone' => 'UTC',
            'billing_status' => $planCode === 'free' ? 'free' : 'active',
        ]);

        $user = User::factory()->create();
        $user->workspaces()->attach($workspace->id, ['is_current' => true, 'role' => 'owner']);

        if ($planCode !== 'free') {
            $plan = Plan::firstOrCreate(
                ['code' => $planCode],
                [
                    'name' => ucfirst($planCode),
                    'max_domains' => 100,
                    'max_team_members' => 10,
                    'is_active' => true,
                ]
            );

            $price = PlanPrice::firstOrCreate(
                ['plan_id' => $plan->id, 'interval' => 'monthly'],
                [
                    'price' => 2900,
                    'currency' => 'USD',
                    'is_active' => true,
                ]
            );

            Subscription::create([
                'workspace_id' => $workspace->id,
                'plan_price_id' => $price->id,
                'gateway' => 'razorpay',
                'gateway_subscription_id' => 'sub_' . uniqid(),
                'status' => 'active',
                'current_period_start' => Carbon::now(),
                'current_period_end' => Carbon::now()->addMonth(),
            ]);

            $workspace->refresh();
        }

        return [$workspace, $user];
    }

    public function test_free_plan_strictly_caps_at_10_monitored_domains(): void
    {
        [$workspace, $user] = $this->createWorkspaceWithOwner('free');

        // Create 10 domains
        for ($i = 1; $i <= 10; $i++) {
            Domain::create([
                'workspace_id' => $workspace->id,
                'name' => "domain-{$i}.com",
                'url' => "https://domain-{$i}.com",
                'is_active' => true,
                'check_interval' => 5,
            ]);
        }

        $this->assertEquals(10, $workspace->domains()->where('is_active', true)->count());
        $this->assertFalse(PlanLimitService::canAddMonitor($workspace));

        // Attempt to create 11th domain via API
        $response = $this->actingAs($user)->postJson('/api/domains', [
            'name' => 'domain-11.com',
            'url' => 'https://domain-11.com',
            'is_active' => true,
            'check_interval' => 5,
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'error_code' => 'plan_limit_monitors',
            ]);
    }

    public function test_downgrade_pauses_excess_domains_and_keeps_first_10_active(): void
    {
        [$workspace, $user] = $this->createWorkspaceWithOwner('solopreneur');

        // Create 15 active domains
        $domains = [];
        for ($i = 1; $i <= 15; $i++) {
            $domains[] = Domain::create([
                'workspace_id' => $workspace->id,
                'name' => "site-{$i}.com",
                'url' => "https://site-{$i}.com",
                'is_active' => true,
                'paused_reason' => null,
                'check_interval' => 1,
                'next_check_at' => now(),
            ]);
        }

        $this->assertEquals(15, $workspace->domains()->where('is_active', true)->count());

        // Cancel subscription and downgrade to free
        $workspace->subscriptions()->update(['status' => 'cancelled']);
        $workspace->billing_status = 'free';
        $workspace->plan_id = null;
        $workspace->save();
        $workspace->unsetRelation('activeSubscription');

        // Enforce limits via WorkspaceBillingService
        app(WorkspaceBillingService::class)->syncDomainsMonitoringInterval($workspace);

        $refreshed = Domain::where('workspace_id', $workspace->id)->orderBy('id', 'asc')->get();

        // First 10 domains must remain active and actively monitored
        for ($i = 0; $i < 10; $i++) {
            $this->assertTrue((bool) $refreshed[$i]->is_active, "Domain #{$refreshed[$i]->id} should be active");
            $this->assertNull($refreshed[$i]->paused_reason, "Domain #{$refreshed[$i]->id} paused_reason should be null");
            $this->assertNotNull($refreshed[$i]->next_check_at, "Domain #{$refreshed[$i]->id} next_check_at should be set");
        }

        // Remaining 5 excess domains must be paused with 'plan_limit'
        for ($i = 10; $i < 15; $i++) {
            $this->assertFalse((bool) $refreshed[$i]->is_active, "Excess domain #{$refreshed[$i]->id} should be inactive");
            $this->assertEquals('plan_limit', $refreshed[$i]->paused_reason, "Excess domain #{$refreshed[$i]->id} paused_reason should be plan_limit");
            $this->assertNull($refreshed[$i]->next_check_at, "Excess domain #{$refreshed[$i]->id} next_check_at should be null");
        }
    }

    public function test_user_paused_domains_are_preserved_on_downgrade(): void
    {
        [$workspace, $user] = $this->createWorkspaceWithOwner('solopreneur');

        // Create 8 active domains
        for ($i = 1; $i <= 8; $i++) {
            Domain::create([
                'workspace_id' => $workspace->id,
                'name' => "active-{$i}.com",
                'url' => "https://active-{$i}.com",
                'is_active' => true,
                'paused_reason' => null,
            ]);
        }

        // Create 2 user-paused domains
        $userPaused1 = Domain::create([
            'workspace_id' => $workspace->id,
            'name' => "user-paused-1.com",
            'url' => "https://user-paused-1.com",
            'is_active' => false,
            'paused_reason' => 'user',
            'next_check_at' => null,
        ]);

        $userPaused2 = Domain::create([
            'workspace_id' => $workspace->id,
            'name' => "user-paused-2.com",
            'url' => "https://user-paused-2.com",
            'is_active' => false,
            'paused_reason' => 'user',
            'next_check_at' => null,
        ]);

        // Create 4 more active domains (total 12 active, 2 user-paused)
        for ($i = 9; $i <= 12; $i++) {
            Domain::create([
                'workspace_id' => $workspace->id,
                'name' => "active-{$i}.com",
                'url' => "https://active-{$i}.com",
                'is_active' => true,
                'paused_reason' => null,
            ]);
        }

        // Downgrade to free
        $workspace->subscriptions()->update(['status' => 'cancelled']);
        $workspace->billing_status = 'free';
        $workspace->plan_id = null;
        $workspace->save();
        $workspace->unsetRelation('activeSubscription');

        app(WorkspaceBillingService::class)->syncDomainsMonitoringInterval($workspace);

        // User-paused domains must NOT be converted to plan_limit or reactivated
        $this->assertEquals('user', $userPaused1->fresh()->paused_reason);
        $this->assertFalse((bool) $userPaused1->fresh()->is_active);
        $this->assertEquals('user', $userPaused2->fresh()->paused_reason);
        $this->assertFalse((bool) $userPaused2->fresh()->is_active);

        // Exactly 10 active domains should exist
        $this->assertEquals(10, $workspace->domains()->where('is_active', true)->count());

        // Excess active domains (2) should be paused with plan_limit
        $this->assertEquals(2, $workspace->domains()->where('paused_reason', 'plan_limit')->count());
    }

    public function test_downgrade_preserves_incidents_and_history(): void
    {
        [$workspace, $user] = $this->createWorkspaceWithOwner('solopreneur');

        // Create 11 domains so 11th will be plan-limited
        $domains = [];
        for ($i = 1; $i <= 11; $i++) {
            $domains[] = Domain::create([
                'workspace_id' => $workspace->id,
                'name' => "history-{$i}.com",
                'url' => "https://history-{$i}.com",
                'is_active' => true,
                'status' => 'down',
            ]);
        }

        $excessDomain = $domains[10]; // 11th domain

        // Attach incident and status events
        $incident = Incident::create([
            'workspace_id' => $workspace->id,
            'domain_id' => $excessDomain->id,
            'status' => 'ongoing',
            'started_at' => now()->subHour(),
        ]);

        $event = DomainStatusEvent::create([
            'domain_id' => $excessDomain->id,
            'status' => 'down',
            'response_time_ms' => 0,
            'checked_at' => now()->subMinutes(10),
            'check_source' => 'local',
            'http_status' => 500,
        ]);

        // Downgrade to Free
        $workspace->subscriptions()->update(['status' => 'cancelled']);
        $workspace->billing_status = 'free';
        $workspace->plan_id = null;
        $workspace->save();
        $workspace->unsetRelation('activeSubscription');

        app(WorkspaceBillingService::class)->syncDomainsMonitoringInterval($workspace);

        $excessDomain->refresh();
        $this->assertFalse((bool) $excessDomain->is_active);
        $this->assertEquals('plan_limit', $excessDomain->paused_reason);

        // Assert history is untouched and NOT deleted
        $this->assertDatabaseHas('incidents', ['id' => $incident->id, 'domain_id' => $excessDomain->id]);
        $this->assertDatabaseHas('domain_status_events', ['id' => $event->id, 'domain_id' => $excessDomain->id]);
    }

    public function test_stale_jobs_and_webhooks_drop_plan_limited_domains(): void
    {
        [$workspace, $user] = $this->createWorkspaceWithOwner('free');

        $domain = Domain::create([
            'workspace_id' => $workspace->id,
            'name' => 'limited-site.com',
            'url' => 'https://limited-site.com',
            'is_active' => false,
            'paused_reason' => 'plan_limit',
            'next_check_at' => null,
        ]);

        // 1. Eligibility service check
        $this->assertFalse(PlanLimitService::isDomainEligibleForMonitoring($domain));

        // 2. ProcessUptimeCheckJob guard
        $this->mock(DomainHealthService::class, function (MockInterface $mock) {
            $mock->shouldNotReceive('runUptimeCheck');
            $mock->shouldNotReceive('processExternalUptimeResult');
            $mock->shouldNotReceive('runConfirmationCheck');
            $mock->shouldNotReceive('runFullHealthCheck');
        });

        (new ProcessUptimeCheckJob($domain->id))->handle(app(DomainHealthService::class));

        // 3. ProcessExternalUptimeResultJob guard
        (new ProcessExternalUptimeResultJob(
            $domain->id,
            'up',
            200,
            null,
            120,
            'us-east-1',
            'N. Virginia'
        ))->handle(app(DomainHealthService::class));

        // 4. ProcessUptimeConfirmationJob guard
        (new ProcessUptimeConfirmationJob($domain->id, 1))->handle(app(DomainHealthService::class));

        // 5. RunDomainHealthChecks guard
        (new RunDomainHealthChecks($domain))->handle(app(DomainHealthService::class));

        // 6. MonitoringService::storeResult guard
        $eventCountBefore = DomainStatusEvent::where('domain_id', $domain->id)->count();
        (new MonitoringService())->storeResult([
            'website_id' => $domain->id,
            'status' => 200,
            'response_time' => 80,
            'checked_at' => now()->toIso8601String(),
            'source' => 'lambda',
            'region' => 'us-east-1',
        ]);
        $this->assertEquals($eventCountBefore, DomainStatusEvent::where('domain_id', $domain->id)->count());
    }

    public function test_upgrade_restores_plan_limit_paused_domains_up_to_new_limit(): void
    {
        [$workspace, $user] = $this->createWorkspaceWithOwner('free');

        // 10 active domains
        for ($i = 1; $i <= 10; $i++) {
            Domain::create([
                'workspace_id' => $workspace->id,
                'name' => "domain-{$i}.com",
                'url' => "https://domain-{$i}.com",
                'is_active' => true,
                'paused_reason' => null,
            ]);
        }

        // 3 plan_limit paused domains
        $planPaused1 = Domain::create([
            'workspace_id' => $workspace->id,
            'name' => "plan-paused-1.com",
            'url' => "https://plan-paused-1.com",
            'is_active' => false,
            'paused_reason' => 'plan_limit',
            'next_check_at' => null,
        ]);

        $planPaused2 = Domain::create([
            'workspace_id' => $workspace->id,
            'name' => "plan-paused-2.com",
            'url' => "https://plan-paused-2.com",
            'is_active' => false,
            'paused_reason' => 'plan_limit',
            'next_check_at' => null,
        ]);

        $planPaused3 = Domain::create([
            'workspace_id' => $workspace->id,
            'name' => "plan-paused-3.com",
            'url' => "https://plan-paused-3.com",
            'is_active' => false,
            'paused_reason' => 'plan_limit',
            'next_check_at' => null,
        ]);

        // 1 user-paused domain
        $userPaused = Domain::create([
            'workspace_id' => $workspace->id,
            'name' => "user-paused.com",
            'url' => "https://user-paused.com",
            'is_active' => false,
            'paused_reason' => 'user',
            'next_check_at' => null,
        ]);

        // Upgrade to Solopreneur (max_monitors = 30)
        $plan = Plan::firstOrCreate(
            ['code' => 'solopreneur'],
            [
                'name' => 'Solopreneur',
                'max_domains' => 30,
                'max_team_members' => 5,
                'is_active' => true,
            ]
        );

        $price = PlanPrice::firstOrCreate(
            ['plan_id' => $plan->id, 'interval' => 'monthly'],
            [
                'price' => 1900,
                'currency' => 'USD',
                'is_active' => true,
            ]
        );

        $sub = Subscription::create([
            'workspace_id' => $workspace->id,
            'plan_price_id' => $price->id,
            'gateway' => 'razorpay',
            'gateway_subscription_id' => 'sub_' . uniqid(),
            'status' => 'active',
            'current_period_start' => Carbon::now(),
            'current_period_end' => Carbon::now()->addMonth(),
        ]);

        $workspace->refresh();
        app(WorkspaceBillingService::class)->syncFromSubscription($workspace, $sub);

        // All 3 plan_limit paused domains should be restored
        $this->assertTrue((bool) $planPaused1->fresh()->is_active);
        $this->assertNull($planPaused1->fresh()->paused_reason);
        $this->assertNotNull($planPaused1->fresh()->next_check_at);

        $this->assertTrue((bool) $planPaused2->fresh()->is_active);
        $this->assertNull($planPaused2->fresh()->paused_reason);
        $this->assertNotNull($planPaused2->fresh()->next_check_at);

        $this->assertTrue((bool) $planPaused3->fresh()->is_active);
        $this->assertNull($planPaused3->fresh()->paused_reason);
        $this->assertNotNull($planPaused3->fresh()->next_check_at);

        // User-paused domain must REMAIN paused
        $this->assertFalse((bool) $userPaused->fresh()->is_active);
        $this->assertEquals('user', $userPaused->fresh()->paused_reason);
    }

    public function test_cannot_manually_activate_domain_when_at_plan_limit(): void
    {
        [$workspace, $user] = $this->createWorkspaceWithOwner('free');

        // 10 active domains
        for ($i = 1; $i <= 10; $i++) {
            Domain::create([
                'workspace_id' => $workspace->id,
                'name' => "domain-{$i}.com",
                'url' => "https://domain-{$i}.com",
                'is_active' => true,
                'paused_reason' => null,
            ]);
        }

        // 1 paused domain
        $pausedDomain = Domain::create([
            'workspace_id' => $workspace->id,
            'name' => 'paused-domain.com',
            'url' => 'https://paused-domain.com',
            'is_active' => false,
            'paused_reason' => 'plan_limit',
            'next_check_at' => null,
        ]);

        // Attempt to activate via API
        $response = $this->actingAs($user)->putJson("/api/domains/{$pausedDomain->ulid}", [
            'is_active' => true,
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'error_code' => 'plan_limit_monitors',
            ]);

        $this->assertFalse((bool) $pausedDomain->fresh()->is_active);
        $this->assertEquals('plan_limit', $pausedDomain->fresh()->paused_reason);
    }

    public function test_downgrade_with_explicit_keep_domain_ids_keeps_selected_and_pauses_unselected(): void
    {
        [$workspace, $user] = $this->createWorkspaceWithOwner('solopreneur');

        // Create 15 active domains
        $domains = [];
        for ($i = 1; $i <= 15; $i++) {
            $domains[] = Domain::create([
                'workspace_id' => $workspace->id,
                'name' => "select-site-{$i}.com",
                'url' => "https://select-site-{$i}.com",
                'is_active' => true,
                'paused_reason' => null,
                'check_interval' => 1,
                'next_check_at' => now(),
            ]);
        }

        // Suppose user selects the last 10 domains (indices 5..14) to keep
        $selectedDomains = array_slice($domains, 5, 10);
        $selectedIds = array_map(fn($d) => $d->id, $selectedDomains);

        $unselectedDomains = array_slice($domains, 0, 5);
        $unselectedIds = array_map(fn($d) => $d->id, $unselectedDomains);

        // Cancel subscription and downgrade to free
        $workspace->subscriptions()->update(['status' => 'cancelled']);
        $workspace->billing_status = 'free';
        $workspace->plan_id = null;
        $workspace->save();
        $workspace->unsetRelation('activeSubscription');

        // Enforce limits passing explicit keepDomainIds
        app(WorkspaceBillingService::class)->syncDomainsMonitoringInterval($workspace, null, $selectedIds);

        // Check selected domains are all ACTIVE and have no paused_reason
        foreach ($selectedIds as $id) {
            $fresh = Domain::find($id);
            $this->assertTrue((bool) $fresh->is_active, "Domain #{$id} should be active");
            $this->assertNull($fresh->paused_reason, "Domain #{$id} paused_reason should be null");
            $this->assertNotNull($fresh->next_check_at, "Domain #{$id} next_check_at should be set");
            $this->assertTrue(PlanLimitService::isDomainEligibleForMonitoring($fresh), "Domain #{$id} should be eligible");
        }

        // Check unselected domains are all PAUSED with plan_limit
        foreach ($unselectedIds as $id) {
            $fresh = Domain::find($id);
            $this->assertFalse((bool) $fresh->is_active, "Domain #{$id} should be paused");
            $this->assertEquals('plan_limit', $fresh->paused_reason, "Domain #{$id} paused_reason should be plan_limit");
            $this->assertNull($fresh->next_check_at, "Domain #{$id} next_check_at should be null");
            $this->assertFalse(PlanLimitService::isDomainEligibleForMonitoring($fresh), "Domain #{$id} should not be eligible");
        }
    }

    public function test_subscribe_api_with_keep_domain_ids_enforces_selection_on_free_downgrade(): void
    {
        [$workspace, $user] = $this->createWorkspaceWithOwner('teams');

        $freePlan = Plan::firstOrCreate(
            ['code' => 'free'],
            ['name' => 'Free', 'max_domains' => 10, 'is_active' => true]
        );
        $freePrice = PlanPrice::firstOrCreate(
            ['plan_id' => $freePlan->id, 'interval' => 'monthly'],
            ['price' => 0, 'currency' => 'USD', 'is_active' => true]
        );

        // Create 11 domains
        $domains = [];
        for ($i = 1; $i <= 11; $i++) {
            $domains[] = Domain::create([
                'workspace_id' => $workspace->id,
                'name' => "api-domain-{$i}.com",
                'url' => "https://api-domain-{$i}.com",
                'is_active' => true,
                'paused_reason' => null,
            ]);
        }

        // User chooses to keep domains 2 to 11 (10 domains), omitting domain 1
        $keepIds = array_map(fn($d) => $d->id, array_slice($domains, 1, 10));
        $omittedId = $domains[0]->id;

        $response = $this->actingAs($user)->postJson('/api/billing/subscribe', [
            'plan_code' => 'free',
            'interval' => 'monthly',
            'keep_domain_ids' => $keepIds,
        ]);

        $response->assertStatus(200);

        // Domain 1 must be paused with plan_limit
        $omittedDomain = Domain::find($omittedId);
        $this->assertFalse((bool) $omittedDomain->is_active);
        $this->assertEquals('plan_limit', $omittedDomain->paused_reason);

        // Domains 2..11 must be active
        foreach ($keepIds as $id) {
            $keptDomain = Domain::find($id);
            $this->assertTrue((bool) $keptDomain->is_active);
            $this->assertNull($keptDomain->paused_reason);
        }
    }
}
