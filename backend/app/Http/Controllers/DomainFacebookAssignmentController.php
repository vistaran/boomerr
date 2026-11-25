<?php

namespace App\Http\Controllers;

use App\Models\Domain;
use App\Models\DomainFacebookAssignment;
use App\Models\User;
use App\Models\UserIntegration;
use App\Services\AuditLogService;
use App\Services\FacebookAdsAssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class DomainFacebookAssignmentController extends Controller
{

    public function __construct(
        private readonly FacebookAdsAssignmentService $assignmentService,
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
            Log::error('Auth user failed', [
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
            Log::error('Load domain failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    public function index(Request $request, $domainId): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            if ($user instanceof JsonResponse) return $user;

            $domain = Domain::where('ulid', $domainId)
                ->where('workspace_id', $user->workspace_id)
                ->first();
            if ($domain instanceof JsonResponse) return $domain;

            $assignments = $this->assignmentService->getAssignmentsForDomain($domain->id);

            return response()->json([
                'data' => $assignments->map(fn($a) => [
                    'id' => $a->id,
                    'ulid' => $a->ulid,
                    'facebook_entity_id' => $a->facebook_entity_id,
                    'facebook_entity_type' => $a->facebook_entity_type,
                    'facebook_entity_name' => $a->facebook_entity_name,
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
            Log::error('Domain FB assignments index failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

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
            $existingCount = DomainFacebookAssignment::forDomain($domain->id)->count();

            $validated = $request->validate([
                'integration_id' => ['required', 'integer'],
                'entities' => ['required', 'array'],
                'entities.*.id' => ['required', 'string'],
                'entities.*.type' => ['sometimes', 'string', 'in:ad,campaign'],
                'entities.*.name' => ['sometimes', 'nullable', 'string'],
                'entities.*.campaign_id' => ['sometimes', 'nullable', 'string'],
                'entities.*.campaign_status' => ['sometimes', 'nullable', 'string'],
            ]);

            $result = $this->assignmentService->updateEntitiesForDomain(
                $domain,
                $validated['integration_id'],
                $validated['entities']
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

            // Extract entity names for audit log
            $entityNames = array_values(array_filter(
                array_map(fn($e) => $e['name'] ?? null, $validated['entities'])
            ));

            // If assignments were removed, log unassign event first
            if ($removed > 0) {
                $this->audit->facebookAdsUnassigned($user, $domain, $removed, [
                    'operation' => 'update',
                    'total_before' => $existingCount,
                    'total_after' => $newCount,
                ]);
            }

            // Log assign event (for added or updated assignments) - only if there are assignments
            if ($newCount > 0) {
                $this->audit->facebookAdsAssigned($user, $domain, $newCount, [
                    'operation' => 'update',
                    'entities' => implode(', ', $entityNames),
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
            Log::error('Update FB assignments failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }


    public function availableIntegrations(Request $request, $domainId): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            if ($user instanceof JsonResponse) return $user;

            $domain = Domain::where('ulid', $domainId)
                ->where('workspace_id', $user->workspace_id)
                ->first();
            if ($domain instanceof JsonResponse) return $domain;

            $currentIntegrationId = DomainFacebookAssignment::forDomain($domain->id)
                ->value('user_integration_id');

            $integrations = UserIntegration::where('workspace_id', $user->workspace_id)
                ->where('provider', 'facebook_ads')
                ->where('status', 'active')
                ->get();

            return response()->json([
                'data' => $integrations->map(function ($i) use ($currentIntegrationId) {
                    $meta = json_decode($i->meta_json ?? '{}', true);
                    return [
                        'id' => $i->id,
                        'ulid' => $i->ulid,
                        'account_id' => $i->account_id,
                        'account_name' => $meta['account']['name'] ?? null,
                        'business_name' => $meta['account']['business']['name'] ?? null,
                        'is_current' => $i->id === $currentIntegrationId,
                        'connected_at' => $i->connected_at?->toIso8601String(),
                    ];
                }),
                'current_integration_id' => $currentIntegrationId,
            ]);
        } catch (Throwable $e) {
            Log::error('Available integrations failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    public function availableAds(Request $request, $domainId, int $integrationId): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            if ($user instanceof JsonResponse) return $user;

            $domain = Domain::where('ulid', $domainId)
                ->where('workspace_id', $user->workspace_id)
                ->first();
            if ($domain instanceof JsonResponse) return $domain;

            $integration = UserIntegration::where('id', $integrationId)
                ->where('workspace_id', $user->workspace_id)
                ->where('provider', 'facebook_ads')
                ->where('status', 'active')
                ->first();

            if (!$integration) {
                return response()->json(['message' => 'Integration not found'], 404);
            }

            $ads = $this->assignmentService->getAvailableAds($integration, $domain->id);
            $assignedIds = DomainFacebookAssignment::forDomain($domain->id)
                ->forIntegration($integrationId)
                ->pluck('facebook_entity_id')
                ->toArray();

            return response()->json([
                'data' => collect($ads)->map(fn($ad) => [
                    'id' => $ad['id'],
                    'name' => $ad['name'] ?? 'Unnamed Ad',
                    'status' => $ad['status'] ?? null,
                    'effective_status' => $ad['effective_status'] ?? null,
                    'configured_status' => $ad['configured_status'] ?? null,
                    'adset' => $ad['adset'] ?? null,
                    'campaign' => $ad['campaign'] ?? null,
                    'is_assigned' => in_array($ad['id'], $assignedIds, true),
                ])->values(),
                'assigned_ids' => $assignedIds,
            ]);
        } catch (Throwable $e) {
            Log::error('Available ads fetch failed', [
                'domain_id' => $domainId,
                'integration_id' => $integrationId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

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
                'entities' => ['required', 'array', 'min:1'],
                'entities.*.id' => ['required', 'string'],
                'entities.*.type' => ['sometimes', 'string', 'in:ad,campaign'],
                'entities.*.name' => ['sometimes', 'nullable', 'string'],
                'entities.*.campaign_id' => ['sometimes', 'nullable', 'string'],
                'entities.*.campaign_status' => ['sometimes', 'nullable', 'string'],
            ]);

            $result = $this->assignmentService->assignEntitiesToDomain(
                $domain,
                $validated['integration_id'],
                $validated['entities']
            );

            if (!$result['success']) {
                return response()->json([
                    'message' => $result['error'],
                    'conflicts' => $result['conflicts'],
                ], 422);
            }

            // Extract entity names for audit log
            $entityNames = array_values(array_filter(
                array_map(fn($e) => $e['name'] ?? null, $validated['entities'])
            ));

            $this->audit->facebookAdsAssigned($user, $domain, count($result['assignments']), [
                'entity_count' => count($validated['entities']),
                'entities' => implode(', ', $entityNames),
            ]);

            return response()->json([
                'message' => 'Assignments created successfully',
                'data' => [
                    'assigned' => count($result['assignments']),
                    'conflicts' => $result['conflicts'],
                ],
            ], 201);
        } catch (Throwable $e) {
            Log::error('Store FB assignments failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

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

            $this->audit->facebookAdsUnassigned($user, $domain, $removed, [
                'operation' => 'remove',
            ]);

            return response()->json([
                'message' => 'Assignments removed',
                'data' => ['removed' => $removed],
            ]);
        } catch (Throwable $e) {
            Log::error('Remove FB assignments failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

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
                'data' => $this->assignmentService->pauseAdsForDomain($domain),
            ]);
        } catch (Throwable $e) {
            Log::error('Pause ads failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }

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
                'data' => $this->assignmentService->resumeAdsForDomain($domain),
            ]);
        } catch (Throwable $e) {
            Log::error('Resume ads failed', [
                'domain_id' => $domainId,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Server error'], 500);
        }
    }
}
