<?php

namespace App\Services;

use App\Models\Subscription;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DiscordAlertService
{
    public function notifySignup(User $user, string $method = 'email', ?string $workspaceName = null): void
    {
        $webhook = env('DISCORD_SIGNUP_WEBHOOK');
        if (! $webhook) {
            return;
        }

        $name = $user->name ?? 'Unknown';
        $email = $user->email ?? 'Unknown';
        $workspace = $workspaceName ? "\nWorkspace: {$workspaceName}" : '';
        $methodLabel = strtoupper($method);

        $message = "**New Signup**\nMethod: {$methodLabel}\nName: {$name}\nEmail: {$email}{$workspace}";

        try {
            Http::post($webhook, ['content' => $message]);
        } catch (\Throwable $e) {
            Log::error('DiscordAlertService notifySignup failed: ' . $e->getMessage());
        }
    }

    public function notifySubscriptionCharged(Subscription $subscription, bool $isFirstTime = false, ?array $eventData = null): void
    {
        $webhook = env('DISCORD_BILLING_WEBHOOK') ?: env('DISCORD_SIGNUP_WEBHOOK');
        if (! $webhook) {
            return;
        }

        $subscription->load(['workspace', 'planPrice.plan']);
        $workspace = $subscription->workspace;
        $plan = $subscription->planPrice?->plan;
        $ownerName = $this->resolveOwnerName($workspace);

        $workspaceName = $workspace?->name ?? 'Unknown';
        $planName = $plan?->name ?? 'Unknown Plan';
        $amount = $this->formatAmount($eventData['amount'] ?? null);
        $currency = $eventData['currency'] ?? $subscription->currency ?? 'USD';
        $timeMarker = $isFirstTime ? '🎯 **FIRST TIME**' : '✅ Renewal';

        $message = "{$timeMarker}\n**Subscription Charged**\nWorkspace: {$workspaceName}\nOwner: {$ownerName}\nPlan: {$planName}\nAmount: {$currency} {$amount}";

        try {
            Http::post($webhook, ['content' => $message]);
        } catch (\Throwable $e) {
            Log::error('DiscordAlertService notifySubscriptionCharged failed: ' . $e->getMessage());
        }
    }

    public function notifySubscriptionError(Subscription $subscription, string $errorType, ?array $eventData = null, ?string $errorMessage = null): void
    {
        $webhook = env('DISCORD_BILLING_WEBHOOK') ?: env('DISCORD_SIGNUP_WEBHOOK');
        if (! $webhook) {
            return;
        }

        $subscription->load(['workspace', 'planPrice.plan']);
        $workspace = $subscription->workspace;
        $plan = $subscription->planPrice?->plan;
        $ownerName = $this->resolveOwnerName($workspace);

        $workspaceName = $workspace?->name ?? 'Unknown';
        $planName = $plan?->name ?? 'Unknown Plan';
        $amount = $this->formatAmount($eventData['amount'] ?? null);
        $currency = $eventData['currency'] ?? $subscription->currency ?? 'USD';
        $errorTypeLabel = strtoupper($errorType);

        $error = $errorMessage ? "\nError: {$errorMessage}" : '';
        $message = "❌ **{$errorTypeLabel}**\nWorkspace: {$workspaceName}\nOwner: {$ownerName}\nPlan: {$planName}\nAmount: {$currency} {$amount}{$error}";

        try {
            Http::post($webhook, ['content' => $message]);
        } catch (\Throwable $e) {
            Log::error('DiscordAlertService notifySubscriptionError failed: ' . $e->getMessage());
        }
    }

    public function notifyTrialStarted(Subscription $subscription): void
    {
        $webhook = env('DISCORD_BILLING_WEBHOOK') ?: env('DISCORD_SIGNUP_WEBHOOK');
        if (! $webhook) {
            return;
        }

        $subscription->load(['workspace', 'planPrice.plan']);
        $workspace = $subscription->workspace;
        $plan = $subscription->planPrice?->plan;
        $ownerName = $this->resolveOwnerName($workspace);

        $workspaceName = $workspace?->name ?? 'Unknown';
        $planName = $plan?->name ?? 'Unknown Plan';
        $trialEndsAt = $subscription->trial_ends_at?->format('Y-m-d H:i:s') ?? 'Unknown';

        $message = "🟢 **TRIAL STARTED**\nWorkspace: {$workspaceName}\nOwner: {$ownerName}\nPlan: {$planName}\nTrial ends at: {$trialEndsAt}";

        try {
            Http::post($webhook, ['content' => $message]);
        } catch (\Throwable $e) {
            Log::error('DiscordAlertService notifyTrialStarted failed: ' . $e->getMessage());
        }
    }

    private function formatAmount(mixed $amount): string
    {
        if ($amount === null || $amount === '') {
            return 'Unknown';
        }

        if (!is_numeric($amount)) {
            return (string) $amount;
        }

        return number_format(((float) $amount) / 100, 2, '.', '');
    }

    private function resolveOwnerName(?Workspace $workspace): string
    {
        if (! $workspace) {
            return 'Unknown';
        }

        $ownerName = $workspace->users()
            ->wherePivot('role', User::ROLE_OWNER)
            ->value('name');

        return $ownerName ?: 'Unknown';
    }
}
