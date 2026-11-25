<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CleanupStaleMonitoringJobs extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'queue:cleanup-stale-monitoring
                            {--dry-run : Inspect and report job classification without deleting}
                            {--force : Execute safe deletion of stale monitoring jobs}
                            {--age=10 : Age in minutes beyond which monitoring jobs are considered stale}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Safely classify queue backlog and purge only stale monitoring checks while preserving all business-critical notifications, logs, and webhooks.';

    /**
     * Job classes that are safe to prune when older than the age threshold
     * because upcoming scheduler cycles produce fresh monitoring results.
     */
    protected array $staleMonitoringClasses = [
        'App\Jobs\ProcessUptimeCheckJob',
        'App\Jobs\ProcessExternalUptimeResultJob',
        'App\Jobs\ProcessBatchUptimeResultsJob',
        'App\Jobs\RunDomainHealthChecks',
    ];

    public function handle(): int
    {
        $this->info("=========================================================");
        $this->info("  Boomerr Queue Backlog Analyzer & Safe Cleanup Tool    ");
        $this->info("=========================================================\n");

        if (!DB::getSchemaBuilder()->hasTable('jobs')) {
            $this->error("The 'jobs' table does not exist in the current database connection.");
            return self::FAILURE;
        }

        $totalJobs = DB::table('jobs')->count();
        $this->line("Total Pending Jobs in Queue: <fg=yellow>{$totalJobs}</>");

        if ($totalJobs === 0) {
            $this->info("Queue is completely empty. Nothing to clean up.");
            return self::SUCCESS;
        }

        $ageMinutes = (int) $this->option('age');
        $cutoffTimestamp = now()->subMinutes($ageMinutes)->getTimestamp();

        $this->line("Stale Threshold: Jobs created before <fg=cyan>" . date('Y-m-d H:i:s', $cutoffTimestamp) . " ({$ageMinutes} min ago)</>\n");

        // Analyze queues
        $byQueue = DB::table('jobs')->select('queue', DB::raw('count(*) as count'))->groupBy('queue')->get();
        $this->info("Queue Breakdown:");
        $queueRows = [];
        foreach ($byQueue as $q) {
            $queueRows[] = [$q->queue, number_format($q->count)];
        }
        $this->table(['Queue Name', 'Job Count'], $queueRows);

        $this->info("\nClassifying jobs by type...");

        $staleJobIds = [];
        $jobClassification = [];
        $protectedJobCount = 0;
        $staleMonitoringJobCount = 0;
        $freshMonitoringJobCount = 0;

        // Process in chunks to avoid memory exhaustion on large tables
        DB::table('jobs')->select('id', 'queue', 'payload', 'created_at')->orderBy('id')->chunk(5000, function ($jobs) use (
            $cutoffTimestamp,
            &$staleJobIds,
            &$jobClassification,
            &$protectedJobCount,
            &$staleMonitoringJobCount,
            &$freshMonitoringJobCount
        ) {
            foreach ($jobs as $job) {
                $payload = json_decode($job->payload, true);
                $displayName = $payload['displayName'] ?? ($payload['data']['commandName'] ?? 'Unknown Job');

                if (!isset($jobClassification[$displayName])) {
                    $jobClassification[$displayName] = [
                        'total' => 0,
                        'stale' => 0,
                        'fresh_or_protected' => 0,
                        'is_monitoring' => in_array($displayName, $this->staleMonitoringClasses, true),
                    ];
                }

                $jobClassification[$displayName]['total']++;

                $isMonitoringClass = in_array($displayName, $this->staleMonitoringClasses, true);
                $isOlderThanCutoff = ($job->created_at <= $cutoffTimestamp);

                if ($isMonitoringClass && $isOlderThanCutoff) {
                    $jobClassification[$displayName]['stale']++;
                    $staleJobIds[] = $job->id;
                    $staleMonitoringJobCount++;
                } elseif ($isMonitoringClass) {
                    $jobClassification[$displayName]['fresh_or_protected']++;
                    $freshMonitoringJobCount++;
                } else {
                    $jobClassification[$displayName]['fresh_or_protected']++;
                    $protectedJobCount++;
                }
            }
        });

        // Display classification table
        $typeRows = [];
        foreach ($jobClassification as $name => $stats) {
            $typeRows[] = [
                $name,
                $stats['is_monitoring'] ? '<fg=yellow>Monitoring</>' : '<fg=green>Business Critical (Protected)</>',
                number_format($stats['total']),
                number_format($stats['stale']),
                number_format($stats['fresh_or_protected']),
            ];
        }

        $this->table(['Job Class / Type', 'Category', 'Total', 'Stale (Eligible for Cleanup)', 'Protected / Recent'], $typeRows);

        $this->line("\n<fg=cyan>Summary:</>");
        $this->line("  - Stale Monitoring Jobs (Older than {$ageMinutes}m): <fg=red>" . number_format($staleMonitoringJobCount) . "</>");
        $this->line("  - Recent Monitoring Jobs (Within {$ageMinutes}m): <fg=yellow>" . number_format($freshMonitoringJobCount) . "</>");
        $this->line("  - Protected Business Jobs (Never deleted): <fg=green>" . number_format($protectedJobCount) . "</>");

        $isDryRun = $this->option('dry-run') || !$this->option('force');

        if ($isDryRun) {
            $this->warn("\n[DRY RUN / AUDIT ONLY] No jobs were deleted.");
            $this->line("To safely delete the <fg=red>" . number_format(count($staleJobIds)) . "</> stale monitoring jobs, run:");
            $this->line("<fg=green>php artisan queue:cleanup-stale-monitoring --force --age={$ageMinutes}</>\n");
            return self::SUCCESS;
        }

        if (empty($staleJobIds)) {
            $this->info("\nNo stale monitoring jobs found matching the criteria. No action taken.");
            return self::SUCCESS;
        }

        $this->warn("\nProceeding with safe deletion of " . count($staleJobIds) . " stale monitoring jobs...");

        $deletedCount = 0;
        $chunks = array_chunk($staleJobIds, 1000);

        foreach ($chunks as $chunk) {
            $deletedCount += DB::table('jobs')->whereIn('id', $chunk)->delete();
        }

        $this->info("✔ Successfully purged {$deletedCount} stale monitoring jobs from the queue.");
        $this->info("✔ {$protectedJobCount} business-critical jobs and {$freshMonitoringJobCount} recent checks remain active in the queue.\n");

        Log::info("Cleaned up stale monitoring queue backlog", [
            'purged_stale_jobs' => $deletedCount,
            'protected_jobs_preserved' => $protectedJobCount,
            'recent_checks_preserved' => $freshMonitoringJobCount,
            'age_threshold_minutes' => $ageMinutes,
        ]);

        return self::SUCCESS;
    }
}
