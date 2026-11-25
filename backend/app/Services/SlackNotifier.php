<?php

namespace App\Services;

use App\Enums\SystemLogEventType;
use App\Models\NotificationChannel;
use App\Models\SystemLog;
use App\Services\Logging\ActionLogHandle;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class SlackNotifier
{
    /**
     * Send a Slack webhook notification.
     *
     * @param string $webhookUrl The Slack webhook URL
     * @param array $payload The message payload
     * @param int|null $channelId Optional notification channel ID for tracking
     * @param ActionLogHandle|null $actionHandle Optional parent action log handle for child logging
     */
    public static function send(
        string $webhookUrl,
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
        $shouldSend = $channel ? \App\Services\NotificationChannelStatusService::isChannelActive($channel) : true;

        if ($shouldSend) {
            $startedAt = microtime(true);
            try {
                Log::info('Slack webhook dispatching', [
                    'url' => $webhookUrl,
                    'payload' => $payload,
                ]);

                $response = Http::timeout(5)->post($webhookUrl, $payload);
                $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
                $success = $response->successful();
                $statusLabel = $success ? 'success' : 'failure';
                $message = $success ? 'Slack webhook delivered' : 'Slack webhook failed';
                $responseStatus = $response->status();
                $lastTriggerStatus = $success ? 'success' : ($response->status() . ' ' . $response->reason());
                $responseBody = $response->body();

                Log::info('Slack webhook response', [
                    'url' => $webhookUrl,
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
                $message = 'Slack webhook threw exception';
                $errorCode = 'EXCEPTION';
                $errorMessage = $e->getMessage();
                Log::error('Slack webhook send failed (exception)', [
                    'url' => $webhookUrl,
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
                    'event_name' => 'Slack Alert', // or derive from payload
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
            'channel_type' => 'slack',
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

            $actionHandle->recordIntegration('slack', [
                'notification_channel_id' => $channel->id,
                'integration_id' => $channel->domainIntegration?->integration_id,
                'event_type' => SystemLogEventType::WEBHOOK_DISPATCH,
                'source' => 'webhook-dispatcher',
                'trigger_source' => 'slack-notifier',
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
                        'type' => 'slack',
                    ],
                    'integration_key' => 'slack',
                    'response_status' => $responseStatus,
                ],
                'sensitive_payload' => [
                    'request_body' => $payload,
                    'response_body' => $responseBody,
                    'webhook_url' => $webhookUrl,
                ],
                'actor' => app(SystemLogService::class)->dispatcherActor('slack-webhook'),
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
                'integration_key' => 'slack',
                'log_type' => SystemLog::LOG_TYPE_INTEGRATION,
                'event_type' => SystemLogEventType::WEBHOOK_DISPATCH,
                'source' => 'webhook-dispatcher',
                'trigger_source' => 'slack-notifier',
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
                        'type' => 'slack',
                    ],
                    'integration_key' => 'slack',
                    'response_status' => $responseStatus,
                ],
                'sensitive_payload' => [
                    'request_body' => $payload,
                    'response_body' => $responseBody,
                    'webhook_url' => $webhookUrl,
                ],
                'actor' => $systemLogs->dispatcherActor('slack-webhook'),
            ]);
        }
    }

    /**
     * Send a domain alert notification to Slack.
     *
     * @param string $webhookUrl The Slack webhook URL
     * @param array $data Alert data with domain information
     * @param int|null $channelId Optional notification channel ID
     * @param ActionLogHandle|null $actionHandle Optional parent action log handle
     */
    public static function domainAlert(
        string $webhookUrl,
        array $data,
        ?int $channelId = null,
        ?ActionLogHandle $actionHandle = null
    ): void {
        $status = strtoupper($data['status']);
        $isDown = $status === 'DOWN';
        $color = $isDown ? '#EF4444' : '#22C55E';
        $emoji = $isDown ? '🔴' : '🟢';

        $fields = [
            [
                'title' => 'Domain Status',
                'value' => ucfirst(sprintf('`%s`', $isDown ? 'DOWN' : 'UP')),
                'short' => true,
            ],
            [
                'title' => 'Response Status',
                'value' => ucfirst(sprintf('`%s`', $data['response_status'])),
                'short' => true,
            ],
            [
                'title' => 'Environment 🌐',
                'value' => sprintf('`%s`', ucfirst($data['environment'])),
                'short' => true,
            ],
            [
                'title' => 'Response Time',
                'value' => sprintf('`%s`', $data['response_time']),
                'short' => true,
            ],
            [
                'title' => 'SSL Days Remaining',
                'value' => $data['ssl_days_remaining'] !== null
                    ? ucfirst(sprintf('`%s`', $data['ssl_days_remaining']))
                    : '_N/A_',
                'short' => true,
            ],
        ];

        if (!empty($data['region'])) {
            $fields[] = [
                'title' => 'Region',
                'value' => sprintf('`%s (%s)`', $data['region_name'], $data['region']),
                'short' => true,
            ];
            $fields[] = [
                'title' => 'Check Time',
                'value' => sprintf('`%s`', $data['checked_at']),
                'short' => true,
            ];
        }

        // Determine title for Slack notification
        $hasIncident = $isDown && !empty($data['incident_ulid']);

        // If both incident and domain status change, clarify in title
        $title = $hasIncident
            ? sprintf('New Incident Recorded: %s', $data['name'])
            : $data['title'];

        // Add incident link as a field if present
        if ($hasIncident) {
            $incidentUrl = rtrim(env('FRONTEND_URL'), '/') . '/incidents/' . $data['incident_ulid'];

            $fields[] = [
                'title' => 'Incident',
                'value' => sprintf('<%s|#%s>', $incidentUrl, $data['incident_ulid']),
                'short' => false,
            ];
        }

        self::send($webhookUrl, [
            'attachments' => [
                [
                    'color' => $color,
                    'title' => sprintf('%s %s', $emoji, $title),
                    'title_link' => $data['url'],
                    'text' => sprintf('%s: <%s|%s>', 'Domain', $data['url'], $data['name']),
                    'fields' => $fields,
                    'footer' => config('app.name'),
                    'ts' => now()->timestamp,
                ]
            ],
        ], $channelId, $actionHandle);
    }
}
