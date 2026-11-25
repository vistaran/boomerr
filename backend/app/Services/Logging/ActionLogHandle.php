<?php

namespace App\Services\Logging;

use App\Enums\SystemLogEventType;
use App\Models\SystemLog;
use Carbon\Carbon;
use Illuminate\Support\Str;

/**
 * Handle returned by SystemLogService::beginAction() for managing
 * parent action logs and their child integration logs.
 */
class ActionLogHandle
{
    private SystemLog $parentLog;
    private array $inheritedContext;
    private Carbon $startedAt;

    public function __construct(SystemLog $parentLog, array $inheritedContext = [])
    {
        $this->parentLog = $parentLog;
        $this->inheritedContext = $inheritedContext;
        $this->startedAt = now();
    }

    /**
     * Get the parent log ID for linking child logs.
     */
    public function getParentId(): int
    {
        return $this->parentLog->id;
    }

    /**
     * Get the parent log model.
     */
    public function getParentLog(): SystemLog
    {
        return $this->parentLog;
    }

    /**
     * Get the correlation ID for this action.
     */
    public function getCorrelationId(): string
    {
        return $this->parentLog->correlation_id;
    }

    /**
     * Mark the parent action as complete.
     *
     * @param string $status Execution status (success, failure, skipped)
     * @param array $summary Optional summary data to merge into payload
     */
    public function markComplete(string $status = SystemLog::EXECUTION_SUCCESS, array $summary = []): self
    {
        $completedAt = now();
        $durationMs = (int) $this->startedAt->diffInMilliseconds($completedAt);

        $payload = $this->parentLog->payload ?? [];
        if (! empty($summary)) {
            $payload['summary'] = $summary;
        }

        // Calculate children summary if children exist
        $childrenSummary = $this->calculateChildrenSummary();
        if ($childrenSummary['total'] > 0) {
            $payload['integrations_summary'] = $childrenSummary;
        }

        $payload['action_duration_ms'] = $durationMs;

        $this->parentLog->update([
            'execution_status' => $status,
            'completed_at' => $completedAt,
            'response_time_ms' => $this->parentLog->response_time_ms ?? $durationMs,
            'payload' => $payload,
            // Update status field for backward compatibility
            'status' => $this->mapExecutionStatusToLegacy($status),
        ]);

        return $this;
    }

    /**
     * Record an integration execution as a child log.
     *
     * @param string $integrationKey The integration key (slack, discord, email, etc.)
     * @param array $attributes Log attributes
     */
    public function recordIntegration(string $integrationKey, array $attributes): SystemLog
    {
        $now = now();

        // Start with inherited context from parent
        $childAttributes = array_merge($this->inheritedContext, [
            'parent_id' => $this->parentLog->id,
            'log_type' => SystemLog::LOG_TYPE_INTEGRATION,
            'integration_key' => $integrationKey,
            'correlation_id' => $this->parentLog->correlation_id,
            'triggered_at' => $attributes['triggered_at'] ?? $now,
            'completed_at' => $attributes['completed_at'] ?? $now,
            'occurred_at' => $now,
        ], $attributes);

        // Ensure required fields
        $childAttributes['execution_status'] = $attributes['execution_status'] ?? SystemLog::EXECUTION_SUCCESS;
        $childAttributes['status'] = $this->mapExecutionStatusToLegacy($childAttributes['execution_status']);

        // Normalize event type
        if (isset($childAttributes['event_type']) && $childAttributes['event_type'] instanceof SystemLogEventType) {
            $childAttributes['event_type'] = $childAttributes['event_type']->value;
        }

        // Handle actor data
        $childAttributes = $this->normalizeActorData($childAttributes);

        return SystemLog::create($childAttributes);
    }

    /**
     * Record an integration execution asynchronously (via queue).
     */
    public function recordIntegrationAsync(string $integrationKey, array $attributes): void
    {
        $now = now();

        // Prepare attributes with inherited context
        $childAttributes = array_merge($this->inheritedContext, [
            'parent_id' => $this->parentLog->id,
            'log_type' => SystemLog::LOG_TYPE_INTEGRATION,
            'integration_key' => $integrationKey,
            'correlation_id' => $this->parentLog->correlation_id,
            'triggered_at' => $attributes['triggered_at'] ?? $now->toDateTimeString(),
            'completed_at' => $attributes['completed_at'] ?? $now->toDateTimeString(),
            'occurred_at' => $now->toDateTimeString(),
        ], $attributes);

        // Ensure required fields
        $childAttributes['execution_status'] = $attributes['execution_status'] ?? SystemLog::EXECUTION_SUCCESS;
        $childAttributes['status'] = $this->mapExecutionStatusToLegacy($childAttributes['execution_status']);

        // Normalize event type
        if (isset($childAttributes['event_type']) && $childAttributes['event_type'] instanceof SystemLogEventType) {
            $childAttributes['event_type'] = $childAttributes['event_type']->value;
        }

        // Handle actor data
        $childAttributes = $this->normalizeActorData($childAttributes);

        // Dispatch to queue
        \App\Jobs\PersistSystemLogEntry::dispatch($childAttributes);
    }

    /**
     * Create a quick success integration log.
     */
    public function integrationSuccess(
        string $integrationKey,
        string $message,
        array $integrationMetadata = [],
        array $extra = []
    ): SystemLog {
        return $this->recordIntegration($integrationKey, array_merge([
            'message' => $message,
            'execution_status' => SystemLog::EXECUTION_SUCCESS,
            'integration_metadata' => $integrationMetadata,
        ], $extra));
    }

    /**
     * Create a quick failure integration log.
     */
    public function integrationFailure(
        string $integrationKey,
        string $message,
        ?string $errorCode = null,
        ?string $errorMessage = null,
        array $integrationMetadata = [],
        array $extra = []
    ): SystemLog {
        return $this->recordIntegration($integrationKey, array_merge([
            'message' => $message,
            'execution_status' => SystemLog::EXECUTION_FAILURE,
            'error_code' => $errorCode,
            'error_message' => $errorMessage,
            'integration_metadata' => $integrationMetadata,
        ], $extra));
    }

    /**
     * Create a quick skipped integration log.
     */
    public function integrationSkipped(
        string $integrationKey,
        string $message,
        array $integrationMetadata = [],
        array $extra = []
    ): SystemLog {
        return $this->recordIntegration($integrationKey, array_merge([
            'message' => $message,
            'execution_status' => SystemLog::EXECUTION_SKIPPED,
            'integration_metadata' => $integrationMetadata,
        ], $extra));
    }

    /**
     * Calculate summary of child integration logs.
     */
    private function calculateChildrenSummary(): array
    {
        $children = SystemLog::where('parent_id', $this->parentLog->id)->get();

        return [
            'total' => $children->count(),
            'success' => $children->where('execution_status', SystemLog::EXECUTION_SUCCESS)->count(),
            'failure' => $children->where('execution_status', SystemLog::EXECUTION_FAILURE)->count(),
            'skipped' => $children->where('execution_status', SystemLog::EXECUTION_SKIPPED)->count(),
            'pending' => $children->where('execution_status', SystemLog::EXECUTION_PENDING)->count(),
        ];
    }

    /**
     * Map execution status to legacy status field for backward compatibility.
     */
    private function mapExecutionStatusToLegacy(string $executionStatus): string
    {
        return match ($executionStatus) {
            SystemLog::EXECUTION_SUCCESS => 'success',
            SystemLog::EXECUTION_FAILURE => 'failure',
            SystemLog::EXECUTION_SKIPPED => 'skipped',
            SystemLog::EXECUTION_PENDING => 'info',
            default => 'info',
        };
    }

    /**
     * Normalize actor data from various formats.
     */
    private function normalizeActorData(array $attributes): array
    {
        $actor = $attributes['actor'] ?? null;
        unset($attributes['actor']);

        if ($actor instanceof \App\Models\User) {
            $attributes['actor_id'] = $actor->id;
            $attributes['actor_type'] = 'user';
            $attributes['actor_name'] = $actor->name;
            $attributes['actor_email'] = $actor->email;
            $attributes['actor_snapshot'] = [
                'id' => $actor->id,
                'name' => $actor->name,
                'email' => $actor->email,
            ];
        } elseif (is_array($actor)) {
            $attributes = array_merge($attributes, $actor);
        }

        return $attributes;
    }
}
