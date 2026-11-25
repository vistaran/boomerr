<?php

namespace App\Services;

use App\Models\Domain;
use App\Models\Workspace;

class PlanLimitService
{
    /**
     * Community Edition configuration with unlimited resources and all features enabled.
     */
    public static function getCommunityEditionConfig(): array
    {
        return [
            'name' => 'Community Edition',
            'code' => 'community',
            'limits' => [
                'max_monitors' => null, // unlimited
                'monitor_interval_minutes' => 1,
                'max_team_members' => null, // unlimited
                'max_status_pages' => null, // unlimited
                'sms_credits_per_month' => null, // unlimited
                'whatsapp_credits_per_month' => null, // unlimited
            ],
            'features' => [
                'domain_monitoring' => true,
                'ssl_monitoring' => true,
                'ai_response_time' => true,
                'ai_performance' => true,
                'ai_seo_score' => true,
                'ai_ux_monitoring' => true,
                'ai_security_monitoring' => true,
                'dns_tools' => true,
                'security_tools' => true,
                'incident_reporting' => true,
                'ai_analysis' => true,
                'multi_region_monitoring' => (bool) config('monitoring.lambda_enabled', false),
            ],
            'integrations' => [
                'email' => true,
                'sms' => true,
                'whatsapp' => true,
                'calls' => true,
                'slack' => true,
                'discord' => true,
                'telegram' => true,
                'facebook_ads' => true,
                'google_ads' => true,
            ],
        ];
    }

    /**
     * Get the active plan code for the workspace.
     */
    public static function getPlanCode(?Workspace $workspace = null): string
    {
        if (!config('billing.enabled', false)) {
            return 'community';
        }

        if (!$workspace) {
            return 'free';
        }

        $subscription = $workspace->activeSubscription;

        if ($subscription && in_array($subscription->status, ['trialing', 'active', 'cancel_at_cycle_end'], true)) {
            if ($subscription->planPrice && $subscription->planPrice->plan) {
                return $subscription->planPrice->plan->code ?? 'free';
            }
        }

        // Fallback: Check direct workspace plan association (e.g. upgraded plan_id)
        if ($workspace->plan_id) {
            $plan = $workspace->relationLoaded('plan') ? $workspace->plan : \App\Models\Plan::find($workspace->plan_id);
            if ($plan && $plan->code) {
                return $plan->code;
            }
        }

        return 'free';
    }

    /**
     * Get all plan config (limits, features, integrations) for the workspace.
     */
    public static function getPlanConfig(?Workspace $workspace = null): array
    {
        if (!config('billing.enabled', false)) {
            return self::getCommunityEditionConfig();
        }

        $code = self::getPlanCode($workspace);
        $plans = config('billing.plans', []);

        return $plans[$code] ?? $plans['free'] ?? [];
    }

    /**
     * Get the numeric limits array for the workspace's plan.
     */
    public static function getLimits(?Workspace $workspace = null): array
    {
        return self::getPlanConfig($workspace)['limits'] ?? [];
    }

    /**
     * Get the features array for the workspace's plan.
     */
    public static function getFeatures(?Workspace $workspace = null): array
    {
        return self::getPlanConfig($workspace)['features'] ?? [];
    }

    /**
     * Get the integrations array for the workspace's plan.
     */
    public static function getIntegrations(?Workspace $workspace = null): array
    {
        return self::getPlanConfig($workspace)['integrations'] ?? [];
    }

    /**
     * Check if adding another monitor (domain) is allowed.
     */
    public static function canAddMonitor(?Workspace $workspace = null): bool
    {
        $limits = self::getLimits($workspace);
        $max = array_key_exists('max_monitors', $limits) ? $limits['max_monitors'] : 10;

        if ($max === null) {
            return true; // unlimited
        }

        return $workspace ? $workspace->domains()->where('is_active', true)->count() < $max : false;
    }

    /**
     * Check if adding another team member is allowed.
     * Owner is excluded from the count.
     */
    public static function canAddTeamMember(?Workspace $workspace = null): bool
    {
        $limits = self::getLimits($workspace);
        $max = array_key_exists('max_team_members', $limits) ? $limits['max_team_members'] : 0;

        if ($max === null) {
            return true; // unlimited
        }

        if ($max === 0) {
            return false; // plan does not allow team members
        }

        if (!$workspace) {
            return false;
        }

        $memberCount = $workspace->users()
            ->wherePivot('role', '!=', 'owner')
            ->count();

        return $memberCount < $max;
    }

    /**
     * Check if adding another status page is allowed.
     */
    public static function canAddStatusPage(?Workspace $workspace = null): bool
    {
        $limits = self::getLimits($workspace);
        $max = array_key_exists('max_status_pages', $limits) ? $limits['max_status_pages'] : 0;

        if ($max === null) {
            return true; // unlimited
        }

        if ($max === 0) {
            return false; // plan does not allow status pages
        }

        return $workspace ? $workspace->statusPages()->count() < $max : false;
    }

    /**
     * Check if a given feature is available for the workspace's plan.
     *
     * @param string $feature  e.g. 'ssl_monitoring', 'ai_seo_score'
     */
    public static function hasFeature(Workspace $workspace, string $feature): bool
    {
        return (bool) (self::getFeatures($workspace)[$feature] ?? false);
    }

    /**
     * Check if a given integration is available for the workspace's plan.
     *
     * @param string $integration  e.g. 'slack', 'facebook_ads'
     */
    public static function hasIntegration(Workspace $workspace, string $integration): bool
    {
        return (bool) (self::getIntegrations($workspace)[$integration] ?? false);
    }

    /**
     * Get monthly SMS credits limit for the workspace (null = unlimited, 0 = disabled).
     */
    public static function getSmsCreditsLimit(Workspace $workspace): ?int
    {
        return self::getLimits($workspace)['sms_credits_per_month'] ?? null;
    }

    /**
     * Get monthly WhatsApp credits limit for the workspace (null = unlimited, 0 = disabled).
     */
    public static function getWhatsAppCreditsLimit(Workspace $workspace): ?int
    {
        return self::getLimits($workspace)['whatsapp_credits_per_month'] ?? null;
    }

    /**
     * Get minimum monitor interval in minutes allowed for the workspace's plan.
     */
    public static function getMonitorIntervalMinutes(Workspace $workspace): int
    {
        return (int) (self::getLimits($workspace)['monitor_interval_minutes'] ?? 1);
    }

    /**
     * Build the full plan info payload to send to the frontend.
     */
    public static function getPlanInfoPayload(Workspace $workspace): array
    {
        $config = self::getPlanConfig($workspace);

        return [
            'plan' => [
                'name' => $config['name'] ?? 'Free',
                'code' => $config['code'] ?? 'free',
            ],
            'limits' => $config['limits'] ?? [],
            'features' => $config['features'] ?? [],
            'integrations' => $config['integrations'] ?? [],
        ];
    }

    /**
     * Check whether a domain is eligible for monitoring based on active status,
     * paused reason, and workspace plan limits.
     */
    public static function isDomainEligibleForMonitoring(Domain $domain): bool
    {
        // 1. Must be active and not paused for any reason
        if (!$domain->is_active || $domain->paused_reason !== null) {
            return false;
        }

        // 2. Guard against stale in-memory model instances by verifying DB state
        if ($domain->exists) {
            $freshState = Domain::where('id', $domain->id)
                ->first(['id', 'workspace_id', 'is_active', 'paused_reason']);

            if (!$freshState || !$freshState->is_active || $freshState->paused_reason !== null) {
                return false;
            }
        }

        // 3. Resolve workspace
        $workspace = $domain->workspace ?? $domain->company;
        if (!$workspace && $domain->workspace_id) {
            $workspace = Workspace::find($domain->workspace_id);
        }
        if (!$workspace) {
            return false;
        }

        // 4. Check workspace monitor limit
        $limits = self::getLimits($workspace);
        $maxMonitors = array_key_exists('max_monitors', $limits) ? $limits['max_monitors'] : 10;
        if ($maxMonitors === null) {
            return true;
        }

        $totalActiveCount = Domain::where('workspace_id', $workspace->id)
            ->where('is_active', true)
            ->whereNull('paused_reason')
            ->count();

        if ($totalActiveCount <= $maxMonitors) {
            return true;
        }

        // 5. In case of active count exceeding limit before enforcement, tie-break by id ASC
        $earlierActiveCount = Domain::where('workspace_id', $workspace->id)
            ->where('is_active', true)
            ->whereNull('paused_reason')
            ->where('id', '<', $domain->id)
            ->count();

        return $earlierActiveCount < $maxMonitors;
    }

    /**
     * Enforce workspace monitor limits across domains:
     * - When $keepDomainIds is provided: keeps the specified workspace domains active (up to max_monitors)
     *   and pauses the remaining active domains as 'plan_limit'.
     * - When $keepDomainIds is null:
     *   - On downgrade / over-limit: keeps first max_monitors active (by id ASC), pauses excess as 'plan_limit'.
     *   - On upgrade / under-limit: restores 'plan_limit' paused domains up to the new plan limit.
     * - User-paused domains ('user') are never touched or restored.
     * - Incidents, status events, and history are untouched.
     */
    public static function enforceWorkspaceDomainLimits(Workspace $workspace, ?array $keepDomainIds = null): void
    {
        $limits = self::getLimits($workspace);
        $maxMonitors = array_key_exists('max_monitors', $limits) ? $limits['max_monitors'] : 10;

        if ($keepDomainIds !== null) {
            $allowedWorkspaceDomainIds = $workspace->domains()->pluck('id')->all();
            $userPausedIds = $workspace->domains()
                ->where('paused_reason', 'user')
                ->pluck('id')
                ->all();

            $sanitizedKeepIds = array_values(array_diff(
                array_intersect(array_map('intval', $keepDomainIds), $allowedWorkspaceDomainIds),
                $userPausedIds
            ));

            if ($maxMonitors !== null && count($sanitizedKeepIds) > $maxMonitors) {
                $sanitizedKeepIds = array_slice($sanitizedKeepIds, 0, $maxMonitors);
            }

            // Keep / activate selected domains (unless user-paused)
            if (!empty($sanitizedKeepIds)) {
                $workspace->domains()
                    ->whereIn('id', $sanitizedKeepIds)
                    ->where(function ($q) {
                        $q->whereNull('paused_reason')
                          ->orWhere('paused_reason', '!=', 'user');
                    })
                    ->each(function (Domain $domain) {
                        $domain->update([
                            'is_active' => true,
                            'paused_reason' => null,
                            'next_check_at' => $domain->next_check_at ?? now(),
                        ]);
                    });
            }

            // Pause unselected active domains with plan_limit (never touch user-paused)
            $workspace->domains()
                ->where('is_active', true)
                ->whereNotIn('id', $sanitizedKeepIds)
                ->where(function ($q) {
                    $q->whereNull('paused_reason')
                      ->orWhere('paused_reason', '!=', 'user');
                })
                ->each(function (Domain $domain) {
                    $domain->update([
                        'is_active' => false,
                        'paused_reason' => 'plan_limit',
                        'next_check_at' => null,
                    ]);
                });

            return;
        }

        if ($maxMonitors === null) {
            // Unlimited: restore all domains paused due to plan_limit
            $workspace->domains()
                ->where('paused_reason', 'plan_limit')
                ->orderBy('id', 'asc')
                ->each(function (Domain $domain) {
                    $domain->update([
                        'is_active' => true,
                        'paused_reason' => null,
                        'next_check_at' => now(),
                    ]);
                });
            return;
        }

        // Fetch active domains ordered by ID ASC
        $activeDomains = $workspace->domains()
            ->where('is_active', true)
            ->orderBy('id', 'asc')
            ->get();

        $activeCount = $activeDomains->count();

        if ($activeCount > $maxMonitors) {
            // Over-limit: Keep the first $maxMonitors active, pause excess
            $keepActive = $activeDomains->slice(0, $maxMonitors);
            foreach ($keepActive as $domain) {
                if ($domain->paused_reason !== null) {
                    $domain->update(['paused_reason' => null]);
                }
            }

            $excess = $activeDomains->slice($maxMonitors);
            foreach ($excess as $domain) {
                $domain->update([
                    'is_active' => false,
                    'paused_reason' => 'plan_limit',
                    'next_check_at' => null,
                ]);
            }
        } elseif ($activeCount < $maxMonitors) {
            // Under-limit: Restore only 'plan_limit' paused domains up to the limit
            $availableSlots = $maxMonitors - $activeCount;
            $restoreDomains = $workspace->domains()
                ->where('paused_reason', 'plan_limit')
                ->orderBy('id', 'asc')
                ->limit($availableSlots)
                ->get();

            foreach ($restoreDomains as $domain) {
                $domain->update([
                    'is_active' => true,
                    'paused_reason' => null,
                    'next_check_at' => now(),
                ]);
            }
        }
    }
}
