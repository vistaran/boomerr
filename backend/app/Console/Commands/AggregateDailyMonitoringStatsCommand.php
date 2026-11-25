<?php

namespace App\Console\Commands;

use App\Models\PlatformMonitoringDailyStat;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AggregateDailyMonitoringStatsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'monitor:aggregate-daily {--all : Backfill all historical dates} {--days=3 : Number of recent completed days to recalculate}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Aggregates raw domain_status_events telemetry into daily stats table.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $now = now();
        $todayStart = $now->copy()->startOfDay();

        $query = DB::table('domain_status_events')
            ->whereNotNull('checked_at')
            ->where('checked_at', '<', $todayStart) // only aggregate completed days
            ->selectRaw("
                DATE(checked_at) as date_val,
                COUNT(*) as total_checks,
                SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_checks,
                SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as down_checks
            ")
            ->groupBy(DB::raw('DATE(checked_at)'));

        if (!$this->option('all')) {
            $days = (int) $this->option('days');
            if ($days < 1) $days = 1;
            $startDate = $now->copy()->subDays($days)->startOfDay();
            $query->where('checked_at', '>=', $startDate);
            $this->info("Aggregating completed days since " . $startDate->toDateString());
        } else {
            $this->info("Aggregating ALL historical completed days...");
        }

        // The query returns exactly 1 row per day. Even for 10 years, that is only 3650 rows,
        // which easily fits in memory.
        $results = $query->get();

        $this->info("Found {$results->count()} daily aggregates to upsert.");

        $upsertData = [];
        foreach ($results as $row) {
            $upsertData[] = [
                'date' => $row->date_val,
                'total_checks' => $row->total_checks,
                'up_checks' => $row->up_checks,
                'down_checks' => $row->down_checks,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // Upsert in chunks to be extremely safe, though usually tiny
        foreach (array_chunk($upsertData, 500) as $chunk) {
            PlatformMonitoringDailyStat::upsert(
                $chunk,
                ['date'], // Unique columns
                ['total_checks', 'up_checks', 'down_checks', 'updated_at'] // Columns to update if exists
            );
        }

        $this->info("Successfully upserted daily stats.");
        return Command::SUCCESS;
    }
}
