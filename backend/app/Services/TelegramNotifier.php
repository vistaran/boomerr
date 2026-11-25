<?php

namespace App\Services;

use App\Enums\SystemLogEventType;
use App\Models\NotificationChannel;
use App\Models\SystemLog;
use App\Services\Logging\ActionLogHandle;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class TelegramNotifier
{
    /**
     * Send a Telegram webhook notification.
     *
     * @param string $chatId The Telegram chat ID
     * @param array $payload The message payload (e.g. text, parse_mode)
     * @param int|null $channelId Optional notification channel ID for tracking
     * @param ActionLogHandle|null $actionHandle Optional parent action log handle for child logging
     */
    public static function send(
        string $chatId,
        array $payload,
        ?int $channelId = null,
        ?ActionLogHandle $actionHandle = null
    ): void {
        $channel = $channelId ? NotificationChannel::find($channelId) : null;

        $success = false;
        $lastTriggerStatus = null;
        $responseBody = null;
        $responseStatus = null;
        $durationMs = null;
        $errorMessage = null;
        $errorCode = null;
        $statusLabel = 'skipped';
        $message = 'Channel inactive or missing';
        $triggeredAt = now();

        $botToken = config('services.telegram.bot_token');
        $webhookUrl = "https://api.telegram.org/bot{$botToken}/sendMessage";

        // Inject chat_id into payload if not already present
        if (!isset($payload['chat_id'])) {
            $payload['chat_id'] = $chatId;
        }

        $shouldSend = $channel ? \App\Services\NotificationChannelStatusService::isChannelActive($channel) : true;

        if ($shouldSend) {
            $startedAt = microtime(true);
            try {
                Log::info('Telegram webhook dispatching', [
                    'url' => $webhookUrl,
                    'chat_id' => $chatId,
                    'payload' => $payload,
                ]);

                $response = Http::timeout(5)->post($webhookUrl, $payload);
                $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
                $success = $response->successful();
                $statusLabel = $success ? 'success' : 'failure';
                $message = $success ? 'Telegram webhook delivered' : 'Telegram webhook failed';
                $responseStatus = $response->status();
                $lastTriggerStatus = $success ? 'success' : ($response->status() . ' ' . $response->reason());
                $responseBody = $response->body();

                Log::info('Telegram webhook response', [
                    'chat_id' => $chatId,
                    'status' => $responseStatus,
                    'body' => $responseBody,
                    'duration_ms' => $durationMs,
                ]);

                if (!$success) {
                    $errorCode = 'HTTP_' . $response->status();
                    $errorMessage = sprintf('HTTP %s %s', $response->status(), $response->reason());
                }
            } catch (Throwable $e) {
                $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
                $lastTriggerStatus = 'error: ' . $e->getMessage();
                $statusLabel = 'failure';
                $message = 'Telegram webhook threw exception';
                $errorCode = 'EXCEPTION';
                $errorMessage = $e->getMessage();
                Log::error('Telegram webhook send failed (exception)', [
                    'chat_id' => $chatId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }

            if ($channel) {
                $channel->last_triggered_at = now();
                $channel->last_trigger_status = $lastTriggerStatus;
                if ($success) {
                    $channel->success_count = ($channel->success_count ?? 0) + 1;
                } else {
                    $channel->failure_count = ($channel->failure_count ?? 0) + 1;
                }
                $channel->save();

                // Record Delivery History for the Integration
                $channel->deliveries()->create([
                    'event_name' => 'Telegram Alert', // or derive from payload
                    'http_status' => $responseStatus,
                    'status' => $statusLabel === 'success' ? 'success' : 'failed',
                    'attempt' => 1,
                    'request_payload' => $payload,
                    'response_headers' => isset($response) && $response instanceof \Illuminate\Http\Client\Response ? $response->headers() : null,
                    'response_body' => $responseBody ?? $errorMessage,
                    'duration_ms' => $durationMs,
                ]);
            }
        }

        $completedAt = now();

        // Build integration metadata
        $integrationMetadata = SystemLogService::normalizeIntegrationMetadata([
            'channel_id' => $channel?->id,
            'channel_name' => $channel?->name,
            'channel_type' => 'telegram',
            'http_status' => $responseStatus,
            'response_body' => $responseBody,
            'error_code' => $errorCode,
            'error_message' => $errorMessage,
            'duration_ms' => $durationMs,
        ]);

        // If we have a parent action handle, record as child log
        if ($actionHandle && $channel) {
            $executionStatus = match ($statusLabel) {
                'success' => SystemLog::EXECUTION_SUCCESS,
                'failure' => SystemLog::EXECUTION_FAILURE,
                'skipped' => SystemLog::EXECUTION_SKIPPED,
                default => SystemLog::EXECUTION_SUCCESS,
            };

            $actionHandle->recordIntegration('telegram', [
                'notification_channel_id' => $channel->id,
                'integration_id' => $channel->domainIntegration?->integration_id,
                'event_type' => SystemLogEventType::WEBHOOK_DISPATCH,
                'source' => 'webhook-dispatcher',
                'trigger_source' => 'telegram-notifier',
                'message' => $message,
                'execution_status' => $executionStatus,
                'triggered_at' => $triggeredAt,
                'completed_at' => $completedAt,
                'response_time_ms' => $durationMs,
                'error_code' => $errorCode,
                'error_message' => $errorMessage,
                'integration_metadata' => $integrationMetadata,
                'payload' => [
                    'channel' => [
                        'id' => $channel->id,
                        'name' => $channel->name,
                        'type' => 'telegram',
                    ],
                    'integration_key' => 'telegram',
                    'response_status' => $responseStatus,
                ],
                'sensitive_payload' => [
                    'request_body' => $payload,
                    'response_body' => $responseBody,
                    'chat_id' => $chatId,
                ],
                'actor' => app(SystemLogService::class)->dispatcherActor('telegram-webhook'),
            ]);
        } elseif ($channel) {
            // Legacy: standalone log (backward compatibility)
            $systemLogs = app(SystemLogService::class);
            $systemLogs->recordAsync([
                'workspace_id' => $channel->workspace_id,
                'domain_id' => $channel->domain_id,
                'domain_integration_id' => $channel->integration_id,
                'notification_channel_id' => $channel->id,
                'integration_id' => $channel->domainIntegration?->integration_id,
                'integration_key' => 'telegram',
                'log_type' => SystemLog::LOG_TYPE_INTEGRATION,
                'event_type' => SystemLogEventType::WEBHOOK_DISPATCH,
                'source' => 'webhook-dispatcher',
                'trigger_source' => 'telegram-notifier',
                'status' => $statusLabel,
                'message' => $message,
                'response_time_ms' => $durationMs,
                'error_code' => $errorCode,
                'error_message' => $errorMessage,
                'integration_metadata' => $integrationMetadata,
                'payload' => [
                    'channel' => [
                        'id' => $channel->id,
                        'name' => $channel->name,
                        'type' => 'telegram',
                    ],
                    'integration_key' => 'telegram',
                    'response_status' => $responseStatus,
                ],
                'sensitive_payload' => [
                    'request_body' => $payload,
                    'response_body' => $responseBody,
                    'chat_id' => $chatId,
                ],
                'actor' => $systemLogs->dispatcherActor('telegram-webhook'),
            ]);
        }
    }

    /**
     * Send a domain alert notification to Telegram.
     *
     * @param string $chatId The Telegram Chat ID
     * @param array $data Alert data with domain information
     * @param int|null $channelId Optional notification channel ID
     * @param ActionLogHandle|null $actionHandle Optional parent action log handle
     */
    public static function domainAlert(
        string $chatId,
        array $data,
        ?int $channelId = null,
        ?ActionLogHandle $actionHandle = null
    ): void {
        $status = strtoupper($data['status']);
        $isDown = $status === 'DOWN';
        $emoji = $isDown ? '🔴' : '🟢';

        // Determine title for Telegram notification
        $hasIncident = $isDown && !empty($data['incident_ulid']);

        // Escape variables that could contain <, >, & to prevent Telegram HTML parse errors
        $title = htmlspecialchars($hasIncident ? sprintf('New Incident Recorded: %s', $data['name']) : $data['title']);
        $url = htmlspecialchars($data['url']);
        $name = htmlspecialchars($data['name']);
        $responseStatus = htmlspecialchars($data['response_status'] ?? 'N/A');
        $environment = htmlspecialchars(ucfirst($data['environment'] ?? 'production'));
        $responseTime = htmlspecialchars($data['response_time'] ?? 'N/A');
        $sslDaysRemaining = htmlspecialchars($data['ssl_days_remaining'] ?? 'N/A');

        $text = "{$emoji} <b>{$title}</b>\n\n";
        $text .= "<b>Domain:</b> <a href=\"{$url}\">{$name}</a>\n";
        $text .= "<b>Status:</b> " . ($isDown ? 'DOWN' : 'UP') . "\n";
        $text .= "<b>Response Status:</b> {$responseStatus}\n";
        $text .= "<b>Environment:</b> 🌐 {$environment}\n";
        $text .= "<b>Response Time:</b> {$responseTime}\n";
        $text .= "<b>SSL Days Remaining:</b> {$sslDaysRemaining}\n";

        if (!empty($data['region'])) {
            $regionName = htmlspecialchars($data['region_name'] ?? '');
            $checkedAt = htmlspecialchars($data['checked_at'] ?? '');
            $text .= "<b>Region:</b> {$regionName}\n";
            $text .= "<b>Check Time:</b> {$checkedAt}\n";
        }

        if ($hasIncident) {
            $incidentUrl = htmlspecialchars(rtrim(env('FRONTEND_URL'), '/') . '/incidents/' . $data['incident_ulid']);
            $incidentUlid = htmlspecialchars($data['incident_ulid']);
            $text .= "\n<b>Incident:</b> <a href=\"{$incidentUrl}\">#{$incidentUlid}</a>\n";
        }

        $text .= "\n<i>" . htmlspecialchars(config('app.name')) . "</i>";

        self::send($chatId, [
            'text' => $text,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => true,
        ], $channelId, $actionHandle);
    }
}
