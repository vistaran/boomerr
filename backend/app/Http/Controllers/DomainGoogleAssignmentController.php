<?php

namespace App\Http\Controllers;

use App\Models\Domain;
use App\Models\DomainGoogleAssignment;
use App\Models\User;
use App\Models\UserIntegration;
use App\Services\AuditLogService;
use App\Services\GoogleAdsAssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class DomainGoogleAssignmentController extends Controller
{
    public function __construct(
        private readonly GoogleAdsAssignmentService $assignmentService,
        private readonly AuditLogService $audit,
    ) {}

    private function authUser(Request $request): User|JsonResponse
    {
        try {
            $user = $request->user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            return $user;
        } catch (Throwable $e) {
            Log::error('Auth user failed in DomainGoogleAssignmentController', [
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    private function loadDomain($domainId, User $user): Domain|JsonResponse
    {
        try {
            $domain = Domain::where('ulid', $domainId)
                ->where('workspace_id', $user->workspace_id)
                ->first();

            if (!$domain) {
                return response()->json(['message' => 'Domain not found'], 404);
            }

            return $domain;
        } catch (Throwable $e) {
            Log::error('Load domain failed in DomainGoogleAssignmentController', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * List Google Ads assignments for a domain.
     */
    public function index(Request $request, $domainId): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            if ($user instanceof JsonResponse) return $user;

            $domain = $this->loadDomain($domainId, $user);
            if ($domain instanceof JsonResponse) return $domain;

            $assignments = $this->assignmentService->getAssignmentsForDomain($domain->id);
            return response()->json([
                'data' => $assignments->map(fn($a) => [
                    'id' => $a->id,
                    'ulid' => $a->ulid,
                    'google_campaign_id' => $a->google_campaign_id,
                    'google_account_id' => $a->google_account_id,
                    'campaign_name' => $a->campaign_name,
                    'campaign_status' => $a->campaign_status,
                    'is_system_paused' => $a->is_system_paused,
                    'system_paused_at' => $a->system_paused_at?->toIso8601String(),
                    'original_status' => $a->original_status,
                    'integration' => $a->userIntegration ? [
                        'id' => $a->userIntegration->id,
                        'ulid' => $a->userIntegration->ulid,
                        'account_id' => $a->userIntegration->account_id,
                    ] : null,
                    'created_at' => $a->created_at?->toIso8601String(),
                ]),
            ]);
        } catch (Throwable $e) {
            Log::error('Domain Google assignments index failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Get available Google Ads integrations for a domain.
     */
    public function availableIntegrations(Request $request, $domainId): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            if ($user instanceof JsonResponse) return $user;

            $domain = $this->loadDomain($domainId, $user);
            if ($domain instanceof JsonResponse) return $domain;

            $result = $this->assignmentService->getAvailableIntegrations($user->workspace_id, $domainId);

            return response()->json([
                'data' => $result['integrations'],
                'current_integration_id' => $result['current_integration_id'],
            ]);
        } catch (Throwable $e) {
            Log::error('Google available integrations failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Get available campaigns from a Google Ads integration.
     */
    public function availableCampaigns(Request $request, $domainId, int $integrationId): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            if ($user instanceof JsonResponse) return $user;

            $domain = $this->loadDomain($domainId, $user);
            if ($domain instanceof JsonResponse) return $domain;

            $integration = UserIntegration::where('id', $integrationId)
                ->where('workspace_id', $user->workspace_id)
                ->where('provider', 'google_ads')
                ->where('status', 'active')
                ->first();

            if (!$integration) {
                return response()->json(['message' => 'Integration not found'], 404);
            }

            $campaigns = $this->assignmentService->getAvailableCampaigns($integration, $domain->id);
            $assignedIds = DomainGoogleAssignment::forDomain($domain->id)
                ->forIntegration($integrationId)
                ->get()
                ->map(fn($a) => $a->google_account_id . ':' . $a->google_campaign_id)
                ->toArray();

            return response()->json([
                'data' => $campaigns,
                'assigned_keys' => $assignedIds,
            ]);
        } catch (Throwable $e) {
            Log::error('Google available campaigns fetch failed', [
                'domain_id' => $domainId,
                'integration_id' => $integrationId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Create new assignments (POST).
     */
    public function store(Request $request, $domainId): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            if ($user instanceof JsonResponse) return $user;

            if (!$user->canManageCompanyResources()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $domain = $this->loadDomain($domainId, $user);
            if ($domain instanceof JsonResponse) return $domain;

            $validated = $request->validate([
                'integration_id' => ['required', 'integer'],
                'campaigns' => ['required', 'array', 'min:1'],
                'campaigns.*.campaign_id' => ['required', 'string'],
                'campaigns.*.account_id' => ['required', 'string'],
                'campaigns.*.name' => ['sometimes', 'nullable', 'string'],
                'campaigns.*.status' => ['sometimes', 'nullable', 'string'],
            ]);

            $result = $this->assignmentService->assignCampaignsToDomain(
                $domain,
                $validated['integration_id'],
                $validated['campaigns']
            );

            if (!$result['success']) {
                return response()->json([
                    'message' => $result['error'],
                    'conflicts' => $result['conflicts'],
                ], 422);
            }

            // Extract campaign names for audit log
            $campaignNames = array_values(array_filter(
                array_map(fn($c) => $c['name'] ?? null, $validated['campaigns'])
            ));

            $this->audit->googleAdsAssigned($user, $domain, count($result['assignments']), [
                'campaign_count' => count($validated['campaigns']),
                'campaigns' => implode(', ', $campaignNames),
            ]);

            return response()->json([
                'message' => 'Assignments created successfully',
                'data' => [
                    'assigned' => count($result['assignments']),
                    'conflicts' => $result['conflicts'],
                ],
            ], 201);
        } catch (Throwable $e) {
            Log::error('Store Google assignments failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Update assignments (PUT semantics - replace all).
     */
    public function update(Request $request, $domainId): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            if ($user instanceof JsonResponse) return $user;

            if (!$user->canManageCompanyResources()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $domain = $this->loadDomain($domainId, $user);
            if ($domain instanceof JsonResponse) return $domain;

            // Count existing assignments before update
            $existingCount = DomainGoogleAssignment::forDomain($domain->id)->count();

            $validated = $request->validate([
                'integration_id' => ['required', 'integer'],
                'campaigns' => ['required', 'array'],
                'campaigns.*.campaign_id' => ['required', 'string'],
                'campaigns.*.account_id' => ['required', 'string'],
                'campaigns.*.name' => ['sometimes', 'nullable', 'string'],
                'campaigns.*.status' => ['sometimes', 'nullable', 'string'],
            ]);

            $result = $this->assignmentService->updateCampaignsForDomain(
                $domain,
                $validated['integration_id'],
                $validated['campaigns']
            );

            if (!$result['success']) {
                return response()->json([
                    'message' => $result['error'],
                    'conflicts' => $result['conflicts'],
                ], 422);
            }

            $newCount = count($result['assignments']);
            $added = max(0, $newCount - $existingCount);
            $removed = max(0, $existingCount - $newCount);

            // Extract campaign names for audit log
            $campaignNames = array_values(array_filter(
                array_map(fn($c) => $c['name'] ?? null, $validated['campaigns'])
            ));

            // If assignments were removed, log unassign event first
            if ($removed > 0) {
                $this->audit->googleAdsUnassigned($user, $domain, $removed, [
                    'operation' => 'update',
                    'total_before' => $existingCount,
                    'total_after' => $newCount,
                ]);
            }

            // Log assign event (for added or updated assignments) - only if there are assignments
            if ($newCount > 0) {
                $this->audit->googleAdsAssigned($user, $domain, $newCount, [
                    'operation' => 'update',
                    'campaigns' => implode(', ', $campaignNames),
                    'added' => $added,
                    'removed' => $removed,
                ]);
            }

            return response()->json([
                'message' => 'Assignments updated successfully',
                'data' => [
                    'updated' => count($result['assignments']),
                    'conflicts' => $result['conflicts'],
                ],
            ]);
        } catch (Throwable $e) {
            Log::error('Update Google assignments failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Remove assignments (DELETE).
     */
    public function destroy(Request $request, $domainId): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            if ($user instanceof JsonResponse) return $user;

            if (!$user->canManageCompanyResources()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $domain = $this->loadDomain($domainId, $user);
            if ($domain instanceof JsonResponse) return $domain;

            $validated = $request->validate([
                'assignment_ids' => ['sometimes', 'array'],
                'assignment_ids.*' => ['integer'],
                'remove_all' => ['sometimes', 'boolean'],
            ]);

            $removed = ($validated['remove_all'] ?? false)
                ? $this->assignmentService->removeAllAssignments($domainId)
                : $this->assignmentService->removeAssignments(
                    $domainId,
                    $validated['assignment_ids'] ?? []
                );

            $this->audit->googleAdsUnassigned($user, $domain, $removed, [
                'operation' => 'remove',
            ]);

            return response()->json([
                'message' => 'Assignments removed',
                'data' => ['removed' => $removed],
            ]);
        } catch (Throwable $e) {
            Log::error('Remove Google assignments failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Manually pause all Google Ads campaigns for a domain.
     */
    public function pause(Request $request, $domainId): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            if ($user instanceof JsonResponse) return $user;

            if (!$user->canManageCompanyResources()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $domain = $this->loadDomain($domainId, $user);
            if ($domain instanceof JsonResponse) return $domain;

            return response()->json([
                'message' => 'Pause operation completed',
                'data' => $this->assignmentService->pauseCampaignsForDomain($domain),
            ]);
        } catch (Throwable $e) {
            Log::error('Pause Google Ads failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Manually resume system-paused Google Ads campaigns for a domain.
     */
    public function resume(Request $request, $domainId): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            if ($user instanceof JsonResponse) return $user;

            if (!$user->canManageCompanyResources()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $domain = $this->loadDomain($domainId, $user);
            if ($domain instanceof JsonResponse) return $domain;

            return response()->json([
                'message' => 'Resume operation completed',
                'data' => $this->assignmentService->resumeCampaignsForDomain($domain),
            ]);
        } catch (Throwable $e) {
            Log::error('Resume Google Ads failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }
}
