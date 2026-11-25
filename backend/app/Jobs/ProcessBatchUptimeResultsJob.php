<?php

namespace App\Jobs;

use App\Services\MonitoringService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessBatchUptimeResultsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 120;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    public function __construct(public array $batchData)
    {
        $this->queue = 'monitoring';
    }

    public function handle(MonitoringService $monitoringService): void
    {
        $monitoringService->processBatchResultsSync($this->batchData);
    }
}
