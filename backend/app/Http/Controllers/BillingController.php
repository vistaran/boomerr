<?php

namespace App\Http\Controllers;

use App\Enums\SubscriptionStatus;
use App\Models\PaymentTransaction;
use App\Models\Plan;
use App\Models\PlanGatewayMapping;
use App\Models\PlanPrice;
use App\Models\Subscription;
use App\Models\Workspace;
use App\Services\Billing\WorkspaceSubscriptionService;
use App\Models\User;
use App\Services\Billing\RazorpayWebhookHandler;
use App\Services\Billing\TrialService;
use App\Services\Billing\WorkspaceBillingService;
use App\Services\Billing\SubscriptionStatusService;
use App\Services\Payments\PaymentGatewayFactory;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BillingController extends Controller
{
    public function __construct(
        private readonly SubscriptionStatusService $subscriptionStatusService,
        private readonly WorkspaceSubscriptionService $workspaceSubscriptionService,
        private readonly TrialService $trialService,
        private readonly RazorpayWebhookHandler $razorpayWebhookHandler,
        private readonly WorkspaceBillingService $workspaceBillingService,
    ) {
    }

    public function plans(Request $request)
    {
        try {
            $user = Auth::user();

            if (!($user instanceof User) || !$user->currentWorkspace()) {
                return response()->json(['message' => !$user ? 'Unauthenticated' : 'User is not part of a workspace'], !$user ? 401 : 403);
            }

            $workspace = $user->currentWorkspace();
            $gatewayName = config('billing.default_gateway');
            $requestedCurrency = $this->resolveRequestedCurrency($request);

            $plans = Plan::with([
                'prices' => function ($q) use ($gatewayName) {
                    $q->where('is_active', true)
                        ->with([
                            'gatewayMappings' => function ($mappingQuery) use ($gatewayName) {
                                $mappingQuery->where('gateway', $gatewayName);
                            }
                        ]);
                }
            ])->where('is_active', true)->get();

            $resolvedCurrency = $this->resolveDisplayCurrency($plans, $requestedCurrency, $gatewayName);

            $currentSubscription = $this->workspaceSubscriptionService->ensureDefaultFreeSubscription($workspace);
            $gatewaySubscriptionStatus = null;
            $paymentUpdateUrl = null;
            $status = $currentSubscription?->status;
            $currentPlanPriceId = $currentSubscription?->plan_price_id;
            $currentPlanCode = $currentSubscription?->planPrice?->plan?->code;
            $trialEndsAt = $currentSubscription?->trial_ends_at;
            $failedPaymentAttempts = $currentSubscription?->failed_payment_attempts ?? 0;

            if ($currentSubscription?->gateway_subscription_id) {
                try {
                    $gateway = PaymentGatewayFactory::make($currentSubscription->gateway);
                    $gatewayDetails = $gateway->getSubscriptionDetails($currentSubscription->gateway_subscription_id);

                    $gatewaySubscriptionStatus = strtolower((string) ($gatewayDetails['status'] ?? ''));
                    $paymentUpdateUrl = $gatewayDetails['short_url'] ?? null;

                    $syncedStatus = $this->subscriptionStatusService->syncFromGateway($currentSubscription, $gatewaySubscriptionStatus, [
                        'current_period_start' => isset($gatewayDetails['current_start']) && $gatewayDetails['current_start'] ? Carbon::createFromTimestamp($gatewayDetails['current_start']) : null,
                        'current_period_end' => isset($gatewayDetails['current_end']) && $gatewayDetails['current_end'] ? Carbon::createFromTimestamp($gatewayDetails['current_end']) : null,
                    ]);
                    if ($syncedStatus !== null) {
                        $status = $syncedStatus;
                        $currentSubscription->refresh();
                        $currentSubscription->loadMissing('planPrice.plan');
                        $currentPlanPriceId = $currentSubscription->plan_price_id;
                        $currentPlanCode = $currentSubscription->planPrice?->plan?->code;
                        $trialEndsAt = $currentSubscription->trial_ends_at;
                        $failedPaymentAttempts = $currentSubscription->failed_payment_attempts ?? $failedPaymentAttempts;

                        if (in_array($syncedStatus, [SubscriptionStatus::TRIALING, SubscriptionStatus::ACTIVE], true)) {
                            $this->trialService->consumeTrialForWorkspaceOwnersIfEligible($workspace);
                            $this->workspaceBillingService->syncFromSubscription($workspace, $currentSubscription);
                            Subscription::query()
                                ->where('workspace_id', $workspace->id)
                                ->where('id', '!=', $currentSubscription->id)
                                ->whereIn('status', SubscriptionStatus::nonTerminalStatuses())
                                ->get()
                                ->each(function (Subscription $other) {
                                    $this->subscriptionStatusService->markCancelled($other, false);
                                });
                        }

                        if (in_array($syncedStatus, SubscriptionStatus::terminalStatuses(), true)) {
                            $currentPlanPriceId = null;
                            $currentPlanCode = null;
                            $trialEndsAt = null;
                            $paymentUpdateUrl = null;
                        }
                    }
                } catch (\Throwable $exception) {
                    Log::warning('Unable to fetch gateway subscription details in plans()', [
                        'subscription_id' => $currentSubscription->id,
                        'gateway_subscription_id' => $currentSubscription->gateway_subscription_id,
                        'error' => $exception->getMessage(),
                    ]);
                }
            }

            $enrichedPlans = $plans->map(function ($plan) use ($resolvedCurrency, $gatewayName) {
                $planConfig = config("billing.plans.{$plan->code}");
                $filteredPrices = $this->buildDisplayPrices($plan, $resolvedCurrency, $gatewayName);

                return [
                    'id' => $plan->id,
                    'name' => $plan->name,
                    'code' => $plan->code,
                    'prices' => $filteredPrices,
                    'details' => [
                        'features' => $planConfig['features'] ?? [],
                        'limits' => $planConfig['limits'] ?? [],
                        'integrations' => $planConfig['integrations'] ?? [],
                    ],
                    'available_currencies' => collect($plan->prices)
                        ->filter(fn(PlanPrice $price) => $this->isSelectablePlanPrice($price, $gatewayName))
                        ->pluck('currency')
                        ->map(fn(?string $currency) => strtoupper((string) $currency))
                        ->filter()
                        ->unique()
                        ->values(),
                ];
            });

            $currentPlanDetails = null;
            if ($currentPlanCode && $currentSubscription?->planPrice?->plan) {
                $currentPlanCode = $currentSubscription->planPrice->plan->code;
                $planConfig = config("billing.plans.{$currentPlanCode}");
                $currentPlanDetails = [
                    'features' => $planConfig['features'] ?? [],
                    'limits' => $planConfig['limits'] ?? [],
                    'integrations' => $planConfig['integrations'] ?? [],
                ];
            }

            $workspaceOwnerIds = $workspace->users()
                ->wherePivot('role', User::ROLE_OWNER)
                ->pluck('users.id')
                ->all();

            $hasConsumedTrial = !empty($workspaceOwnerIds)
                && User::query()
                    ->whereIn('id', $workspaceOwnerIds)
                    ->whereNotNull('trial_consumed_at')
                    ->exists();

            $hasCapturedPaidTransaction = PaymentTransaction::query()
                ->where('workspace_id', $workspace->id)
                ->where('status', 'captured')
                ->whereHas('subscription.planPrice.plan', function ($query) {
                    $query->where('code', '!=', 'free');
                })
                ->exists();

            $hasActivatedPaidSubscription = $workspace->subscriptions()
                ->whereHas('planPrice.plan', function ($query) {
                    $query->where('code', '!=', 'free');
                })
                ->whereIn('status', [
                    SubscriptionStatus::AUTHENTICATED,
                    SubscriptionStatus::TRIALING,
                    SubscriptionStatus::ACTIVE,
                    SubscriptionStatus::PAST_DUE,
                    SubscriptionStatus::FAILED_RETRYING,
                    SubscriptionStatus::HALTED,
                    SubscriptionStatus::CANCEL_AT_CYCLE_END,
                    SubscriptionStatus::COMPLETED,
                    SubscriptionStatus::EXPIRED,
                ])
                ->exists();

            $hasTriedPaidPlan = $hasConsumedTrial
                || $hasCapturedPaidTransaction
                || $hasActivatedPaidSubscription;

            return response()->json([
                'plans' => $enrichedPlans,
                'requested_currency' => $requestedCurrency,
                'resolved_currency' => $resolvedCurrency,
                'current_subscription_currency' => $currentSubscription?->currency
                    ?: strtoupper((string) ($currentSubscription?->planPrice?->currency ?: $resolvedCurrency)),
                'supported_currencies' => array_values((array) config('billing.supported_currencies', ['USD', 'INR'])),
                'current_plan_price_id' => $currentPlanPriceId,
                'current_plan_code' => $currentPlanCode,
                'current_plan_details' => $currentPlanDetails,
                'trial_ends_at' => $trialEndsAt,
                'status' => $status,
                'gateway_status' => $gatewaySubscriptionStatus,
                'gateway_subscription_details' => $gatewayDetails ?? null,
                'payment_update_url' => $paymentUpdateUrl,
                'is_past_due' => in_array($status, [SubscriptionStatus::PAST_DUE, SubscriptionStatus::PENDING, SubscriptionStatus::HALTED], true),
                'failed_payment_attempts' => $failedPaymentAttempts,
                'has_tried_paid_plan' => $hasTriedPaidPlan,
            ]);
        } catch (\Throwable $e) {
            Log::error('Error in plans(): ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'An unexpected error occurred.'
            ], 500);
        }
    }

    public function subscribe(Request $request)
    {
        try {
            $request->validate([
                'plan_code' => 'required|string',
                'interval' => 'required|in:monthly,yearly',
                'switch_mode' => 'nullable|in:immediate,cycle_end',
                'currency' => 'nullable|string|size:3',
                'keep_domain_ids' => 'nullable|array',
                'keep_domain_ids.*' => 'integer',
            ]);

            $keepDomainIds = $request->input('keep_domain_ids');

            $user = Auth::user();

            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $workspace = $user->currentWorkspace();

            if (!$workspace) {
                return response()->json([
                    'message' => 'No active workspace selected.'
                ], 400);
            }

            if ($ownerAuthorizationError = $this->authorizePlanManagement($user, $workspace->id)) {
                return $ownerAuthorizationError;
            }

            $requestedCurrency = $this->resolveRequestedCurrency($request);
            $plan = Plan::where('code', $request->plan_code)->first();

            if (!$plan) {
                return response()->json([
                    'message' => 'Selected plan was not found.'
                ], 404);
            }

            if ($plan->isCustom() || !$plan->isSelfServe()) {
                return response()->json([
                    'message' => 'Enterprise and Custom plans cannot be activated via self-serve. Please contact sales.'
                ], 403);
            }

            $priceQuery = PlanPrice::where('plan_id', $plan->id)
                ->where('is_active', true);

            $price = $this->resolvePlanPriceForCurrency($priceQuery, $request->interval, $requestedCurrency);

            if (!$price) {
                $fallbackFreePrice = (clone $priceQuery)
                    ->where('price', 0)
                    ->orderBy('id')
                    ->first();

                if ($fallbackFreePrice) {
                    $price = $fallbackFreePrice;
                } else {
                    return response()->json([
                        'message' => 'Selected billing interval is not available for this plan.'
                    ], 422);
                }
            }

            $gatewayName = config('billing.default_gateway');
            $gateway = PaymentGatewayFactory::make($gatewayName);

            if ((int) $price->price > 0) {
                $hasGatewayMapping = PlanGatewayMapping::query()
                    ->where('plan_price_id', $price->id)
                    ->where('gateway', $gatewayName)
                    ->exists();

                if (!$hasGatewayMapping) {
                    return response()->json([
                        'message' => "The {$requestedCurrency} billing option is not configured for this plan yet. Please choose another currency or complete the gateway setup first.",
                    ], 422);
                }
            }

            DB::beginTransaction();

            try {
                $workspace = Workspace::query()
                    ->whereKey($workspace->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $subscriptionCurrency = strtoupper((string) ($price->currency ?: $requestedCurrency));

                // Check for existing lifecycle subscription on paying plans
                if ((int) $price->price > 0) {
                    $existingLifecycleSubscription = Subscription::where('workspace_id', $workspace->id)
                        ->whereIn('status', SubscriptionStatus::paymentLifecycleStatuses())
                        ->latest()
                        ->first();

                    if ($existingLifecycleSubscription) {
                        $isSamePlan =
                            (int) $existingLifecycleSubscription->plan_price_id === (int) $price->id;

                        if ($isSamePlan) {
                            DB::commit();

                            return response()->json([
                                'subscription_id' => $existingLifecycleSubscription->gateway_subscription_id,
                                'public_key' => $gateway->getPublicKey(),
                                'payment_url' => $existingLifecycleSubscription->gateway_payment_url,
                                'reuse' => true,
                                'message' => 'Payment authentication already pending. Please complete payment.',
                            ]);
                        }

                        // Different plan selected → cancel old lifecycle subscription
                        if ($existingLifecycleSubscription->gateway_subscription_id) {
                            try {
                                $oldGateway = PaymentGatewayFactory::make($existingLifecycleSubscription->gateway);
                                $oldGateway->cancelSubscription($existingLifecycleSubscription->gateway_subscription_id);
                            } catch (\Throwable $e) {
                                Log::warning('Failed cancelling old lifecycle subscription during plan change', [
                                    'subscription_id' => $existingLifecycleSubscription->id,
                                    'error' => $e->getMessage(),
                                ]);
                            }
                        }

                        $this->subscriptionStatusService->markCancelled($existingLifecycleSubscription, false);
                    }
                }

                $currentSubscription = $workspace->activeSubscription;

                $this->cancelDuplicateNonTerminalSubscriptions($workspace->id, $currentSubscription?->id);

                if ($currentSubscription?->gateway_subscription_id) {
                    try {
                        $currentGateway = PaymentGatewayFactory::make($currentSubscription->gateway);
                        $gatewayDetails = $currentGateway->getSubscriptionDetails($currentSubscription->gateway_subscription_id);
                        $gatewayStatus = strtolower((string) ($gatewayDetails['status'] ?? ''));
                        $this->subscriptionStatusService->syncFromGateway($currentSubscription, $gatewayStatus);

                        if (in_array($currentSubscription->status, SubscriptionStatus::terminalStatuses(), true)) {
                            $currentSubscription = null;
                        }
                    } catch (\Throwable $gatewayStatusException) {
                        Log::warning('Could not sync current subscription status before subscribe', [
                            'subscription_id' => $currentSubscription->id,
                            'gateway_subscription_id' => $currentSubscription->gateway_subscription_id,
                            'error' => $gatewayStatusException->getMessage(),
                        ]);
                    }
                }

                $blockingSubscription = Subscription::query()
                    ->where('workspace_id', $workspace->id)
                    ->whereIn('status', SubscriptionStatus::paymentLifecycleStatuses())
                    ->latest('id')
                    ->first();

                if ($blockingSubscription) {
                    $activeFreeSubscription = Subscription::query()
                        ->where('workspace_id', $workspace->id)
                        ->where('status', SubscriptionStatus::ACTIVE)
                        ->whereHas('planPrice', function ($query) {
                            $query->where('price', 0);
                        })
                        ->latest('id')
                        ->first();

                    $canAutoClearBlockingSubscription =
                        $activeFreeSubscription
                        && $activeFreeSubscription->id !== $blockingSubscription->id;

                    if ($canAutoClearBlockingSubscription) {
                        if ($blockingSubscription->gateway_subscription_id) {
                            try {
                                $blockingGateway = PaymentGatewayFactory::make($blockingSubscription->gateway);
                                $blockingGateway->cancelSubscription($blockingSubscription->gateway_subscription_id);
                            } catch (\Throwable $cancelException) {
                                Log::warning('Failed to auto-cancel blocking lifecycle subscription during resubscribe', [
                                    'subscription_id' => $blockingSubscription->id,
                                    'gateway_subscription_id' => $blockingSubscription->gateway_subscription_id,
                                    'error' => $cancelException->getMessage(),
                                ]);
                            }
                        }

                        $this->subscriptionStatusService->markCancelled($blockingSubscription, false);

                        $blockingSubscription = Subscription::query()
                            ->where('workspace_id', $workspace->id)
                            ->whereIn('status', SubscriptionStatus::paymentLifecycleStatuses())
                            ->latest('id')
                            ->first();
                    }
                }

                if ($blockingSubscription) {
                    DB::rollBack();

                    return response()->json([
                        'message' => 'Previous payment is pending or failed. Please retry or cancel before changing plan.'
                    ], 422);
                }

                $isCurrentActivePaidSubscription =
                    $currentSubscription
                    && $currentSubscription->status === SubscriptionStatus::ACTIVE
                    && (int) ($currentSubscription->planPrice?->price ?? 0) > 0;

                $switchMode = strtolower((string) ($request->input('switch_mode') ?: 'cycle_end'));

                if ($isCurrentActivePaidSubscription && (int) $price->price > 0) {
                    if ($switchMode === 'immediate') {
                        // Instead of cancelling the user's current active paid subscription
                        // immediately (which would remove access if payment is not
                        // completed), mark the current subscription with a switch
                        // request and create a pending gateway subscription. The
                        // pending subscription can be cancelled independently if the
                        // user dismisses the checkout, preserving the user's active
                        // subscription until the new subscription is successfully
                        // activated via webhook.
                        $currentSubscription->update([
                            'switch_requested_plan_price_id' => $price->id,
                            'switch_requested_interval' => $request->interval,
                            'switch_requested_at' => now(),
                        ]);

                        $mapping = PlanGatewayMapping::where('plan_price_id', $price->id)
                            ->where('gateway', $gatewayName)
                            ->firstOrFail();

                        // Attempt to reuse an existing gateway customer_id to avoid
                        // prompting for card details every time. Prefer a customer
                        // id already stored on any workspace subscription.
                        $existingCustomerId = Subscription::query()
                            ->where('workspace_id', $workspace->id)
                            ->whereNotNull('gateway_customer_id')
                            ->latest('id')
                            ->value('gateway_customer_id');
                        $gatewaySubscription = $gateway->createSubscription([
                            'plan_id' => $mapping->gateway_plan_id,
                            'trial_days' => 0,
                            'start_at' => null,
                            'interval' => $request->interval,
                            'customer_id' => $existingCustomerId ?: null,
                        ]);

                        $pendingSubscription = Subscription::create([
                            'workspace_id' => $workspace->id,
                            'plan_price_id' => $price->id,
                            'gateway' => $gatewayName,
                            'gateway_subscription_id' => $gatewaySubscription['id'],
                            'gateway_customer_id' => $existingCustomerId ?: null,
                            'gateway_payment_url' => $gatewaySubscription['short_url'] ?? null,
                            'currency' => $subscriptionCurrency,
                            'unit_amount' => (int) $price->price,
                            'status' => SubscriptionStatus::PENDING,
                            'trial_ends_at' => null,
                        ]);

                        $this->workspaceBillingService->syncFromSubscription($workspace, $pendingSubscription, $keepDomainIds);

                        DB::commit();

                        return response()->json([
                            'subscription_id' => $gatewaySubscription['id'],
                            'public_key' => $gateway->getPublicKey(),
                            'is_trial_activated' => false,
                            'plan_name' => $plan->name,
                            'trial_ends_at' => null,
                            'switch_mode' => 'immediate',
                            'message' => 'Immediate plan switch initiated. Complete authentication to activate the new plan.',
                        ]);
                    }

                    // Deferred switch avoids creating overlapping in-cycle subscriptions.
                    $currentSubscription->update([
                        'switch_requested_plan_price_id' => $price->id,
                        'switch_requested_interval' => $request->interval,
                        'switch_requested_at' => now(),
                    ]);

                    DB::commit();

                    return response()->json([
                        'subscription_id' => null,
                        'public_key' => null,
                        'message' => 'Plan switch scheduled for next billing cycle.',
                        'is_trial_activated' => false,
                        'plan_name' => $plan->name,
                        'trial_ends_at' => $currentSubscription->current_period_end?->toIso8601String(),
                        'switch_mode' => 'cycle_end',
                    ]);
                }

                $isSwitchingDuringActiveTrial =
                    $currentSubscription
                    && $currentSubscription->status === SubscriptionStatus::TRIALING
                    && $currentSubscription->trial_ends_at
                    && $currentSubscription->trial_ends_at->isFuture();

                $activeTrialEndsAt = $isSwitchingDuringActiveTrial
                    ? $currentSubscription->trial_ends_at->copy()
                    : null;

                if ((int) $price->price === 0) {
                    $isTrialToFreeDowngrade =
                        strtolower((string) $workspace->billing_status) === SubscriptionStatus::TRIALING
                        || $currentSubscription?->status === SubscriptionStatus::TRIALING;

                    if ($isTrialToFreeDowngrade) {
                        $this->workspaceBillingService->downgradeTrialToFree($workspace, $keepDomainIds);
                    } else {
                        if ($currentSubscription?->gateway_subscription_id) {
                            try {
                                $currentGateway = PaymentGatewayFactory::make($currentSubscription->gateway);
                                $currentGateway->cancelSubscription($currentSubscription->gateway_subscription_id);
                            } catch (\Throwable $gatewayException) {
                                Log::warning('Failed to cancel gateway subscription while switching to free plan', [
                                    'subscription_id' => $currentSubscription->id,
                                    'gateway_subscription_id' => $currentSubscription->gateway_subscription_id,
                                    'error' => $gatewayException->getMessage(),
                                ]);
                            }
                        }

                        $workspace->subscriptions()
                            ->whereIn('status', SubscriptionStatus::nonTerminalStatuses())
                            ->update([
                                'status' => SubscriptionStatus::CANCELLED,
                                'cancelled_at' => now(),
                                'switch_requested_plan_price_id' => null,
                                'switch_requested_interval' => null,
                                'switch_requested_at' => null,
                            ]);

                        $freeSubscription = Subscription::create([
                            'workspace_id' => $workspace->id,
                            'plan_price_id' => $price->id,
                            'gateway' => null,
                            'gateway_subscription_id' => null,
                            'currency' => strtoupper((string) ($price->currency ?: config('billing.default_currency', 'USD'))),
                            'unit_amount' => (int) $price->price,
                            'status' => SubscriptionStatus::ACTIVE,
                        ]);

                        $this->workspaceBillingService->syncFromSubscription($workspace, $freeSubscription, $keepDomainIds);
                    }

                    DB::commit();

                    return response()->json([
                        'subscription_id' => null,
                        'public_key' => null,
                        'message' => 'Free plan activated.',
                        'is_trial_activated' => false,
                        'plan_name' => $plan->name,
                        'trial_ends_at' => null,
                    ]);
                }

                if ($currentSubscription) {
                    $isSamePlanPrice = $currentSubscription->plan_price_id == $price->id;
                    $canResubscribeSamePlan = $isSamePlanPrice && $currentSubscription->status === SubscriptionStatus::HALTED;
                    $isCurrentActiveFreeSubscription =
                        $currentSubscription->status === SubscriptionStatus::ACTIVE
                        && (int) ($currentSubscription->planPrice?->price ?? 0) === 0;

                    if ($isSamePlanPrice && !$canResubscribeSamePlan) {
                        DB::rollBack();

                        return response()->json([
                            'message' => 'You are already on this plan.'
                        ], 400);
                    }

                    if ($isSwitchingDuringActiveTrial) {
                        // Trial switch happens immediately to preserve remaining trial window.
                        if ($currentSubscription->gateway_subscription_id) {
                            try {
                                $currentGateway = PaymentGatewayFactory::make($currentSubscription->gateway);
                                $currentGateway->cancelSubscription($currentSubscription->gateway_subscription_id);
                            } catch (\Throwable $gatewayException) {
                                Log::warning('Failed to cancel trial gateway subscription while creating a new one', [
                                    'subscription_id' => $currentSubscription->id,
                                    'gateway_subscription_id' => $currentSubscription->gateway_subscription_id,
                                    'error' => $gatewayException->getMessage(),
                                ]);
                            }
                        }

                        $this->subscriptionStatusService->markCancelled($currentSubscription, false);
                    } elseif ($isCurrentActiveFreeSubscription) {
                        // Keep free plan active until paid subscription is actually activated
                        // via webhook. This prevents showing the paid plan when payment
                        // authorization/charge has not succeeded yet.
                    } elseif (in_array($currentSubscription->status, SubscriptionStatus::nonTerminalStatuses(), true)) {
                        if ($currentSubscription->gateway_subscription_id) {
                            try {
                                $currentGateway = PaymentGatewayFactory::make($currentSubscription->gateway);
                                $currentGateway->cancelSubscription($currentSubscription->gateway_subscription_id);
                            } catch (\Throwable $gatewayException) {
                                Log::warning('Failed to cancel previous gateway subscription while creating a new one', [
                                    'subscription_id' => $currentSubscription->id,
                                    'gateway_subscription_id' => $currentSubscription->gateway_subscription_id,
                                    'error' => $gatewayException->getMessage(),
                                ]);
                            }
                        }

                        $this->subscriptionStatusService->markCancelled($currentSubscription, false);
                    }
                }

                $trialEndsAt = $activeTrialEndsAt;
                if (!$trialEndsAt) {
                    // Trial is only marked consumed after successful gateway
                    // authentication via webhook. Here we only preview eligibility.
                    $trialEndsAt = $this->trialService->trialEndsAtIfEligible($user, 14);
                }

                $startAt = $trialEndsAt?->timestamp;
                $hoursRemaining = $trialEndsAt ? max(0, now()->diffInHours($trialEndsAt, false)) : 0;
                $trialDays = $trialEndsAt ? (int) ceil($hoursRemaining / 24) : 0;

                $mapping = PlanGatewayMapping::where('plan_price_id', $price->id)
                    ->where('gateway', $gatewayName)
                    ->firstOrFail();

                // Try to reuse an existing gateway customer id so saved cards
                // on the gateway can be reused and users aren't asked for
                // card details on every upgrade/downgrade.
                $existingCustomerId = Subscription::query()
                    ->where('workspace_id', $workspace->id)
                    ->whereNotNull('gateway_customer_id')
                    ->latest('id')
                    ->value('gateway_customer_id');

                $gatewaySubscription = $gateway->createSubscription([
                    'plan_id' => $mapping->gateway_plan_id,
                    'trial_days' => $trialDays,
                    'start_at' => $startAt,
                    'interval' => $request->interval,
                    'customer_id' => $existingCustomerId ?: null,
                ]);

                $pendingSubscription = Subscription::create([
                    'workspace_id' => $workspace->id,
                    'plan_price_id' => $price->id,
                    'gateway' => $gatewayName,
                    'gateway_subscription_id' => $gatewaySubscription['id'],
                    'gateway_customer_id' => $existingCustomerId ?: null,
                    'gateway_payment_url' => $gatewaySubscription['short_url'] ?? null,
                    'currency' => $subscriptionCurrency,
                    'unit_amount' => (int) $price->price,
                    'status' => SubscriptionStatus::PENDING,
                    'trial_ends_at' => $trialEndsAt,
                ]);

                if ($trialDays > 0) {
                    try {
                        app(\App\Services\DiscordAlertService::class)->notifyTrialStarted($pendingSubscription);
                    } catch (\Throwable $alertException) {
                        Log::warning('Discord trial start notification failed: ' . $alertException->getMessage());
                    }
                }

                $this->workspaceBillingService->syncFromSubscription($workspace, $pendingSubscription);

                DB::commit();

                return response()->json([
                    'subscription_id' => $gatewaySubscription['id'],
                    'public_key' => $gateway->getPublicKey(),
                    'is_trial_activated' => $trialDays > 0,
                    'plan_name' => $plan->name,
                    'trial_ends_at' => $trialEndsAt?->toIso8601String(),
                ]);
            } catch (\Exception $e) {
                DB::rollBack();

                Log::error("Subscription error: " . $e->getMessage() . " >> " . $e->getLine());

                return response()->json([
                    'message' => 'Unable to process subscription.'
                ], 500);
            }
        } catch (\Throwable $e) {
            Log::error('Error in subscribe(): ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'An unexpected error occurred.'
            ], 500);
        }
    }

    public function handleWebhook(Request $request)
    {
        $result = $this->razorpayWebhookHandler->handle($request);

        if (($result['code'] ?? 200) === 403) {
            abort(403);
        }

        return response()->json(['status' => $result['status'] ?? 'ok'], $result['code'] ?? 200);
    }

    public function cancel(Request $request)
    {
        $user = Auth::user();
        if (!($user instanceof User)) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $workspace = $user->currentWorkspace();

        if (!$workspace) {
            return response()->json(['message' => 'No active workspace.'], 400);
        }

        if ($ownerAuthorizationError = $this->authorizePlanManagement($user, $workspace->id)) {
            return $ownerAuthorizationError;
        }

        // Allow cancelling a specific gateway subscription when provided by frontend
        $gatewaySubscriptionId = $request->input('gateway_subscription_id') ?: $request->input('subscription_id');

        if ($gatewaySubscriptionId) {
            $target = Subscription::query()
                ->where('gateway_subscription_id', $gatewaySubscriptionId)
                ->where('workspace_id', $workspace->id)
                ->latest('id')
                ->first();

            if ($target) {
                $subscription = $target;
            } else {
                $subscription = $this->resolveBillingActionSubscription($workspace);
            }
        } else {
            $subscription = $this->resolveBillingActionSubscription($workspace);
        }

        if (!$subscription) {
            return response()->json(['message' => 'No active subscription found.'], 404);
        }

        $gateway = PaymentGatewayFactory::make($subscription->gateway);

        $keepDomainIds = $request->input('keep_domain_ids');

        if ($subscription->status === SubscriptionStatus::TRIALING) {
            $this->workspaceBillingService->downgradeTrialToFree($workspace, $keepDomainIds);

            $this->notifyAdminsOfCancellation($workspace);
            return response()->json(['message' => 'Trial cancelled successfully.']);
        }

        if (in_array($subscription->status, SubscriptionStatus::paymentLifecycleStatuses(), true)) {
            if ($subscription->gateway_subscription_id) {
                $gateway->cancelSubscription($subscription->gateway_subscription_id);
            }

            $this->subscriptionStatusService->markCancelled($subscription, false);
            $this->workspaceBillingService->syncFromSubscription($workspace, $subscription->fresh());

            $this->notifyAdminsOfCancellation($workspace);
            return response()->json(['message' => 'Pending subscription cancelled successfully.']);
        }

        if ($subscription->gateway_subscription_id) {
            $gateway->cancelSubscriptionAtCycleEnd($subscription->gateway_subscription_id);
        }

        $this->subscriptionStatusService->markCancelled($subscription, true);
        $this->workspaceBillingService->syncFromSubscription($workspace, $subscription->fresh());

        $this->notifyAdminsOfCancellation($workspace);
        return response()->json([
            'message' => 'Subscription will be cancelled at the end of the current billing period.',
            'current_period_end' => $subscription->current_period_end,
        ]);
    }

    private function notifyAdminsOfCancellation(\App\Models\Workspace $workspace): void
    {
        \App\Models\Admin::all()->each(function ($admin) use ($workspace) {
            $admin->notify(new \App\Notifications\AdminSubscriptionEventNotification(
                "Workspace '{$workspace->name}' has cancelled their subscription."
            ));
        });
    }

    public function transactionHistory(Request $request)
    {
        $user = Auth::user();
        if (!($user instanceof User)) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $workspace = $user->currentWorkspace();

        if (!$workspace) {
            return response()->json(['message' => 'No active workspace.'], 400);
        }

        $transactions = PaymentTransaction::where('workspace_id', $workspace->id)
            ->with(['subscription.planPrice.plan'])
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($transactions);
    }

    public function retryPayment(Request $request)
    {
        $user = Auth::user();
        if (!($user instanceof User)) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $workspace = $user->currentWorkspace();

        if (!$workspace) {
            return response()->json(['message' => 'No active workspace.'], 400);
        }

        if ($ownerAuthorizationError = $this->authorizePlanManagement($user, $workspace->id)) {
            return $ownerAuthorizationError;
        }

        $subscription = $this->resolveBillingActionSubscription($workspace);

        if (!$subscription) {
            return response()->json(['message' => 'No active subscription found.'], 404);
        }

        $gateway = PaymentGatewayFactory::make($subscription->gateway);

        try {
            $paymentUrl = null;

            if (in_array($subscription->status, SubscriptionStatus::terminalStatuses(), true)) {
                return response()->json([
                    'retry_allowed' => false,
                    'payment_url' => null,
                    'message' => 'This subscription is in a terminal state. Please subscribe again or change plan.',
                ], 422);
            }

            if ($subscription->gateway_subscription_id) {
                $gatewayDetails = $gateway->getSubscriptionDetails($subscription->gateway_subscription_id);
                $gatewayStatus = strtolower((string) ($gatewayDetails['status'] ?? ''));

                $syncedStatus = $this->subscriptionStatusService->syncFromGateway($subscription, $gatewayStatus, [
                    'current_period_start' => isset($gatewayDetails['current_start']) ? Carbon::createFromTimestamp($gatewayDetails['current_start']) : $subscription->current_period_start,
                    'current_period_end' => isset($gatewayDetails['current_end']) ? Carbon::createFromTimestamp($gatewayDetails['current_end']) : $subscription->current_period_end,
                ]);

                if (in_array($syncedStatus, SubscriptionStatus::terminalStatuses(), true)) {
                    return response()->json([
                        'retry_allowed' => false,
                        'payment_url' => null,
                        'message' => 'This subscription is in a terminal state. Please subscribe again or change plan.',
                    ], 422);
                }

                if ($gatewayStatus === 'paused') {
                    $resumeResponse = $gateway->resumeSubscription($subscription->gateway_subscription_id);
                    $paymentUrl = $resumeResponse['short_url'] ?? ($gatewayDetails['short_url'] ?? null);
                }

                if ($gatewayStatus === 'pending') {
                    $paymentUrl = $gatewayDetails['short_url'] ?? null;
                }

                if ($gatewayStatus === 'active') {
                    return response()->json([
                        'retry_allowed' => false,
                        'payment_url' => null,
                        'message' => 'Subscription is already active.',
                    ]);
                }
            }

            if (!in_array($subscription->status, SubscriptionStatus::retryableStatuses(), true)) {
                return response()->json([
                    'retry_allowed' => false,
                    'payment_url' => null,
                    'message' => 'Subscription is not in retryable status. Please subscribe again or change plan.',
                ], 422);
            }

            if ($subscription->hasMaxFailedAttempts()) {
                return response()->json([
                    'retry_allowed' => false,
                    'payment_url' => null,
                    'message' => 'Maximum payment retry attempts exceeded. Please subscribe again or change plan.',
                ], 422);
            }

            return response()->json([
                'retry_allowed' => true,
                'payment_url' => $paymentUrl,
                'message' => $paymentUrl
                    ? 'Payment retry initiated. Complete payment using the provided link.'
                    : 'Payment retry initiated. We will update subscription status after gateway confirmation.',
            ]);
        } catch (\Exception $e) {
            Log::error('Payment retry failed: ' . $e->getMessage());

            return response()->json([
                'retry_allowed' => false,
                'payment_url' => null,
                'message' => 'Failed to retry payment. ' . $e->getMessage()
            ], 500);
        }
    }

    private function cancelDuplicateNonTerminalSubscriptions(int $workspaceId, ?int $keepSubscriptionId = null): void
    {
        $nonTerminalSubscriptions = Subscription::query()
            ->where('workspace_id', $workspaceId)
            ->whereIn('status', SubscriptionStatus::nonTerminalStatuses())
            ->orderByDesc('id')
            ->get();

        $activeFreeSubscription = $nonTerminalSubscriptions->first(function (Subscription $subscription) {
            return $subscription->status === SubscriptionStatus::ACTIVE
                && (int) ($subscription->planPrice?->price ?? 0) === 0;
        });

        $paymentLifecycleSubscription = $nonTerminalSubscriptions->first(function (Subscription $subscription) {
            return in_array($subscription->status, SubscriptionStatus::paymentLifecycleStatuses(), true);
        });

        if (
            $nonTerminalSubscriptions->count() === 2
            && $activeFreeSubscription
            && $paymentLifecycleSubscription
        ) {
            // Transitional state: keep free active until lifecycle subscription
            // is activated or terminal via webhook flow.
            return;
        }

        if ($nonTerminalSubscriptions->count() <= 1) {
            return;
        }

        Log::warning('Multiple non-terminal subscriptions found. Cancelling older subscriptions.', [
            'workspace_id' => $workspaceId,
            'subscription_ids' => $nonTerminalSubscriptions->pluck('id')->all(),
            'keep_subscription_id' => $keepSubscriptionId,
        ]);

        $protectedSubscriptionId = $keepSubscriptionId ?: $nonTerminalSubscriptions->first()?->id;

        $nonTerminalSubscriptions
            ->filter(fn(Subscription $subscription) => $subscription->id !== $protectedSubscriptionId)
            ->each(function (Subscription $subscription) {
                if ($subscription->gateway_subscription_id) {
                    try {
                        $gateway = PaymentGatewayFactory::make($subscription->gateway);
                        $gateway->cancelSubscription($subscription->gateway_subscription_id);
                    } catch (\Throwable $cancelException) {
                        Log::warning('Failed to cancel older duplicate gateway subscription', [
                            'subscription_id' => $subscription->id,
                            'gateway_subscription_id' => $subscription->gateway_subscription_id,
                            'error' => $cancelException->getMessage(),
                        ]);
                    }
                }

                $this->subscriptionStatusService->markCancelled($subscription, false);
            });
    }

    private function executeDeferredSwitchIfRequested(Subscription $subscription): void
    {
        if (!$subscription->switch_requested_plan_price_id) {
            return;
        }

        DB::transaction(function () use ($subscription) {
            /** @var Subscription|null $lockedSubscription */
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
                // Idempotency guard: if switch subscription already exists, only clear
                // switch request markers so duplicate webhook deliveries do nothing.
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
                Log::warning('Deferred switch mapping not found', [
                    'subscription_id' => $lockedSubscription->id,
                    'workspace_id' => $lockedSubscription->workspace_id,
                    'plan_price_id' => $requestedPlanPrice->id,
                    'gateway' => $gatewayName,
                ]);

                return;
            }

            $requestedInterval = $lockedSubscription->switch_requested_interval ?: $requestedPlanPrice->interval;

            // Prefer the locked subscription's gateway customer id, falling
            // back to any previously recorded customer id for the workspace.
            $preferredCustomerId = $lockedSubscription->gateway_customer_id ?: Subscription::query()
                ->where('workspace_id', $lockedSubscription->workspace_id)
                ->whereNotNull('gateway_customer_id')
                ->latest('id')
                ->value('gateway_customer_id');

            $gatewaySubscription = $gateway->createSubscription([
                'plan_id' => $mapping->gateway_plan_id,
                'trial_days' => 0,
                'start_at' => null,
                'interval' => $requestedInterval,
                'customer_id' => $preferredCustomerId ?: null,
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

    private function cancelOtherNonTerminalSubscriptions(Subscription $subscription): void
    {
        Subscription::query()
            ->where('workspace_id', $subscription->workspace_id)
            ->where('id', '!=', $subscription->id)
            ->whereIn('status', SubscriptionStatus::nonTerminalStatuses())
            ->orderByDesc('id')
            ->get()
            ->each(function (Subscription $otherSubscription) {
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

    private function downgradeWorkspaceToFreePlan(int $workspaceId): void
    {
        $workspace = Workspace::query()->find($workspaceId);
        if (!$workspace) {
            return;
        }

        $subscription = $this->workspaceSubscriptionService->ensureDefaultFreeSubscription($workspace);
        $this->workspaceBillingService->syncFromSubscription($workspace, $subscription);
    }

    private function supportedCurrencies(): array
    {
        $configured = array_values((array) config('billing.supported_currencies', ['USD', 'INR']));

        return array_values(array_unique(array_filter(array_map(
            static fn($currency) => strtoupper(trim((string) $currency)),
            $configured
        ))));
    }

    private function resolveRequestedCurrency(Request $request): string
    {
        $candidate = strtoupper((string) (
            $request->input('currency')
            ?: $request->query('currency')
            ?: $request->header('X-Billing-Currency')
            ?: $this->detectCurrencyFromLocale((string) $request->header('Accept-Language', ''))
        ));

        if (in_array($candidate, $this->supportedCurrencies(), true)) {
            return $candidate;
        }

        return strtoupper((string) config('billing.default_currency', 'USD'));
    }

    private function detectCurrencyFromLocale(string $acceptLanguage): string
    {
        if (preg_match('/(?:^|,)\s*[a-z]{2}(?:-[A-Z]{2})?/i', $acceptLanguage, $matches) === 1) {
            $locale = $matches[0];

            if (str_contains(strtoupper($locale), '-IN')) {
                return 'INR';
            }
        }

        return strtoupper((string) config('billing.default_currency', 'USD'));
    }

    private function resolveDisplayCurrency($plans, string $requestedCurrency, string $gatewayName): string
    {
        $hasRequestedCurrency = $plans->contains(function (Plan $plan) use ($requestedCurrency, $gatewayName) {
            return collect($plan->prices)->contains(function (PlanPrice $price) use ($requestedCurrency, $gatewayName) {
                return strtoupper((string) $price->currency) === $requestedCurrency
                    && $this->isSelectablePlanPrice($price, $gatewayName);
            });
        });

        if ($hasRequestedCurrency) {
            return $requestedCurrency;
        }

        return strtoupper((string) config('billing.default_currency', 'USD'));
    }

    private function buildDisplayPrices(Plan $plan, string $currency, string $gatewayName): array
    {
        return collect(['monthly', 'yearly'])
            ->map(function (string $interval) use ($plan, $currency, $gatewayName) {
                $price = collect($plan->prices)
                    ->filter(fn(PlanPrice $candidate) => $candidate->interval === $interval)
                    ->sortBy('id')
                    ->pipe(function ($prices) use ($currency, $gatewayName) {
                        return $prices->first(fn(PlanPrice $candidate) => strtoupper((string) $candidate->currency) === $currency && $this->isSelectablePlanPrice($candidate, $gatewayName))
                            ?? $prices->first(fn(PlanPrice $candidate) => strtoupper((string) $candidate->currency) === strtoupper((string) config('billing.default_currency', 'USD')) && $this->isSelectablePlanPrice($candidate, $gatewayName))
                            ?? $prices->first(fn(PlanPrice $candidate) => $this->isSelectablePlanPrice($candidate, $gatewayName));
                    });

                if (!$price) {
                    return null;
                }

                return [
                    'id' => $price->id,
                    'interval' => $price->interval,
                    'price' => (int) $price->price,
                    'currency' => strtoupper((string) $price->currency),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function isSelectablePlanPrice(PlanPrice $price, string $gatewayName): bool
    {
        if ((int) $price->price === 0) {
            return true;
        }

        return $price->relationLoaded('gatewayMappings')
            ? $price->gatewayMappings->contains(fn(PlanGatewayMapping $mapping) => trim((string) $mapping->gateway_plan_id) !== '')
            : PlanGatewayMapping::query()
                ->where('plan_price_id', $price->id)
                ->where('gateway', $gatewayName)
                ->whereNotNull('gateway_plan_id')
                ->where('gateway_plan_id', '!=', '')
                ->exists();
    }

    private function resolvePlanPriceForCurrency($priceQuery, string $interval, string $currency): ?PlanPrice
    {
        $defaultCurrency = strtoupper((string) config('billing.default_currency', 'USD'));
        $normalizedCurrency = strtoupper($currency);

        return (clone $priceQuery)
            ->where('interval', $interval)
            ->where('currency', $normalizedCurrency)
            ->first()
            ?: (clone $priceQuery)
                ->where('interval', $interval)
                ->where('currency', $defaultCurrency)
                ->first()
            ?: (clone $priceQuery)
                ->where('interval', $interval)
                ->orderBy('id')
                ->first();
    }

    private function resolveBillingActionSubscription(Workspace $workspace): ?Subscription
    {
        $nonTerminalSubscriptions = Subscription::query()
            ->where('workspace_id', $workspace->id)
            ->whereIn('status', SubscriptionStatus::nonTerminalStatuses())
            ->orderByDesc('id')
            ->get();

        $paymentLifecycleSubscription = $nonTerminalSubscriptions->first(function (Subscription $subscription) {
            return in_array($subscription->status, SubscriptionStatus::paymentLifecycleStatuses(), true);
        });

        if ($paymentLifecycleSubscription) {
            return $paymentLifecycleSubscription;
        }

        $activePaidSubscription = $nonTerminalSubscriptions->first(function (Subscription $subscription) {
            return $subscription->status === SubscriptionStatus::ACTIVE
                && (int) ($subscription->planPrice?->price ?? 0) > 0;
        });

        if ($activePaidSubscription) {
            return $activePaidSubscription;
        }

        return $workspace->activeSubscription;
    }

    private function authorizePlanManagement(User $user, int $workspaceId): ?JsonResponse
    {
        if ($user->roleInWorkspace($workspaceId) !== User::ROLE_OWNER) {
            return response()->json([
                'message' => 'Only workspace owners can manage billing plans.',
            ], 403);
        }

        return null;
    }
}
