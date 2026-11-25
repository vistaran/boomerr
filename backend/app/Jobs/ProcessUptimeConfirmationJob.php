<?php

namespace App\Jobs;

use App\Models\Domain;
use App\Services\DomainHealthService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;

class ProcessUptimeConfirmationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 60;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    public function __construct(
        public int $domainId,
        public int $attempt,
        public ?int $initialHttpStatus = null,
        public ?string $initialFailureReason = null,
        public string $source = 'local',
        public string $region = 'local',
        public string $location = 'local'
    ) {
        $this->queue = 'monitoring';
    }

    public function handle(DomainHealthService $healthService): void
    {
        $domain = Domain::find($this->domainId);

        if (!$domain || !\App\Services\PlanLimitService::isDomainEligibleForMonitoring($domain)) {
            Cache::forget("domain_down_confirmation_{$this->domainId}");
            return;
        }

        $healthService->runConfirmationCheck(
            $domain,
            $this->attempt,
            $this->initialHttpStatus,
            $this->initialFailureReason,
            $this->source,
            $this->region,
            $this->location
        );
    }
}
