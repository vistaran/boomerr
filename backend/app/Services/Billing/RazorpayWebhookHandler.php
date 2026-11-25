<?php

namespace App\Services\Billing;

use App\Events\BillingStatusUpdated;
use App\Enums\SubscriptionStatus;
use App\Models\BillingEvent;
use App\Models\PaymentTransaction;
use App\Models\PlanGatewayMapping;
use App\Models\PlanPrice;
use App\Models\Subscription;
use App\Models\Workspace;
use App\Services\Payments\PaymentGatewayFactory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class RazorpayWebhookHandler
{
    public function __construct(
        private readonly SubscriptionStatusService $subscriptionStatusService,
        private readonly TrialService $trialService,
        private readonly WorkspaceBillingService $workspaceBillingService,
    ) {}

    public function handle(Request $request): array
    {
        $verificationGateway = PaymentGatewayFactory::make();
        $signature = $verificationGateway->extractSignature($request);

        if (!$verificationGateway->verifyWebhook($request->getContent(), $signature)) {
            return ['status' => 'invalid_signature', 'code' => 403];
        }

        $payload = $request->all();
        $event = $verificationGateway->parseEvent($payload);
        $eventId = (string) ($request->header('X-Razorpay-Event-Id') ?: sha1($request->getContent()));

        $eventRecord = BillingEvent::query()->firstOrCreate(
            ['razorpay_event_id' => $eventId],
            [
                'event_type' => (string) ($event['type'] ?? 'unknown'),
                'gateway_subscription_id' => $event['subscription_id'] ?? null,
                'gateway_payment_id' => $event['payment_id'] ?? null,
                'payload' => $payload,
                'status' => 'processing',
            ]
        );

        if (!$eventRecord->wasRecentlyCreated && $eventRecord->status === 'processed') {
            return ['status' => 'duplicate', 'code' => 200];
        }

        try {
            $broadcastPayload = null;

            DB::transaction(function () use ($event, $eventRecord, &$broadcastPayload): void {
                $subscription = $this->resolveSubscription($event);

                if (!$subscription) {
                    $eventRecord->forceFill([
                        'status' => 'ignored',
                        'processed_at' => now(),
                    ])->save();

                    return;
                }

                $lockedSubscription = Subscription::query()
                    ->whereKey($subscription->id)
                    ->lockForUpdate()
                    ->first();

                if (!$lockedSubscription) {
                    $eventRecord->forceFill([
                        'status' => 'ignored',
                        'processed_at' => now(),
                    ])->save();

                    return;
                }

                $this->processEvent($lockedSubscription, $event);
                // If the gateway provides a customer id in the event, persist
                // it on the subscription so future subscription creations can
                // reuse the customer's saved payment methods.
                $incomingCustomerId = $event['customer_id'] ?? null;
                if ($incomingCustomerId && empty($lockedSubscription->gateway_customer_id)) {
                    $lockedSubscription->update(['gateway_customer_id' => $incomingCustomerId]);
                }
                $this->syncWorkspaceFromSubscription($lockedSubscription);

                $updatedSubscription = $lockedSubscription->fresh(['planPrice.plan']);
                if ($updatedSubscription) {
                    $broadcastPayload = [
                        'workspace_id' => (int) $updatedSubscription->workspace_id,
                        'subscription_id' => (int) $updatedSubscription->id,
                        'status' => (string) $updatedSubscription->status,
                        'plan_code' => $updatedSubscription->planPrice?->plan?->code,
                        'event_type' => $event['type'] ?? null,
                    ];
                }

                $eventRecord->forceFill([
                    'status' => 'processed',
                    'processed_at' => now(),
                ])->save();
            });

            if (is_array($broadcastPayload)) {
                event(new BillingStatusUpdated(
                    workspaceId: (int) $broadcastPayload['workspace_id'],
                    subscriptionId: (int) $broadcastPayload['subscription_id'],
                    status: (string) $broadcastPayload['status'],
                    planCode: $broadcastPayload['plan_code'] ?? null,
                    eventType: $broadcastPayload['event_type'] ?? null,
                ));
            }

            return ['status' => 'ok', 'code' => 200];
        } catch (\Throwable $exception) {
            Log::error('Razorpay webhook handling failed', [
                'event_type' => $event['type'] ?? null,
                'subscription_id' => $event['subscription_id'] ?? null,
                'error' => $exception->getMessage(),
            ]);

            $eventRecord->forceFill([
                'status' => 'failed',
                'error_message' => $exception->getMessage(),
                'processed_at' => now(),
            ])->save();

            return ['status' => 'failed', 'code' => 500];
        }
    }

    private function resolveSubscription(array $event): ?Subscription
    {
        if (!empty($event['subscription_id'])) {
            $subscription = Subscription::query()
                ->where('gateway_subscription_id', $event['subscription_id'])
                ->latest('id')
                ->first();

            if ($subscription) {
                return $subscription;
            }
        }

        if (!empty($event['customer_id'])) {
            return Subscription::query()
                ->where('gateway_customer_id', $event['customer_id'])
                ->latest('id')
                ->first();
        }

        return null;
    }

    private function processEvent(Subscription $subscription, array $event): void
    {
        $type = (string) ($event['type'] ?? '');

        switch ($type) {
            case 'subscription.authenticated':
            case 'subscription.activated':
                $newStatus = $this->subscriptionStatusService->markActivated($subscription, [
                    'current_period_start' => $event['current_period_start'] ?? null,
                    'current_period_end' => $event['current_period_end'] ?? null,
                    'force_active' => !empty($event['payment_id']),
                ], false);

                if (in_array($newStatus, [SubscriptionStatus::TRIALING, SubscriptionStatus::ACTIVE], true)) {
                    $workspace = Workspace::query()->find($subscription->workspace_id);
                    if ($workspace) {
                        $consumedCount = $this->trialService->consumeTrialForWorkspaceOwnersIfEligible($workspace);

                        if ($consumedCount > 0) {
                            Log::info('trial_consumed_after_authentication', [
                                'workspace_id' => $workspace->id,
                                'subscription_id' => $subscription->id,
                                'owners_updated' => $consumedCount,
                            ]);
                        }
                    }
                }

                if (in_array($newStatus, [SubscriptionStatus::TRIALING, SubscriptionStatus::ACTIVE], true)) {
                    $this->cancelOtherNonTerminalSubscriptions($subscription);
                }

                if ($newStatus === SubscriptionStatus::ACTIVE) {
                    $this->executeDeferredSwitchIfRequested($subscription);
                }
                break;

            case 'subscription.charged':
            case 'invoice.paid':
                $isNewSuccessfulCharge = !empty($event['payment_id']);

                if (!empty($event['payment_id'])) {
                    $transaction = PaymentTransaction::firstOrCreate(
                        [
                            'workspace_id' => $subscription->workspace_id,
                            'subscription_id' => $subscription->id,
                            'gateway_payment_id' => $event['payment_id'],
                        ],
                        [
                            'gateway' => $subscription->gateway ?: config('billing.default_gateway', 'razorpay'),
                            'amount' => $event['amount'] ?? null,
                            'currency' => $event['currency'] ?? $subscription->currency ?? $subscription->planPrice?->currency ?? config('billing.default_currency', 'USD'),
                            'status' => 'captured',
                            'description' => 'Subscription renewal',
                            'paid_at' => now(),
                        ]
                    );

                    if (!$transaction->wasRecentlyCreated) {
                        $isNewSuccessfulCharge = false;
                    }
                    // Persist gateway customer id when payment contains one so
                    if (!empty($event['customer_id']) && empty($subscription->gateway_customer_id)) {
                        try {
                            $subscription->update(['gateway_customer_id' => $event['customer_id']]);
                        } catch (\Throwable $e) {
                            Log::warning('Failed to persist gateway_customer_id after successful payment', ['error' => $e->getMessage()]);
                        }
                    }
                }

                $newStatus = $this->subscriptionStatusService->markActivated($subscription, [
                    'current_period_start' => $event['current_period_start'] ?? null,
                    'current_period_end' => $event['current_period_end'] ?? null,
                    'force_active' => true,
                ], $isNewSuccessfulCharge);

                if (in_array($newStatus, [SubscriptionStatus::TRIALING, SubscriptionStatus::ACTIVE], true)) {
                    $this->cancelOtherNonTerminalSubscriptions($subscription);
                }

                if ($newStatus === SubscriptionStatus::ACTIVE) {
                    $this->executeDeferredSwitchIfRequested($subscription);
                }

                // Send Discord alert only for the first successful charge in this workspace
                if ($isNewSuccessfulCharge) {
                    try {
                        $previousSuccessfulPayments = PaymentTransaction::query()
                            ->where('workspace_id', $subscription->workspace_id)
                            ->where('status', 'captured')
                            ->whereHas('subscription.planPrice.plan', function ($query) {
                                $query->where('code', '!=', 'free');
                            })
                            ->exists();

                        if (!$previousSuccessfulPayments) {
                            app(\App\Services\DiscordAlertService::class)->notifySubscriptionCharged(
                                $subscription,
                                true,
                                [
                                    'amount' => $event['amount'] ?? null,
                                    'currency' => $event['currency'] ?? null,
                                ]
                            );
                        }
                    } catch (\Throwable $e) {
                        Log::warning('Discord subscription charge notification failed: ' . $e->getMessage());
                    }
                }
                break;

            case 'payment.failed':
            case 'invoice.expired':
            case 'subscription.halted':
                $shouldIncrementAttempt = true;

                if (!empty($event['payment_id'])) {
                    $failedTransaction = PaymentTransaction::firstOrCreate(
                        [
                            'workspace_id' => $subscription->workspace_id,
                            'subscription_id' => $subscription->id,
                            'gateway_payment_id' => $event['payment_id'],
                        ],
                        [
                            'gateway' => $subscription->gateway ?: config('billing.default_gateway', 'razorpay'),
                            'amount' => $event['amount'] ?? null,
                            'currency' => $event['currency'] ?? $subscription->currency ?? $subscription->planPrice?->currency ?? config('billing.default_currency', 'USD'),
                            'status' => 'failed',
                            'description' => 'Payment failed',
                            'paid_at' => null,
                        ]
                    );

                    if (!$failedTransaction->wasRecentlyCreated) {
                        $shouldIncrementAttempt = false;
                    }
                    // Also persist gateway customer id from failed payment events
                    // if available; this can still be useful for retry flows.
                    if (!empty($event['customer_id']) && empty($subscription->gateway_customer_id)) {
                        try {
                            $subscription->update(['gateway_customer_id' => $event['customer_id']]);
                        } catch (\Throwable $e) {
                            Log::warning('Failed to persist gateway_customer_id after failed payment', ['error' => $e->getMessage()]);
                        }
                    }
                }

                if ($shouldIncrementAttempt) {
                    $newStatus = $this->subscriptionStatusService->markFailedAttempt($subscription, true);
                    if ($newStatus === SubscriptionStatus::CANCELLED) {
                        $this->downgradeWorkspaceToFreePlan($subscription->workspace_id);
                    }

                    // Send Discord alert for payment failure
                    try {
                        app(\App\Services\DiscordAlertService::class)->notifySubscriptionError(
                            $subscription,
                            $type,
                            [
                                'amount' => $event['amount'] ?? null,
                                'currency' => $event['currency'] ?? null,
                            ],
                            $event['error_description'] ?? null
                        );
                    } catch (\Throwable $e) {
                        Log::warning('Discord subscription error notification failed: ' . $e->getMessage());
                    }
                }
                break;

            case 'subscription.paused':
                $this->subscriptionStatusService->markPaused($subscription);
                break;

            case 'subscription.cancelled':
            case 'subscription.completed':
            case 'subscription.expired':
            case 'invoice.cancelled':
                $this->subscriptionStatusService->markCancelled($subscription, false);
                break;

            case 'payment.authorized':
            case 'payment.captured':
            case 'subscription.pending':
            default:
                // no-op
                break;
        }
    }

    private function cancelOtherNonTerminalSubscriptions(Subscription $subscription): void
    {
        Subscription::query()
            ->where('workspace_id', $subscription->workspace_id)
            ->where('id', '!=', $subscription->id)
            ->whereIn('status', SubscriptionStatus::nonTerminalStatuses())
            ->orderByDesc('id')
            ->get()
            ->each(function (Subscription $otherSubscription): void {
                if ($otherSubscription->gateway_subscription_id) {
                    try {
                        $otherGateway = PaymentGatewayFactory::make($otherSubscription->gateway);
                        $otherGateway->cancelSubscription($otherSubscription->gateway_subscription_id);
                    } catch (\Throwable $cancelException) {
                        Log::warning('Failed to cancel previous gateway subscription after activation', [
                            'subscription_id' => $otherSubscription->id,
                            'gateway_subscription_id' => $otherSubscription->gateway_subscription_id,
                            'error' => $cancelException->getMessage(),
                        ]);
                    }
                }

                $this->subscriptionStatusService->markCancelled($otherSubscription, false);
            });
    }

    private function executeDeferredSwitchIfRequested(Subscription $subscription): void
    {
        if (!$subscription->switch_requested_plan_price_id) {
            return;
        }

        DB::transaction(function () use ($subscription): void {
            $lockedSubscription = Subscription::query()
                ->whereKey($subscription->id)
                ->lockForUpdate()
                ->first();

            if (!$lockedSubscription || !$lockedSubscription->switch_requested_plan_price_id) {
                return;
            }

            $existingNextSubscription = Subscription::query()
                ->where('workspace_id', $lockedSubscription->workspace_id)
                ->where('id', '!=', $lockedSubscription->id)
                ->where('plan_price_id', $lockedSubscription->switch_requested_plan_price_id)
                ->whereIn('status', SubscriptionStatus::nonTerminalStatuses())
                ->first();

            if ($existingNextSubscription) {
                $lockedSubscription->update([
                    'switch_requested_plan_price_id' => null,
                    'switch_requested_interval' => null,
                    'switch_requested_at' => null,
                ]);

                return;
            }

            $gatewayName = (string) ($lockedSubscription->gateway ?: config('billing.default_gateway'));
            $gateway = PaymentGatewayFactory::make($gatewayName);

            if ($lockedSubscription->gateway_subscription_id) {
                $gateway->cancelSubscriptionAtCycleEnd($lockedSubscription->gateway_subscription_id);
            }

            $requestedPlanPrice = PlanPrice::query()->find($lockedSubscription->switch_requested_plan_price_id);
            if (!$requestedPlanPrice) {
                return;
            }

            $mapping = PlanGatewayMapping::query()
                ->where('plan_price_id', $requestedPlanPrice->id)
                ->where('gateway', $gatewayName)
                ->first();

            if (!$mapping) {
                return;
            }

            $requestedInterval = $lockedSubscription->switch_requested_interval ?: $requestedPlanPrice->interval;

            $gatewaySubscription = $gateway->createSubscription([
                'plan_id' => $mapping->gateway_plan_id,
                'trial_days' => 0,
                'start_at' => null,
                'interval' => $requestedInterval,
            ]);

            Subscription::create([
                'workspace_id' => $lockedSubscription->workspace_id,
                'plan_price_id' => $requestedPlanPrice->id,
                'gateway' => $gatewayName,
                'gateway_subscription_id' => $gatewaySubscription['id'],
                'gateway_payment_url' => $gatewaySubscription['short_url'] ?? null,
                'currency' => strtoupper((string) ($requestedPlanPrice->currency ?: config('billing.default_currency', 'USD'))),
                'unit_amount' => (int) $requestedPlanPrice->price,
                'status' => SubscriptionStatus::PENDING,
            ]);

            $lockedSubscription->update([
                'switch_requested_plan_price_id' => null,
                'switch_requested_interval' => null,
                'switch_requested_at' => null,
            ]);
        });
    }

    private function downgradeWorkspaceToFreePlan(int $workspaceId): void
    {
        $workspace = Workspace::query()->find($workspaceId);
        if (!$workspace) {
            return;
        }

        $this->workspaceBillingService->downgradeTrialToFree($workspace);
    }

    private function syncWorkspaceFromSubscription(Subscription $subscription): void
    {
        $workspace = Workspace::query()->find($subscription->workspace_id);
        if (!$workspace) {
            return;
        }

        if ($this->shouldSkipWorkspaceSyncForTerminatedSubscription($workspace, $subscription)) {
            Log::info('Skipping workspace sync for terminated subscription webhook', [
                'workspace_id' => $workspace->id,
                'subscription_id' => $subscription->id,
                'subscription_status' => $subscription->status,
                'workspace_billing_status' => $workspace->billing_status,
            ]);

            return;
        }

        $this->workspaceBillingService->syncFromSubscription($workspace, $subscription->fresh());
    }

    private function shouldSkipWorkspaceSyncForTerminatedSubscription(Workspace $workspace, Subscription $subscription): bool
    {
        $workspaceIsFree = strtolower((string) $workspace->billing_status) === 'free';
        $workspaceHasNoGatewaySubscription = empty($workspace->razorpay_subscription_id);
        $subscriptionIsTerminal = in_array($subscription->status, SubscriptionStatus::terminalStatuses(), true);

        // Preserve explicit FREE downgrade state. Late webhook deliveries from
        // old terminated subscriptions must not overwrite workspace billing.
        return $workspaceIsFree
            && $workspaceHasNoGatewaySubscription
            && $subscriptionIsTerminal;
    }
}
