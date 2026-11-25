<?php

namespace App\Services\Billing;

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\Workspace;
use App\Services\Payments\PaymentGatewayFactory;
use Illuminate\Support\Facades\Log;

class SubscriptionService
{
    public function __construct(
        private readonly SubscriptionStatusService $subscriptionStatusService,
        private readonly WorkspaceBillingService $workspaceBillingService,
    ) {}

    public function cancelNonTerminalForWorkspace(Workspace $workspace, bool $atCycleEnd = false): void
    {
        Subscription::query()
            ->where('workspace_id', $workspace->id)
            ->whereIn('status', SubscriptionStatus::nonTerminalStatuses())
            ->get()
            ->each(function (Subscription $subscription) use ($atCycleEnd): void {
                if ($subscription->gateway_subscription_id) {
                    try {
                        $gateway = PaymentGatewayFactory::make($subscription->gateway);
                        if ($atCycleEnd) {
                            $gateway->cancelSubscriptionAtCycleEnd($subscription->gateway_subscription_id);
                        } else {
                            $gateway->cancelSubscription($subscription->gateway_subscription_id);
                        }
                    } catch (\Throwable $exception) {
                        Log::warning('Gateway subscription cancellation failed', [
                            'subscription_id' => $subscription->id,
                            'gateway_subscription_id' => $subscription->gateway_subscription_id,
                            'at_cycle_end' => $atCycleEnd,
                            'error' => $exception->getMessage(),
                        ]);
                    }
                }

                $this->subscriptionStatusService->markCancelled($subscription, $atCycleEnd);
            });

        $active = $workspace->activeSubscription()->first();
        $this->workspaceBillingService->syncFromSubscription($workspace, $active);
    }

    public function downgradeToFree(Workspace $workspace): void
    {
        $this->workspaceBillingService->downgradeTrialToFree($workspace);
    }
}
