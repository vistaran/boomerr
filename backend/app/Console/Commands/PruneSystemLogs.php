<?php

namespace App\Console\Commands;

use App\Models\SystemLog;
use Illuminate\Console\Command;

class PruneSystemLogs extends Command
{
    protected $signature = 'system-logs:prune {--dry : Preview how many payloads would be cleared}';

    protected $description = 'Remove expired sensitive payloads from system logs to satisfy retention requirements.';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry');

        $query = SystemLog::query()
            ->whereNotNull('retention_expires_at')
            ->where('retention_expires_at', '<=', now());

        $total = $query->count();

        if ($total === 0) {
            $this->info('No expired system log payloads detected.');
            return self::SUCCESS;
        }

        if ($dryRun) {
            $this->line("{$total} system log entries would be scrubbed.");
            return self::SUCCESS;
        }

        $query->chunkById(500, function ($logs) use (&$total) {
            $ids = $logs->pluck('id');
            SystemLog::whereIn('id', $ids)->update([
                'sensitive_payload' => null,
                'retention_expires_at' => null,
                'updated_at' => now(),
            ]);
        });

        $this->info("Cleared sensitive payloads for {$total} system log entries.");

        return self::SUCCESS;
    }
}
