<?php

namespace App\Console\Commands;

use App\Models\DomainStatusEvent;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillCheckedAtCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'monitoring:backfill-checked-at {--dry-run : Only show how many records would be updated}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Safely backfills checked_at with created_at for historical DomainStatusEvents where checked_at is NULL';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info("Starting backfill of checked_at...");

        $totalQuery = DB::table('domain_status_events')->whereNull('checked_at');
        $totalToUpdate = $totalQuery->count();

        if ($totalToUpdate === 0) {
            $this->info("No records found with checked_at = NULL. Backfill is complete.");
            return Command::SUCCESS;
        }

        $this->info("Found {$totalToUpdate} records needing backfill.");

        if ($this->option('dry-run')) {
            $this->info("Dry run complete. No records were modified.");
            return Command::SUCCESS;
        }

        $processed = 0;
        $chunkSize = 5000;

        // Process in chunks updating directly via ID ranges or chunkById
        // Since we are modifying the query condition (checked_at), chunkById on 'id' is safe,
        // but it's even safer to just do a simple DB update with limits if supported,
        // or just chunkById and collect IDs then update.
        
        $totalChunks = ceil($totalToUpdate / $chunkSize);
        $bar = $this->output->createProgressBar($totalToUpdate);

        $totalQuery->orderBy('id')->chunkById($chunkSize, function ($events) use ($bar, &$processed) {
            $ids = $events->pluck('id')->toArray();
            
            DB::table('domain_status_events')
                ->whereIn('id', $ids)
                ->whereNull('checked_at')
                ->update(['checked_at' => DB::raw('created_at')]);
            
            $processed += count($ids);
            $bar->advance(count($ids));
        });

        $bar->finish();
        $this->newLine();
        
        $remaining = DB::table('domain_status_events')->whereNull('checked_at')->count();

        $this->info("Backfill complete! Processed: {$processed} rows.");
        $this->info("Remaining NULL checked_at rows: {$remaining}");

        return Command::SUCCESS;
    }
}
