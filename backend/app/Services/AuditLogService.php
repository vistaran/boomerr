<?php

namespace App\Services;

use App\Enums\AuditLogEventType;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AuditLogService
{
    /**
     * Record an audit log entry.
     *
     * @param AuditLogEventType $eventType  The event being recorded
     * @param User|null         $actor      The user who performed the action
     * @param array             $options    Additional options:
     *   - workspace_id: int          (required if actor is null)
     *   - entity_type:  string|null  (e.g. 'Domain', 'Department')
     *   - entity_id:    mixed|null   (primary key or identifier)
     *   - entity_name:  string|null  (human-readable entity name)
     *   - description:  string|null  (human-readable description)
     *   - metadata:     array|null   (arbitrary key-value data)
     *   - changes:      array|null   (array of {field, from, to})
     *   - request:      Request|null (to extract IP / user-agent)
     */
    public function record(
        AuditLogEventType $eventType,
        ?User $actor = null,
        array $options = [],
    ): AuditLog {
        $workspaceId = $options['workspace_id']
            ?? $actor?->currentWorkspaceId()
            ?? 0;

        if (! $workspaceId && $actor) {
            $workspaceId = (int) ($actor->workspaces()->first()?->id ?? 0);
        }

        $request = $options['request'] ?? request();

        return AuditLog::create([
            'workspace_id' => $workspaceId,
            'event_type' => $eventType->value,
            'action' => $eventType->action(),
            'actor_id' => $actor?->id,
            'actor_name' => $actor?->name,
            'actor_email' => $actor?->email,
            'actor_role' => $actor ? $this->resolveRole($actor, $workspaceId) : null,
            'actor_ip' => $request instanceof Request ? $this->getClientIp($request) : null,
            'actor_user_agent' => $request instanceof Request
                ? $this->truncate($request->userAgent(), 500)
                : null,
            'entity_type' => $options['entity_type'] ?? null,
            'entity_id' => isset($options['entity_id']) ? (string) $options['entity_id'] : null,
            'entity_name' => $options['entity_name'] ?? null,
            'description' => $options['description'] ?? $eventType->label(),
            'metadata' => ! empty($options['metadata']) ? $options['metadata'] : null,
            'changes' => ! empty($options['changes']) ? $options['changes'] : null,
            'occurred_at' => now(),
        ]);
    }

    // ─── Convenience Methods ─────────────────────────────────────────────

    public function domainCreated(User $actor, $domain, array $metadata = []): AuditLog
    {
        return $this->record(AuditLogEventType::DOMAIN_CREATED, $actor, [
            'entity_type' => 'Domain',
            'entity_id' => $domain->id,
            'entity_name' => $domain->url,
            'description' => "Created domain {$domain->url}",
            'metadata' => array_merge([
                'url' => $domain->url,
                'environment' => $domain->environment ?? null,
            ], $metadata),
        ]);
    }

    public function workspaceCreated(User $actor, $workspace, array $metadata = []): AuditLog
    {
        return $this->record(AuditLogEventType::WORKSPACE_CREATED, $actor, [
            'entity_type' => 'Workspace',
            'entity_id' => $workspace->id,
            'entity_name' => $workspace->name,
            'description' => "Created workspace {$workspace->name}",
            'metadata' => array_merge([
                'name' => $workspace->name,
            ], $metadata),
        ]);
    }

    public function workspaceRenamed(User $actor, $workspace, array $changes = []): AuditLog
    {
        return $this->record(AuditLogEventType::WORKSPACE_RENAMED, $actor, [
            'entity_type' => 'Workspace',
            'entity_id' => $workspace->id,
            'entity_name' => $workspace->name,
            'description' => "Renamed workspace to {$workspace->name}",
            'changes' => $changes,
        ]);
    }

    public function domainUpdated(User $actor, $domain, array $changes = []): AuditLog
    {
        return $this->record(AuditLogEventType::DOMAIN_UPDATED, $actor, [
            'entity_type' => 'Domain',
            'entity_id' => $domain->id,
            'entity_name' => $domain->url,
            'description' => "Updated domain {$domain->url}",
            'changes' => $changes,
        ]);
    }

    public function domainDeleted(User $actor, $domain): AuditLog
    {
        return $this->record(AuditLogEventType::DOMAIN_DELETED, $actor, [
            'entity_type' => 'Domain',
            'entity_id' => $domain->id,
            'entity_name' => $domain->url,
            'description' => "Deleted domain {$domain->url}",
            'metadata' => [
                'url' => $domain->url,
            ],
        ]);
    }

    public function incidentResolved(User $actor, $incident): AuditLog
    {
        $domainName = $incident->domain?->url ?? $incident->domain?->name ?? 'Unknown Domain';

        return $this->record(AuditLogEventType::INCIDENT_RESOLVED, $actor, [
            'entity_type' => 'Incident',
            'entity_id' => $incident->ulid ?? $incident->id,
            'entity_name' => "Incident #{$incident->id}",
            'description' => "Resolved incident for {$domainName}",
            'metadata' => [
                'incident_ulid' => $incident->ulid,
                'domain_id' => $incident->domain_id,
                'domain_url' => $domainName,
                'started_at' => $incident->started_at?->toIso8601String(),
                'resolved_at' => $incident->resolved_at?->toIso8601String(),
            ],
        ]);
    }

    public function departmentCreated(User $actor, $department): AuditLog
    {
        return $this->record(AuditLogEventType::DEPARTMENT_CREATED, $actor, [
            'entity_type' => 'Department',
            'entity_id' => $department->id,
            'entity_name' => $department->name,
            'description' => "Created department {$department->name}",
        ]);
    }

    public function departmentUpdated(User $actor, $department, array $changes = []): AuditLog
    {
        return $this->record(AuditLogEventType::DEPARTMENT_UPDATED, $actor, [
            'entity_type' => 'Department',
            'entity_id' => $department->id,
            'entity_name' => $department->name,
            'description' => "Updated department {$department->name}",
            'changes' => $changes,
        ]);
    }

    public function departmentUserAdded(User $actor, $department, User $member): AuditLog
    {
        return $this->record(AuditLogEventType::DEPARTMENT_USER_ADDED, $actor, [
            'entity_type' => 'Department',
            'entity_id' => $department->id,
            'entity_name' => $department->name,
            'description' => "Added {$member->name} to department {$department->name}",
            'metadata' => [
                'user_id' => $member->id,
                'user_name' => $member->name,
                'user_email' => $member->email,
            ],
        ]);
    }

    public function departmentUserRemoved(User $actor, $department, User $member): AuditLog
    {
        return $this->record(AuditLogEventType::DEPARTMENT_USER_REMOVED, $actor, [
            'entity_type' => 'Department',
            'entity_id' => $department->id,
            'entity_name' => $department->name,
            'description' => "Removed {$member->name} from department {$department->name}",
            'metadata' => [
                'user_id' => $member->id,
                'user_name' => $member->name,
                'user_email' => $member->email,
            ],
        ]);
    }

    public function integrationChannelCreated(User $actor, $channel, array $metadata = []): AuditLog
    {
        return $this->record(AuditLogEventType::INTEGRATION_CHANNEL_CREATED, $actor, [
            'entity_type' => 'Integration',
            'entity_id' => $channel->id,
            'entity_name' => $channel->name,
            'description' => "Created integration channel {$channel->name}",
            'metadata' => array_merge([
                'type' => $channel->type,
            ], $metadata),
        ]);
    }

    public function integrationChannelUpdated(User $actor, $channel, array $changes = []): AuditLog
    {
        return $this->record(AuditLogEventType::INTEGRATION_CHANNEL_UPDATED, $actor, [
            'entity_type' => 'Integration',
            'entity_id' => $channel->id,
            'entity_name' => $channel->name,
            'description' => "Updated integration channel {$channel->name}",
            'changes' => $changes,
        ]);
    }

    public function integrationChannelDeleted(User $actor, $channel): AuditLog
    {
        return $this->record(AuditLogEventType::INTEGRATION_CHANNEL_DELETED, $actor, [
            'entity_type' => 'Integration',
            'entity_id' => $channel->id,
            'entity_name' => $channel->name,
            'description' => "Deleted integration channel {$channel->name}",
            'metadata' => [
                'type' => $channel->type,
            ],
        ]);
    }

    public function userInvited(User $actor, string $email, string $role, ?string $departmentName = null): AuditLog
    {
        return $this->record(AuditLogEventType::USER_INVITED, $actor, [
            'entity_type' => 'Team',
            'entity_id' => $email,
            'entity_name' => $email,
            'description' => "Invited {$email} as {$role}",
            'metadata' => array_filter([
                'invited_email' => $email,
                'role' => $role,
                'department' => $departmentName,
            ]),
        ]);
    }

    public function inviteAccepted(User $actor, string $email, string $role, ?string $departmentName = null): AuditLog
    {
        return $this->record(AuditLogEventType::USER_INVITED_ACCEPTED, $actor, [
            'entity_type' => 'Team',
            'entity_id' => $email,
            'entity_name' => $email,
            'description' => "Accepted invitation for {$email} as {$role}",
            'metadata' => array_filter([
                'invited_email' => $email,
                'role' => $role,
                'department' => $departmentName,
            ]),
        ]);
    }

    public function userInviteCanceled(User $actor, string $email, string $role, ?string $departmentName = null): AuditLog
    {
        return $this->record(AuditLogEventType::USER_INVITE_CANCELED, $actor, [
            'entity_type' => 'Team',
            'entity_id' => $email,
            'entity_name' => $email,
            'description' => "Canceled invitation for {$email}",
            'metadata' => array_filter([
                'invited_email' => $email,
                'role' => $role,
                'department' => $departmentName,
            ]),
        ]);
    }

    public function userInviteResent(User $actor, string $email, string $role, ?string $departmentName = null): AuditLog
    {
        return $this->record(AuditLogEventType::USER_INVITE_RESENT, $actor, [
            'entity_type' => 'Team',
            'entity_id' => $email,
            'entity_name' => $email,
            'description' => "Resent invitation to {$email}",
            'metadata' => array_filter([
                'invited_email' => $email,
                'role' => $role,
                'department' => $departmentName,
            ]),
        ]);
    }

    public function userRemoved(User $actor, User $member): AuditLog
    {
        return $this->record(AuditLogEventType::USER_REMOVED, $actor, [
            'entity_type' => 'Team',
            'entity_id' => $member->id,
            'entity_name' => $member->name,
            'description' => "Removed {$member->name} from workspace",
            'metadata' => [
                'removed_email' => $member->email,
            ],
        ]);
    }

    public function userLogin(User $actor, string $method = 'email'): AuditLog
    {
        return $this->record(AuditLogEventType::USER_LOGIN, $actor, [
            'entity_type' => 'Auth',
            'entity_name' => $actor->name,
            'description' => "{$actor->name} logged in via {$method}",
            'metadata' => [
                'method' => $method,
            ],
        ]);
    }

    public function userLogout(User $actor, ?Request $request = null): AuditLog
    {
        return $this->record(AuditLogEventType::USER_LOGOUT, $actor, [
            'entity_type' => 'Auth',
            'entity_name' => $actor->name,
            'description' => "{$actor->name} logged out",
            'request' => $request,
        ]);
    }

    public function domainIntegrationToggled(User $actor, $integration, bool $enabled, ?bool $wasEnabled = null): AuditLog
    {
        $eventType = $enabled
            ? AuditLogEventType::DOMAIN_INTEGRATION_ENABLED
            : AuditLogEventType::DOMAIN_INTEGRATION_DISABLED;

        $integrationName = $integration->integration->name ?? 'Integration';
        $domain = $integration->domain;

        // Use provided wasEnabled if available, otherwise try to infer (for backward compatibility)
        if ($wasEnabled === null) {
            $wasEnabled = !$enabled;
        }

        return $this->record($eventType, $actor, [
            'entity_type' => 'DomainIntegration',
            'entity_id' => $integration->id,
            'entity_name' => $integrationName,
            'description' => ($enabled ? 'Enabled' : 'Disabled') . " domain integration {$integrationName} for {$domain->url}",
            'metadata' => [
                'domain_id' => $integration->domain_id,
                'domain_url' => $domain->url ?? null,
                'domain_name' => $domain->name ?? null,
                'integration_key' => $integration->integration->key ?? null,
            ],
            'changes' => [
                [
                    'field' => 'enabled',
                    'from' => $wasEnabled ? 'true' : 'false',
                    'to' => $enabled ? 'true' : 'false',
                ],
            ],
        ]);
    }

    public function workspaceIntegrationToggled(User $actor, $integration, bool $enabled): AuditLog
    {
        $eventType = $enabled
            ? AuditLogEventType::WORKSPACE_INTEGRATION_ENABLED
            : AuditLogEventType::WORKSPACE_INTEGRATION_DISABLED;

        $integrationName = $integration->integration->name ?? 'Integration';

        return $this->record($eventType, $actor, [
            'entity_type' => 'WorkspaceIntegration',
            'entity_id' => $integration->id,
            'entity_name' => $integrationName,
            'description' => ($enabled ? 'Enabled' : 'Disabled') . " workspace integration {$integrationName}",
            'metadata' => [
                'integration_key' => $integration->integration->key ?? null,
            ],
        ]);
    }

    public function googleAdsAssigned(User $actor, $domain, int $count, array $metadata = []): AuditLog
    {
        return $this->record(AuditLogEventType::GOOGLE_ADS_ASSIGNED, $actor, [
            'entity_type' => 'GoogleAds',
            'entity_id' => $domain->id,
            'entity_name' => $domain->url,
            'description' => "Assigned {$count} Google Ads campaign(s) to {$domain->url}",
            'metadata' => $metadata,
        ]);
    }

    public function googleAdsUnassigned(User $actor, $domain, int $count, array $metadata = []): AuditLog
    {
        return $this->record(AuditLogEventType::GOOGLE_ADS_UNASSIGNED, $actor, [
            'entity_type' => 'GoogleAds',
            'entity_id' => $domain->id,
            'entity_name' => $domain->url,
            'description' => "Unassigned {$count} Google Ads campaign(s) from {$domain->url}",
            'metadata' => $metadata,
        ]);
    }

    public function facebookAdsAssigned(User $actor, $domain, int $count, array $metadata = []): AuditLog
    {
        return $this->record(AuditLogEventType::FACEBOOK_ADS_ASSIGNED, $actor, [
            'entity_type' => 'FacebookAds',
            'entity_id' => $domain->id,
            'entity_name' => $domain->url,
            'description' => "Assigned {$count} Facebook Ads to {$domain->url}",
            'metadata' => $metadata,
        ]);
    }

    public function facebookAdsUnassigned(User $actor, $domain, int $count, array $metadata = []): AuditLog
    {
        return $this->record(AuditLogEventType::FACEBOOK_ADS_UNASSIGNED, $actor, [
            'entity_type' => 'FacebookAds',
            'entity_id' => $domain->id,
            'entity_name' => $domain->url,
            'description' => "Unassigned {$count} Facebook Ads from {$domain->url}",
            'metadata' => $metadata,
        ]);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private function resolveRole(User $user, int $workspaceId): string
    {
        return $workspaceId
            ? ($user->roleInWorkspace($workspaceId) ?? $user->role ?? 'member')
            : ($user->role ?? 'member');
    }

    private function truncate(?string $value, int $max): ?string
    {
        if (! $value) {
            return null;
        }

        return mb_strlen($value) > $max ? mb_substr($value, 0, $max) : $value;
    }

    private function getClientIp(Request $request): ?string
    {
        return $request->ip() ?: null;
    }
}
