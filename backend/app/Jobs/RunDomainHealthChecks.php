<?php

namespace App\Jobs;

use App\Models\Domain;
use App\Services\DomainHealthService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class RunDomainHealthChecks implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 120;
    public int $tries = 1;

    public function __construct(public Domain $domain, public bool $suppressStatusNotification = false)
    {
        //
    }

    public function handle(DomainHealthService $service): void
    {
        $domain = $this->domain->fresh();
        if (!$domain || !\App\Services\PlanLimitService::isDomainEligibleForMonitoring($domain)) {
            return;
        }

        $service->runFullHealthCheck($domain, $this->suppressStatusNotification);
    }
}
