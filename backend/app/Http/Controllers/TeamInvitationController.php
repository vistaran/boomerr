<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\TeamInvitation;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\TeamInvitationNotification;
use App\Services\PlanLimitService;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TeamInvitationController extends Controller
{
    public function create(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'email' => ['required', 'email'],
                'role' => ['required', 'string', Rule::in(['admin', 'member'])],
                'isFromDepartment' => ['sometimes', 'boolean'],
                // department_id is expected as a ULID string from the frontend; validate exists by ulid
                'department_id' => ['required_if:isFromDepartment,true', 'string', 'exists:departments,ulid'],
            ]);

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

            // Enforce plan team-member limit
            $workspace = $user->currentWorkspace();
            if ($workspace && ! PlanLimitService::canAddTeamMember($workspace)) {
                $limits = PlanLimitService::getLimits($workspace);
                return response()->json([
                    'message'    => 'You have reached the maximum number of team members allowed on your current plan.',
                    'limit'      => $limits['max_team_members'] ?? 0,
                    'error_code' => 'plan_limit_team_members',
                ], 403);
            }

            $existing = TeamInvitation::where('workspace_id', $workspaceId)
                ->where('email', $validated['email'])
                ->where('is_accepted', 0)
                ->where('expires_at', '>', Carbon::now())
                ->first();

            if ($existing) {
                return response()->json([
                    'message' => 'An invitation has already been sent to this email address.',
                ], 422);
            }

            $invitationData = [
                'workspace_id' => $workspaceId,
                'email' => $validated['email'],
                'role' => $validated['role'],
                'token' => Str::random(32),
                'expires_at' => Carbon::now()->addDays(7),
            ];

            if (!empty($validated['isFromDepartment']) && !empty($validated['department_id'])) {
                // Convert department ULID to numeric id for storing as FK
                $dept = Department::where('ulid', $validated['department_id'])->first();
                if ($dept) {
                    $invitationData['department_id'] = $dept->id;
                }
            }

            $invitation = TeamInvitation::create($invitationData);

            Notification::route('mail', $invitation->email)
                ->notify(new TeamInvitationNotification($invitation));

            $departmentName = null;
            if (!empty($validated['department_id'])) {
                $departmentName = Department::where('ulid', $validated['department_id'])->first()?->name;
            }
            app(AuditLogService::class)->userInvited($user, $validated['email'], $validated['role'], $departmentName);

            return response()->json([
                'message' => 'Invitation sent successfully.',
                'data' => $invitation,
            ], 201);
        } catch (\Throwable $e) {
            Log::error('TeamInvitationController create failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to create invitation'], 500);
        }
    }

    public function accept(Request $request, string $token): JsonResponse
    {
        try {
            $invitation = TeamInvitation::where('token', $token)
                ->where('expires_at', '>', Carbon::now())
                ->first();

            if (! $invitation) {
                return response()->json(['message' => 'Invalid or expired invitation.'], 404);
            }
            // Validate incoming credentials to finalize account
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'password' => ['required', 'string', 'min:8', 'confirmed'], // expects password_confirmation
            ]);

            $user = User::where('email', $invitation->email)->first();

            // If user already belongs to this company (single-company model via workspace_id)
            if ($user && $user->belongsToWorkspace((int) $invitation->workspace_id)) {
                // Already part of company; allow updating name/password optionally
                $user->name = $validated['name'];
                $user->password = Hash::make($validated['password']);
                $user->save();

                $user->workspaces()->syncWithoutDetaching([
                    $invitation->workspace_id => ['role' => $invitation->role],
                ]);

                $user->activateWorkspace($invitation->workspace_id);
                $workspaces = $user->workspaceSummaries();

                // Mark invitation as accepted
                $invitation->is_accepted = 1;
                $invitation->save();

                $this->syncDepartmentAssignment($invitation, $user);

                // Issue Sanctum token for login
                $token = $user->createToken('web')->plainTextToken;

                return response()->json([
                    'message' => 'You are already part of this company.',
                    'token' => $token,
                    'user' => $user,
                    'workspaces' => $workspaces,
                ], 200);
            }

            if (! $user) {
                $user = User::create([
                    'name' => $validated['name'],
                    'email' => $invitation->email,
                    'password' => Hash::make($validated['password']),
                    'email_verified_at' => now()
                ]);

                // Send discord signup alert for invited user
                try {
                    $workspace = Workspace::find($invitation->workspace_id);
                    app(\App\Services\DiscordAlertService::class)->notifySignup($user, 'invite', $workspace?->name ?? null);
                } catch (\Throwable $e) {
                    Log::error('Discord signup notify failed: ' . $e->getMessage());
                }
            } else {
                // Update existing user details
                $user->name = $validated['name'];
                $user->password = Hash::make($validated['password']);
                $user->save();
            }

            $user->workspaces()->syncWithoutDetaching([
                $invitation->workspace_id => ['role' => $invitation->role],
            ]);

            $user->activateWorkspace($invitation->workspace_id);

            $workspaces = $user->workspaceSummaries();

            // Mark invitation as accepted (preserve record for history)
            $invitation->is_accepted = 1;
            $invitation->save();

            $this->syncDepartmentAssignment($invitation, $user);

            // Issue Sanctum token for immediate login
            $token = $user->createToken('web')->plainTextToken;

            $departmentName = null;
            if ($invitation->department_id) {
                $departmentName = Department::where('id', $invitation->department_id)->first()?->name;
            }

            app(AuditLogService::class)->inviteAccepted($user, $user->email, $user->role, $departmentName);

            return response()->json([
                'message' => 'Invitation accepted successfully.',
                'token' => $token,
                'user' => $user,
                'workspaces' => $workspaces,
            ], 200);
        } catch (\Throwable $e) {
            Log::error('TeamInvitationController accept failed: ' . $e->getMessage() . " >> " . $e->getFile() . ":" . $e->getLine());
            return response()->json(['message' => 'Failed to accept invitation'], 500);
        }
    }

    /**
     * Lookup invitation by token to prefill client-side form (email & role).
     */
    public function lookup(Request $request, string $token): JsonResponse
    {
        try {
            $invitation = TeamInvitation::where('token', $token)
                ->where('expires_at', '>', Carbon::now())
                ->first();

            if (! $invitation) {
                return response()->json(['message' => 'Invalid or expired invitation.'], 404);
            }

            return response()->json([
                'data' => [
                    'email' => $invitation->email,
                    'role' => $invitation->role,
                    'workspace_id' => $invitation->workspace_id,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('TeamInvitationController lookup failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to lookup invitation'], 500);
        }
    }

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

            $invitations = TeamInvitation::where('workspace_id', $workspaceId)
                ->where('expires_at', '>', Carbon::now())
                ->where('is_accepted', 0)
                ->get();

            return response()->json($invitations);
        } catch (\Throwable $e) {
            Log::error('TeamInvitationController index failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load invitations'], 500);
        }
    }

    protected function syncDepartmentAssignment(TeamInvitation $invitation, User $user): void
    {
        try {
            if (! $invitation->department_id) {
                return;
            }

            $department = Department::where('id', $invitation->department_id)
                ->where('workspace_id', $invitation->workspace_id)
                ->first();

            if (! $department) {
                return;
            }

            $department->users()->syncWithoutDetaching([
                $user->id => ['workspace_id' => $invitation->workspace_id],
            ]);
        } catch (\Throwable $e) {
            Log::error('TeamInvitationController syncDepartmentAssignment failed: ' . $e->getMessage());
        }
    }
}
