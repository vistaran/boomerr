<?php

namespace App\Http\Controllers;

use App\Models\Domain;
use App\Models\DomainStatusEvent;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DomainStatusStatsController extends Controller
{
    public function show(Request $request, $domain_id)
    {
        try {
            $domain = Domain::where('ulid', $domain_id)->firstOrFail();

            $range = $request->query('range', '24h');
            $allowed = ['24h', '7d', '30d', '1y'];

            if (!in_array($range, $allowed, true)) {
                return response()->json(['message' => 'Invalid range'], 422);
            }

            $user = $request->user();
            if (!$user || (int)$user->workspace_id !== (int)$domain->workspace_id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            [$start, $bucketSeconds, $bucketLabel] = $this->getWindowAndBucket($range);
            $region = $request->query('region');
            $cacheKey = "domain_status_stats:{$domain->id}:{$range}:" . md5($region ?? 'all');

            $data = \Illuminate\Support\Facades\Cache::remember($cacheKey, 15, function () use ($domain, $start, $range, $bucketSeconds, $bucketLabel, $region) {
                // Fetch status events with eager-loaded incident and select only required fields
                $events = DomainStatusEvent::query()
                    ->select(['id', 'domain_id', 'status', 'created_at', 'checked_at', 'incident_id', 'region'])
                    ->with('incident:id,ulid')
                    ->where('domain_id', $domain->id)
                    ->where('checked_at', '>=', $start)
                    ->when($region && $region !== 'all', function ($query) use ($region) {
                        $query->where('region', $region);
                    })
                    ->orderBy('created_at')
                    ->get();

                if ($events->isEmpty()) {
                    return [
                        'domain_id' => $domain->id,
                        'range' => $range,
                        'bucket' => $bucketLabel,
                        'buckets' => [],
                        'latest_down_event' => null,
                    ];
                }

                $bucketMap = [];
                $latestDown = null;

                foreach ($events as $event) {
                    $bucketTs = (int) floor($event->created_at->timestamp / $bucketSeconds) * $bucketSeconds;
                    $status = $event->status === 'down' ? 'down' : 'up';
                    $incidentUlid = $status === 'down' ? ($event->incident?->ulid ?? null) : null;

                    $bucketMap[$bucketTs] = [
                        'bucket_start' => \Carbon\Carbon::createFromTimestamp($bucketTs)->toIso8601String(),
                        'status' => $status,
                        'incident_ulid' => $incidentUlid,
                    ];

                    if ($status === 'down') {
                        $latestDown = $event;
                    }
                }

                ksort($bucketMap);

                return [
                    'domain_id' => $domain->id,
                    'range' => $range,
                    'bucket' => $bucketLabel,
                    'buckets' => array_values($bucketMap),
                    'latest_down_event' => $latestDown ? [
                        'id' => $latestDown->id,
                        'created_at' => $latestDown->created_at?->toIso8601String(),
                        'incident_ulid' => $latestDown->incident?->ulid,
                    ] : null,
                ];
            });

            return response()->json([
                'data' => $data,
            ]);
        } catch (\Throwable $e) {
            Log::error('DomainStatusStatsController@show error: ' . $e->getMessage(), [
                'exception' => $e,
                'domain_id' => $domain_id,
            ]);
            return response()->json([
                'message' => 'Internal server error',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function getWindowAndBucket(string $range): array
    {
        try {
            $now = now();

            return match ($range) {
                '24h' => [$now->copy()->subHours(24), 3600, 'hour'],
                '7d'  => [$now->copy()->subDays(7), 43200, '12h'],   // 12 hours
                '30d' => [$now->copy()->subDays(30), 86400, 'day'],
                '1y'  => [$now->copy()->subYear(), 2592000, 'month'], // 30d month buckets
                default => throw new \InvalidArgumentException("Invalid range: $range"),
            };
        } catch (\Throwable $e) {
            Log::error('DomainStatusStatsController@getWindowAndBucket error: ' . $e->getMessage(), [
                'exception' => $e,
                'range' => $range,
            ]);
            return [null, null, null, $e->getMessage()];
        }
    }

    private function buildLabels(Carbon $start, Carbon $end, string $bucket): array
    {
        try {
            $labels = [];
            $cursor = $start->copy()->startOf($bucket === 'hour' ? 'hour' : 'day');
            $end = $end->copy()->startOf($bucket === 'hour' ? 'hour' : 'day');
            while ($cursor <= $end) {
                $labels[] = $bucket === 'hour'
                    ? $cursor->format('Y-m-d H:00')
                    : $cursor->format('Y-m-d');
                $cursor->add($bucket === 'hour' ? 'hour' : 'day', 1);
            }
            return $labels;
        } catch (\Throwable $e) {
            Log::error('DomainStatusStatsController@buildLabels error: ' . $e->getMessage(), [
                'exception' => $e,
            ]);
            return [];
        }
    }

    public function regionalStatus(Request $request, $domain_id)
    {
        try {
            $domain = Domain::where('ulid', $domain_id)->firstOrFail();

            $user = $request->user();
            if (!$user || (int)$user->workspace_id !== (int)$domain->workspace_id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            // Get active regions
            $activeRegions = \App\Models\MonitoringRegion::where('is_active', true)->get();

            $requestedRegion = $request->query('region');
            $cacheKey = "domain_regional_status:{$domain->id}:" . md5($requestedRegion ?? 'all');

            $regionalData = \Illuminate\Support\Facades\Cache::remember($cacheKey, 15, function () use ($domain, $activeRegions, $requestedRegion) {
                // 1. Grouped query across all regions in a single database round-trip
                $statsByRegion = DomainStatusEvent::query()
                    ->where('domain_id', $domain->id)
                    ->where('checked_at', '>=', now()->subHours(24))
                    ->groupBy('region')
                    ->selectRaw('
                        region,
                        MIN(CASE WHEN status = "up" THEN response_time_ms END) as min_time,
                        MAX(CASE WHEN status = "up" THEN response_time_ms END) as max_time,
                        AVG(CASE WHEN status = "up" THEN response_time_ms END) as avg_time,
                        COUNT(*) as total_count,
                        SUM(CASE WHEN status = "up" THEN 1 ELSE 0 END) as up_count
                    ')
                    ->get()
                    ->keyBy('region');

                $data = [];

                foreach ($activeRegions as $region) {
                    $awsRegion = $region->aws_region;

                    // Query latest event per region using indexed (domain_id, region, checked_at)
                    $latestEvent = DomainStatusEvent::query()
                        ->where('domain_id', $domain->id)
                        ->where('region', $awsRegion)
                        ->orderByDesc('checked_at')
                        ->orderByDesc('id')
                        ->first();

                    if (!$latestEvent) {
                        continue;
                    }

                    $stats = $statsByRegion->get($awsRegion);
                    $totalCount = $stats ? (int) $stats->total_count : 0;
                    $upCount = $stats ? (int) $stats->up_count : 0;
                    $uptimePercent = $totalCount > 0 ? round(($upCount / $totalCount) * 100, 1) : 100.0;

                    $item = [
                        'region' => $awsRegion,
                        'region_name' => $region->name,
                        'location' => $latestEvent->location,
                        'status' => $latestEvent->status,
                        'response_time_ms' => $latestEvent->response_time_ms,
                        'min_response_time_ms' => $stats && $stats->min_time !== null ? (int) $stats->min_time : null,
                        'max_response_time_ms' => $stats && $stats->max_time !== null ? (int) $stats->max_time : null,
                        'avg_response_time_ms' => $stats && $stats->avg_time !== null ? (int) round($stats->avg_time) : null,
                        'uptime_percent' => $uptimePercent,
                        'total_checks_24h' => $totalCount,
                        'checked_at' => $latestEvent->checked_at?->toIso8601String(),
                    ];

                    // If a specific region history is requested
                    if ($requestedRegion === $awsRegion) {
                        $history = DomainStatusEvent::query()
                            ->where('domain_id', $domain->id)
                            ->where('region', $awsRegion)
                            ->orderByDesc('checked_at')
                            ->orderByDesc('id')
                            ->limit(30)
                            ->get()
                            ->map(function ($event) {
                                return [
                                    'id' => $event->id,
                                    'status' => $event->status,
                                    'response_time_ms' => $event->response_time_ms,
                                    'error_message' => $event->error_message,
                                    'checked_at' => $event->checked_at?->toIso8601String(),
                                ];
                            })
                            ->reverse()
                            ->values();

                        $incidents = DomainStatusEvent::query()
                            ->where('domain_id', $domain->id)
                            ->where('region', $awsRegion)
                            ->where('status', 'down')
                            ->orderByDesc('checked_at')
                            ->orderByDesc('id')
                            ->limit(10)
                            ->get()
                            ->map(function ($event) {
                                return [
                                    'id' => $event->id,
                                    'error_message' => $event->error_message ?? 'Connection or response failure',
                                    'checked_at' => $event->checked_at?->toIso8601String(),
                                ];
                            });

                        $item['history'] = $history;
                        $item['recent_incidents'] = $incidents;
                    }

                    $data[] = $item;
                }

                return $data;
            });

            return response()->json([
                'data' => $regionalData
            ]);
        } catch (\Throwable $e) {
            Log::error('DomainStatusStatsController@regionalStatus error: ' . $e->getMessage(), [
                'exception' => $e,
                'domain_id' => $domain_id,
            ]);
            return response()->json([
                'message' => 'Internal server error',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
