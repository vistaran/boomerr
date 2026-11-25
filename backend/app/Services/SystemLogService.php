<?php

namespace App\Services;

use App\Enums\SystemLogEventType;
use App\Jobs\PersistSystemLogEntry;
use App\Models\SystemLog;
use App\Models\User;
use App\Services\Logging\ActionLogHandle;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Support\Str;

class SystemLogService
{
    // ─────────────────────────────────────────────────────────────────────────
    // Action Builder Pattern (New API)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Begin a new action log (parent log).
     * Returns a handle for recording child integration logs and marking completion.
     *
     * @param array<string, mixed> $attributes
     */
    public function beginAction(array $attributes): ActionLogHandle
    {
        $now = now();

        $prepared = $this->prepareAttributes(array_merge($attributes, [
            'log_type' => SystemLog::LOG_TYPE_ACTION,
            'execution_status' => SystemLog::EXECUTION_PENDING,
            'triggered_at' => $now,
            'status' => 'info', // Will be updated on completion
        ]));

        $parentLog = SystemLog::create($prepared);

        // Context to inherit to child logs
        $inheritedContext = [
            'workspace_id' => $prepared['workspace_id'] ?? null,
            'domain_id' => $prepared['domain_id'] ?? null,
            'domain_integration_id' => $prepared['domain_integration_id'] ?? null,
            'event_type' => $prepared['event_type'] ?? null,
            'source' => $prepared['source'] ?? null,
            'category' => $prepared['category'] ?? null,
            'severity' => $prepared['severity'] ?? 'info',
        ];

        return new ActionLogHandle($parentLog, array_filter($inheritedContext));
    }

    /**
     * Create a complete action log without needing the builder pattern.
     * Useful for simple single-step actions without child integrations.
     *
     * @param array<string, mixed> $attributes
     */
    public function recordAction(array $attributes): SystemLog
    {
        $now = now();

        $log = SystemLog::create($this->prepareAttributes(array_merge($attributes, [
            'log_type' => SystemLog::LOG_TYPE_ACTION,
            'execution_status' => $attributes['execution_status'] ?? SystemLog::EXECUTION_SUCCESS,
            'triggered_at' => $attributes['triggered_at'] ?? $now,
            'completed_at' => $attributes['completed_at'] ?? $now,
        ])));

        $this->notifyAdminsOnError($log);

        return $log;
    }

    protected function notifyAdminsOnError(SystemLog $log): void
    {
        if ($log->status === 'failure' || $log->severity === 'error' || $log->severity === 'critical') {
            \App\Models\Admin::all()->each(function ($admin) use ($log) {
                $admin->notify(new \App\Notifications\AdminSystemAlertNotification(
                    "System Event [{$log->event_type}]: " . ($log->message ?? 'No message'),
                    $log->severity ?? 'error'
                ));
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Legacy API (Backward Compatibility)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Write immediately bypassing the queue for critical/audit events.
     *
     * @param array<string, mixed> $attributes
     * @deprecated Use beginAction() for parent logs or recordAction() for simple logs
     */
    public function recordInline(array $attributes): SystemLog
    {
        $log = SystemLog::create($this->prepareAttributes($this->ensureLifecycleFields($attributes)));
        $this->notifyAdminsOnError($log);
        return $log;
    }

    /**
     * Queue persistence for high-volume signals (health checks, dispatchers, etc.).
     *
     * @param array<string, mixed> $attributes
     * @deprecated Use ActionLogHandle::recordIntegrationAsync() for child logs
     */
    public function recordAsync(array $attributes): void
    {
        PersistSystemLogEntry::dispatch($this->prepareAttributes($this->ensureLifecycleFields($attributes)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Actor Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Helper describing an automated/system actor.
     */
    public function automationActor(string $name, string $context = 'system'): array
    {
        return [
            'actor_type' => 'system',
            'actor_name' => $name,
            'actor_role' => Str::headline($context),
            'actor_department' => 'automation',
            'actor_snapshot' => [
                'type' => 'system',
                'name' => $name,
                'context' => $context,
            ],
        ];
    }

    /**
     * Helper describing a scheduler initiated actor.
     */
    public function schedulerActor(string $name = 'scheduler'): array
    {
        return $this->automationActor($name, 'scheduler');
    }

    /**
     * Helper describing a webhook dispatcher actor.
     */
    public function dispatcherActor(string $name = 'webhook-dispatcher'): array
    {
        return $this->automationActor($name, 'webhook-dispatcher');
    }

    /**
     * Ensure SystemLogEventType enums are flattened to their string value.
     *
     * @param array<string, mixed> $attributes
     * @return array<string, mixed>
     */
    private function prepareAttributes(array $attributes): array
    {
        $attributes['event_type'] = $this->normalizeEventType($attributes['event_type'] ?? SystemLogEventType::SYSTEM_ALERT);

        $attributes = $this->mergeActorData($attributes);

        $attributes['payload'] = $this->normalizeArray($attributes['payload'] ?? null);
        $attributes['sensitive_payload'] = $this->normalizeArray($attributes['sensitive_payload'] ?? null);
        $attributes['actor_snapshot'] = $this->normalizeArray($attributes['actor_snapshot'] ?? null);

        $attributes['status'] = $attributes['status'] ?? 'info';
        $attributes['severity'] = $attributes['severity'] ?? 'info';
        $attributes['source'] = $attributes['source'] ?? null;
        $attributes['category'] = $attributes['category'] ?? null;

        $attributes['occurred_at'] = $this->normalizeDateString($attributes['occurred_at'] ?? now());

        if (! empty($attributes['sensitive_payload']) && empty($attributes['retention_expires_at'])) {
            $attributes['retention_expires_at'] = $this->normalizeDateString(
                now()->addDays($this->sensitiveRetentionDays())
            );
        } elseif (! empty($attributes['retention_expires_at'])) {
            $attributes['retention_expires_at'] = $this->normalizeDateString($attributes['retention_expires_at']);
        }

        if (empty($attributes['correlation_id'])) {
            $attributes['correlation_id'] = (string) Str::uuid();
        }

        if (empty($attributes['message'])) {
            $attributes['message'] = null;
        }

        if (empty($attributes['error_code'])) {
            $attributes['error_code'] = null;
        }

        if (empty($attributes['error_message'])) {
            $attributes['error_message'] = null;
        }

        return $attributes;
    }

    private function normalizeEventType(SystemLogEventType|string|null $eventType): string
    {
        if ($eventType instanceof SystemLogEventType) {
            return $eventType->value;
        }

        if (is_string($eventType) && $eventType !== '') {
            return $eventType;
        }

        return SystemLogEventType::SYSTEM_ALERT->value;
    }

    /**
     * @param array<string, mixed> $attributes
     * @return array<string, mixed>
     */
    private function mergeActorData(array $attributes): array
    {
        $actor = $attributes['actor'] ?? null;
        unset($attributes['actor']);

        if ($actor instanceof User) {
            $workspaceId = $attributes['workspace_id'] ?? $actor->currentWorkspaceId();
            $attributes = array_merge($attributes, $this->formatUserActor($actor, $workspaceId));
        } elseif (is_array($actor)) {
            $attributes = array_merge($attributes, $this->normalizeActorArray($actor));
        }

        return $attributes;
    }

    private function normalizeArray(mixed $value): ?array
    {
        if ($value instanceof Arrayable) {
            $value = $value->toArray();
        }

        if (is_object($value)) {
            $value = (array) $value;
        }

        if (! is_array($value) || empty($value)) {
            return null;
        }

        return $value;
    }

    private function normalizeDateString(CarbonInterface|string $value): string
    {
        if ($value instanceof CarbonInterface) {
            return $value->toDateTimeString();
        }

        return (string) $value;
    }

    private function sensitiveRetentionDays(): int
    {
        $target = (int) config('system-logs.sensitive_retention_days', 150);
        $min = (int) config('system-logs.sensitive_retention_min_days', 90);
        $max = (int) config('system-logs.sensitive_retention_max_days', 180);

        return max($min, min($max, $target));
    }

    private function formatUserActor(User $user, ?int $workspaceId = null): array
    {
        $workspaceId ??= $user->currentWorkspaceId();
        $role = $workspaceId ? ($user->roleInWorkspace($workspaceId) ?? $user->role) : $user->role;

        $department = null;
        if ($workspaceId) {
            $department = $user->departments()
                ->wherePivot('workspace_id', $workspaceId)
                ->value('name');
        }

        return [
            'actor_id' => $user->id,
            'actor_type' => 'user',
            'actor_name' => $user->name,
            'actor_email' => $user->email,
            'actor_role' => $role,
            'actor_department' => $department,
            'actor_snapshot' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $role,
                'department' => $department,
                'workspace_id' => $workspaceId,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $actor
     * @return array<string, mixed>
     */
    private function normalizeActorArray(array $actor): array
    {
        $snapshot = $this->normalizeArray($actor['actor_snapshot'] ?? null);

        return [
            'actor_id' => $actor['actor_id'] ?? null,
            'actor_type' => $actor['actor_type'] ?? 'system',
            'actor_name' => $actor['actor_name'] ?? ($snapshot['name'] ?? null),
            'actor_email' => $actor['actor_email'] ?? null,
            'actor_role' => $actor['actor_role'] ?? ($snapshot['role'] ?? null),
            'actor_department' => $actor['actor_department'] ?? ($snapshot['department'] ?? null),
            'actor_snapshot' => $snapshot,
        ];
    }

    /**
     * Ensure lifecycle fields are set for backward-compatible log creation.
     *
     * @param array<string, mixed> $attributes
     * @return array<string, mixed>
     */
    private function ensureLifecycleFields(array $attributes): array
    {
        $now = now();

        // Default to action type if not specified
        if (empty($attributes['log_type'])) {
            $attributes['log_type'] = SystemLog::LOG_TYPE_ACTION;
        }

        // Set lifecycle timestamps if not provided
        if (empty($attributes['triggered_at'])) {
            $attributes['triggered_at'] = $now->toDateTimeString();
        }
        if (empty($attributes['completed_at'])) {
            $attributes['completed_at'] = $now->toDateTimeString();
        }

        // Map status to execution_status if not set
        if (empty($attributes['execution_status'])) {
            $attributes['execution_status'] = match ($attributes['status'] ?? 'info') {
                'success' => SystemLog::EXECUTION_SUCCESS,
                'failure' => SystemLog::EXECUTION_FAILURE,
                'skipped' => SystemLog::EXECUTION_SKIPPED,
                default => SystemLog::EXECUTION_SUCCESS,
            };
        }

        // Extract integration_key from payload if available
        if (empty($attributes['integration_key'])) {
            $payload = $attributes['payload'] ?? [];
            if (is_array($payload) && isset($payload['integration_key'])) {
                $attributes['integration_key'] = $payload['integration_key'];
            }
        }

        return $attributes;
    }

    /**
     * Normalize integration metadata to ensure consistent structure.
     *
     * @param array<string, mixed> $metadata
     * @return array<string, mixed>
     */
    public static function normalizeIntegrationMetadata(array $metadata): array
    {
        return [
            'channel_id' => $metadata['channel_id'] ?? null,
            'channel_name' => $metadata['channel_name'] ?? null,
            'channel_type' => $metadata['channel_type'] ?? null,
            'webhook_url' => $metadata['webhook_url'] ?? null,
            'recipient' => $metadata['recipient'] ?? null,
            'recipient_email' => $metadata['recipient_email'] ?? null,
            'recipient_phone' => $metadata['recipient_phone'] ?? null,
            'subject' => $metadata['subject'] ?? null,
            'provider_response' => $metadata['provider_response'] ?? null,
            'http_status' => $metadata['http_status'] ?? null,
            'response_body' => $metadata['response_body'] ?? null,
            'error_code' => $metadata['error_code'] ?? null,
            'error_message' => $metadata['error_message'] ?? null,
            'duration_ms' => $metadata['duration_ms'] ?? null,
            'retry_count' => $metadata['retry_count'] ?? 0,
            'extra' => $metadata['extra'] ?? null,
        ];
    }
}
