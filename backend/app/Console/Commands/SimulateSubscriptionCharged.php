<?php

namespace App\Console\Commands;

use App\Models\PaymentTransaction;
use App\Models\Subscription;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SimulateSubscriptionCharged extends Command
{
    protected $signature = 'billing:simulate-charged
                            {subscription_id? : The gateway_subscription_id (e.g. sub_SMMH3QvWKW0nC7). Defaults to the latest trialing subscription.}';

    protected $description = '[DEV ONLY] Simulate a subscription.charged webhook to test post-trial billing logic.';

    public function handle(): int
    {
        $gatewaySubId = $this->argument('subscription_id');

        $subscription = $gatewaySubId
            ? Subscription::where('gateway_subscription_id', $gatewaySubId)->first()
            : Subscription::where('status', 'trialing')->latest()->first();

        if (!$subscription) {
            $this->error('No matching subscription found.');
            return 1;
        }

        $this->info("Found subscription: {$subscription->gateway_subscription_id}");
        $this->info("  workspace_id : {$subscription->workspace_id}");
        $this->info("  plan         : " . ($subscription->planPrice?->plan?->name ?? 'unknown'));
        $this->info("  current status: {$subscription->status}");
        $this->info("  trial_ends_at : " . ($subscription->trial_ends_at ?? 'null'));

        if (!$this->confirm('Simulate subscription.charged for this subscription?', true)) {
            $this->line('Aborted.');
            return 0;
        }

        $now            = Carbon::now();
        $periodStart    = $now;
        $periodEnd      = $now->copy()->addMonth();
        $fakePaymentId  = 'pay_SIMULATED_' . strtoupper(substr(md5(uniqid()), 0, 10));
        $amount         = $subscription->planPrice?->price ?? 0;

        // Mirror exactly what handleWebhook does for subscription.charged
        $subscription->update([
            'status'               => 'active',
            'trial_ends_at'        => null,
            'current_period_start' => $periodStart,
            'current_period_end'   => $periodEnd,
        ]);

        if ($amount > 0) {
            PaymentTransaction::create([
                'workspace_id'       => $subscription->workspace_id,
                'subscription_id'    => $subscription->id,
                'gateway'            => $subscription->gateway ?? 'razorpay',
                'gateway_payment_id' => $fakePaymentId,
                'amount'             => $amount,
                'currency'           => 'INR',
                'status'             => 'captured',
                'description'        => 'Subscription renewal (simulated)',
                'paid_at'            => $now,
            ]);
        }

        $this->newLine();
        $this->info('✓ Subscription status  → active');
        $this->info('✓ trial_ends_at        → null');
        $this->info('✓ current_period_start → ' . $periodStart->toDateTimeString());
        $this->info('✓ current_period_end   → ' . $periodEnd->toDateTimeString());

        if ($amount > 0) {
            $this->info("✓ PaymentTransaction recorded ({$fakePaymentId}, ₹" . ($amount / 100) . ')');
        } else {
            $this->warn('  No transaction recorded (plan price is 0).');
        }

        return 0;
    }
}
