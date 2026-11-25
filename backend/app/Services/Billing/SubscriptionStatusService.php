<?php

namespace App\Services\Billing;

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use Illuminate\Support\Facades\Log;

class SubscriptionStatusService
{
    private function maxFailedAttempts(): int
    {
        return max(1, (int) config('billing.max_failed_payment_attempts', 3));
    }

    public function syncFromGateway(Subscription $subscription, ?string $gatewayStatus, array $context = []): ?string
    {
        if (!$gatewayStatus) {
            return $subscription->status;
        }

        $gatewayStatus = strtolower($gatewayStatus);

        return match ($gatewayStatus) {
            'active', 'authenticated' => $this->markActivated($subscription, $context, false),
            'pending' => $this->applyStatus($subscription, SubscriptionStatus::PENDING, [
                'status' => SubscriptionStatus::PENDING,
            ]),
            'paused' => $this->markPaused($subscription),
            'halted' => $this->applyStatus($subscription, SubscriptionStatus::HALTED, [
                'status' => SubscriptionStatus::HALTED,
                'failed_payment_attempts' => max((int) ($subscription->failed_payment_attempts ?? 0), 3),
                'last_payment_failed_at' => now(),
            ]),
            'cancelled' => $this->markCancelled($subscription, false),
            'expired', 'completed' => $this->markExpired($subscription),
            default => $subscription->status,
        };
    }

    public function markFailedAttempt(Subscription $subscription, bool $increment = true): string
    {
        $failedAttempts = (int) ($subscription->failed_payment_attempts ?? 0);

        if ($increment) {
            $failedAttempts++;
        }

        $isMaxFailed = $failedAttempts >= $this->maxFailedAttempts();
        $status = $isMaxFailed ? SubscriptionStatus::CANCELLED : SubscriptionStatus::FAILED_RETRYING;

        return $this->applyStatus($subscription, $status, [
            'status' => $status,
            'failed_payment_attempts' => $failedAttempts,
            'last_payment_failed_at' => now(),
            'cancelled_at' => $isMaxFailed ? ($subscription->cancelled_at ?? now()) : $subscription->cancelled_at,
        ]);
    }

    public function markActivated(Subscription $subscription, array $context = [], bool $resetFailures = true): string
    {
        $forceActive = (bool) ($context['force_active'] ?? false);

        $isStillTrialing = !$forceActive
            && $subscription->trial_ends_at
            && $subscription->trial_ends_at->isFuture();

        $status = $isStillTrialing
            ? SubscriptionStatus::TRIALING
            : SubscriptionStatus::ACTIVE;

        $updateData = [
            'status' => $status,
            'trial_ends_at' => $isStillTrialing ? $subscription->trial_ends_at : null,
            'current_period_start' => $context['current_period_start'] ?? $subscription->current_period_start,
            'current_period_end' => $context['current_period_end'] ?? $subscription->current_period_end,
        ];

        if ($resetFailures) {
            $updateData['failed_payment_attempts'] = 0;
            $updateData['last_payment_failed_at'] = null;
        }

        return $this->applyStatus($subscription, $status, $updateData);
    }

    public function markCancelled(Subscription $subscription, bool $atCycleEnd = false): string
    {
        $status = $atCycleEnd
            ? SubscriptionStatus::CANCEL_AT_CYCLE_END
            : SubscriptionStatus::CANCELLED;

        Log::info("Sttaus >> $status");
        return $this->applyStatus($subscription, $status, [
            'status' => $status,
            'cancelled_at' => $subscription->cancelled_at ?? now(),
        ]);
    }

    public function markExpired(Subscription $subscription): string
    {
        return $this->applyStatus($subscription, SubscriptionStatus::EXPIRED, [
            'status' => SubscriptionStatus::EXPIRED,
            'cancelled_at' => $subscription->cancelled_at ?? now(),
        ]);
    }

    public function markPaused(Subscription $subscription): string
    {
        return $this->applyStatus($subscription, SubscriptionStatus::PAUSED, [
            'status' => SubscriptionStatus::PAUSED,
        ]);
    }

    private function applyStatus(Subscription $subscription, string $incomingStatus, array $updateData): string
    {
        $currentStatus = (string) $subscription->status;

        Log::info("Attempting status transition from '$currentStatus' to '$incomingStatus' for subscription ID {$subscription->id}");

        if (!$this->canTransition($currentStatus, $incomingStatus)) {
            Log::info("can tranistion");

            return $currentStatus;
        }


        Log::info("Status transition allowed. Updating subscription ID {$subscription->id} to status '$incomingStatus'");

        $subscription->fill($updateData);

        Log::info("subscription updated");
        if ($subscription->isDirty()) {
            $subscription->save();
            $subscription->refresh();
        }

        return (string) $subscription->status;
    }

    private function canTransition(?string $currentStatus, string $incomingStatus): bool
    {
        if (!$currentStatus || $currentStatus === $incomingStatus) {
            return true;
        }

        $currentIsTerminal = in_array($currentStatus, SubscriptionStatus::terminalStatuses(), true);
        $incomingIsTerminal = in_array($incomingStatus, SubscriptionStatus::terminalStatuses(), true);

        if ($currentIsTerminal && !$incomingIsTerminal) {
            return false;
        }

        if (!$currentIsTerminal && $incomingIsTerminal) {
            return true;
        }

        if (
            in_array($currentStatus, [SubscriptionStatus::TRIALING, SubscriptionStatus::PENDING, SubscriptionStatus::PAST_DUE, SubscriptionStatus::HALTED, SubscriptionStatus::PAUSED, SubscriptionStatus::FAILED_RETRYING, SubscriptionStatus::CREATED, SubscriptionStatus::AUTHENTICATED], true)
            && in_array($incomingStatus, [SubscriptionStatus::ACTIVE, SubscriptionStatus::TRIALING], true)
        ) {
            return true;
        }

        return SubscriptionStatus::rank($incomingStatus) >= SubscriptionStatus::rank($currentStatus);
    }
}
