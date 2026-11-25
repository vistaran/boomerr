<?php

namespace App\Http\Controllers;

use App\Models\Domain;
use App\Models\DomainStatusEvent;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\GoogleAdsAssignmentService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DomainResponseStatsController extends Controller
{
    public function __construct(
        private readonly GoogleAdsAssignmentService $assignmentService,
        private readonly AuditLogService $audit,
    ) {
        try {
            // Constructor initialization
            // Dependency injection errors are handled by the service container
        } catch (\Throwable $e) {
            Log::error('DomainResponseStatsController@__construct error: ' . $e->getMessage(), [
                'exception' => $e,
            ]);
            throw $e;
        }
    }

    public function show(Request $request, $domain_id)
    {
        try {
            $domain = Domain::where('ulid', $domain_id)->firstOrFail();

            $range = $request->query('range', '24h');
            // $bucket = $request->query('bucket', 'auto');
            $allowedRanges = ['24h', '7d', '30d', '1y'];
            $allowedBuckets = ['auto', '10s', '1m', '15m', '1h', '1d'];

            if (!in_array($range, $allowedRanges, true)) {
                return response()->json(['message' => 'Invalid range'], 422);
            }

            // Workspace check
            $user = $request->user();
            if (!$user || (int)$user->workspace_id !== (int)$domain->workspace_id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            [$start, $bucketSeconds, $bucketName] = $this->windowAndBucket($range);

            // Build labels: floor to bucket size between start..now
            $labels = $this->buildLabels($start, now(), $bucketSeconds);

            // MySQL bucketing by seconds
            $formatExpr = "FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(created_at) / $bucketSeconds) * $bucketSeconds)";

            $region = $request->query('region');
            $cacheKey = "domain_response_stats:{$domain->id}:{$range}:" . md5($region ?? 'all');

            $data = \Illuminate\Support\Facades\Cache::remember($cacheKey, 15, function () use ($domain, $range, $start, $bucketSeconds, $bucketName, $labels, $formatExpr, $region) {
                $rangeAgg = DomainStatusEvent::query()
                    ->selectRaw('
                MIN(response_time_ms) as min_ms,
                MAX(response_time_ms) as max_ms,
                AVG(response_time_ms) as avg_ms')
                    ->where('domain_id', $domain->id)
                    ->where('checked_at', '>=', $start)
                    ->whereNotNull('response_time_ms')
                    ->when($region && $region !== 'all', function ($query) use ($region) {
                        $query->where('region', $region);
                    })
                    ->first();

                $rows = DomainStatusEvent::query()
                    ->select([
                        \Illuminate\Support\Facades\DB::raw("$formatExpr AS bucket_ts"),
                        \Illuminate\Support\Facades\DB::raw('AVG(response_time_ms) AS avg_ms'),
                    ])
                    ->where('domain_id', $domain->id)
                    ->where('checked_at', '>=', $start)
                    ->whereNotNull('response_time_ms')
                    ->when($region && $region !== 'all', function ($query) use ($region) {
                        $query->where('region', $region);
                    })
                    ->groupBy('bucket_ts')
                    ->orderBy('bucket_ts')
                    ->get();

                $index = [];
                foreach ($labels as $i => $ts) {
                    $index[$ts] = $i;
                }

                $ms = array_fill(0, count($labels), null);

                foreach ($rows as $row) {
                    $bucketTs = (int) floor(
                        Carbon::parse($row->bucket_ts)->timestamp / $bucketSeconds
                    ) * $bucketSeconds;

                    $ts = Carbon::createFromTimestamp($bucketTs)
                        ->format('Y-m-d H:i:s');

                    if (!array_key_exists($ts, $index)) {
                        continue;
                    }

                    $ms[$index[$ts]] = $row->avg_ms !== null
                        ? (int) round($row->avg_ms)
                        : null;
                }

                return [
                    'domain_id' => $domain->id,
                    'range' => $range,
                    'bucket' => $bucketName,
                    'labels' => $labels,
                    'ms' => $ms,
                    'null_count' => count(array_filter($ms, fn($v) => $v === null)),
                    'min_response_time_ms' => $rangeAgg?->min_ms !== null ? (int)$rangeAgg->min_ms : null,
                    'max_response_time_ms' => $rangeAgg?->max_ms !== null ? (int)$rangeAgg->max_ms : null,
                    'avg_response_time_ms' => $rangeAgg?->avg_ms !== null ? (int) round($rangeAgg->avg_ms) : null,
                ];
            });

            return response()->json([
                'data' => $data,
            ]);
        } catch (\Throwable $e) {
            Log::error('DomainResponseStatsController@show error: ' . $e->getMessage(), [
                'exception' => $e,
                'domain_id' => $domain_id,
            ]);
            return response()->json([
                'message' => 'Internal server error',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function authUser(Request $request): User|JsonResponse
    {
        try {
            $user = $request->user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            return $user;
        } catch (\Throwable $e) {
            Log::error('DomainResponseStatsController@authUser error: ' . $e->getMessage(), [
                'exception' => $e,
            ]);
            return response()->json(['message' => 'Internal server error'], 500);
        }
    }

    private function loadDomain($domainId, User $user): Domain|JsonResponse
    {
        try {
            $domain = Domain::where('ulid', $domainId)
                ->where('workspace_id', $user->workspace_id)
                ->first();

            if (!$domain) {
                return response()->json(['message' => 'Domain not found'], 404);
            }

            return $domain;
        } catch (\Throwable $e) {
            Log::error('DomainResponseStatsController@loadDomain error: ' . $e->getMessage(), [
                'exception' => $e,
                'domainId' => $domainId,
            ]);
            return response()->json(['message' => 'Internal server error'], 500);
        }
    }

    private function windowAndBucket(string $range): array
    {
        try {
            $now = now();

            return match ($range) {
                '24h' => [$now->copy()->subHours(24), 900, '15m'],   // 15 min
                '7d'  => [$now->copy()->subDays(7), 3600, '1h'],    // 1 hour
                '30d' => [$now->copy()->subDays(30), 21600, '6h'],  // 6 hours
                '1y'  => [$now->copy()->subYear(), 86400, '1d'],    // 1 day
                default => [$now->copy()->subHours(24), 900, '15m'],
            };
        } catch (\Throwable $e) {
            Log::error('DomainResponseStatsController@windowAndBucket error: ' . $e->getMessage(), [
                'exception' => $e,
                'range' => $range,
            ]);
            throw $e;
        }
    }

    private function buildLabels(Carbon $start, Carbon $end, int $bucketSeconds): array
    {
        try {
            $labels = [];

            $startTs = (int) floor($start->timestamp / $bucketSeconds) * $bucketSeconds;
            $endTs   = (int) floor($end->timestamp / $bucketSeconds) * $bucketSeconds;

            for ($ts = $startTs; $ts <= $endTs; $ts += $bucketSeconds) {
                $labels[] = gmdate('Y-m-d H:i:s', $ts);
            }

            return $labels;
        } catch (\Throwable $e) {
            Log::error('DomainResponseStatsController@buildLabels error: ' . $e->getMessage(), [
                'exception' => $e,
                'bucketSeconds' => $bucketSeconds,
            ]);
            throw $e;
        }
    }
}
