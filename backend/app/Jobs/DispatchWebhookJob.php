<?php

namespace App\Jobs;

use App\Models\Webhook;
use App\Models\WebhookDelivery;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class DispatchWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $webhook;
    public $payload;
    public $eventName;
    public $eventId;
    public $attemptNumber;

    public function __construct(
        Webhook $webhook,
        array $payload,
        string $eventName,
        ?string $eventId,
        int $attemptNumber = 1,
        public ?int $parentLogId = null
    ) {
        $this->webhook = $webhook;
        $this->payload = $payload;
        $this->eventName = $eventName;
        $this->eventId = $eventId;
        $this->attemptNumber = $attemptNumber;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $timestamp = now()->toIso8601String();

        // SSRF Guard: Verify webhook URL before delivery
        $ssrfReason = null;
        if (!\App\Helpers\SecurityHelper::isSafeUrl($this->webhook->url, $ssrfReason)) {
            \Illuminate\Support\Facades\Log::warning("SSRF Protection: Webhook #{$this->webhook->id} ({$this->webhook->url}) delivery aborted", [
                'webhook_id' => $this->webhook->id,
                'url' => $this->webhook->url,
                'reason' => $ssrfReason,
            ]);
            return;
        }
        
        $requestPayload = $this->payload;

        // Automatically format payload for Discord Webhooks
        if (str_contains($this->webhook->url, 'discord.com/api/webhooks')) {
            $description = isset($this->payload['message']) 
                ? $this->payload['message'] 
                : "```json\n" . json_encode($this->payload, JSON_PRETTY_PRINT) . "\n```";

            $requestPayload = [
                'embeds' => [[
                    'title' => "🔔 Webhook Event: " . $this->eventName,
                    'color' => 3447003,
                    'description' => $description,
                    'footer' => [
                        'text' => config('app.name', 'Boomerr'),
                    ],
                    'timestamp' => now()->toIso8601String(),
                ]]
            ];
        }

        $payloadJson = json_encode($requestPayload);
        $signature = hash_hmac('sha256', $payloadJson, $this->webhook->secret ?? '');

        $startTime = microtime(true);

        try {
            $headers = [
                'Content-Type' => 'application/json',
                'User-Agent' => 'BoomerMonitor/1.0',
                'X-Webhook-ID' => (string) $this->webhook->id,
                'X-Webhook-Event' => $this->eventName,
                'X-Webhook-Timestamp' => $timestamp,
                'X-Webhook-Signature' => $signature,
            ];

            $response = \App\Services\SafeWebhookHttpClient::post(
                $this->webhook->url,
                $requestPayload,
                $headers,
                $this->webhook->timeout ?? 10
            );

            $durationMs = (int) ((microtime(true) - $startTime) * 1000);
            $httpStatus = $response->status();

            $status = $response->successful() ? 'success' : 'failed';

            if ($status === 'success' && $this->webhook->failure_count > 0) {
                $this->webhook->update(['failure_count' => 0]);
            }

            WebhookDelivery::create([
                'webhook_id' => $this->webhook->id,
                'event_id' => $this->eventId,
                'event_name' => $this->eventName,
                'http_status' => $httpStatus,
                'status' => $status,
                'attempt' => $this->attemptNumber,
                'request_payload' => $requestPayload,
                'response_headers' => $response->headers(),
                'response_body' => mb_substr($response->body(), 0, 10000), // Limit length
                'duration_ms' => $durationMs,
            ]);

            $executionStatus = $status === 'success' ? \App\Models\SystemLog::EXECUTION_SUCCESS : \App\Models\SystemLog::EXECUTION_FAILURE;

            \App\Models\SystemLog::create([
                'parent_id' => $this->parentLogId,
                'workspace_id' => $this->webhook->workspace_id,
                'log_type' => $this->parentLogId ? \App\Models\SystemLog::LOG_TYPE_INTEGRATION : \App\Models\SystemLog::LOG_TYPE_ACTION,
                'source' => 'webhook-dispatcher',
                'event_type' => $this->eventName,
                'severity' => $status === 'success' ? 'info' : 'error',
                'message' => "Webhook {$this->eventName} delivered to {$this->webhook->name}",
                'execution_status' => $executionStatus,
                'status' => $status === 'success' ? 'success' : 'failure',
                'payload' => $requestPayload,
                'error_message' => $status === 'failed' ? mb_substr($response->body(), 0, 1000) : null,
                'integration_key' => 'webhook',
                'integration_metadata' => [
                    'webhook_id' => $this->webhook->id,
                    'webhook_name' => $this->webhook->name,
                    'url' => $this->webhook->url,
                    'http_status' => $httpStatus,
                    'duration_ms' => $durationMs,
                ],
                'response_time_ms' => $durationMs,
                'triggered_at' => $timestamp,
                'completed_at' => now(),
                'occurred_at' => now(),
            ]);

            if ($status === 'failed') {
                if ($this->webhook->retry_enabled && $this->eventName !== 'TEST') {
                    $this->handleRetry($httpStatus);
                } else {
                    $this->recordFinalFailure();
                }
            }

        } catch (\Exception $e) {
            $durationMs = (int) ((microtime(true) - $startTime) * 1000);

            WebhookDelivery::create([
                'webhook_id' => $this->webhook->id,
                'event_id' => $this->eventId,
                'event_name' => $this->eventName,
                'http_status' => null,
                'status' => 'failed',
                'attempt' => $this->attemptNumber,
                'request_payload' => $requestPayload,
                'response_headers' => null,
                'response_body' => $e->getMessage(),
                'duration_ms' => $durationMs,
            ]);

            \App\Models\SystemLog::create([
                'parent_id' => $this->parentLogId,
                'workspace_id' => $this->webhook->workspace_id,
                'log_type' => $this->parentLogId ? \App\Models\SystemLog::LOG_TYPE_INTEGRATION : \App\Models\SystemLog::LOG_TYPE_ACTION,
                'source' => 'webhook-dispatcher',
                'event_type' => $this->eventName,
                'severity' => 'error',
                'message' => "Webhook {$this->eventName} failed to deliver to {$this->webhook->name}",
                'execution_status' => \App\Models\SystemLog::EXECUTION_FAILURE,
                'status' => 'failure',
                'payload' => $requestPayload,
                'error_message' => mb_substr($e->getMessage(), 0, 1000),
                'integration_key' => 'webhook',
                'integration_metadata' => [
                    'webhook_id' => $this->webhook->id,
                    'webhook_name' => $this->webhook->name,
                    'url' => $this->webhook->url,
                    'duration_ms' => $durationMs,
                    'error' => $e->getMessage(),
                ],
                'response_time_ms' => $durationMs,
                'triggered_at' => $timestamp,
                'completed_at' => now(),
                'occurred_at' => now(),
            ]);

            if ($this->webhook->retry_enabled && $this->eventName !== 'TEST') {
                // Timeout or connection error
                $this->handleRetry(null);
            } else {
                $this->recordFinalFailure();
            }
        }
    }

    protected function handleRetry(?int $httpStatus)
    {
        // Do NOT retry for these statuses
        if (in_array($httpStatus, [400, 401, 403, 404, 410])) {
            $this->recordFinalFailure();
            return;
        }

        // Retry for Timeout(null), 500, 502, 503, 504 or other errors
        $maxAttempts = 5;
        if ($this->attemptNumber >= $maxAttempts) {
            $this->recordFinalFailure();
            return;
        }

        // Retry schedule: 10 seconds, 1 minute, 5 minutes, 30 minutes
        $delays = [
            2 => 10,
            3 => 60,
            4 => 300,
            5 => 1800,
        ];

        $nextAttempt = $this->attemptNumber + 1;
        $delaySeconds = $delays[$nextAttempt] ?? 0;

        self::dispatch($this->webhook, $this->payload, $this->eventName, $this->eventId, $nextAttempt)
            ->delay(now()->addSeconds($delaySeconds));
    }

    protected function recordFinalFailure()
    {
        $this->webhook->increment('failure_count');
        $this->webhook->refresh();

        if ($this->webhook->failure_count >= 3 && $this->webhook->enabled) {
            $this->webhook->update([
                'enabled' => false,
                'failure_count' => 0,
            ]);

            if ($this->webhook->workspace) {
                $this->webhook->workspace->notify(new \App\Notifications\DeveloperWebhookDisabledNotification($this->webhook));
            }
        }
    }
}
