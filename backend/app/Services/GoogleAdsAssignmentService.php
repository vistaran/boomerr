<?php

namespace App\Services;

use App\Models\Domain;
use App\Models\DomainGoogleAssignment;
use App\Models\GoogleAdsCampaign;
use App\Models\UserIntegration;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GoogleAdsAssignmentService
{
    public function __construct(
        private readonly GoogleAdsService $googleAdsService
    ) {}

    /**
     * Get all Google Ads assignments for a domain.
     */
    public function getAssignmentsForDomain($domainId): Collection
    {
        return DomainGoogleAssignment::with('userIntegration')
            ->forDomain($domainId)
            ->get();
    }

    /**
     * Get available Google Ads integrations for a domain's workspace.
     */
    public function getAvailableIntegrations(int $workspaceId, $domainId): array
    {
        $currentIntegrationId = DomainGoogleAssignment::forDomain($domainId)
            ->value('user_integration_id');

        $integrations = UserIntegration::where('workspace_id', $workspaceId)
            ->where('provider', 'google_ads')
            ->where('status', 'active')
            ->get();

        return [
            'integrations' => $integrations->map(function ($i) use ($currentIntegrationId) {
                $meta = is_array($i->meta_json)
                    ? $i->meta_json
                    : json_decode($i->meta_json ?? '{}', true);
                return [
                    'id' => $i->id,
                    'ulid' => $i->ulid,
                    'account_id' => $i->account_id,
                    'email' => $meta['email'] ?? null,
                    'name' => $meta['name'] ?? null,
                    'is_current' => $i->id === $currentIntegrationId,
                    'connected_at' => $i->connected_at?->toIso8601String(),
                ];
            })->values(),
            'current_integration_id' => $currentIntegrationId,
        ];
    }

    /**
     * Get available campaigns for assignment from a Google Ads integration.
     * Returns campaigns from all non-manager accounts under the integration.
     */
    public function getAvailableCampaigns(UserIntegration $integration, $excludeDomainId = null): array
    {
        // Get all non-manager accounts for this integration
        $accounts = $integration->googleAdsAccounts()
            ->where('is_manager', false)
            ->with(['campaigns' => function ($q) {
                $q->where('status', '!=', 'REMOVED');
            }])
            ->get();

        // Get already assigned campaign IDs (excluding current domain if specified)
        $assignedQuery = DomainGoogleAssignment::query();
        if ($excludeDomainId) {
            $assignedQuery->where('domain_id', '!=', $excludeDomainId);
        }
        $assignedCampaignKeys = $assignedQuery
            ->select('google_campaign_id', 'google_account_id')
            ->get()
            ->map(fn($a) => $a->google_account_id . ':' . $a->google_campaign_id)
            ->toArray();

        $campaigns = [];

        foreach ($accounts as $account) {
            foreach ($account->campaigns as $campaign) {
                $key = $account->customer_id . ':' . $campaign->campaign_id;
                $campaigns[] = [
                    'id' => $campaign->id,
                    'campaign_id' => $campaign->campaign_id,
                    'name' => $campaign->name,
                    'status' => $campaign->status,
                    'channel_type' => $campaign->advertising_channel_type,
                    'account_id' => $account->customer_id,
                    'account_name' => $account->descriptive_name,
                    'is_assigned_elsewhere' => in_array($key, $assignedCampaignKeys, true),
                ];
            }
        }

        return $campaigns;
    }

    /**
     * Update Google Ads assignments for a domain (PUT semantics).
     * Replaces all assignments for the domain with the provided campaigns.
     */
    public function updateCampaignsForDomain(Domain $domain, int $userIntegrationId, array $campaigns): array
    {
        $integration = UserIntegration::where('id', $userIntegrationId)
            ->where('workspace_id', $domain->workspace_id)
            ->where('provider', 'google_ads')
            ->where('status', 'active')
            ->first();

        if (!$integration) {
            return [
                'success' => false,
                'error' => 'Invalid or inactive Google Ads integration',
                'assignments' => [],
                'conflicts' => [],
            ];
        }

        // Remove all existing assignments for this domain and integration
        DomainGoogleAssignment::forDomain($domain->id)
            ->forIntegration($userIntegrationId)
            ->delete();

        // Assign new campaigns
        return $this->assignCampaignsToDomain($domain, $userIntegrationId, $campaigns);
    }

    /**
     * Assign Google Ads campaigns to a domain.
     *
     * @param Domain $domain
     * @param int $userIntegrationId
     * @param array $campaigns Array of ['campaign_id' => string, 'account_id' => string, 'name' => string|null]
     * @return array
     */
    public function assignCampaignsToDomain(Domain $domain, int $userIntegrationId, array $campaigns): array
    {
        $integration = UserIntegration::where('id', $userIntegrationId)
            ->where('workspace_id', $domain->workspace_id)
            ->where('provider', 'google_ads')
            ->where('status', 'active')
            ->first();

        if (!$integration) {
            return [
                'success' => false,
                'error' => 'Invalid or inactive Google Ads integration',
                'assignments' => [],
                'conflicts' => [],
            ];
        }

        // Check if domain already has assignments from a DIFFERENT integration
        $existingIntegrationId = DomainGoogleAssignment::forDomain($domain->id)
            ->value('user_integration_id');

        if ($existingIntegrationId && $existingIntegrationId !== $userIntegrationId) {
            return [
                'success' => false,
                'error' => 'Domain is already linked to a different Google Ads integration. Remove existing assignments first.',
                'assignments' => [],
                'conflicts' => [],
            ];
        }

        $created = [];
        $conflicts = [];

        DB::beginTransaction();
        try {
            foreach ($campaigns as $campaign) {
                $campaignId = $campaign['campaign_id'] ?? null;
                $accountId = $campaign['account_id'] ?? null;
                $name = $campaign['name'] ?? null;
                $status = $campaign['status'] ?? null;

                if (!$campaignId || !$accountId) {
                    continue;
                }

                // Check if this campaign is already assigned to another domain
                $existingAssignment = DomainGoogleAssignment::where('google_campaign_id', $campaignId)
                    ->where('google_account_id', $accountId)
                    ->first();

                if ($existingAssignment && $existingAssignment->domain_id !== $domain->id) {
                    $conflicts[] = [
                        'campaign_id' => $campaignId,
                        'account_id' => $accountId,
                        'assigned_domain_id' => $existingAssignment->domain_id,
                    ];
                    continue;
                }

                // Create or update assignment
                $updateData = [
                    'domain_id' => $domain->id,
                    'user_integration_id' => $userIntegrationId,
                    'campaign_name' => $name,
                    'campaign_status' => $status,
                ];

                if ($status !== null) {
                    $updateData['original_status'] = $status;
                }

                $assignment = DomainGoogleAssignment::updateOrCreate(
                    [
                        'google_campaign_id' => $campaignId,
                        'google_account_id' => $accountId,
                    ],
                    $updateData
                );

                $created[] = $assignment;
            }

            DB::commit();

            // If the domain is currently DOWN, immediately auto-pause the new assignments
            if ($domain->status === 'down' && !empty($created)) {
                try {
                    $freshDomain = $domain->fresh();
                    if ($freshDomain instanceof Domain) {
                        $this->pauseCampaignsForDomain($freshDomain);
                    }
                } catch (\Throwable $e) {
                    Log::error('Failed to auto-pause Google Ads after assignment while domain is DOWN', [
                        'domain_id' => $domain->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            return [
                'success' => true,
                'assignments' => $created,
                'conflicts' => $conflicts,
            ];
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Failed to assign Google Ads campaigns to domain', [
                'domain_id' => $domain->id,
                'integration_id' => $userIntegrationId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to create assignments: ' . $e->getMessage(),
                'assignments' => [],
                'conflicts' => [],
            ];
        }
    }

    /**
     * Remove specific assignments from a domain.
     */
    public function removeAssignments($domainId, array $assignmentIds)
    {
        return DomainGoogleAssignment::forDomain($domainId)
            ->whereIn('id', $assignmentIds)
            ->delete();
    }

    /**
     * Remove all assignments for a domain.
     */
    public function removeAllAssignments($domainId)
    {
        $domainId = Domain::where('ulid', $domainId)
            ->value('id');
        return DomainGoogleAssignment::forDomain($domainId)->delete();
    }

    /**
     * Pause all assigned Google Ads campaigns when domain goes DOWN.
     */
    public function pauseCampaignsForDomain(Domain $domain): array
    {
        $assignments = DomainGoogleAssignment::with('userIntegration')
            ->forDomain($domain->id)
            ->get();

        if ($assignments->isEmpty()) {
            Log::info('No Google Ads assignments to pause for domain', [
                'domain_id' => $domain->id,
                'domain_url' => $domain->url,
            ]);
            return ['paused' => 0, 'failed' => 0, 'skipped' => 0];
        }

        $results = ['paused' => 0, 'failed' => 0, 'skipped' => 0];

        foreach ($assignments as $assignment) {
            $result = $this->pauseSingleCampaign($assignment);
            $results[$result]++;
        }

        Log::info('Google Ads campaigns pause operation completed for domain', [
            'domain_id' => $domain->id,
            'domain_url' => $domain->url,
            'results' => $results,
        ]);

        return $results;
    }

    /**
     * Resume campaigns that were paused by the system when domain comes back UP.
     */
    public function resumeCampaignsForDomain(Domain $domain): array
    {
        $assignments = DomainGoogleAssignment::with('userIntegration')
            ->forDomain($domain->id)
            ->systemPaused()
            ->get();

        if ($assignments->isEmpty()) {
            return ['resumed' => 0, 'failed' => 0, 'skipped' => 0];
        }

        $results = ['resumed' => 0, 'failed' => 0, 'skipped' => 0];

        foreach ($assignments as $assignment) {
            $result = $this->resumeSingleCampaign($assignment);
            $results[$result]++;
        }

        Log::info('Google Ads campaigns resume operation completed for domain', [
            'domain_id' => $domain->id,
            'domain_url' => $domain->url,
            'results' => $results,
        ]);

        return $results;
    }

    /**
     * Pause a single Google Ads campaign.
     */
    private function pauseSingleCampaign(DomainGoogleAssignment $assignment): string
    {
        Log::debug('Pausing Google Ads campaign assignment', [
            'assignment' => $assignment->toArray(),
        ]);

        $integration = $assignment->userIntegration;

        if (!$integration || $integration->status !== 'active' || empty($integration->access_token)) {
            Log::warning('Cannot pause Google Ads campaign: integration invalid', [
                'assignment_id' => $assignment->id,
                'integration_id' => $assignment->user_integration_id,
            ]);
            return 'failed';
        }

        // Skip if already system-paused
        if ($assignment->is_system_paused) {
            return 'skipped';
        }

        try {
            // Get current campaign status from the local DB or the assignment
            $currentStatus = $assignment->campaign_status ?? 'ENABLED';

            // Skip if not currently enabled
            if ($currentStatus !== 'ENABLED') {
                Log::debug('Google Ads campaign not enabled, skipping pause', [
                    'campaign_id' => $assignment->google_campaign_id,
                    'current_status' => $currentStatus,
                ]);
                return 'skipped';
            }

            $result = $this->googleAdsService->setCampaignStatus(
                $integration,
                $assignment->google_account_id,
                $assignment->google_campaign_id,
                false // PAUSED
            );

            if (!$result['success']) {
                Log::error('Failed to pause Google Ads campaign', [
                    'assignment_id' => $assignment->id,
                    'campaign_id' => $assignment->google_campaign_id,
                    'error' => $result['message'],
                ]);
                return 'failed';
            }

            // Mark as system-paused
            $assignment->markAsSystemPaused($currentStatus);

            Log::info('Successfully paused Google Ads campaign', [
                'assignment_id' => $assignment->id,
                'campaign_id' => $assignment->google_campaign_id,
                'original_status' => $currentStatus,
            ]);

            return 'paused';
        } catch (\Throwable $e) {
            Log::error('Exception while pausing Google Ads campaign', [
                'assignment_id' => $assignment->id,
                'campaign_id' => $assignment->google_campaign_id,
                'error' => $e->getMessage(),
            ]);
            return 'failed';
        }
    }

    /**
     * Resume a single Google Ads campaign that was system-paused.
     */
    private function resumeSingleCampaign(DomainGoogleAssignment $assignment): string
    {
        $integration = $assignment->userIntegration;

        if (!$integration || $integration->status !== 'active' || empty($integration->access_token)) {
            Log::warning('Cannot resume Google Ads campaign: integration invalid', [
                'assignment_id' => $assignment->id,
                'integration_id' => $assignment->user_integration_id,
            ]);
            return 'failed';
        }

        // Only resume if it was enabled before system-pause
        $originalStatus = $assignment->original_status;
        if ($originalStatus !== 'ENABLED') {
            Log::debug('Google Ads campaign was not enabled before system-pause, clearing flag only', [
                'campaign_id' => $assignment->google_campaign_id,
                'original_status' => $originalStatus,
            ]);
            $assignment->clearSystemPause();
            return 'skipped';
        }

        try {
            $result = $this->googleAdsService->setCampaignStatus(
                $integration,
                $assignment->google_account_id,
                $assignment->google_campaign_id,
                true // ENABLED
            );

            if (!$result['success']) {
                Log::error('Failed to resume Google Ads campaign', [
                    'assignment_id' => $assignment->id,
                    'campaign_id' => $assignment->google_campaign_id,
                    'error' => $result['message'],
                ]);
                return 'failed';
            }

            $assignment->clearSystemPause();

            Log::info('Successfully resumed Google Ads campaign', [
                'assignment_id' => $assignment->id,
                'campaign_id' => $assignment->google_campaign_id,
            ]);

            return 'resumed';
        } catch (\Throwable $e) {
            Log::error('Exception while resuming Google Ads campaign', [
                'assignment_id' => $assignment->id,
                'campaign_id' => $assignment->google_campaign_id,
                'error' => $e->getMessage(),
            ]);
            return 'failed';
        }
    }
}
