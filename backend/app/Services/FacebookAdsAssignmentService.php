<?php

namespace App\Services;

use App\Models\Domain;
use App\Models\DomainFacebookAssignment;
use App\Models\UserIntegration;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FacebookAdsAssignmentService
{
    private string $fbApiUrl;

    public function __construct()
    {
        $this->fbApiUrl = rtrim(
            config('services.facebook.api_url', env('FACEBOOK_API_URL', 'https://graph.facebook.com/v22.0')),
            '/'
        );
    }
    /**
     * Update Facebook assignments for a domain (PUT semantics).
     * Replaces all assignments for the domain with the provided entities.
     * @param Domain $domain
     * @param int $userIntegrationId
     * @param array $entities
     * @return array
     */
    public function updateEntitiesForDomain(Domain $domain, int $userIntegrationId, array $entities): array
    {
        $integration = UserIntegration::where('id', $userIntegrationId)
            ->where('workspace_id', $domain->workspace_id)
            ->where('provider', 'facebook_ads')
            ->where('status', 'active')
            ->first();

        if (!$integration) {
            return [
                'success' => false,
                'error' => 'Invalid or inactive Facebook integration',
                'assignments' => [],
                'conflicts' => [],
            ];
        }

        // Remove all existing assignments for this domain and integration
        DomainFacebookAssignment::forDomain($domain->id)
            ->forIntegration($userIntegrationId)
            ->delete();

        // Assign new entities
        return $this->assignEntitiesToDomain($domain, $userIntegrationId, $entities);
    }

    /**
     * Get all Facebook assignments for a domain.
     */
    public function getAssignmentsForDomain($domainId): Collection
    {
        return DomainFacebookAssignment::with('userIntegration')
            ->forDomain($domainId)
            ->get();
    }

    /**
     * Get all Facebook assignments for a workspace (across all domains).
     */
    public function getAssignmentsForWorkspace(int $workspaceId): Collection
    {
        return DomainFacebookAssignment::with(['domain', 'userIntegration'])
            ->whereHas('domain', fn($q) => $q->where('workspace_id', $workspaceId))
            ->get();
    }

    /**
     * Assign Facebook entities (ads/campaigns) to a domain.
     * A domain must be linked to ONE Facebook integration.
     *
     * @param Domain $domain
     * @param int $userIntegrationId
     * @param array $entities Array of ['id' => string, 'type' => 'ad'|'campaign', 'name' => string|null]
     * @return array Result with created assignments and any conflicts
     */
    public function assignEntitiesToDomain(Domain $domain, int $userIntegrationId, array $entities): array
    {
        $integration = UserIntegration::where('id', $userIntegrationId)
            ->where('workspace_id', $domain->workspace_id)
            ->where('provider', 'facebook_ads')
            ->where('status', 'active')
            ->first();

        if (!$integration) {
            return [
                'success' => false,
                'error' => 'Invalid or inactive Facebook integration',
                'assignments' => [],
                'conflicts' => [],
            ];
        }

        // Check if domain already has assignments from a DIFFERENT integration
        $existingIntegrationId = DomainFacebookAssignment::forDomain($domain->id)
            ->value('user_integration_id');

        if ($existingIntegrationId && $existingIntegrationId !== $userIntegrationId) {
            return [
                'success' => false,
                'error' => 'Domain is already linked to a different Facebook integration. Remove existing assignments first.',
                'assignments' => [],
                'conflicts' => [],
            ];
        }

        $created = [];
        $conflicts = [];
        $autoPauseResult = null;

        DB::beginTransaction();
        try {
            foreach ($entities as $entity) {
                $entityId = $entity['id'] ?? null;
                $entityType = $entity['type'] ?? 'ad';
                $entityName = $entity['name'] ?? null;
                $campaignId = $entity['campaign_id'] ?? null;
                $campaignStatus = $entity['campaign_status'] ?? null;
                $originalStatus = $campaignStatus ?? ($entity['status'] ?? null);

                if (!$entityId) {
                    continue;
                }

                // Check if this entity is already assigned to another domain
                $existingAssignment = DomainFacebookAssignment::where('facebook_entity_id', $entityId)
                    ->where('facebook_entity_type', $entityType)
                    ->first();

                if ($existingAssignment && $existingAssignment->domain_id !== $domain->id) {
                    $conflicts[] = [
                        'entity_id' => $entityId,
                        'entity_type' => $entityType,
                        'assigned_domain_id' => $existingAssignment->domain_id,
                    ];
                    continue;
                }

                // Create or update assignment
                $updateData = [
                    'domain_id' => $domain->id,
                    'user_integration_id' => $userIntegrationId,
                    'facebook_entity_name' => $entityName,
                    'campaign_id' => $campaignId,
                ];

                if ($originalStatus !== null) {
                    $updateData['original_status'] = $originalStatus;
                }

                $assignment = DomainFacebookAssignment::updateOrCreate(
                    [
                        'facebook_entity_id' => $entityId,
                        'facebook_entity_type' => $entityType,
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
                        $autoPauseResult = $this->pauseAdsForDomain($freshDomain);
                    }
                } catch (\Throwable $pauseException) {
                    Log::error('Failed to auto-pause Facebook ads after assignment while domain is DOWN', [
                        'domain_id' => $domain->id,
                        'error' => $pauseException->getMessage(),
                    ]);
                }
            }

            return [
                'success' => true,
                'assignments' => $created,
                'conflicts' => $conflicts,
                'auto_pause' => $autoPauseResult,
            ];
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Failed to assign Facebook entities to domain', [
                'domain_id' => $domain->id,
                'integration_id' => $userIntegrationId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to create assignments: ' . $e->getMessage(),
                'assignments' => [],
                'conflicts' => [],
                'auto_pause' => null,
            ];
        }
    }

    /**
     * Remove specific assignments from a domain.
     */
    public function removeAssignments($domainId, array $assignmentIds): int
    {
        $domainId = Domain::where('ulid', $domainId)
            ->value('id');

        return DomainFacebookAssignment::forDomain($domainId)
            ->whereIn('id', $assignmentIds)
            ->delete();
    }

    /**
     * Remove all assignments for a domain.
     */
    public function removeAllAssignments($domainId): int
    {
        $domainId = Domain::where('ulid', $domainId)
            ->value('id');
        return DomainFacebookAssignment::forDomain($domainId)->delete();
    }

    /**
     * Toggle a Facebook ad or campaign status using Graph API and return the updated state.
     */
    public function setAdStatus(UserIntegration $integration, string $entityId, bool $enabled): array
    {
        if ($integration->status !== 'active' || empty($integration->access_token)) {
            return [
                'success' => false,
                'message' => 'Invalid integration token',
                'status' => 422,
            ];
        }

        try {
            $token = Crypt::decryptString($integration->access_token);
            $configuredStatus = $enabled ? 'ACTIVE' : 'PAUSED';

            $updateRes = Http::asForm()->post("{$this->fbApiUrl}/{$entityId}", [
                'access_token' => $token,
                'status' => $configuredStatus,
            ]);

            if (!$updateRes->ok()) {
                Log::warning('FB set ad status failed', [
                    'entity_id' => $entityId,
                    'desired_status' => $configuredStatus,
                    'status' => $updateRes->status(),
                    'body' => $updateRes->body(),
                ]);

                return [
                    'success' => false,
                    'message' => 'Failed to update ad status',
                    'status' => 502,
                    'response' => $updateRes->json(),
                ];
            }

            $adStatusRes = Http::get("{$this->fbApiUrl}/{$entityId}", [
                'access_token' => $token,
                'fields' => 'id,configured_status,effective_status',
            ]);

            $finalConfiguredStatus = $configuredStatus;
            $effectiveStatus = null;

            if ($adStatusRes->ok()) {
                $adData = $adStatusRes->json();
                $finalConfiguredStatus = $adData['configured_status'] ?? $configuredStatus;
                $effectiveStatus = $adData['effective_status'] ?? null;
            } else {
                Log::warning('FB fetch updated ad status failed', [
                    'entity_id' => $entityId,
                    'status' => $adStatusRes->status(),
                    'body' => $adStatusRes->body(),
                ]);
            }
            Log::info('FB ad status updated', [
                'entity_id' => $entityId,
                'configured_status' => $finalConfiguredStatus,
                'effective_status' => $effectiveStatus,
            ]);

            $updatedAssignments = DomainFacebookAssignment::where('user_integration_id', $integration->id)
                ->where(function ($query) use ($entityId) {
                    $query->where('facebook_entity_id', $entityId)
                        ->orWhere('campaign_id', $entityId);
                })
                ->update([
                    'original_status' => $finalConfiguredStatus,
                ]);

            Log::debug('Updated Facebook assignment original_status after setAdStatus', [
                'integration_id' => $integration->id,
                'entity_id' => $entityId,
                'original_status' => $finalConfiguredStatus,
                'updated_assignments' => $updatedAssignments,
            ]);

            return [
                'success' => true,
                'data' => [
                    'id' => $entityId,
                    'configured_status' => $finalConfiguredStatus,
                    'effective_status' => $effectiveStatus,
                    'enabled' => $finalConfiguredStatus === 'ACTIVE',
                ],
            ];
        } catch (\Throwable $e) {
            Log::error('Facebook setAdStatus error', [
                'entity_id' => $entityId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Unexpected error while updating ad status',
                'status' => 500,
            ];
        }
    }
    /**
     * Pause all assigned Facebook ads/campaigns when domain goes DOWN.
     * Only pauses entities that are currently ACTIVE.
     */
    public function pauseAdsForDomain(Domain $domain): array
    {
        $assignments = DomainFacebookAssignment::with('userIntegration')
            ->forDomain($domain->id)
            ->get();

        if ($assignments->isEmpty()) {
            Log::info('No Facebook assignments to pause for domain', [
                'domain_id' => $domain->id,
                'domain_url' => $domain->url,
            ]);
            return ['paused' => 0, 'failed' => 0, 'skipped' => 0];
        }

        $results = ['paused' => 0, 'failed' => 0, 'skipped' => 0];

        foreach ($assignments as $assignment) {
            // Pause both ads and campaigns
            if ($assignment->facebook_entity_type === 'ad' || $assignment->facebook_entity_type === 'campaign') {
                $result = $this->pauseSingleEntity($assignment);
                $results[$result]++;
            } else {
                $results['skipped']++;
            }
        }

        Log::info('Facebook ads pause operation completed for domain', [
            'domain_id' => $domain->id,
            'domain_url' => $domain->url,
            'results' => $results,
        ]);

        return $results;
    }

    /**
     * Resume ads/campaigns that were paused by the system when domain comes back UP.
     * Only resumes entities that were system-paused (not user-paused).
     */
    public function resumeAdsForDomain(Domain $domain): array
    {
        $assignments = DomainFacebookAssignment::with('userIntegration')
            ->forDomain($domain->id)
            ->systemPaused() // Only those paused by system
            ->get();

        if ($assignments->isEmpty()) {
            return ['resumed' => 0, 'failed' => 0, 'skipped' => 0];
        }

        $results = ['resumed' => 0, 'failed' => 0, 'skipped' => 0];

        foreach ($assignments as $assignment) {
            $result = $this->resumeSingleEntity($assignment);
            $results[$result]++;
        }

        Log::info('Facebook ads resume operation completed for domain', [
            'domain_id' => $domain->id,
            'domain_url' => $domain->url,
            'results' => $results,
        ]);

        return $results;
    }

    /**
     * Pause a single Facebook entity.
     */
    private function pauseSingleEntity(DomainFacebookAssignment $assignment): string
    {
        // log whole assignment
        Log::debug('Pausing Facebook entity assignment', [
            'assignment' => $assignment->toArray(),
        ]);
        $integration = $assignment->userIntegration;

        if (!$integration || $integration->status !== 'active' || empty($integration->access_token)) {
            Log::warning('Cannot pause Facebook entity: integration invalid', [
                'assignment_id' => $assignment->id,
                'integration_id' => $assignment->user_integration_id,
                'integration_status' => $integration ? $integration->status : 'none',
                'access_token_present' => $integration ? !empty($integration->access_token) : false,
            ]);
            return 'failed';
        }

        try {
            $token = Crypt::decryptString($integration->access_token);

            // Prefer checking the campaign status (so pausing a campaign affects its ads),
            $targetEntityId = $assignment->campaign_id ?: $assignment->facebook_entity_id;
            $entityType = $assignment->facebook_entity_type ?? null;

            // Fetch the entity (campaign or ad) status directly
            $entityRes = Http::get("{$this->fbApiUrl}/{$targetEntityId}", [
                'access_token' => $token,
                'fields' => 'id,configured_status,effective_status',
            ]);

            if (!$entityRes->ok()) {
                $errorPayload = $entityRes->json('error') ?? [];
                Log::warning('Integration not active or missing token for pause', [
                    'assignment_id' => $assignment->id,
                    'entity_id' => $assignment->facebook_entity_id,
                    'facebook_entity_type' => $entityType,
                ]);
                return 'skipped';
            }

            $entityData = $entityRes->json() ?? [];
            $currentStatus = $entityData['configured_status'] ?? $entityData['effective_status'] ?? null;

            // Skip if already paused
            if ($currentStatus === 'PAUSED') {
                Log::debug('Facebook entity already paused, skipping', [
                    'entity_id' => $targetEntityId,
                ]);
                return 'skipped';
            }

            // Only pause if currently ACTIVE
            if ($currentStatus !== 'ACTIVE') {
                Log::debug('Facebook entity not active, skipping pause', [
                    'entity_id' => $targetEntityId,
                    'current_status' => $currentStatus,
                ]);
                return 'skipped';
            }

            // Pause the campaign if available, otherwise pause the entity itself
            $pauseId = $assignment->campaign_id ?: $assignment->facebook_entity_id;
            $updateResult = $this->setAdStatus($integration, $pauseId, false);

            if (!$updateResult['success']) {
                Log::error('Failed to pause Facebook entity via setAdStatus', [
                    'assignment_id' => $assignment->id,
                    'entity_id' => $assignment->facebook_entity_id,
                    'error' => $updateResult['message'] ?? 'Unknown',
                    'response' => $updateResult['response'] ?? null,
                ]);
                return 'failed';
            }

            // Mark as system-paused
            $assignment->markAsSystemPaused($currentStatus);

            return 'paused';
        } catch (\Throwable $e) {
            Log::error('Exception while pausing Facebook entity', [
                'assignment_id' => $assignment->id,
                'entity_id' => $assignment->facebook_entity_id,
                'error' => $e->getMessage(),
            ]);
            return 'failed';
        }
    }

    /**
     * Resume a single Facebook entity that was system-paused.
     */
    private function resumeSingleEntity(DomainFacebookAssignment $assignment): string
    {
        $integration = $assignment->userIntegration;

        if (!$integration || $integration->status !== 'active' || empty($integration->access_token)) {
            Log::warning('Cannot resume Facebook entity: integration invalid', [
                'assignment_id' => $assignment->id,
                'integration_id' => $assignment->user_integration_id,
            ]);
            return 'failed';
        }

        // Only resume if it was active before system-pause
        $originalStatus = $assignment->original_status;
        if ($originalStatus !== 'ACTIVE') {
            Log::debug('Facebook entity was not active before system-pause, clearing flag only', [
                'entity_id' => $assignment->facebook_entity_id,
                'original_status' => $originalStatus,
            ]);
            $assignment->clearSystemPause();
            return 'skipped';
        }

        try {
            $updateResult = $this->setAdStatus($integration, $assignment->campaign_id, true);

            if (!$updateResult['success']) {
                Log::error('Failed to resume Facebook entity via setAdStatus', [
                    'assignment_id' => $assignment->id,
                    'entity_id' => $assignment->facebook_entity_id,
                    'error' => $updateResult['message'] ?? 'Unknown',
                    'response' => $updateResult['response'] ?? null,
                ]);
                return 'failed';
            }

            $assignment->clearSystemPause();

            Log::info('Successfully resumed Facebook entity', [
                'assignment_id' => $assignment->id,
                'entity_id' => $assignment->facebook_entity_id,
            ]);

            return 'resumed';
        } catch (\Throwable $e) {
            Log::error('Exception while resuming Facebook entity', [
                'assignment_id' => $assignment->id,
                'entity_id' => $assignment->facebook_entity_id,
                'error' => $e->getMessage(),
            ]);
            return 'failed';
        }
    }

    /**
     * Check if a Facebook entity is already assigned to any domain.
     */
    public function isEntityAssigned(string $entityId, string $entityType = 'ad'): ?DomainFacebookAssignment
    {
        return DomainFacebookAssignment::where('facebook_entity_id', $entityId)
            ->where('facebook_entity_type', $entityType)
            ->first();
    }

    /**
     * Get available (unassigned) ads from a Facebook integration.
     */
    public function getAvailableAds(UserIntegration $integration, $excludeDomainId = null): array
    {
        if ($integration->status !== 'active' || empty($integration->access_token)) {
            return [];
        }

        try {
            $token = Crypt::decryptString($integration->access_token);
            $accountId = $integration->account_id;

            $adsRes = Http::get("{$this->fbApiUrl}/{$accountId}/ads", [
                'access_token' => $token,
                'fields' => 'id,name,status,effective_status,configured_status,adset{id,name},campaign{id,name,status}',
                'limit' => 100,
            ]);

            if (!$adsRes->ok()) {
                Log::warning('Failed to fetch Facebook ads for assignment', [
                    'integration_id' => $integration->id,
                    'response' => $adsRes->body(),
                ]);
                return [];
            }

            $ads = $adsRes->json('data') ?? [];

            // Get already assigned entity IDs (excluding current domain if specified)
            $assignedQuery = DomainFacebookAssignment::query();
            if ($excludeDomainId) {
                $assignedQuery->where('domain_id', '!=', $excludeDomainId);
            }
            $assignedEntityIds = $assignedQuery->pluck('facebook_entity_id')->toArray();

            // Filter out already assigned ads
            return array_filter($ads, function ($ad) use ($assignedEntityIds) {
                return !in_array($ad['id'], $assignedEntityIds);
            });
        } catch (\Throwable $e) {
            Log::error('Exception while fetching available Facebook ads', [
                'integration_id' => $integration->id,
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }
}
