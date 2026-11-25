<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\TeamInvitation;
use App\Models\User;
use App\Notifications\TeamInvitationNotification;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class DepartmentController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = $request->user();
            if (! $user instanceof User) {
                abort(401, 'Unauthenticated.');
            }

            $workspaceId = $user->currentWorkspaceId();

            if (! $workspaceId) {
                abort(422, 'Authenticated user does not belong to a workspace.');
            }

            return Department::where('workspace_id', $workspaceId)
                ->withCount('users')
                ->get();
        } catch (\Throwable $e) {
            Log::error('DepartmentController index failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load departments'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $user = $request->user();
            if (! $user instanceof User) {
                abort(401, 'Unauthenticated.');
            }

            $workspaceId = $user->currentWorkspaceId();

            if ($user->role !== 'admin' && $user->role !== 'owner') {
                abort(403);
            }

            if (! $workspaceId) {
                abort(422, 'Authenticated user does not belong to a workspace.');
            }

            $data = $request->validate([
                'name' => 'required|string|max:255',
            ]);

            $department = Department::create([
                'name' => $data['name'],
                'workspace_id' => $workspaceId,
            ]);

            app(AuditLogService::class)->departmentCreated($user, $department);

            return $department;
        } catch (\Throwable $e) {
            Log::error('DepartmentController store failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to create department'], 500);
        }
    }

    public function show(string $department_ulid)
    {
        try {
            $user = request()->user();
            if (! $user instanceof User) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
            $workspaceId = $user->currentWorkspaceId();

            $department = Department::where('ulid', $department_ulid)->first();
            if (!$department) {
                return response()->json(['message' => 'Department not found'], 404);
            }
            if (! $workspaceId || $department->workspace_id !== $workspaceId) {
                return response()->json(['message' => 'Department not found'], 404);
            }

            return $department;
        } catch (\Throwable $e) {
            Log::error('DepartmentController show failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load department'], 500);
        }
    }

    public function users(string $department_ulid)
    {
        try {
            $department = Department::where('ulid', $department_ulid)->first();
            if (! $department) {
                return response()->json(['message' => 'Department not found'], 404);
            }

            return $department->users()
                ->select([
                    'users.id',
                    'users.ulid',
                    'users.name',
                    'users.email',
                    'users.contact_email',
                    'users.role',
                ])
                ->get();
        } catch (\Throwable $e) {
            Log::error('DepartmentController users failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load department users'], 500);
        }
    }


    public function syncUsers(Request $request, string $department_ulid)
    {
        try {
            $user = $request->user();
            if (! $user instanceof User) {
                abort(401, 'Unauthenticated.');
            }
            // Role check
            if (!in_array($user->role, ['admin', 'owner'])) {
                abort(403);
            }

            $data = $request->validate([
                'user_ids'   => ['array'],
                'user_ids.*' => ['exists:users,ulid'],
                'workspace_id' => ['required', 'exists:workspaces,id'],
            ]);

            $department = Department::where('ulid', $department_ulid)->first();
            if (! $department) {
                abort(404, 'Department not found');
            }

            if ($department->workspace_id !== (int) $data['workspace_id']) {
                abort(400, 'Company ID does not match department');
            }

            // Convert provided user ULIDs to numeric IDs for pivot sync
            $users = User::whereIn('ulid', $data['user_ids'] ?? [])->get()->keyBy('ulid');

            $syncData = collect($data['user_ids'] ?? [])
                ->mapWithKeys(function ($userUlid) use ($users, $data) {
                    $user = $users->get($userUlid);
                    if (! $user) return [];
                    return [
                        $user->id => ['workspace_id' => $data['workspace_id']],
                    ];
                })
                ->toArray();

            $syncResult = $department->users()->sync($syncData);

            // Log additions
            if (!empty($syncResult['attached'])) {
                $auditService = app(AuditLogService::class);
                $addedUsers = User::whereIn('id', $syncResult['attached'])->get();
                foreach ($addedUsers as $addedUser) {
                    $auditService->departmentUserAdded($user, $department, $addedUser);
                }
            }

            // Log removals
            if (!empty($syncResult['detached'])) {
                $auditService = app(AuditLogService::class);
                $removedUsers = User::whereIn('id', $syncResult['detached'])->get();
                foreach ($removedUsers as $removedUser) {
                    $auditService->departmentUserRemoved($user, $department, $removedUser);
                }
            }

            return response()->json([
                'message' => 'Department users updated successfully',
            ]);
        } catch (\Throwable $e) {
            Log::error('DepartmentController syncUsers failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to sync department users'], 500);
        }
    }

    public function deptPendingInvitations(Request $request, string $department_ulid)
    {
        try {
            $user = $request->user();
            if (! $user instanceof User) {
                abort(401, 'Unauthenticated.');
            }
            $workspaceId = $user->currentWorkspaceId();

            if (! $workspaceId) {
                abort(422, 'Authenticated user does not belong to a workspace.');
            }


            $department = Department::where('ulid', $department_ulid)->first();
            if (! $department) {
                return response()->json(['message' => 'Department not found'], 404);
            }

            $invitations = TeamInvitation::where('workspace_id', $workspaceId)
                ->where('department_id', $department->id)
                ->where('is_accepted', 0)
                ->where('expires_at', '>', now())
                ->get();

            return response()->json([
                'message' => 'Pending invitations retrieved successfully.',
                'data' => $invitations,
            ]);
        } catch (\Throwable $e) {
            Log::error('DepartmentController deptPendingInvitations failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load pending invitations'], 500);
        }
    }

    public function resendInvitation(Request $request, $id)
    {
        try {
            $user = $request->user();
            if (! $user instanceof User) {
                abort(401, 'Unauthenticated.');
            }

            $workspaceId = $user->currentWorkspaceId();

            if (! $workspaceId) {
                abort(422, 'Authenticated user does not belong to a workspace.');
            }

            $invitation = TeamInvitation::where('ulid', $id)
                ->where('workspace_id', $workspaceId)
                ->first();

            if (! $invitation) {
                abort(404, 'Invitation not found.');
            }

            // Get department name if exists
            $departmentName = null;
            if ($invitation->department_id) {
                $department = Department::find($invitation->department_id);
                $departmentName = $department?->name;
            }

            Notification::route('mail', $invitation->email)
                ->notify(new TeamInvitationNotification($invitation));

            app(AuditLogService::class)->userInviteResent(
                $user,
                $invitation->email,
                $invitation->role,
                $departmentName
            );

            return response()->json(['message' => 'Invitation resent successfully.', 'success' => true]);
        } catch (\Exception $e) {
            Log::error('Error resending invitation: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to resend invitation.', 'success' => false], 500);
        }
    }

    public function cancelInvitation(Request $request, $id)
    {
        try {
            $user = $request->user();
            if (! $user instanceof User) {
                abort(401, 'Unauthenticated.');
            }

            $workspaceId = $user->currentWorkspaceId();

            if (! $workspaceId) {
                abort(422, 'Authenticated user does not belong to a workspace.');
            }

            $invitation = TeamInvitation::where('ulid', $id)
                ->where('workspace_id', $workspaceId)
                ->first();

            if (! $invitation) {
                abort(404, 'Invitation not found.');
            }

            // Get department name if exists
            $departmentName = null;
            if ($invitation->department_id) {
                $department = Department::find($invitation->department_id);
                $departmentName = $department?->name;
            }

            // Store invitation details before deletion
            $email = $invitation->email;
            $role = $invitation->role;

            $invitation->delete();

            app(AuditLogService::class)->userInviteCanceled(
                $user,
                $email,
                $role,
                $departmentName
            );

            return response()->json(['message' => 'Invitation canceled successfully.', 'success' => true]);
        } catch (\Exception $e) {
            Log::error('Error canceling invitation: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to cancel invitation.', 'success' => false], 500);
        }
    }
}
