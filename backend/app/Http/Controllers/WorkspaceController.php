<?php

namespace App\Http\Controllers;

use App\Models\Integration;
use App\Models\User;
use App\Models\Workspace;
use App\Services\AuditLogService;
use App\Services\Billing\SubscriptionService;
use App\Services\Billing\WorkspaceBillingService;
use App\Services\Billing\WorkspaceSubscriptionService;
use App\Services\PlanLimitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class WorkspaceController extends Controller
{
    public function __construct(
        private readonly WorkspaceSubscriptionService $workspaceSubscriptionService,
        private readonly WorkspaceBillingService $workspaceBillingService,
        private readonly SubscriptionService $subscriptionService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $user->ensureWorkspaceHydrated();

            return response()->json([
                'data' => $user->workspaceSummaries(),
            ]);
        } catch (\Throwable $e) {
            Log::error('WorkspaceController index failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load workspaces'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            $user = $request->user();

            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
            ]);

            $workspace = DB::transaction(function () use ($validated, $user) {
                $workspace = Workspace::create([
                    'name' => $validated['name'],
                    'slug' => Str::slug($validated['name'] . '-' . Str::random(5)),
                ]);

                $user->workspaces()->syncWithoutDetaching([
                    $workspace->id => ['role' => User::ROLE_OWNER],
                ]);

                $user->activateWorkspace($workspace->id);

                return $workspace;
            });

            $user->refresh();
            $user->ensureWorkspaceHydrated();
            $workspaces = $user->workspaceSummaries();

            Integration::all()->each(
                fn($i) =>
                $workspace->integrations()->attach($i->id, ['enabled' => true, 'ulid' => strtolower((string) Str::ulid())])
            );

            $subscription = $this->workspaceSubscriptionService->ensureDefaultFreeSubscription($workspace);
            $this->workspaceBillingService->syncFromSubscription($workspace, $subscription);

            app(AuditLogService::class)->workspaceCreated($user, $workspace);

            return response()->json([
                'message' => 'Workspace created successfully.',
                'workspace' => $workspace,
                'user' => $user,
                'workspaces' => $workspaces,
            ], 201);
        } catch (\Throwable $e) {
            Log::error('WorkspaceController store failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to create workspace'], 500);
        }
    }

    public function rename(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $workspace = $user->currentWorkspace();

            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
            ]);

            if (!$workspace) {
                return response()->json([
                    'message' => 'No active workspace found.',
                ], 404);
            }

            $oldName = $workspace?->name;
            $userWorkspace = $user->workspaces()->where('workspaces.id', $workspace->id)->first();

            if (!$userWorkspace) {
                return response()->json([
                    'message' => 'You do not have permission to rename this workspace.',
                ], 403);
            }

            if ($userWorkspace->pivot->role !== User::ROLE_OWNER && $userWorkspace->pivot->role !== User::ROLE_ADMIN) {
                return response()->json([
                    'message' => 'Only workspace owners can rename the workspace.',
                ], 403);
            }

            $workspace->name = $validated['name'];
            $workspace->save();

            $changes = [
                [
                    'field' => 'name',
                    'from' => $oldName,
                    'to' => $workspace->name,
                ]
            ];

            app(AuditLogService::class)->workspaceRenamed($user, $workspace, $changes);

            return response()->json([
                'message' => 'Workspace renamed successfully.',
                'workspace' => $workspace,
            ]);
        } catch (\Throwable $e) {
            Log::error('WorkspaceController rename failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to rename workspace'], 500);
        }
    }

    public function destroy(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $workspace = $user->currentWorkspace();

            if (!$workspace) {
                return response()->json([
                    'message' => 'No active workspace found.',
                ], 404);
            }

            if ($user->roleInWorkspace($workspace->id) !== User::ROLE_OWNER) {
                return response()->json([
                    'message' => 'Only workspace owners can delete the workspace.',
                ], 403);
            }

            DB::transaction(function () use ($workspace): void {
                $lockedWorkspace = Workspace::query()
                    ->whereKey($workspace->id)
                    ->lockForUpdate()
                    ->first();

                if (!$lockedWorkspace) {
                    return;
                }

                $this->subscriptionService->cancelNonTerminalForWorkspace($lockedWorkspace, false);
                $lockedWorkspace->delete();
            });

            $user->refresh();
            $user->ensureWorkspaceHydrated();

            return response()->json([
                'message' => 'Workspace deleted successfully.',
                'workspaces' => $user->workspaceSummaries(),
            ]);
        } catch (\Throwable $exception) {
            Log::error('WorkspaceController destroy failed: ' . $exception->getMessage());

            return response()->json([
                'message' => 'Failed to delete workspace.',
            ], 500);
        }
    }

    /**
     * Return the current workspace's active plan, limits, features and integrations.
     */
    public function planInfo(Request $request): JsonResponse
    {
        try {
            $user      = $request->user();
            $workspace = $user->currentWorkspace();

            if (! $workspace) {
                return response()->json(['message' => 'No active workspace found.'], 404);
            }

            $subscription = $this->workspaceSubscriptionService->ensureDefaultFreeSubscription($workspace);
            $this->workspaceBillingService->syncFromSubscription($workspace, $subscription);

            return response()->json(PlanLimitService::getPlanInfoPayload($workspace));
        } catch (\Throwable $e) {
            Log::error('WorkspaceController planInfo failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load plan info'], 500);
        }
    }

    public function toggleDeveloperWebhooks(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $workspace = $user->currentWorkspace();

            if (!$workspace) {
                return response()->json(['message' => 'No active workspace found.'], 404);
            }

            if ($user->roleInWorkspace($workspace->id) !== User::ROLE_OWNER && $user->roleInWorkspace($workspace->id) !== User::ROLE_ADMIN) {
                return response()->json(['message' => 'Unauthorized to update workspace settings.'], 403);
            }

            $validated = $request->validate([
                'enabled' => 'required|boolean',
            ]);

            $workspace->developer_webhooks_enabled = $validated['enabled'];
            $workspace->save();

            return response()->json([
                'message' => 'Developer Webhooks ' . ($workspace->developer_webhooks_enabled ? 'enabled' : 'disabled') . ' successfully.',
                'enabled' => $workspace->developer_webhooks_enabled,
            ]);
        } catch (\Throwable $exception) {
            Log::error('WorkspaceController toggleDeveloperWebhooks failed: ' . $exception->getMessage());
            return response()->json(['message' => 'Failed to toggle developer webhooks.'], 500);
        }
    }
}
