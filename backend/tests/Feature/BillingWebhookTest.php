<?php

namespace Tests\Feature;

use App\Models\PaymentTransaction;
use App\Models\Plan;
use App\Models\PlanPrice;
use App\Models\Subscription;
use App\Models\Workspace;
use App\Services\Payments\RazorpayService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BillingWebhookTest extends TestCase
{
    use RefreshDatabase;

    public function test_webhook_rejects_invalid_signature(): void
    {
        $gateway = \Mockery::mock(RazorpayService::class);
        $gateway->shouldReceive('extractSignature')->once()->andReturn('bad-signature');
        $gateway->shouldReceive('verifyWebhook')->once()->andReturn(false);
        $gateway->shouldNotReceive('parseEvent');
        app()->instance(RazorpayService::class, $gateway);

        $response = $this->postJson('/api/billing/webhook', [
            'event' => 'subscription.activated',
        ]);

        $response->assertStatus(403);
    }

    public function test_webhook_returns_ignored_for_unknown_subscription(): void
    {
        $this->bindGatewayEvent([
            'type' => 'subscription.activated',
            'subscription_id' => 'sub_unknown',
            'current_period_start' => Carbon::now(),
            'current_period_end' => Carbon::now()->addMonth(),
            'payment_id' => null,
            'amount' => null,
            'currency' => 'INR',
        ]);

        $response = $this->postJson('/api/billing/webhook', [
            'event' => 'subscription.activated',
        ]);

        $response->assertOk()->assertJson(['status' => 'ignored']);
    }

    public function test_subscription_activated_stays_trialing_when_trial_not_ended(): void
    {
        $subscription = $this->createSubscription([
            'status' => 'trialing',
            'trial_ends_at' => Carbon::now()->addDays(2),
        ]);

        $this->bindGatewayEvent([
            'type' => 'subscription.activated',
            'subscription_id' => $subscription->gateway_subscription_id,
            'current_period_start' => Carbon::now(),
            'current_period_end' => Carbon::now()->addMonth(),
            'payment_id' => null,
            'amount' => null,
            'currency' => 'INR',
        ]);

        $this->postJson('/api/billing/webhook', ['event' => 'subscription.activated'])
            ->assertOk()
            ->assertJson(['status' => 'ok']);

        $subscription->refresh();

        $this->assertSame('trialing', $subscription->status);
        $this->assertNotNull($subscription->trial_ends_at);
        $this->assertNotNull($subscription->current_period_start);
        $this->assertNotNull($subscription->current_period_end);
    }

    public function test_subscription_activated_becomes_active_after_trial_end(): void
    {
        $subscription = $this->createSubscription([
            'status' => 'trialing',
            'trial_ends_at' => Carbon::now()->subMinute(),
        ]);

        $this->bindGatewayEvent([
            'type' => 'subscription.activated',
            'subscription_id' => $subscription->gateway_subscription_id,
            'current_period_start' => Carbon::now(),
            'current_period_end' => Carbon::now()->addMonth(),
            'payment_id' => null,
            'amount' => null,
            'currency' => 'INR',
        ]);

        $this->postJson('/api/billing/webhook', ['event' => 'subscription.activated'])
            ->assertOk()
            ->assertJson(['status' => 'ok']);

        $subscription->refresh();

        $this->assertSame('active', $subscription->status);
        $this->assertNull($subscription->trial_ends_at);
    }

    public function test_subscription_charged_marks_active_and_records_payment(): void
    {
        $subscription = $this->createSubscription([
            'status' => 'trialing',
            'trial_ends_at' => Carbon::now()->subDay(),
        ]);

        $this->bindGatewayEvent([
            'type' => 'subscription.charged',
            'subscription_id' => $subscription->gateway_subscription_id,
            'current_period_start' => Carbon::now(),
            'current_period_end' => Carbon::now()->addMonth(),
            'payment_id' => 'pay_001',
            'amount' => 90000,
            'currency' => 'INR',
        ]);

        $this->postJson('/api/billing/webhook', ['event' => 'subscription.charged'])
            ->assertOk()
            ->assertJson(['status' => 'ok']);

        $subscription->refresh();

        $this->assertSame('active', $subscription->status);
        $this->assertNull($subscription->trial_ends_at);

        $this->assertDatabaseHas('payment_transactions', [
            'workspace_id' => $subscription->workspace_id,
            'subscription_id' => $subscription->id,
            'gateway_payment_id' => 'pay_001',
            'status' => 'captured',
            'amount' => 90000,
            'currency' => 'INR',
        ]);
    }

    public function test_payment_failed_marks_past_due_and_records_failed_transaction(): void
    {
        $subscription = $this->createSubscription([
            'status' => 'active',
            'trial_ends_at' => null,
        ]);

        $this->bindGatewayEvent([
            'type' => 'payment.failed',
            'subscription_id' => $subscription->gateway_subscription_id,
            'current_period_start' => null,
            'current_period_end' => null,
            'payment_id' => 'pay_fail_001',
            'amount' => 90000,
            'currency' => 'INR',
        ]);

        $this->postJson('/api/billing/webhook', ['event' => 'payment.failed'])
            ->assertOk()
            ->assertJson(['status' => 'ok']);

        $subscription->refresh();
        $this->assertSame('pending', $subscription->status);

        $transaction = PaymentTransaction::where('gateway_payment_id', 'pay_fail_001')->first();
        $this->assertNotNull($transaction);
        $this->assertSame('failed', $transaction->status);
        $this->assertNull($transaction->paid_at);
    }

    public function test_subscription_cancelled_sets_cancelled_status_and_timestamp(): void
    {
        $subscription = $this->createSubscription([
            'status' => 'active',
            'trial_ends_at' => null,
        ]);

        $this->bindGatewayEvent([
            'type' => 'subscription.cancelled',
            'subscription_id' => $subscription->gateway_subscription_id,
            'current_period_start' => null,
            'current_period_end' => null,
            'payment_id' => null,
            'amount' => null,
            'currency' => 'INR',
        ]);

        $this->postJson('/api/billing/webhook', ['event' => 'subscription.cancelled'])
            ->assertOk()
            ->assertJson(['status' => 'ok']);

        $subscription->refresh();
        $this->assertSame('cancelled', $subscription->status);
        $this->assertNotNull($subscription->cancelled_at);
    }

    public function test_subscription_halted_marks_past_due(): void
    {
        $subscription = $this->createSubscription([
            'status' => 'active',
            'trial_ends_at' => null,
        ]);

        $this->bindGatewayEvent([
            'type' => 'subscription.halted',
            'subscription_id' => $subscription->gateway_subscription_id,
            'current_period_start' => null,
            'current_period_end' => null,
            'payment_id' => null,
            'amount' => null,
            'currency' => 'INR',
        ]);

        $this->postJson('/api/billing/webhook', ['event' => 'subscription.halted'])
            ->assertOk()
            ->assertJson(['status' => 'ok']);

        $subscription->refresh();
        $this->assertSame('halted', $subscription->status);
    }

    public function test_duplicate_subscription_charged_webhook_is_idempotent(): void
    {
        $subscription = $this->createSubscription([
            'status' => 'pending',
            'failed_payment_attempts' => 2,
            'trial_ends_at' => null,
        ]);

        $this->bindGatewayEvent([
            'type' => 'subscription.charged',
            'subscription_id' => $subscription->gateway_subscription_id,
            'current_period_start' => Carbon::now(),
            'current_period_end' => Carbon::now()->addMonth(),
            'payment_id' => 'pay_idempotent_001',
            'amount' => 90000,
            'currency' => 'INR',
        ]);

        $this->postJson('/api/billing/webhook', ['event' => 'subscription.charged'])
            ->assertOk()
            ->assertJson(['status' => 'ok']);

        $this->bindGatewayEvent([
            'type' => 'subscription.charged',
            'subscription_id' => $subscription->gateway_subscription_id,
            'current_period_start' => Carbon::now(),
            'current_period_end' => Carbon::now()->addMonth(),
            'payment_id' => 'pay_idempotent_001',
            'amount' => 90000,
            'currency' => 'INR',
        ]);

        $this->postJson('/api/billing/webhook', ['event' => 'subscription.charged'])
            ->assertOk()
            ->assertJson(['status' => 'ok']);

        $subscription->refresh();

        $this->assertSame('active', $subscription->status);
        $this->assertSame(0, (int) $subscription->failed_payment_attempts);

        $this->assertSame(1, PaymentTransaction::where('gateway_payment_id', 'pay_idempotent_001')->count());
    }

    public function test_payment_authorized_and_captured_do_not_create_transactions(): void
    {
        $subscription = $this->createSubscription([
            'status' => 'trialing',
            'trial_ends_at' => Carbon::now()->addDays(3),
        ]);

        $this->bindGatewayEvent([
            'type' => 'payment.authorized',
            'subscription_id' => $subscription->gateway_subscription_id,
            'current_period_start' => null,
            'current_period_end' => null,
            'payment_id' => 'pay_auth_1',
            'amount' => 50,
            'currency' => 'INR',
        ]);

        $this->postJson('/api/billing/webhook', ['event' => 'payment.authorized'])
            ->assertOk();

        $this->bindGatewayEvent([
            'type' => 'payment.captured',
            'subscription_id' => $subscription->gateway_subscription_id,
            'current_period_start' => null,
            'current_period_end' => null,
            'payment_id' => 'pay_cap_1',
            'amount' => 50,
            'currency' => 'INR',
        ]);

        $this->postJson('/api/billing/webhook', ['event' => 'payment.captured'])
            ->assertOk();

        $this->assertDatabaseCount('payment_transactions', 0);
    }

    private function bindGatewayEvent(array $parsedEvent): void
    {
        $gateway = \Mockery::mock(RazorpayService::class);
        $gateway->shouldReceive('extractSignature')->once()->andReturn('sig');
        $gateway->shouldReceive('verifyWebhook')->once()->andReturn(true);
        $gateway->shouldReceive('parseEvent')->once()->andReturn($parsedEvent);
        app()->instance(RazorpayService::class, $gateway);
    }

    private function createSubscription(array $overrides = []): Subscription
    {
        $workspace = Workspace::create([
            'name' => 'Test Workspace',
            'slug' => 'test-workspace-' . uniqid(),
            'primary_contact_email' => 'owner@example.com',
            'timezone' => 'UTC',
        ]);

        $plan = Plan::create([
            'name' => 'Starter',
            'code' => 'starter-' . uniqid(),
            'max_domains' => 10,
            'max_team_members' => 5,
            'is_active' => true,
        ]);

        $price = PlanPrice::create([
            'plan_id' => $plan->id,
            'interval' => 'monthly',
            'price' => 900,
            'currency' => 'USD',
            'is_active' => true,
        ]);

        return Subscription::create(array_merge([
            'workspace_id' => $workspace->id,
            'plan_price_id' => $price->id,
            'gateway' => 'razorpay',
            'gateway_subscription_id' => 'sub_' . uniqid(),
            'status' => 'trialing',
            'trial_ends_at' => Carbon::now()->addDays(14),
            'current_period_start' => null,
            'current_period_end' => null,
        ], $overrides));
    }
}
