<?php

namespace App\Services;

use App\Models\Domain;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class MonitoringService
{
    /**
     * Store a monitoring result and update the domain status.
     * 
     * @param array $data Expected format: ['website_id' => int, 'status' => int, 'response_time' => int, 'checked_at' => string]
     * @return void
     */
    public function storeResult(array $data): void
    {
        \Illuminate\Support\Facades\Log::info("Storing monitoring result", ['data' => $data]);

        DB::transaction(function () use ($data) {
            $checkedAt = Carbon::parse($data['checked_at'])->format('Y-m-d H:i:s');

            // Update the domain statistics with the latest result
            $domain = Domain::find($data['website_id']);
            if ($domain) {
                if (!\App\Services\PlanLimitService::isDomainEligibleForMonitoring($domain)) {
                    \Illuminate\Support\Facades\Log::info("Skipping monitoring result for ineligible domain", ['domain_id' => $domain->id]);
                    return;
                }

                $region = $data['region'] ?? null;
                $location = $data['location'] ?? null;

                if ($region && !$location) {
                    $location = self::getLocationFromRegion($region);
                }

                $httpStatus = $data['status'] ?? null;
                $eventStatus = ($httpStatus !== null && $httpStatus >= 200 && $httpStatus < 300) ? 'up' : 'down';

                // Idempotency: skip if this exact check was already recorded
                $alreadyRecorded = \App\Models\DomainStatusEvent::where('domain_id', $domain->id)
                    ->where('region', $region)
                    ->where('checked_at', $checkedAt)
                    ->exists();

                if ($alreadyRecorded) {
                    \Illuminate\Support\Facades\Log::info("Skipping duplicate monitoring result", ['domain_id' => $domain->id, 'region' => $region, 'checked_at' => $checkedAt]);
                    return;
                }

                // Store in domain_status_events to keep the history correctly
                $event = \App\Models\DomainStatusEvent::create([
                    'domain_id' => $domain->id,
                    'status' => $eventStatus,
                    'response_time_ms' => $data['response_time'] ?? null,
                    'region' => $region,
                    'location' => $location,
                    'checked_at' => $checkedAt,
                    'check_source' => $data['source'] ?? 'lambda',
                    'http_status' => $httpStatus,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                // Store the error message on the domain if check failed
                if ($eventStatus === 'down' && isset($data['error'])) {
                    $domain->last_response_status = $data['error'];
                } elseif ($eventStatus === 'up') {
                    $domain->last_response_status = $httpStatus;
                }

                \Illuminate\Support\Facades\Log::info("Created DomainStatusEvent", ['event_id' => $event->id, 'region' => $region, 'source' => $data['source'] ?? 'lambda']);

                // Aggregate domain status across all active regions
                $activeRegions = \App\Models\MonitoringRegion::where('is_active', true)->pluck('aws_region')->toArray();
                $freshnessWindowMinutes = config('monitoring.freshness_window_minutes', 2);
                $freshnessThreshold = now()->subMinutes($freshnessWindowMinutes);
                
                $latestEvents = [];
                if (!empty($activeRegions)) {
                    foreach ($activeRegions as $r) {
                        $latestEvent = \App\Models\DomainStatusEvent::where('domain_id', $domain->id)
                            ->where('region', $r)
                            ->where('checked_at', '>=', $freshnessThreshold)
                            ->orderByDesc('checked_at')
                            ->orderByDesc('id')
                            ->first();
                        
                        if ($latestEvent) {
                            $latestEvents[] = $latestEvent;
                        }
                    }
                } else {
                    // Fallback if no regions defined
                    $latestEvents[] = (object) [
                        'status' => $eventStatus,
                        'response_time_ms' => $data['response_time'],
                        'checked_at' => $checkedAt,
                    ];
                }

                $upCount = 0;
                $upResponseTimes = [];
                $latestCheck = null;

                foreach ($latestEvents as $event) {
                    if ($event->status === 'up') {
                        $upCount++;
                        if ($event->response_time_ms !== null) {
                            $upResponseTimes[] = $event->response_time_ms;
                        }
                    }

                    if ($latestCheck === null || Carbon::parse($event->checked_at)->gt(Carbon::parse($latestCheck))) {
                        $latestCheck = $event->checked_at;
                    }
                }

                $minHealthyRegions = config('monitoring.min_healthy_regions', 1);
                $isUp = $upCount >= $minHealthyRegions;
                $newStatus = $isUp ? 'up' : 'down';
                $medianMs = null;

                if ($isUp && count($upResponseTimes) > 0) {
                    sort($upResponseTimes);
                    $count = count($upResponseTimes);
                    $middleVal = (int) floor(($count - 1) / 2);

                    if ($count % 2) {
                        $median = $upResponseTimes[$middleVal];
                    } else {
                        $low = $upResponseTimes[$middleVal];
                        $high = $upResponseTimes[$middleVal + 1];
                        $median = ($low + $high) / 2;
                    }
                    $medianMs = (int) round($median);
                }

                $failureReason = $isUp ? null : ($data['error'] ?? ($httpStatus ? sprintf('HTTP %s', $httpStatus) : 'Domain unreachable'));

                app(\App\Services\DomainHealthService::class)->processExternalUptimeResult(
                    $domain,
                    $newStatus,
                    $httpStatus,
                    $failureReason,
                    $medianMs,
                    $region,
                    $location
                );
            }
        });
    }

    public static function getLocationFromRegion(string $region): string
    {
        $locations = [
            'ap-south-1' => 'Mumbai',
            'us-east-1' => 'N. Virginia',
            'us-east-2' => 'Ohio',
            'us-west-1' => 'N. California',
            'us-west-2' => 'Oregon',
            'af-south-1' => 'Cape Town',
            'ap-east-1' => 'Hong Kong',
            'ap-southeast-1' => 'Singapore',
            'ap-southeast-2' => 'Sydney',
            'ap-southeast-3' => 'Jakarta',
            'ap-northeast-1' => 'Tokyo',
            'ap-northeast-2' => 'Seoul',
            'ap-northeast-3' => 'Osaka',
            'ca-central-1' => 'Central',
            'eu-central-1' => 'Frankfurt',
            'eu-west-1' => 'Ireland',
            'eu-west-2' => 'London',
            'eu-west-3' => 'Paris',
            'eu-south-1' => 'Milan',
            'eu-north-1' => 'Stockholm',
            'me-south-1' => 'Bahrain',
            'sa-east-1' => 'São Paulo',
        ];

        return $locations[$region] ?? $region;
    }

    /**
     * Store a batch of monitoring results and update the domain statuses.
     * 
     * @param array $batchData Expected format: ['region' => string, 'results' => [...]]
     * @return void
     */
    public function storeBatchResults(array $batchData): void
    {
        \Illuminate\Support\Facades\Log::info("Dispatching batch monitoring results to queue", ['count' => count($batchData['results'] ?? [])]);
        \App\Jobs\ProcessBatchUptimeResultsJob::dispatch($batchData);
    }

    /**
     * Synchronously process a batch of monitoring results and update the domain statuses.
     * 
     * @param array $batchData Expected format: ['region' => string, 'results' => [...]]
     * @return void
     */
    public function processBatchResultsSync(array $batchData): void
    {
        \Illuminate\Support\Facades\Log::info("Processing batch monitoring results sync", ['count' => count($batchData['results'] ?? [])]);

        DB::transaction(function () use ($batchData) {
            $region = $batchData['region'] ?? null;
            $location = $batchData['location'] ?? null;
            $source = $batchData['source'] ?? 'lambda';

            if ($region && !$location) {
                $location = self::getLocationFromRegion($region);
            }

            $requestedDomainIds = array_column($batchData['results'] ?? [], 'website_id');
            $validDomainIds = \App\Models\Domain::whereIn('id', $requestedDomainIds)->pluck('id')->toArray();
            $validDomainIdsMap = array_flip($validDomainIds);

            $domainIds = [];
            $eventsToInsert = [];
            $domainUpdates = []; // To keep track of the latest checks for domains

            foreach ($batchData['results'] as $result) {
                $domainId = $result['website_id'];

                if (!isset($validDomainIdsMap[$domainId])) {
                    continue;
                }

                $domainIds[] = $domainId;

                $checkedAt = Carbon::parse($result['checked_at'])->format('Y-m-d H:i:s');
                $httpStatus = $result['status'] ?? null;
                $eventStatus = ($httpStatus !== null && $httpStatus >= 200 && $httpStatus < 300) ? 'up' : 'down';

                $eventsToInsert[] = [
                    'domain_id' => $domainId,
                    'status' => $eventStatus,
                    'response_time_ms' => $result['response_time'] ?? null,
                    'region' => $region,
                    'location' => $location,
                    'checked_at' => $checkedAt,
                    'check_source' => $source,
                    'http_status' => $httpStatus,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                $domainUpdates[$domainId] = [
                    'last_response_status' => $eventStatus === 'down' && isset($result['error']) ? $result['error'] : $httpStatus,
                    'checked_at' => $checkedAt
                ];
            }

            if (empty($eventsToInsert)) {
                return;
            }

            // Pre-check for already inserted events to ensure idempotency on batch retry
            $existingKeys = \App\Models\DomainStatusEvent::whereIn('domain_id', array_unique($domainIds))
                ->where('region', $region)
                ->where('checked_at', '>=', now()->subMinutes(10))
                ->get()
                ->mapWithKeys(fn($e) => ["{$e->domain_id}_{$e->checked_at}" => true]);

            $filteredEventsToInsert = [];
            foreach ($eventsToInsert as $event) {
                $key = "{$event['domain_id']}_{$event['checked_at']}";
                if (!isset($existingKeys[$key])) {
                    $filteredEventsToInsert[] = $event;
                }
            }

            // Bulk insert only non-duplicate events
            if (!empty($filteredEventsToInsert)) {
                \App\Models\DomainStatusEvent::insert($filteredEventsToInsert);
            }

            // Fetch domains that need updating
            $domains = Domain::whereIn('id', array_unique($domainIds))->get()->keyBy('id');

            $activeRegions = \App\Models\MonitoringRegion::where('is_active', true)->pluck('aws_region')->toArray();
            $freshnessWindowMinutes = config('monitoring.freshness_window_minutes', 2);
            $freshnessThreshold = now()->subMinutes($freshnessWindowMinutes);
            $minHealthyRegions = config('monitoring.min_healthy_regions', 1);

            // Fetch recent events for all these domains across active regions to prevent N+1
            // We use DB facade for efficiency or a subquery. 
            // A simpler approach for limited batch size (max 50) is to query all recent events for these domains.
            $recentEvents = \App\Models\DomainStatusEvent::whereIn('domain_id', array_unique($domainIds))
                ->whereIn('region', $activeRegions ?: ['fallback'])
                ->where('checked_at', '>=', $freshnessThreshold)
                ->orderBy('checked_at', 'desc')
                ->orderBy('id', 'desc')
                ->get()
                ->groupBy('domain_id');

            $stableDomainsToUpdate = [];

            foreach ($domains as $domainId => $domain) {
                $domainEvents = $recentEvents->get($domainId, collect());
                
                // Group by region and get the latest
                $latestEventsByRegion = [];
                foreach ($domainEvents as $event) {
                    if (!isset($latestEventsByRegion[$event->region])) {
                        $latestEventsByRegion[$event->region] = $event;
                    }
                }

                if (empty($latestEventsByRegion)) {
                    // Fallback to the current event if no regions are configured or if region doesn't match
                    $currentUpdate = $domainUpdates[$domainId];
                    $latestEventsByRegion[] = (object) [
                        'status' => $currentUpdate['last_response_status'] === 'up' || (is_numeric($currentUpdate['last_response_status']) && $currentUpdate['last_response_status'] >= 200 && $currentUpdate['last_response_status'] < 300) ? 'up' : 'down',
                        'response_time_ms' => null, // We don't have it easily here without mapping, but it's a fallback
                        'checked_at' => $currentUpdate['checked_at']
                    ];
                }

                $upCount = 0;
                $upResponseTimes = [];
                $latestCheck = null;

                foreach ($latestEventsByRegion as $event) {
                    if ($event->status === 'up') {
                        $upCount++;
                        if ($event->response_time_ms !== null) {
                            $upResponseTimes[] = $event->response_time_ms;
                        }
                    }

                    if ($latestCheck === null || Carbon::parse($event->checked_at)->gt(Carbon::parse($latestCheck))) {
                        $latestCheck = $event->checked_at;
                    }
                }

                $isUp = $upCount >= $minHealthyRegions;
                $newStatus = $isUp ? 'up' : 'down';
                $medianMs = null;

                if ($isUp && count($upResponseTimes) > 0) {
                    sort($upResponseTimes);
                    $count = count($upResponseTimes);
                    $middleVal = (int) floor(($count - 1) / 2);

                    if ($count % 2) {
                        $median = $upResponseTimes[$middleVal];
                    } else {
                        $low = $upResponseTimes[$middleVal];
                        $high = $upResponseTimes[$middleVal + 1];
                        $median = ($low + $high) / 2;
                    }
                    $medianMs = (int) round($median);
                }

                $lastStatus = $domainUpdates[$domainId]['last_response_status'] ?? null;
                $httpStatus = is_numeric($lastStatus) ? (int) $lastStatus : null;
                $failureReason = $isUp ? null : (is_string($lastStatus) ? $lastStatus : ($httpStatus ? sprintf('HTTP %s', $httpStatus) : 'Domain unreachable'));

                $isStatusChanged = $domain->status !== $newStatus;
                $isCurrentlyDown = $domain->status === 'down';
                $isInitialCheck = empty($domain->status);

                if ($isStatusChanged || $isCurrentlyDown || $isInitialCheck) {
                    \App\Jobs\ProcessExternalUptimeResultJob::dispatch(
                        $domain->id,
                        $newStatus,
                        $httpStatus,
                        $failureReason,
                        $medianMs,
                        $region,
                        $location
                    );
                } else {
                    $stableDomainsToUpdate[] = [
                        'id' => $domain->id,
                        'last_response_time_ms' => $medianMs,
                    ];
                }
            }

            if (!empty($stableDomainsToUpdate)) {
                $cases = [];
                $ids = [];
                foreach ($stableDomainsToUpdate as $data) {
                    $id = (int) $data['id'];
                    $ms = $data['last_response_time_ms'] === null ? 'NULL' : (int) $data['last_response_time_ms'];
                    $cases[] = "WHEN id = {$id} THEN {$ms}";
                    $ids[] = $id;
                }
                
                $idsStr = implode(',', $ids);
                $casesStr = implode(' ', $cases);
                $now = now()->toDateTimeString();
                
                DB::statement("UPDATE domains SET last_response_time_ms = CASE {$casesStr} ELSE last_response_time_ms END, last_checked_at = '{$now}' WHERE id IN ({$idsStr})");
            }
        });
    }
}
