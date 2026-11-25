<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TeamMemberController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            if (! $user instanceof User) {
                return response()->json([
                    'message' => 'Unauthenticated.',
                ], 401);
            }
            $workspaceId = $user->currentWorkspaceId();

            if (! $workspaceId) {
                return response()->json([
                    'message' => 'Authenticated user does not belong to a workspace.',
                ], 422);
            }

            $members = User::query()
                ->select([
                    'users.ulid',
                    'users.name',
                    'users.email',
                    'users.contact_email',
                    'workspace_user.role as role',
                ])
                ->join('workspace_user', function ($join) use ($workspaceId) {
                    $join->on('workspace_user.user_id', '=', 'users.id')
                        ->where('workspace_user.workspace_id', '=', $workspaceId);
                })
                ->orderByRaw("FIELD(workspace_user.role, 'owner', 'admin', 'member')")
                ->orderBy('users.name')
                ->get();

            return response()->json([
                'data' => $members,
            ]);
        } catch (\Throwable $e) {
            Log::error('TeamMemberController index failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load team members'], 500);
        }
    }

    public function destroy(Request $request, int $memberId): JsonResponse
    {
        try {
            $actingUser = $request->user();
            if (! $actingUser instanceof User) {
                return response()->json([
                    'message' => 'Unauthenticated.',
                ], 401);
            }
            $workspaceId = $actingUser->currentWorkspaceId();

            if (! $workspaceId) {
                return response()->json([
                    'message' => 'Authenticated user does not belong to a workspace.',
                ], 422);
            }

            $member = User::find($memberId);

            if (! $member) {
                return response()->json([
                    'message' => 'Member not found.',
                ], 404);
            }

            $membership = $member->workspaces()
                ->where('workspaces.id', $workspaceId)
                ->first();

            if (! $membership) {
                return response()->json([
                    'message' => 'Member not found.',
                ], 404);
            }

            if ($member->id === $actingUser->id) {
                return response()->json([
                    'message' => 'You cannot remove yourself.',
                ], 422);
            }

            if (($membership->pivot->role ?? User::ROLE_MEMBER) === User::ROLE_OWNER) {
                return response()->json([
                    'message' => 'Owners cannot be removed from the workspace.',
                ], 422);
            }

            $memberCurrentWorkspaceId = $member->currentWorkspaceId();

            $member->workspaces()->detach($workspaceId);

            if ($memberCurrentWorkspaceId === $workspaceId) {
                $member->refresh();
                $member->ensureWorkspaceHydrated();
            }

            app(AuditLogService::class)->userRemoved($actingUser, $member);

            return response()->json([
                'message' => 'Member removed successfully.',
            ]);
        } catch (\Throwable $e) {
            Log::error('TeamMemberController destroy failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to remove team member'], 500);
        }
    }
}
