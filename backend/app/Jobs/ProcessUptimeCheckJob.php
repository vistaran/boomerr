<?php

namespace App\Jobs;

use App\Models\Domain;
use App\Services\DomainHealthService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;

class ProcessUptimeCheckJob implements ShouldQueue, ShouldBeUnique
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

    /**
     * The number of seconds after which the job's unique lock will be released.
     */
    public int $uniqueFor = 120;

    /**
     * Create a new job instance.
     */
    public function __construct(public int $domainId)
    {
        $this->queue = 'monitoring';
    }

    /**
     * The unique ID of the job.
     */
    public function uniqueId(): string
    {
        return (string) $this->domainId;
    }

    /**
     * Get the middleware the job should pass through.
     *
     * @return array<int, object>
     */
    public function middleware(): array
    {
        // Prevent concurrent checks for the same domain.
        // dontRelease() ensures that if a check is already running, 
        // this duplicate job is simply discarded instead of piling up in the queue.
        return [(new WithoutOverlapping((string) $this->domainId))->dontRelease()];
    }

    /**
     * Execute the job.
     */
    public function handle(DomainHealthService $healthService): void
    {
        $domain = Domain::find($this->domainId);

        if (!$domain || !\App\Services\PlanLimitService::isDomainEligibleForMonitoring($domain)) {
            return;
        }

        $healthService->runUptimeCheck($domain);
    }
}
