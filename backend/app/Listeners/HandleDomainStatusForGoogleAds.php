<?php

namespace App\Listeners;

use App\Events\DomainStatusUpdated;
use App\Services\GoogleAdsAssignmentService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

class HandleDomainStatusForGoogleAds implements ShouldQueue
{
    /**
     * The name of the queue the job should be sent to.
     */
    public string $queue = 'default';

    /**
     * The number of seconds to wait before retrying the job.
     */
    public int $backoff = 30;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 3;

    public function __construct(
        private readonly GoogleAdsAssignmentService $assignmentService
    ) {}

    /**
     * Handle the event.
     */
    public function handle(DomainStatusUpdated $event): void
    {
        $domain = $event->domain;
        $status = $domain->status;

        try {
            if ($status === 'down') {
                // Domain is DOWN - pause assigned Google Ads campaigns
                $results = $this->assignmentService->pauseCampaignsForDomain($domain);

                Log::info('Auto-paused Google Ads campaigns for domain going DOWN', [
                    'domain_id' => $domain->id,
                    'domain_url' => $domain->url,
                    'results' => $results,
                ]);
            } elseif ($status === 'up') {
                // Domain is UP - resume system-paused campaigns
                $results = $this->assignmentService->resumeCampaignsForDomain($domain);

                Log::info('Auto-resumed Google Ads campaigns for domain going UP', [
                    'domain_id' => $domain->id,
                    'domain_url' => $domain->url,
                    'results' => $results,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('Failed to auto-pause/resume Google Ads campaigns for domain', [
                'domain_id' => $domain->id,
                'domain_url' => $domain->url,
                'status' => $status,
                'error' => $e->getMessage(),
            ]);

            throw $e; // Re-throw to trigger retry
        }
    }

    /**
     * Determine whether the listener should be queued.
     */
    public function shouldQueue(DomainStatusUpdated $event): bool
    {
        // Only queue if domain has Google Ads assignments
        return $event->domain->googleAssignments()->exists();
    }
}
