<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Workspace;
use App\Models\Domain;
use App\Models\Department;
use App\Models\Incident;
use App\Models\SystemLog;
use App\Models\AuditLog;
use App\Models\Integration;
use App\Models\WorkspaceIntegration;
use App\Models\NotificationChannel;
use App\Models\UserIntegration;
use App\Models\DomainStatusEvent;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

class DashboardController extends Controller
{
    /**
     * Cache TTL constants
     */
    private const WORKSPACE_DASHBOARD_CACHE_TTL_SECONDS = 30;
    private const DOMAIN_30DAY_STATS_CACHE_TTL_MINUTES = 30;

    /**
     * Get aggregated statistics for the user dashboard.
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $workspaceId = (int) ($user->currentWorkspaceId() ?? 0);
        if (!$workspaceId) {
            return response()->json(['error' => 'Workspace not found'], 404);
        }

        $workspace = Workspace::find($workspaceId);
        if (!$workspace) {
            return response()->json(['error' => 'Workspace not found'], 404);
        }

        $cacheKey = "workspace_{$workspaceId}_dashboard_stats";

        // Check response-level cache unless explicitly requesting fresh data
        if (!$request->has('fresh') && Cache::has($cacheKey)) {
            $cachedData = Cache::get($cacheKey);
            if (is_array($cachedData)) {
                return response()->json(['data' => $cachedData]);
            }
        }

        // Fetch domains once to avoid multiple duplicate queries
        $domains = $workspace->domains()->get();
        $totalDomains = $domains->count();

        // 1. Domain 30-day Uptime Statistics (Multi-tier per-domain cache + batch uncached query)
        $domainStatsMap = collect();

        if ($totalDomains > 0) {
            $thirtyDaysAgo = Carbon::now()->subDays(30);
            $missingDomainIds = [];

            foreach ($domains as $domain) {
                $cachedDomainStat = Cache::get("domain_{$domain->id}_30day_stats");
                if ($cachedDomainStat !== null && is_array($cachedDomainStat)) {
                    $domainStatsMap->put($domain->id, (object)$cachedDomainStat);
                } else {
                    $missingDomainIds[] = $domain->id;
                }
            }

            if (!empty($missingDomainIds)) {
                $queriedStats = DomainStatusEvent::whereIn('domain_id', $missingDomainIds)
                    ->where('checked_at', '>=', $thirtyDaysAgo)
                    ->selectRaw('domain_id, COUNT(*) as total_count, SUM(CASE WHEN status = "up" THEN 1 ELSE 0 END) as up_count')
                    ->groupBy('domain_id')
                    ->get();

                foreach ($missingDomainIds as $dId) {
                    $found = $queriedStats->firstWhere('domain_id', $dId);
                    $totalCount = $found ? (int)$found->total_count : 0;
                    $upCount = $found ? (int)$found->up_count : 0;
                    $statObj = (object)[
                        'total_count' => $totalCount,
                        'up_count' => $upCount
                    ];
                    $domainStatsMap->put($dId, $statObj);
                    Cache::put(
                        "domain_{$dId}_30day_stats",
                        ['total_count' => $totalCount, 'up_count' => $upCount],
                        now()->addMinutes(self::DOMAIN_30DAY_STATS_CACHE_TTL_MINUTES)
                    );
                }
            }
        }

        // Generate Domain List
        $now = Carbon::now();
        $domainsList = $domains->map(function($domain) use ($domainStatsMap, $now) {
            // Generate a 14-day history array
            $history = [];
            for ($i = 13; $i >= 0; $i--) {
                $date = $now->copy()->subDays($i)->format('M d, Y');
                $status = 1;
                if ($i === 0 && $domain->status !== 'up') {
                    $status = 0;
                }
                $history[] = [
                    'status' => $status,
                    'date' => $date
                ];
            }

            $stats = $domainStatsMap->get($domain->id);
            $totalCount = $stats ? (int)$stats->total_count : 0;
            $upCount = $stats ? (int)$stats->up_count : 0;
            $uptime = $totalCount > 0 ? round(($upCount / $totalCount) * 100, 1) : 100.0;

            return [
                'ulid' => $domain->ulid,
                'name' => $domain->name,
                'status' => $domain->status,
                'uptime' => $uptime,
                'avg_response' => $domain->last_response_time_ms ?? 0,
                'ssl_expiry' => $domain->ssl_days_remaining,
                'last_check' => $domain->last_checked_at ? $domain->last_checked_at->diffForHumans() : 'Never',
                'history' => $history,
            ];
        });

        $activeDomains = $domainsList->where('status', 'up')->count();
        $inactiveDomains = $totalDomains - $activeDomains;
        $expiringSsl = $domainsList->where('ssl_expiry', '<', 30)->whereNotNull('ssl_expiry')->count();
        $avgUptime = $totalDomains > 0 ? round($domainsList->sum('uptime') / $totalDomains, 1) : 100.0;

        // 2. Incident Stats & Activity Log (Direct workspace queries leveraging indexed keys)
        $totalIncidents = Incident::where('workspace_id', $workspaceId)->count();
        $openIncidentsCount = Incident::where('workspace_id', $workspaceId)->whereNull('resolved_at')->count();

        $recentIncidents = Incident::where('workspace_id', $workspaceId)
            ->with('domain:id,ulid,name')
            ->orderBy('started_at', 'desc')
            ->take(5)
            ->get()
            ->map(function($i) {
                return [
                    'id' => $i->ulid,
                    'type' => 'incident',
                    'message' => ($i->domain ? $i->domain->name : 'Domain') . ' incident: ' . $i->status,
                    'timestamp' => $i->started_at,
                    'is_error' => true
                ];
            });

        // System Logs (Using composite index [workspace_id, created_at])
        $recentLogs = SystemLog::where('workspace_id', $workspaceId)
            ->orderBy('created_at', 'desc')
            ->take(5)
            ->get()
            ->map(function($l) {
                return [
                    'id' => $l->id,
                    'type' => 'log',
                    'message' => $l->message,
                    'timestamp' => $l->created_at,
                    'is_error' => false
                ];
            });

        $systemLogs = $recentIncidents->concat($recentLogs)->sortByDesc('timestamp')->take(5)->values();

        // Audit Logs (Using composite index [workspace_id, occurred_at])
        $auditLogs = AuditLog::where('workspace_id', $workspaceId)
            ->orderBy('occurred_at', 'desc')
            ->take(5)
            ->get()
            ->map(function($l) {
                return [
                    'id' => $l->id,
                    'type' => 'audit',
                    'message' => $l->description ?? ($l->action . ' on ' . $l->entity_name),
                    'timestamp' => $l->occurred_at,
                    'is_error' => false
                ];
            });

        // 3. Departments & Users
        $departments = Department::where('workspace_id', $workspaceId)
            ->with('users:id,name,email')
            ->get()
            ->map(function($dept) {
                return [
                    'ulid' => $dept->ulid,
                    'name' => $dept->name,
                    'users' => $dept->users->map(function($u) {
                        return [
                            'name' => $u->name,
                            'email' => $u->email,
                            'role' => $u->pivot->role ?? 'Member',
                        ];
                    })
                ];
            });

        $workspaceUsers = $workspace->users()->get();
        $recentUsers = $workspaceUsers->take(5)->map(function($u) use ($departments) {
            $departmentName = 'No Department';
            foreach ($departments as $dept) {
                if ($dept['users']->contains('email', $u->email)) {
                    $departmentName = $dept['name'];
                    break;
                }
            }
            return [
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->pivot->role ?? 'Member',
                'departmentName' => $departmentName,
                'last_login_at' => $u->last_login_at ? $u->last_login_at->toIso8601String() : null
            ];
        });

        // Plan details
        $activeSubscription = $workspace->activeSubscription()->with('planPrice.plan')->first();
        $currentPlan = $activeSubscription && $activeSubscription->planPrice && $activeSubscription->planPrice->plan 
            ? $activeSubscription->planPrice->plan->name 
            : 'Free / Trial';

        // 4. Active Integrations (Batch loaded in 3 queries, resolved in-memory, eliminating N+1)
        $allIntegrations = Integration::orderBy('position')->get();
        $wsIntegrations = WorkspaceIntegration::where('workspace_id', $workspaceId)->get()->keyBy('integration_id');
        $notificationChannels = NotificationChannel::where('workspace_id', $workspaceId)
            ->with('domainIntegration:id,integration_id')
            ->get();
        $userIntegrations = UserIntegration::where('workspace_id', $workspaceId)
            ->whereNotNull('access_token')
            ->get();

        $primaryContactEmail = $workspace->primary_contact_email;

        $integrations = $allIntegrations->map(function($integration) use (
            $wsIntegrations,
            $notificationChannels,
            $userIntegrations,
            $primaryContactEmail
        ) {
            $key = $integration->key;
            $wsIntegration = $wsIntegrations->get($integration->id);
            $isWsEnabled = $wsIntegration ? (bool)$wsIntegration->enabled : true;

            // Notification channels count in memory
            $channelCount = $notificationChannels->filter(function($ch) use ($integration, $key) {
                return ($ch->domainIntegration && $ch->domainIntegration->integration_id === $integration->id)
                    || $ch->type === $key;
            })->count();

            $configuredCount = 0;
            $isActive = false;

            if ($key === 'clickup') {
                $hasClickupToken = $userIntegrations->contains('provider', 'clickup');
                $configuredCount = $hasClickupToken ? max(1, $channelCount) : $channelCount;
                $isActive = ($hasClickupToken || $configuredCount > 0) && $isWsEnabled;
            } elseif ($key === 'facebook-ads' || $key === 'facebook_ads') {
                $fbCount = $userIntegrations->filter(fn($ui) => in_array($ui->provider, ['facebook', 'facebook_ads'], true))->count();
                $configuredCount = $fbCount;
                $isActive = $fbCount > 0 && $isWsEnabled;
            } elseif ($key === 'google-ads' || $key === 'google_ads') {
                $googleCount = $userIntegrations->filter(fn($ui) => in_array($ui->provider, ['google', 'google_ads'], true))->count();
                $configuredCount = $googleCount;
                $isActive = $googleCount > 0 && $isWsEnabled;
            } elseif ($key === 'email') {
                $hasEmail = !empty($primaryContactEmail) || $channelCount > 0;
                $configuredCount = $channelCount > 0 ? $channelCount : ($hasEmail ? 1 : 0);
                $isActive = $hasEmail && $isWsEnabled;
            } elseif ($key === 'call') {
                $configuredCount = 0;
                $isActive = false;
            } else {
                $configuredCount = $channelCount;
                $isActive = $channelCount > 0 && $isWsEnabled;
            }

            return [
                'id' => $integration->id,
                'key' => $key,
                'name' => $integration->name,
                'is_active' => (bool)$isActive,
                'configured_count' => (int)$configuredCount,
                'is_launched' => (bool)($integration->is_launched ?? true),
                'position' => $integration->position ?? 0,
            ];
        });

        // 5. Response Time Chart Data (Last 24h) from actual DomainStatusEvents
        $chartData = [];
        $domainIds = $domains->pluck('id')->all();

        if (!empty($domainIds)) {
            $twentyFourHoursAgo = $now->copy()->subHours(24);

            $events = DomainStatusEvent::whereIn('domain_id', $domainIds)
                ->where(function ($q) use ($twentyFourHoursAgo) {
                    $q->where('checked_at', '>=', $twentyFourHoursAgo)
                      ->orWhere(function ($q2) use ($twentyFourHoursAgo) {
                          $q2->whereNull('checked_at')->where('created_at', '>=', $twentyFourHoursAgo);
                      });
                })
                ->whereNotNull('response_time_ms')
                ->where('response_time_ms', '>', 0)
                ->select(['domain_id', 'response_time_ms', 'checked_at', 'created_at'])
                ->get();

            $domainIdToName = $domains->pluck('name', 'id')->all();

            $hourlyData = [];
            foreach ($events as $event) {
                $rawTime = $event->checked_at ?? $event->created_at;
                if (!$rawTime) {
                    continue;
                }
                $checkedAt = Carbon::parse($rawTime);
                $hourKey = $checkedAt->format('Y-m-d H:00');
                $dName = $domainIdToName[$event->domain_id] ?? null;
                if (!$dName) {
                    continue;
                }

                if (!isset($hourlyData[$hourKey][$dName])) {
                    $hourlyData[$hourKey][$dName] = ['total' => 0, 'count' => 0];
                }
                $hourlyData[$hourKey][$dName]['total'] += (int) $event->response_time_ms;
                $hourlyData[$hourKey][$dName]['count'] += 1;
            }

            for ($i = 23; $i >= 0; $i--) {
                $bucketTime = $now->copy()->subHours($i);
                $hourKey = $bucketTime->format('Y-m-d H:00');
                $entry = [
                    'time' => $bucketTime->format('H:00'),
                ];

                foreach ($domains as $domain) {
                    $dName = $domain->name;
                    if (isset($hourlyData[$hourKey][$dName]) && $hourlyData[$hourKey][$dName]['count'] > 0) {
                        $entry[$dName] = (int) round($hourlyData[$hourKey][$dName]['total'] / $hourlyData[$hourKey][$dName]['count']);
                    } else {
                        $entry[$dName] = null;
                    }
                }

                $chartData[] = $entry;
            }
        }

        $defaultRegion = $workspace->onboarding_settings['default_region'] ?? null;

        $lastSyncedAt = clone $now;
        $maxLastCheck = $domains->max('last_checked_at');
        if ($maxLastCheck) {
            $lastSyncedAt = Carbon::parse($maxLastCheck);
        }

        $responseData = [
            'last_synced_at' => $lastSyncedAt->toIso8601String(),
            'domains' => [
                'total' => $totalDomains,
                'active' => $activeDomains,
                'inactive' => $inactiveDomains,
                'expiring_ssl' => $expiringSsl,
                'avg_uptime' => $avgUptime,
                'list' => $domainsList
            ],
            'incidents' => [
                'total' => $totalIncidents,
                'open' => $openIncidentsCount,
            ],
            'organization' => [
                'users' => $workspaceUsers->count(),
                'departments' => $departments->count(),
                'departments_list' => $departments,
                'recent_users' => $recentUsers,
                'current_plan' => $currentPlan,
            ],
            'integrations' => $integrations,
            'system_logs' => $systemLogs,
            'audit_logs' => $auditLogs,
            'chart_data' => $chartData,
            'default_region' => $defaultRegion
        ];

        // Store in short-term workspace cache
        Cache::put($cacheKey, $responseData, now()->addSeconds(self::WORKSPACE_DASHBOARD_CACHE_TTL_SECONDS));

        return response()->json(['data' => $responseData]);
    }

    /**
     * Update the default region in workspace onboarding settings.
     */
    public function updateDefaultRegion(Request $request): JsonResponse
    {
        $request->validate([
            'region' => 'required|string'
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $workspaceId = $user->currentWorkspaceId();
        $workspace = Workspace::find($workspaceId);

        if (!$workspace) {
            return response()->json(['error' => 'Workspace not found'], 404);
        }

        $settings = (array) $workspace->onboarding_settings;
        $settings['default_region'] = $request->region;

        $workspace->onboarding_settings = $settings;
        $workspace->save();

        // Invalidate dashboard stats cache so updated region is immediately reflected
        Cache::forget("workspace_{$workspaceId}_dashboard_stats");

        return response()->json([
            'message' => 'Default region updated successfully',
            'default_region' => $request->region
        ]);
    }
}
