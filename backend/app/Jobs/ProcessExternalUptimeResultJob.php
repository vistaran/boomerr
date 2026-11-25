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

class ProcessExternalUptimeResultJob implements ShouldQueue, ShouldBeUnique
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
    public int $uniqueFor = 60;

    public function __construct(
        public int $domainId,
        public string $status,
        public ?int $httpStatus,
        public ?string $failureReason,
        public ?int $durationMs,
        public string $region,
        public string $location
    ) {
        $this->queue = 'monitoring';
    }

    /**
     * The unique ID of the job.
     */
    public function uniqueId(): string
    {
        return (string) $this->domainId;
    }

    public function middleware(): array
    {
        return [(new WithoutOverlapping((string) $this->domainId))->dontRelease()];
    }

    public function handle(DomainHealthService $healthService): void
    {
        $domain = Domain::find($this->domainId);

        if (!$domain || !\App\Services\PlanLimitService::isDomainEligibleForMonitoring($domain)) {
            return;
        }

        $healthService->processExternalUptimeResult(
            $domain,
            $this->status,
            $this->httpStatus,
            $this->failureReason,
            $this->durationMs,
            $this->region,
            $this->location
        );
    }
}
