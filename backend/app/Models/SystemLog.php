<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\AsEncryptedArrayObject;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SystemLog extends Model
{
    /**
     * Log types for hierarchical organization.
     */
    public const LOG_TYPE_ACTION = 'action';
    public const LOG_TYPE_INTEGRATION = 'integration';
    public const LOG_TYPE_SUBTASK = 'subtask';

    /**
     * Execution status values.
     */
    public const EXECUTION_PENDING = 'pending';
    public const EXECUTION_SUCCESS = 'success';
    public const EXECUTION_FAILURE = 'failure';
    public const EXECUTION_SKIPPED = 'skipped';

    protected $fillable = [
        'workspace_id',
        'domain_id',
        'incident_id',
        'domain_integration_id',
        'notification_channel_id',
        'integration_id',
        'parent_id',
        'log_type',
        'integration_key',
        'event_type',
        'source',
        'category',
        'status',
        'execution_status',
        'trigger_source',
        'severity',
        'message',
        'response_time_ms',
        'error_code',
        'error_message',
        'payload',
        'integration_metadata',
        'sensitive_payload',
        'occurred_at',
        'triggered_at',
        'completed_at',
        'retention_expires_at',
        'actor_id',
        'actor_type',
        'actor_name',
        'actor_email',
        'actor_role',
        'actor_department',
        'actor_snapshot',
        'correlation_id',
    ];

    protected $casts = [
        'payload' => 'array',
        'integration_metadata' => 'array',
        'sensitive_payload' => AsEncryptedArrayObject::class,
        'actor_snapshot' => 'array',
        'occurred_at' => 'datetime',
        'triggered_at' => 'datetime',
        'completed_at' => 'datetime',
        'retention_expires_at' => 'datetime',
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // Relationships
    // ─────────────────────────────────────────────────────────────────────────

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function domain(): BelongsTo
    {
        return $this->belongsTo(Domain::class);
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function domainIntegration(): BelongsTo
    {
        return $this->belongsTo(DomainIntegration::class);
    }

    public function notificationChannel(): BelongsTo
    {
        return $this->belongsTo(NotificationChannel::class);
    }

    public function integration(): BelongsTo
    {
        return $this->belongsTo(Integration::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /**
     * Parent log for hierarchical logs (integration/subtask logs).
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /**
     * Child logs (integration executions, subtasks).
     */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('triggered_at');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scopes
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Scope to only parent/action logs (no parent_id).
     */
    public function scopeParents(Builder $query): Builder
    {
        return $query->whereNull('parent_id')->where('log_type', self::LOG_TYPE_ACTION);
    }

    /**
     * Scope to get children of specific parent IDs.
     */
    public function scopeChildrenOf(Builder $query, array|int $parentIds): Builder
    {
        return $query->whereIn('parent_id', (array) $parentIds);
    }

    /**
     * Scope to only integration execution logs.
     */
    public function scopeIntegrationExecutions(Builder $query): Builder
    {
        return $query->where('log_type', self::LOG_TYPE_INTEGRATION);
    }

    /**
     * Scope to filter by execution status.
     */
    public function scopeWithExecutionStatus(Builder $query, string|array $status): Builder
    {
        return $query->whereIn('execution_status', (array) $status);
    }

    /**
     * Scope to filter by integration key.
     */
    public function scopeForIntegration(Builder $query, string $integrationKey): Builder
    {
        return $query->where('integration_key', $integrationKey);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calculate duration in milliseconds between triggered and completed.
     */
    public function getDurationMsAttribute(): ?int
    {
        if (! $this->triggered_at || ! $this->completed_at) {
            return $this->response_time_ms;
        }

        return (int) $this->triggered_at->diffInMilliseconds($this->completed_at);
    }

    /**
     * Check if this log is a parent/action log.
     */
    public function isParent(): bool
    {
        return $this->log_type === self::LOG_TYPE_ACTION && $this->parent_id === null;
    }

    /**
     * Check if this log is a child (integration or subtask).
     */
    public function isChild(): bool
    {
        return $this->parent_id !== null;
    }

    /**
     * Check if execution is still pending.
     */
    public function isPending(): bool
    {
        return $this->execution_status === self::EXECUTION_PENDING;
    }

    /**
     * Check if execution completed successfully.
     */
    public function isSuccessful(): bool
    {
        return $this->execution_status === self::EXECUTION_SUCCESS;
    }

    /**
     * Check if execution failed.
     */
    public function isFailed(): bool
    {
        return $this->execution_status === self::EXECUTION_FAILURE;
    }

    /**
     * Check if execution was skipped.
     */
    public function isSkipped(): bool
    {
        return $this->execution_status === self::EXECUTION_SKIPPED;
    }

    /**
     * Get a summary of child integration executions.
     */
    public function getChildrenSummaryAttribute(): array
    {
        if (! $this->relationLoaded('children')) {
            return [
                'total' => 0,
                'success' => 0,
                'failure' => 0,
                'skipped' => 0,
                'pending' => 0,
            ];
        }

        $children = $this->children;

        return [
            'total' => $children->count(),
            'success' => $children->where('execution_status', self::EXECUTION_SUCCESS)->count(),
            'failure' => $children->where('execution_status', self::EXECUTION_FAILURE)->count(),
            'skipped' => $children->where('execution_status', self::EXECUTION_SKIPPED)->count(),
            'pending' => $children->where('execution_status', self::EXECUTION_PENDING)->count(),
        ];
    }

    /**
     * Get lifecycle data as a structured array.
     */
    public function getLifecycleAttribute(): array
    {
        return [
            'triggered_at' => $this->triggered_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'duration_ms' => $this->duration_ms,
            'execution_status' => $this->execution_status,
        ];
    }
}
