<?php

namespace App\Console\Commands;

use App\Jobs\ProcessUptimeCheckJob;
use App\Models\Domain;
use App\Models\MonitoringRegion;
use App\Services\DomainHealthService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class RunUptimeChecks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * php artisan monitor:run-uptime-checks
     */
    protected $signature = 'monitor:run-uptime-checks';

    /**
     * The console command description.
     */
    protected $description = 'Check uptime for active local-assigned domains due for verification.';

    public function __construct(private DomainHealthService $healthService)
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting local system uptime checks...');
        Log::info("Starting local system uptime checks...");

        $now = now();

        // 1. Fetch only active domains that are due for check (next_check_at is null or past)
        $query = Domain::where('is_active', true)
            ->whereNull('paused_reason')
            ->where(function ($q) use ($now) {
                $q->whereNull('next_check_at')
                  ->orWhere('next_check_at', '<=', $now);
            })
            ->with('company');

        $dueDomains = $query->get();

        if ($dueDomains->isEmpty()) {
            $this->info('No domains due for local check.');
            return self::SUCCESS;
        }

        $isLambdaEnabled = (bool) config('monitoring.lambda_enabled', false) && !app()->environment('local', 'testing');
        $hasActiveRegions = $isLambdaEnabled && MonitoringRegion::where('is_active', true)->exists();

        // 2. Filter domains assigned to local system
        // If multi-region monitoring is active and enabled for Lambda, domains with multi_region_monitoring feature are checked via Lambda.
        // Otherwise (or in local/testing/disabled environments), local check monitors all domains (both free and paid).
        $domains = $dueDomains->filter(function ($domain) use ($hasActiveRegions) {
            if (!$hasActiveRegions) {
                return true; // All domains monitored locally if Lambda monitoring is not active/enabled
            }

            $hasMultiRegion = $domain->company && $domain->company->hasFeature('multi_region_monitoring');
            if ($hasMultiRegion) {
                return false; // Assigned exclusively to Lambda
            }

            return true;
        });

        Log::info("Local monitor check dispatch summary", [
            'total_due' => $dueDomains->count(),
            'assigned_local' => $domains->count(),
            'assigned_lambda' => $dueDomains->count() - $domains->count(),
        ]);

        if ($domains->isEmpty()) {
            $this->info('No local domains due for check.');
            return self::SUCCESS;
        }

        $dispatchedCount = 0;

        foreach ($domains as $domain) {
            // Producer-level deduplication: ensure we don't enqueue if a check is already pending/running
            $lockKey = "uptime_check_dispatch_{$domain->id}";
            $lock = Cache::lock($lockKey, 60);

            if (!$lock->get()) {
                Log::debug("Skipping dispatch for domain #{$domain->id} ({$domain->url}) - check already in progress or dispatched");
                continue;
            }

            try {
                $this->line("Dispatching [Local] {$domain->url} to queue...");
                ProcessUptimeCheckJob::dispatch($domain->id);

                // Advance next_check_at only AFTER successful dispatch
                $interval = $domain->getEffectiveCheckInterval();
                $domain->next_check_at = now()->addMinutes($interval);
                $domain->save();

                $dispatchedCount++;
            } catch (\Throwable $e) {
                // Dispatch failed: release lock so the next tick can retry, do NOT advance next_check_at
                try {
                    $lock->release();
                } catch (\Throwable) {
                }

                Log::error("Failed to dispatch local uptime check for domain #{$domain->id} ({$domain->url}): {$e->getMessage()}", [
                    'domain_id' => $domain->id,
                    'exception' => $e,
                ]);
            }
        }

        $this->info("Dispatched {$dispatchedCount} local uptime check jobs ✔");
        return self::SUCCESS;
    }
}
