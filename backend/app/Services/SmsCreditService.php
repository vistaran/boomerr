<?php

namespace App\Services;

use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SmsCreditService
{
    /**
     * Get the monthly SMS credit limit for a workspace based on its active plan.
     * Returns null for unlimited, or an integer limit (e.g. 30).
     */
    public function getMonthlyLimit(?Workspace $workspace = null): ?int
    {
        if (!config('billing.enabled', false)) {
            return null; // Unlimited in Community Edition
        }

        if (!$workspace) {
            return 0;
        }

        $limits = PlanLimitService::getLimits($workspace);

        // If plan explicitly configures sms_credits_per_month, return it
        if (array_key_exists('sms_credits_per_month', $limits)) {
            return $limits['sms_credits_per_month'];
        }

        // If SMS integration is not enabled on plan, limit is 0
        if (!PlanLimitService::hasIntegration($workspace, 'sms')) {
            return 0;
        }

        // Default to unlimited if integration is enabled but no numeric limit configured
        return null;
    }

    /**
     * Get credits used in the given year_month (format 'Y-m', defaults to current month).
     */
    public function getUsedCredits(?Workspace $workspace = null, ?string $yearMonth = null): int
    {
        if (!$workspace) {
            return 0;
        }

        $yearMonth = $yearMonth ?? now()->format('Y-m');

        return (int) (DB::table('workspace_sms_usages')
            ->where('workspace_id', $workspace->id)
            ->where('year_month', $yearMonth)
            ->value('credits_used') ?? 0);
    }

    /**
     * Get remaining credits for the current month.
     * Returns null if unlimited.
     */
    public function getRemainingCredits(?Workspace $workspace = null): ?int
    {
        $limit = $this->getMonthlyLimit($workspace);
        if ($limit === null) {
            return null; // unlimited
        }

        $used = $this->getUsedCredits($workspace);
        return max(0, $limit - $used);
    }

    /**
     * Check whether the workspace currently has available SMS credits.
     */
    public function hasCredit(?Workspace $workspace = null): bool
    {
        if (!config('billing.enabled', false)) {
            return true;
        }

        if (!$workspace) {
            return false;
        }

        if (!PlanLimitService::hasIntegration($workspace, 'sms')) {
            return false;
        }

        $limit = $this->getMonthlyLimit($workspace);
        if ($limit === null) {
            return true; // unlimited
        }

        if ($limit <= 0) {
            return false;
        }

        return $this->getUsedCredits($workspace) < $limit;
    }

    /**
     * Atomically reserve SMS credit(s) before attempting to send.
     * Concurrency-safe: uses a database transaction with lockForUpdate()
     * so that multiple simultaneous jobs cannot see the same remaining balance
     * and send more messages than the monthly limit permits.
     *
     * @return bool True if credit was successfully reserved; false if limit was reached.
     */
    public function reserveCredit(?Workspace $workspace = null, int $credits = 1): bool
    {
        if (!config('billing.enabled', false)) {
            return true;
        }

        if (!$workspace) {
            return false;
        }

        if ($credits <= 0) {
            return true;
        }

        if (!PlanLimitService::hasIntegration($workspace, 'sms')) {
            return false;
        }

        $limit = $this->getMonthlyLimit($workspace);
        $yearMonth = now()->format('Y-m');

        // Unlimited plan: no reservation required, unlimited sending allowed
        if ($limit === null) {
            return true;
        }

        if ($limit <= 0) {
            return false;
        }

        return DB::transaction(function () use ($workspace, $yearMonth, $limit, $credits) {
            // Ensure record exists with row lock
            $record = DB::table('workspace_sms_usages')
                ->where('workspace_id', $workspace->id)
                ->where('year_month', $yearMonth)
                ->lockForUpdate()
                ->first();

            if (!$record) {
                DB::table('workspace_sms_usages')->insert([
                    'workspace_id' => $workspace->id,
                    'year_month'   => $yearMonth,
                    'credits_used' => 0,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ]);
                $used = 0;
            } else {
                $used = (int) $record->credits_used;
            }

            if ($used + $credits > $limit) {
                Log::warning('SMS credit reservation blocked: monthly limit exceeded', [
                    'workspace_id' => $workspace->id,
                    'limit'        => $limit,
                    'used'         => $used,
                    'requested'    => $credits,
                ]);
                return false;
            }

            DB::table('workspace_sms_usages')
                ->where('workspace_id', $workspace->id)
                ->where('year_month', $yearMonth)
                ->increment('credits_used', $credits, ['updated_at' => now()]);

            return true;
        });
    }

    /**
     * Atomically refund previously reserved SMS credit(s) if the SMS provider failed.
     * Concurrency-safe: uses a database transaction with lockForUpdate().
     */
    public function refundCredit(?Workspace $workspace = null, int $credits = 1): void
    {
        if ($credits <= 0 || !$workspace) {
            return;
        }

        $limit = $this->getMonthlyLimit($workspace);
        if ($limit === null) {
            return; // Unlimited plan, no credit accounting to refund
        }

        $yearMonth = now()->format('Y-m');

        DB::transaction(function () use ($workspace, $yearMonth, $credits) {
            $record = DB::table('workspace_sms_usages')
                ->where('workspace_id', $workspace->id)
                ->where('year_month', $yearMonth)
                ->lockForUpdate()
                ->first();

            if ($record && $record->credits_used > 0) {
                $newUsed = max(0, (int) $record->credits_used - $credits);
                DB::table('workspace_sms_usages')
                    ->where('workspace_id', $workspace->id)
                    ->where('year_month', $yearMonth)
                    ->update([
                        'credits_used' => $newUsed,
                        'updated_at'   => now(),
                    ]);

                Log::info('Refunded SMS credit after send failure', [
                    'workspace_id' => $workspace->id,
                    'refunded'     => $credits,
                    'new_used'     => $newUsed,
                ]);
            }
        });
    }

    /**
     * Consume SMS credit(s). Alias for reserveCredit for backward compatibility.
     *
     * @return bool True if credit was successfully consumed; false if limit was reached.
     */
    public function consumeCredit(?Workspace $workspace = null, int $credits = 1): bool
    {
        return $this->reserveCredit($workspace, $credits);
    }

    /**
     * Get a comprehensive credit summary payload for API & frontend consumers.
     */
    public function getCreditDetails(?Workspace $workspace = null): array
    {
        if (!config('billing.enabled', false)) {
            return [
                'enabled'         => true,
                'limit'           => null,
                'used'            => 0,
                'remaining'       => null,
                'has_credit'      => true,
                'billing_enabled' => false,
            ];
        }

        if (!$workspace) {
            return [
                'enabled'         => false,
                'limit'           => 0,
                'used'            => 0,
                'remaining'       => 0,
                'has_credit'      => false,
                'billing_enabled' => true,
            ];
        }

        $limit = $this->getMonthlyLimit($workspace);
        $used = $this->getUsedCredits($workspace);
        $remaining = $limit !== null ? max(0, $limit - $used) : null;
        $hasCredit = $this->hasCredit($workspace);

        return [
            'enabled'    => PlanLimitService::hasIntegration($workspace, 'sms'),
            'limit'      => $limit,
            'used'       => $used,
            'remaining'  => $remaining,
            'has_credit' => $hasCredit,
            'resets_at'  => now()->endOfMonth()->toIso8601String(),
            'period'     => now()->format('Y-m'),
        ];
    }
}
