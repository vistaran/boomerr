<?php

namespace App\Console\Commands;

use App\Models\Domain;
use App\Models\MonitoringRegion;
use App\Services\MonitoringDispatcherService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class RunLambdaUptimeChecks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * php artisan monitor:run-lambda-checks
     */
    protected $signature = 'monitor:run-lambda-checks';

    /**
     * The console command description.
     */
    protected $description = 'Dispatch uptime checks to AWS Lambda for active multi-region domains due for verification.';

    public function __construct(private MonitoringDispatcherService $dispatcherService)
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting Lambda uptime checks dispatcher...');
        Log::info("Starting Lambda uptime checks dispatcher...");

        $isLambdaEnabled = (bool) config('monitoring.lambda_enabled', false) && !app()->environment('local', 'testing');
        if (!$isLambdaEnabled) {
            $this->info('Lambda monitoring is disabled for this environment. Skipping Lambda dispatch (domains monitored locally).');
            Log::info("Lambda monitoring is disabled. Skipping Lambda dispatch.");
            return self::SUCCESS;
        }

        $activeRegions = MonitoringRegion::where('is_active', true)->get();
        if ($activeRegions->isEmpty()) {
            $this->warn('No active monitoring regions configured. Skipping Lambda dispatch (local check will handle domains as fallback).');
            Log::info("No active monitoring regions found for Lambda uptime checks.");
            return self::SUCCESS;
        }

        $now = now();

        // 1. Fetch only active domains that are due for check
        $query = Domain::where('is_active', true)
            ->whereNull('paused_reason')
            ->where(function ($q) use ($now) {
                $q->whereNull('next_check_at')
                  ->orWhere('next_check_at', '<=', $now);
            })
            ->with('company');

        $dueDomains = $query->get();

        if ($dueDomains->isEmpty()) {
            $this->info('No domains due for Lambda check.');
            return self::SUCCESS;
        }

        // 2. Filter domains assigned to Lambda (must have multi_region_monitoring feature)
        $domains = $dueDomains->filter(function ($domain) {
            $hasMultiRegion = $domain->company && $domain->company->hasFeature('multi_region_monitoring');
            if (!$hasMultiRegion) {
                return false; // Handled by local monitor
            }
            return true;
        });

        Log::info("Lambda monitor domains stats", [
            'total_due' => $dueDomains->count(),
            'assigned_lambda' => $domains->count(),
            'assigned_local' => $dueDomains->count() - $domains->count(),
        ]);

        if ($domains->isEmpty()) {
            $this->info('No multi-region domains due for Lambda check.');
            return self::SUCCESS;
        }

        // 3. Deduplicate and collect domains with lock
        $acquiredLocks = [];
        $domainsToDispatch = collect();
        foreach ($domains as $domain) {
            $lockKey = "lambda_check_dispatch_{$domain->id}";
            $lock = Cache::lock($lockKey, 60);

            if (!$lock->get()) {
                Log::debug("Skipping Lambda dispatch for domain #{$domain->id} ({$domain->url}) - check already in progress");
                continue;
            }

            $acquiredLocks[$domain->id] = $lock;
            $domainsToDispatch->push($domain);
        }

        if ($domainsToDispatch->isEmpty()) {
            $this->info('All due domains already in dispatch progress.');
            return self::SUCCESS;
        }

        $chunks = $domainsToDispatch->chunk(50);
        $this->info("Dispatching " . $chunks->count() . " batches ({$domainsToDispatch->count()} domains) to Lambda across {$activeRegions->count()} regions...");
        Log::info("Dispatching Lambda checks in batches", [
            'batches' => $chunks->count(),
            'domain_count' => $domainsToDispatch->count(),
            'regions_count' => $activeRegions->count(),
        ]);

        foreach ($chunks as $index => $chunk) {
            $this->line("Dispatching batch " . ($index + 1) . " (Size: {$chunk->count()}) to Lambda...");
            try {
                $this->dispatcherService->dispatchBatchToLambda($chunk);

                // Advance next_check_at only AFTER successful dispatch to Lambda
                foreach ($chunk as $domain) {
                    $interval = $domain->getEffectiveCheckInterval();
                    $domain->next_check_at = now()->addMinutes($interval);
                    $domain->save();
                }
            } catch (\Throwable $e) {
                // Release locks for domains in failed batch so they are retried on the next tick
                foreach ($chunk as $domain) {
                    if (isset($acquiredLocks[$domain->id])) {
                        try {
                            $acquiredLocks[$domain->id]->release();
                        } catch (\Throwable) {
                        }
                    }
                }

                Log::error("Failed to dispatch batch " . ($index + 1) . " to Lambda: {$e->getMessage()}", [
                    'exception' => $e,
                ]);
            }
        }

        $this->info('Done ✔');
        return self::SUCCESS;
    }
}
