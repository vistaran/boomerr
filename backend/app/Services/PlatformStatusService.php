<?php

namespace App\Services;

use App\Models\BoomerrIncident;
use App\Models\BoomerrServiceStatus;
use App\Models\BoomerrScheduledMaintenance;
use App\Models\DomainStatusEvent;
use App\Models\MonitoringRegion;
use App\Models\NodeHeartbeat;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PlatformStatusService
{
    // Node definitions matching spec §3.4
    const NODES = [
        ['node_id' => 'node-ap-south-1', 'aws_region' => 'ap-south-1', 'name' => 'Node 1 - Mumbai, India', 'label' => 'india', 'lat' => 19.0760, 'lng' => 72.8777],
        ['node_id' => 'node-us-east-1', 'aws_region' => 'us-east-1', 'name' => 'Node 2 - N. Virginia, USA', 'label' => 'virginia', 'lat' => 37.9267, 'lng' => -77.8],
        ['node_id' => 'node-us-west-2', 'aws_region' => 'us-west-2', 'name' => 'Node 3 - Oregon, USA', 'label' => 'oregon', 'lat' => 43.8041, 'lng' => -120.5542],
        ['node_id' => 'node-eu-central-1', 'aws_region' => 'eu-central-1', 'name' => 'Node 4 - Frankfurt, Germany', 'label' => 'frankfurt', 'lat' => 50.1109, 'lng' => 8.6821],
        ['node_id' => 'node-af-south-1', 'aws_region' => 'af-south-1', 'name' => 'Node 5 - Cape Town, South Africa', 'label' => 'south-africa', 'lat' => -33.9249, 'lng' => 18.4241],
    ];

    // Spec §3.5 degradation thresholds (seconds)
    const HEARTBEAT_HEALTHY_MAX = 60;   // < 60s → healthy
    const HEARTBEAT_DEGRADED_MAX = 300;  // 60–300s → degraded; > 300s → down

    const LATENCY_HEALTHY_MAX = 500;   // < 500ms healthy
    const LATENCY_DEGRADED_MAX = 2000;  // 500–2000ms degraded

    const SUCCESS_HEALTHY_MIN = 99.0;  // > 99% healthy
    const SUCCESS_DEGRADED_MIN = 95.0;  // 95–99% degraded; < 95% down

    /**
     * Build the full /api/status response payload.
     */
    public function getStatusPayload(): array
    {
        $nodes = $this->getNodeStatuses();
        $services = $this->getServiceStatuses();
        $platform = $this->getPlatformChecks();
        $incidents = $this->getActiveIncidents();
        $maintenance = $this->getActiveMaintenance();

        $overallStatus = $this->computeOverallStatus($nodes, $services, $incidents, $maintenance);

        return [
            'overall_status' => $overallStatus,
            'last_checked_at' => now()->toIso8601String(),
            'uptime_30d' => $this->getAggregate30dUptime($services),
            'nodes' => $nodes,
            'services' => $services,
            'platform' => $platform,
            'active_incidents' => $incidents,
            'maintenance' => $maintenance,
        ];
    }

    /**
     * Compute health for all 5 nodes from domain_status_events.
     */
    public function getNodeStatuses(): array
    {
        $now = now();
        $nodes = [];

        // Fetch the latest real heartbeat records received from Lambdas
        $heartbeats = NodeHeartbeat::latestPerNode();

        foreach (self::NODES as $nodeDef) {
            $region = $nodeDef['aws_region'];
            $nodeId = $nodeDef['node_id'];
            $hb = $heartbeats->get($nodeId);

            $lastHeartbeatSeconds = null;
            $nodeStatus = 'down';
            $latencyMs = null;
            $checksRun24h = null;
            $successRate24h = null;

            if ($hb && $hb->created_at->diffInHours($now) < 24) {
                $lastHeartbeatSeconds = (int) $hb->created_at->diffInSeconds($now);
                $latencyMs = $hb->latency_ms;
                $checksRun24h = $hb->checks_run_24h;
                $successRate24h = $hb->success_rate_24h;

                // Evaluate real-time node health based on heartbeat age & metrics
                if ($lastHeartbeatSeconds === null || $lastHeartbeatSeconds > self::HEARTBEAT_DEGRADED_MAX) { // > 300s → down / offline
                    $nodeStatus = 'down';
                } elseif ($lastHeartbeatSeconds >= self::HEARTBEAT_HEALTHY_MAX) { // 60s - 300s → degraded
                    $nodeStatus = 'degraded';
                } elseif ($successRate24h !== null && $successRate24h < 50.0) { // Critical failure < 50% → down
                    $nodeStatus = 'down';
                } elseif ($latencyMs !== null && $latencyMs > 10000) { // Severe timeout > 10s → down
                    $nodeStatus = 'down';
                } elseif (($successRate24h !== null && $successRate24h < self::SUCCESS_HEALTHY_MIN) || ($latencyMs !== null && $latencyMs > self::LATENCY_HEALTHY_MAX)) {
                    $nodeStatus = 'degraded';
                } else {
                    $nodeStatus = 'healthy';
                }
            } else {
                // If no heartbeat record exists, reflect real state (unknown) without fabricating telemetry
                $nodeStatus = 'unknown';
                $lastHeartbeatSeconds = null;
                $latencyMs = null;
                $checksRun24h = null;
                $successRate24h = null;
            }

            $nodes[] = array_merge($nodeDef, [
                'status' => $nodeStatus,
                'last_heartbeat_ago_s' => $lastHeartbeatSeconds,
                'latency_ms' => $latencyMs,
                'checks_run_24h' => $checksRun24h,
                'success_rate_24h' => $successRate24h,
            ]);
        }

        return $nodes;
    }

    /**
     * Infer node status from domain_status_events (no separate heartbeat row).
     */
    private function inferNodeStatusFromEvents(
        string $region,
        Carbon $now,
        ?int &$lastHeartbeatSeconds,
        ?int &$latencyMs,
        ?int &$checksRun24h,
        ?float &$successRate24h
    ): string {
        $latest = DomainStatusEvent::where('region', $region)
            ->orderByDesc('checked_at')
            ->first(['checked_at', 'response_time_ms', 'status']);

        if (!$latest) {
            $lastHeartbeatSeconds = null;
            return 'down';
        }

        $checkedAt = Carbon::parse($latest->checked_at);
        $lastHeartbeatSeconds = (int) $checkedAt->diffInSeconds($now);
        $latencyMs = $latest->response_time_ms;

        // Compute 24h stats from region events efficiently in one pass
        $window = $now->copy()->subHours(24);
        $stats = DomainStatusEvent::where('region', $region)
            ->where('checked_at', '>=', $window)
            ->selectRaw("
                COUNT(*) as total_checks,
                SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_checks
            ")
            ->first();

        $total = (int) ($stats->total_checks ?? 0);
        $ups = (int) ($stats->up_checks ?? 0);

        $checksRun24h = $total;
        $successRate24h = $total > 0 ? round(($ups / $total) * 100, 2) : null;

        // Apply thresholds - Spec: < 60s → healthy | >= 60s and <= 300s → degraded | > 300s → down
        if ($lastHeartbeatSeconds > self::HEARTBEAT_DEGRADED_MAX)
            return 'down';
        if ($lastHeartbeatSeconds >= self::HEARTBEAT_HEALTHY_MAX)
            return 'degraded';
        if ($successRate24h !== null && $successRate24h < self::SUCCESS_DEGRADED_MIN)
            return 'down';
        if ($successRate24h !== null && $successRate24h < self::SUCCESS_HEALTHY_MIN)
            return 'degraded';
        if ($latencyMs !== null && $latencyMs > self::LATENCY_DEGRADED_MAX)
            return 'down';
        if ($latencyMs !== null && $latencyMs > self::LATENCY_HEALTHY_MAX)
            return 'degraded';

        return 'healthy';
    }

    /**
     * Get all service statuses from the boomerr_service_status table.
     */
    public function getServiceStatuses(): array
    {
        $dailyBars = $this->getServiceDailyBars();

        return BoomerrServiceStatus::all()->map(function ($svc) use ($dailyBars) {
            return [
                'service_id' => $svc->service_id,
                'service_name' => $svc->service_name,
                'status' => $svc->status,
                'uptime_7d' => $svc->uptime_7d,
                'uptime_30d' => $svc->uptime_30d,
                'uptime_90d' => $svc->uptime_90d,
                'checks_today' => $svc->checks_today,
                'failures_today' => $svc->failures_today,
                'updated_at' => $svc->updated_at?->toIso8601String(),
                'daily_bars' => $dailyBars,
            ];
        })->values()->toArray();
    }

    private function getServiceDailyBars(): array
    {
        $now = now();
        $todayStart = $now->copy()->startOfDay();
        $from89d = $now->copy()->subDays(89)->startOfDay()->toDateString();
        $todayStr = $todayStart->toDateString();

        $historicalAggregates = \App\Models\PlatformMonitoringDailyStat::where('date', '>=', $from89d)
            ->get()
            ->keyBy('date');

        // Fetch today's counts explicitly
        $todayStats = DomainStatusEvent::where('checked_at', '>=', $todayStart)
            ->selectRaw("
                COUNT(*) as total_checks,
                SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_checks
            ")
            ->first();

        $bars = [];
        for ($i = 89; $i >= 0; $i--) {
            $d = $now->copy()->subDays($i);
            $dateStr = $d->format('Y-m-d');
            $label = $d->format('M d');

            $total = 0;
            $ups = 0;

            if ($dateStr === $todayStr) {
                $total = (int) ($todayStats->total_checks ?? 0);
                $ups = (int) ($todayStats->up_checks ?? 0);
            } elseif ($historicalAggregates->has($dateStr)) {
                $agg = $historicalAggregates->get($dateStr);
                $total = $agg->total_checks;
                $ups = $agg->up_checks;
            }

            if ($total === 0) {
                $bars[] = [
                    'date' => $label,
                    'uptime' => 100.0,
                    'status' => 'operational',
                ];
            } else {
                $uptimePct = round(($ups / $total) * 100, 2);
                $bars[] = [
                    'date' => $label,
                    'uptime' => $uptimePct,
                    'status' => $uptimePct < 100 ? 'degraded' : 'operational',
                ];
            }
        }

        return $bars;
    }

    /**
     * Perform live HTTP checks on Dashboard, Website, and API.
     * Results are cached for 60 seconds to avoid hammering our own infra.
     */
    public function getPlatformChecks(): array
    {
        return Cache::remember('platform_http_checks', 15, function () {
            $frontendUrl = rtrim(config('app.frontend_url') ?? config('app.url', 'http://localhost:8080'), '/');
            $apiUrl = rtrim(config('app.url', 'http://localhost:8080'), '/');

            $targets = [
                ['name' => 'Web Dashboard', 'url' => config('services.platform.dashboard_url', $frontendUrl)],
                ['name' => 'Public Website', 'url' => config('services.platform.website_url', $frontendUrl)],
                ['name' => 'REST API', 'url' => config('services.platform.api_health_url', $apiUrl . '/api/health')],
            ];

            $results = [];
            foreach ($targets as $target) {
                try {
                    $start = microtime(true);
                    $response = Http::timeout(5)->get($target['url']);
                    $latency = (int) ((microtime(true) - $start) * 1000);
                    $results[] = [
                        'name' => $target['name'],
                        'url' => $target['url'],
                        'status' => $response->successful() ? 'up' : 'down',
                        'latency_ms' => $latency,
                        'http_code' => $response->status(),
                    ];
                } catch (\Throwable $e) {
                    Log::warning("Platform HTTP check failed for {$target['name']}: " . $e->getMessage());
                    $results[] = [
                        'name' => $target['name'],
                        'url' => $target['url'],
                        'status' => 'down',
                        'latency_ms' => null,
                        'http_code' => null,
                    ];
                }
            }
            return $results;
        });
    }

    /**
     * Get active (unresolved) platform incidents.
     */
    public function getActiveIncidents(): array
    {
        return BoomerrIncident::active()
            ->orderByDesc('incident_started_at')
            ->get()
            ->map(fn($i) => $this->formatIncident($i))
            ->toArray();
    }

    /**
     * Compute overall system status from nodes, services, and active incidents.
     * Rules (spec §2.1):
     *  - 🔴 Major Outage:       3+ nodes down OR core uptime-checking service down
     *  - 🟡 Partial Degradation: 1–2 nodes degraded OR 1 non-critical service degraded
     *  - 🟢 All Operational:     everything healthy
     */
    public function computeOverallStatus(array $nodes, array $services, array $incidents, array $maintenance = []): string
    {
        if (!empty($maintenance)) {
            // Maintenance overrides green but not incidents
            if (empty($incidents)) {
                return 'maintenance';
            }
        }

        if (!empty($incidents)) {
            // Active incidents always indicate at minimum degraded
            return count($incidents) > 0 ? 'degraded' : 'operational';
        }

        $nodesDown = collect($nodes)->where('status', 'down')->count();
        $nodesDegraded = collect($nodes)->where('status', 'degraded')->count();
        $coreDown = collect($services)->where('service_id', 'uptime-monitoring')->where('status', 'down')->isNotEmpty();

        if ($nodesDown >= 3 || $coreDown)
            return 'major_outage';
        if ($nodesDown >= 1 || $nodesDegraded >= 1)
            return 'degraded';

        $anyServiceDegraded = collect($services)->whereIn('status', ['degraded', 'down'])->isNotEmpty();
        if ($anyServiceDegraded)
            return 'degraded';

        return 'operational';
    }

    /**
     * Get active or upcoming maintenance within 24h.
     */
    public function getActiveMaintenance(): array
    {
        return BoomerrScheduledMaintenance::whereIn('status', ['upcoming', 'in_progress'])
            ->where('end_time', '>=', now())
            ->orderBy('start_time', 'asc')
            ->get()
            ->toArray();
    }

    /**
     * Compute aggregate 30d uptime from all service statuses.
     */
    private function getAggregate30dUptime(array $services): float
    {
        $uptimes = array_column($services, 'uptime_30d');
        $uptimes = array_filter($uptimes, fn($v) => $v !== null);
        if (empty($uptimes))
            return 100.0;
        return round(array_sum($uptimes) / count($uptimes), 2);
    }

    /**
     * Format a BoomerrIncident for the API response.
     */
    public function formatIncident(BoomerrIncident $incident): array
    {
        return [
            'id' => $incident->id,
            'incident_id' => $incident->incident_id,
            'incident_title' => $incident->incident_title,
            'incident_status' => $incident->incident_status,
            'incident_impact' => $incident->incident_impact,
            'incident_cause' => $incident->incident_cause,
            'incident_affected_services' => $incident->incident_affected_services ?? [],
            'incident_started_at' => $incident->incident_started_at?->toIso8601String(),
            'incident_resolved_at' => $incident->incident_resolved_at?->toIso8601String(),
            'duration' => $incident->duration,
            'created_at' => $incident->created_at?->toIso8601String(),
        ];
    }

    /**
     * Compute and persist service uptime metrics from domain_status_events.
     * Called by the RefreshPlatformStatus scheduled command.
     */
    public function refreshServiceMetrics(): void
    {
        $now = now();
        $todayStart = $now->copy()->startOfDay();

        // 1. Get today's counts from domain_status_events directly
        // We only scan today's telemetry, drastically reducing overhead.
        $todayStats = DomainStatusEvent::where('checked_at', '>=', $todayStart)
            ->selectRaw("
                COUNT(*) as checks_today,
                SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_today,
                SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as down_today
            ")
            ->first();

        $checksToday = (int) ($todayStats->checks_today ?? 0);
        $upToday = (int) ($todayStats->up_today ?? 0);
        $failuresToday = (int) ($todayStats->down_today ?? 0);

        // 2. Query historical aggregates (excluding today)
        // 90-day window = today + last 89 completed days
        $from89d = $now->copy()->subDays(89)->startOfDay()->toDateString();
        $from29d = $now->copy()->subDays(29)->startOfDay()->toDateString();
        $from6d  = $now->copy()->subDays(6)->startOfDay()->toDateString();

        $historicalAggregates = \App\Models\PlatformMonitoringDailyStat::where('date', '>=', $from89d)
            ->where('date', '<', $todayStart->toDateString())
            ->get();

        $total90 = $checksToday;
        $up90 = $upToday;
        
        $total30 = $checksToday;
        $up30 = $upToday;
        
        $total7 = $checksToday;
        $up7 = $upToday;

        foreach ($historicalAggregates as $agg) {
            $total90 += $agg->total_checks;
            $up90 += $agg->up_checks;
            
            if ($agg->date >= $from29d) {
                $total30 += $agg->total_checks;
                $up30 += $agg->up_checks;
            }
            
            if ($agg->date >= $from6d) {
                $total7 += $agg->total_checks;
                $up7 += $agg->up_checks;
            }
        }

        $updates = [
            'uptime_90d' => $total90 > 0 ? round(($up90 / $total90) * 100, 2) : 100.00,
            'uptime_30d' => $total30 > 0 ? round(($up30 / $total30) * 100, 2) : 100.00,
            'uptime_7d' => $total7 > 0 ? round(($up7 / $total7) * 100, 2) : 100.00,
            'checks_today' => $checksToday,
            'failures_today' => $failuresToday,
            'updated_at' => $now,
        ];

        // Apply identical updates to both services that rely on domain_status_events telemetry
        foreach (['uptime-monitoring', 'response-time'] as $serviceId) {
            BoomerrServiceStatus::where('service_id', $serviceId)->update($updates);
        }
        
        // SSL, domain-expiry, and AI insights don't use domain_status_events in the same way,
        // so they default to 100% unless an admin manually marks them degraded.
    }

    /**
     * Refresh and persist node heartbeats from domain_status_events.
     * Called by the RefreshPlatformStatus scheduled command.
     */
    public function refreshNodeHeartbeats(): void
    {
        $now = now();

        foreach (self::NODES as $nodeDef) {
            $region = $nodeDef['aws_region'];
            $nodeId = $nodeDef['node_id'];

            $lastHeartbeatSeconds = null;
            $latencyMs = null;
            $checksRun24h = null;
            $successRate24h = null;

            $status = $this->inferNodeStatusFromEvents(
                $region,
                $now,
                $lastHeartbeatSeconds,
                $latencyMs,
                $checksRun24h,
                $successRate24h
            );

            NodeHeartbeat::create([
                'node_id' => $nodeId,
                'aws_region' => $region,
                'status' => $status,
                'latency_ms' => $latencyMs,
                'checks_run_24h' => $checksRun24h,
                'success_rate_24h' => $successRate24h,
            ]);
        }
    }
}
