<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    public const ROLE_OWNER = 'owner';
    public const ROLE_ADMIN = 'admin';
    public const ROLE_MEMBER = 'member';

    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasUlids, HasFactory, HasApiTokens, Notifiable;

    protected static function booted(): void
    {
        static::deleting(function (User $user) {
            // 1. Delete all email deliveries for this account's email and user_id
            if (!empty($user->email)) {
                DB::table('email_deliveries')
                    ->where('email', $user->email)
                    ->delete();
            }

            if (!empty($user->id)) {
                DB::table('email_deliveries')
                    ->where('user_id', $user->id)
                    ->delete();
            }

            // 2. If user is owner of any workspaces, delete those workspaces and remove all members
            if (!empty($user->id)) {
                $ownedWorkspaceIds = DB::table('workspace_user')
                    ->where('user_id', $user->id)
                    ->where('role', self::ROLE_OWNER)
                    ->pluck('workspace_id')
                    ->all();

                foreach ($ownedWorkspaceIds as $workspaceId) {
                    $workspace = Workspace::find($workspaceId);
                    if ($workspace) {
                        try {
                            if (class_exists(\App\Services\Billing\SubscriptionService::class)) {
                                app(\App\Services\Billing\SubscriptionService::class)->cancelNonTerminalForWorkspace($workspace, false);
                            }
                        } catch (\Throwable $e) {
                            Log::warning("Could not cancel subscriptions for workspace {$workspaceId} on user deletion: " . $e->getMessage());
                        }

                        // Remove all users from this workspace
                        DB::table('workspace_user')->where('workspace_id', $workspaceId)->delete();

                        // Delete the workspace (cascades domains, integrations, settings)
                        $workspace->delete();
                    }
                }

                // 3. Remove this user from any remaining workspaces where they were merely a member or admin
                DB::table('workspace_user')->where('user_id', $user->id)->delete();
            }
        });
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'ulid',
        'name',
        'email',
        'password',
        'github_id',
        'avatar',
        'provider',
        'trial_consumed_at',
        'failed_attempts',
        'blocked_until',
        'last_attempt_at',
        'email_verified_at',
        'last_login_at',
        'receives_onboarding_emails',
        'receives_product_updates',
        'receives_newsletters',
        'receives_promotional_emails'
    ];

    /**
     * Surface legacy attributes (workspace_id, role) derived from the pivot table.
     *
     * @var list<string>
     */
    protected $appends = [
        'workspace_id',
        'workspace_ulid',
        'role',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'id',
        'password',
        'remember_token',
    ];

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    protected ?Workspace $currentWorkspaceCache = null;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'trial_consumed_at' => 'datetime',
            'blocked_until' => 'datetime',
            'last_attempt_at' => 'datetime',
            'last_login_at' => 'datetime',
            'onboarding_settings' => 'array',
            'receives_onboarding_emails' => 'boolean',
            'receives_product_updates' => 'boolean',
            'receives_newsletters' => 'boolean',
            'receives_promotional_emails' => 'boolean',
        ];
    }

    public function isOwner(): bool
    {
        return $this->currentRole() === self::ROLE_OWNER;
    }

    public function isAdmin(): bool
    {
        return $this->currentRole() === self::ROLE_ADMIN;
    }

    public function isMember(): bool
    {
        return $this->currentRole() === self::ROLE_MEMBER;
    }

    public function canManageCompanyResources(): bool
    {
        return $this->isOwner() || $this->isAdmin();
    }


    public function routeNotificationForMail($notification): ?string
    {
        // For users, email should be the notification route
        return $this->email;
    }

    public function departments()
    {
        return $this->belongsToMany(Department::class)
            ->withPivot('workspace_id')
            ->withTimestamps();
    }

    public function workspaces(): BelongsToMany
    {
        return $this->belongsToMany(Workspace::class, 'workspace_user')
            ->withPivot('role', 'is_current')
            ->withTimestamps();
    }

    public function smsNotificationSetting(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(SmsNotificationSetting::class);
    }

    public function currentWorkspaceRelation(): BelongsToMany
    {
        return $this->belongsToMany(Workspace::class, 'workspace_user')
            ->withPivot('role', 'is_current')
            ->wherePivot('is_current', true);
    }

    public function currentWorkspace(bool $ensure = true): ?Workspace
    {
        if ($this->currentWorkspaceCache instanceof Workspace) {
            return $this->currentWorkspaceCache;
        }

        $workspace = $this->currentWorkspaceRelation()->first();

        if (!$workspace && $ensure) {
            $this->ensureActiveWorkspaceSet();
            $workspace = $this->currentWorkspaceRelation()->first();
        }

        if ($workspace) {
            $this->currentWorkspaceCache = $workspace;
        }

        return $workspace;
    }

    public function currentWorkspaceId(): ?int
    {
        return $this->currentWorkspace()?->id;
    }

    public function currentRole(): string
    {
        return $this->currentWorkspace()?->pivot->role ?? self::ROLE_MEMBER;
    }

    public function belongsToWorkspace(int $workspaceId): bool
    {
        return $this->workspaces()
            ->where('workspaces.id', $workspaceId)
            ->exists();
    }

    public function ensureActiveWorkspaceSet(): void
    {
        if ($this->currentWorkspace(ensure: false)) {
            return;
        }

        $workspace = $this->workspaces()
            ->orderBy('workspace_user.created_at')
            ->first();

        if ($workspace) {
            $this->activateWorkspace((int) $workspace->id);
        }
    }

    public function ensureWorkspaceHydrated(): void
    {
        $this->loadMissing('workspaces');
        $this->ensureActiveWorkspaceSet();
    }

    public function activateWorkspace(int $workspaceId): bool
    {
        $workspace = $this->workspaces()
            ->where('workspaces.id', $workspaceId)
            ->first();

        if (!$workspace) {
            return false;
        }

        DB::table('workspace_user')
            ->where('user_id', $this->id)
            ->update(['is_current' => false]);

        $this->workspaces()->updateExistingPivot($workspaceId, ['is_current' => true]);

        $workspace->pivot->is_current = true;
        $this->currentWorkspaceCache = $workspace;

        return true;
    }

    public function clearWorkspaceContext(): void
    {
        DB::table('workspace_user')
            ->where('user_id', $this->id)
            ->update(['is_current' => false]);

        $this->currentWorkspaceCache = null;
    }

    public function refresh(): static
    {
        $this->currentWorkspaceCache = null;

        return parent::refresh();
    }

    public function workspaceSummaries(): array
    {
        return $this->workspaces()
            ->select('workspaces.id', 'workspaces.name', 'workspaces.slug', 'workspaces.ulid', 'workspaces.developer_webhooks_enabled')
            ->orderBy('workspaces.name')
            ->get()
            ->map(fn(Workspace $workspace) => [
                'id' => $workspace->id,
                'ulid' => $workspace->ulid,
                'name' => $workspace->name,
                'slug' => $workspace->slug,
                'role' => $workspace->pivot->role ?? self::ROLE_MEMBER,
                'is_current' => (bool) ($workspace->pivot->is_current ?? false),
                'developer_webhooks_enabled' => (bool) $workspace->developer_webhooks_enabled,
            ])
            ->toArray();
    }

    public function roleInWorkspace(int $workspaceId): ?string
    {
        return $this->workspaces()
            ->where('workspaces.id', $workspaceId)
            ->first()
            ?->pivot
                ?->role;
    }

    public function getWorkspaceIdAttribute(): ?int
    {
        return $this->currentWorkspaceId();
    }

    public function getWorkspaceUlidAttribute(): ?string
    {
        return $this->currentWorkspace()?->ulid;
    }

    public function getRoleAttribute(): string
    {
        return $this->currentRole();
    }

    public function emailDeliveries(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(EmailDelivery::class, 'user_id');
    }
}
