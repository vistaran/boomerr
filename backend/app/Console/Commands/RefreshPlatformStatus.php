<?php

namespace App\Console\Commands;

use App\Services\PlatformStatusService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RefreshPlatformStatus extends Command
{
    protected $signature   = 'status:refresh';
    protected $description = 'Refresh node heartbeats and service uptime metrics for the Boomerr status page';

    public function handle(PlatformStatusService $service): int
    {
        $this->info('Refreshing service uptime metrics from historical telemetry...');
        try {
            $service->refreshServiceMetrics();
            $this->info('Service metrics updated.');
        } catch (\Throwable $e) {
            Log::error('Failed to refresh service metrics: ' . $e->getMessage());
            $this->error('Failed to refresh service metrics: ' . $e->getMessage());
        }

        $this->info('Done.');
        return Command::SUCCESS;
    }
}
