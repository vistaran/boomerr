<?php

namespace App\Jobs;

use App\Models\SystemLog;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class PersistSystemLogEntry implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;
    public int $timeout = 30;

    /**
     * @param array<string, mixed> $attributes
     */
    public function __construct(private readonly array $attributes)
    {
        //
    }

    public function handle(): void
    {
        $payload = $this->attributes;

        try {
            // Parse date fields
            $dateFields = ['occurred_at', 'retention_expires_at', 'triggered_at', 'completed_at'];
            foreach ($dateFields as $field) {
                if (! empty($payload[$field])) {
                    $payload[$field] = Carbon::parse($payload[$field]);
                }
            }

            // Normalize nullable array fields
            $arrayFields = ['payload', 'actor_snapshot', 'sensitive_payload', 'integration_metadata'];
            foreach ($arrayFields as $field) {
                if (empty($payload[$field])) {
                    $payload[$field] = null;
                }
            }

            // Ensure lifecycle defaults for backward compatibility
            if (empty($payload['log_type'])) {
                $payload['log_type'] = SystemLog::LOG_TYPE_ACTION;
            }

            if (empty($payload['execution_status'])) {
                $payload['execution_status'] = match ($payload['status'] ?? 'info') {
                    'success' => SystemLog::EXECUTION_SUCCESS,
                    'failure' => SystemLog::EXECUTION_FAILURE,
                    'skipped' => SystemLog::EXECUTION_SKIPPED,
                    default => SystemLog::EXECUTION_SUCCESS,
                };
            }

            if (empty($payload['triggered_at'])) {
                $payload['triggered_at'] = $payload['occurred_at'] ?? now();
            }

            if (empty($payload['completed_at'])) {
                $payload['completed_at'] = $payload['occurred_at'] ?? now();
            }

            SystemLog::create($payload);
        } catch (Throwable $exception) {
            Log::warning('Failed to persist system log entry', [
                'message' => $exception->getMessage(),
                'log_type' => $payload['log_type'] ?? 'unknown',
                'parent_id' => $payload['parent_id'] ?? null,
            ]);
        }
    }
}
