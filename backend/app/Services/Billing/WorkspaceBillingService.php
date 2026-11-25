<?php

namespace App\Services\Billing;

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\Workspace;
use App\Services\Payments\PaymentGatewayFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WorkspaceBillingService
{
    public function __construct(
        private readonly WorkspaceSubscriptionService $workspaceSubscriptionService,
        private readonly SubscriptionStatusService $subscriptionStatusService,
    ) {}

    public function syncFromSubscription(Workspace $workspace, ?Subscription $subscription, ?array $keepDomainIds = null): void
    {
        $workspace->forceFill([
            'plan_id' => $subscription?->planPrice?->plan_id,
            'billing_status' => $this->mapBillingStatus($subscription?->status),
            'razorpay_subscription_id' => $subscription?->gateway_subscription_id,
            'trial_started_at' => $subscription?->trial_ends_at ? $subscription->created_at : null,
            'trial_ends_at' => $subscription?->trial_ends_at,
            'billing_cycle_ends_at' => $subscription?->current_period_end,
            'cancel_at_cycle_end' => $subscription?->status === SubscriptionStatus::CANCEL_AT_CYCLE_END,
            'payment_fail_count' => (int) ($subscription?->failed_payment_attempts ?? 0),
            'grace_period_ends_at' => $this->computeGracePeriod($subscription),
        ])->save();

        if ($subscription) {
            $subscription->loadMissing('planPrice.plan');
            $workspace->setRelation('activeSubscription', $subscription);
        } else {
            $workspace->unsetRelation('activeSubscription');
        }

        $this->syncDomainsMonitoringInterval($workspace, $subscription, $keepDomainIds);
    }

    public function syncDomainsMonitoringInterval(Workspace $workspace, ?Subscription $subscription = null, ?array $keepDomainIds = null): void
    {
        if ($subscription) {
            $subscription->loadMissing('planPrice.plan');
            $workspace->setRelation('activeSubscription', $subscription);
        }

        \App\Services\PlanLimitService::enforceWorkspaceDomainLimits($workspace, $keepDomainIds);

        $planInterval = \App\Services\PlanLimitService::getMonitorIntervalMinutes($workspace);

        $workspace->domains()->each(function ($domain) use ($planInterval) {
            $needsIntervalUpdate = ($domain->check_interval >= 5 && $planInterval < 5) || $domain->check_interval > $planInterval;
            if ($needsIntervalUpdate) {
                $domain->check_interval = $planInterval;
            }

            // Immediately reschedule existing active domains so checks resume on the new plan interval right away
            if ($domain->is_active) {
                $domain->next_check_at = now();
            } else {
                $domain->next_check_at = null;
            }

            $domain->save();
        });
    }

    public function downgradeTrialToFree(Workspace $workspace, ?array $keepDomainIds = null): Subscription
    {
        $cancelGatewaySubscriptionIds = [];

        $freeSubscription = DB::transaction(function () use ($workspace, &$cancelGatewaySubscriptionIds, $keepDomainIds): Subscription {
            $lockedWorkspace = Workspace::query()
                ->whereKey($workspace->id)
                ->lockForUpdate()
                ->firstOrFail();

            $billingStatus = strtolower((string) $lockedWorkspace->billing_status);
            $shouldCancelGatewaySubscription = $billingStatus === SubscriptionStatus::TRIALING;

            $nonTerminalSubscriptions = Subscription::query()
                ->where('workspace_id', $lockedWorkspace->id)
                ->whereIn('status', SubscriptionStatus::nonTerminalStatuses())
                ->lockForUpdate()
                ->orderByDesc('id')
                ->get();

            if ($shouldCancelGatewaySubscription) {
                $cancelGatewaySubscriptionIds = $nonTerminalSubscriptions
                    ->pluck('gateway_subscription_id')
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();
            }

            foreach ($nonTerminalSubscriptions as $subscription) {
                if ($subscription->status !== SubscriptionStatus::CANCELLED) {
                    $this->subscriptionStatusService->markCancelled($subscription, false);
                }

                if (
                    $subscription->switch_requested_plan_price_id
                    || $subscription->switch_requested_interval
                    || $subscription->switch_requested_at
                ) {
                    $subscription->forceFill([
                        'switch_requested_plan_price_id' => null,
                        'switch_requested_interval' => null,
                        'switch_requested_at' => null,
                    ])->save();
                }
            }

            $freeSubscription = $this->workspaceSubscriptionService->ensureDefaultFreeSubscription($lockedWorkspace);

            if (!$freeSubscription) {
                throw new \RuntimeException('Free plan price is missing; unable to downgrade workspace.');
            }

            $lockedWorkspace->forceFill([
                'plan_id' => $freeSubscription->planPrice?->plan_id,
                'billing_status' => 'free',
                'razorpay_subscription_id' => null,
                'trial_ends_at' => now(),
                'billing_cycle_ends_at' => null,
                'cancel_at_cycle_end' => false,
                'payment_fail_count' => 0,
                'grace_period_ends_at' => null,
                'subscription_creation_lock' => false,
            ])->save();

            $this->syncDomainsMonitoringInterval($lockedWorkspace, null, $keepDomainIds);

            Log::info('trial_terminated', [
                'workspace_id' => $lockedWorkspace->id,
                'reason' => 'trial_downgraded_to_free',
            ]);

            Log::info('workspace_downgraded', [
                'workspace_id' => $lockedWorkspace->id,
                'from_billing_status' => $billingStatus,
                'to_billing_status' => 'free',
                'free_subscription_id' => $freeSubscription->id,
            ]);

            return $freeSubscription->fresh(['planPrice.plan']);
        });

        if (!empty($cancelGatewaySubscriptionIds)) {
            foreach ($cancelGatewaySubscriptionIds as $gatewaySubscriptionId) {
                try {
                    PaymentGatewayFactory::make()->cancelSubscription((string) $gatewaySubscriptionId);

                    Log::info('subscription_cancelled', [
                        'workspace_id' => $workspace->id,
                        'gateway_subscription_id' => $gatewaySubscriptionId,
                        'cancel_at_cycle_end' => false,
                        'trigger' => 'trial_to_free_downgrade',
                    ]);
                } catch (\Throwable $exception) {
                    Log::warning('subscription_cancelled_failed', [
                        'workspace_id' => $workspace->id,
                        'gateway_subscription_id' => $gatewaySubscriptionId,
                        'error' => $exception->getMessage(),
                    ]);
                }
            }
        }

        return $freeSubscription;
    }

    private function mapBillingStatus(?string $subscriptionStatus): string
    {
        return match ($subscriptionStatus) {
            SubscriptionStatus::TRIALING => 'trialing',
            SubscriptionStatus::ACTIVE => 'active',
            SubscriptionStatus::PENDING,
            SubscriptionStatus::FAILED_RETRYING,
            SubscriptionStatus::HALTED,
            SubscriptionStatus::PAST_DUE => 'payment_failed',
            SubscriptionStatus::CANCEL_AT_CYCLE_END => 'cancel_at_cycle_end',
            SubscriptionStatus::CANCELLED,
            SubscriptionStatus::EXPIRED,
            SubscriptionStatus::COMPLETED => 'inactive',
            default => 'free',
        };
    }

    private function computeGracePeriod(?Subscription $subscription)
    {
        if (!$subscription) {
            return null;
        }

        if (!in_array($subscription->status, [
            SubscriptionStatus::PENDING,
            SubscriptionStatus::FAILED_RETRYING,
            SubscriptionStatus::HALTED,
            SubscriptionStatus::PAST_DUE,
        ], true)) {
            return null;
        }

        return now()->addDays(3);
    }
}
