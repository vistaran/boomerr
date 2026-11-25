<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class SystemLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray($request): array
    {
        $payload = $this->payload ?? [];

        $isActionLog = ($this->log_type ?? null) === 'action';

        $integrationKey = $this->integration_key
            ?? $payload['integration_key']
            ?? $this->notificationChannel?->type
            ?? (! $isActionLog ? ($this->domainIntegration?->integration?->key ?? $this->integration?->key) : null);

        $integrationName = $payload['integration_name']
            ?? $this->notificationChannel?->name
            ?? (! $isActionLog ? ($this->domainIntegration?->integration?->name ?? $this->integration?->name) : null)
            ?? ($integrationKey ? ucfirst((string) $integrationKey) : null);

        $summarizeChannels = static function ($channels) {
            if (! $channels || $channels->isEmpty()) {
                return [
                    'counts' => null,
                    'primary' => null,
                ];
            }

            $counts = [];
            foreach ($channels as $channel) {
                $type = $channel->type ?? 'unknown';
                $counts[$type] = ($counts[$type] ?? 0) + 1;
            }

            $first = $channels->first();
            return [
                'counts' => $counts,
                'primary' => [
                    'id' => $first->id,
                    'name' => $first->name,
                    'type' => $first->type,
                    'url' => $first->url,
                    'is_active' => (bool) $first->is_active,
                    'last_trigger_status' => $first->last_trigger_status,
                ],
            ];
        };

        $groupChannelsByType = static function ($channels) {
            $grouped = [];

            if ($channels && $channels->isNotEmpty()) {
                foreach ($channels as $channel) {
                    $type = $channel->type ?? 'unknown';
                    $grouped[$type] ??= [];
                    $grouped[$type][] = [
                        'id' => $channel->id,
                        'name' => $channel->name,
                        'type' => $channel->type,
                        'url' => $channel->url,
                        'is_active' => (bool) $channel->is_active,
                        'last_trigger_status' => $channel->last_trigger_status,
                    ];
                }
            }

            $counts = [];
            foreach ($grouped as $type => $items) {
                $counts[$type] = count($items);
            }

            return [
                'by_type' => $grouped,
                'counts' => $counts,
            ];
        };

        // Build lifecycle data
        $lifecycle = [
            'triggered_at' => optional($this->triggered_at)->toIso8601String(),
            'completed_at' => optional($this->completed_at)->toIso8601String(),
            'duration_ms' => $this->duration_ms,
            'execution_status' => $this->execution_status,
        ];

        // Build children summary for parent logs
        $childrenSummary = null;
        if ($this->relationLoaded('children') && $this->children->isNotEmpty()) {
            $children = $this->children;
            $childrenSummary = [
                'total' => $children->count(),
                'success' => $children->where('execution_status', 'success')->count(),
                'failure' => $children->where('execution_status', 'failure')->count(),
                'skipped' => $children->where('execution_status', 'skipped')->count(),
                'pending' => $children->where('execution_status', 'pending')->count(),
                'by_integration' => $children->groupBy('integration_key')->map(fn($group) => [
                    'total' => $group->count(),
                    'success' => $group->where('execution_status', 'success')->count(),
                    'failure' => $group->where('execution_status', 'failure')->count(),
                ])->toArray(),
            ];
        }

        return [
            'id' => $this->id,
            'parent_id' => $this->parent_id,
            'log_type' => $this->log_type,
            'workspace_id' => $this->workspace_id,
            'domain_id' => $this->domain_id,
            'workspace' => $this->whenLoaded('workspace', fn() => [
                'id' => $this->workspace?->id,
                'name' => $this->workspace?->name,
            ]),
            'domain' => $this->whenLoaded('domain', fn() => [
                'id' => $this->domain?->id,
                'name' => $this->domain?->name,
                'url' => $this->domain?->url,
            ]),
            'domain_notification_channels' => $this->whenLoaded('domain', function () use ($groupChannelsByType) {
                $grouped = $groupChannelsByType($this->domain?->notificationChannels);

                return [
                    'by_type' => $grouped['by_type'],
                    'counts' => $grouped['counts'],
                    'channels' => $this->domain?->notificationChannels?->map(fn($channel) => [
                        'id' => $channel->id,
                        'name' => $channel->name,
                        'type' => $channel->type,
                        'url' => $channel->url,
                        'is_active' => (bool) $channel->is_active,
                        'last_trigger_status' => $channel->last_trigger_status,
                    ])?->values()?->all() ?? [],
                ];
            }),
            'notification_channel' => $this->whenLoaded('notificationChannel', fn() => [
                'id' => $this->notificationChannel?->id,
                'name' => $this->notificationChannel?->name,
                'type' => $this->notificationChannel?->type,
                'url' => $this->notificationChannel?->url,
                'is_active' => (bool) $this->notificationChannel?->is_active,
                'last_trigger_status' => $this->notificationChannel?->last_trigger_status,
            ]),
            'integration' => $this->whenLoaded('integration', fn() => [
                'id' => $this->integration?->id,
                'name' => $this->integration?->name,
                'key' => $this->integration?->key,
                'is_launched' => (bool) $this->integration?->is_launched,
            ]),
            // Resolved integration key for easier frontend grouping
            'integration_key' => $integrationKey,
            'integration_name' => $integrationName,
            'event_type' => $this->event_type,
            'source' => $this->source,
            'trigger_source' => $this->trigger_source,
            'category' => $this->category,
            'status' => $this->status,
            'execution_status' => $this->execution_status,
            'severity' => $this->severity,
            'message' => $this->message,
            'response_time_ms' => $this->response_time_ms,
            'latest_response_time_ms' => $this->latest_response_time_ms,
            'error_code' => $this->error_code,
            'error_message' => $this->error_message,
            'payload' => $this->payload ?? [],
            'integration_metadata' => $this->integration_metadata,
            'has_sensitive_payload' => ! empty($this->sensitive_payload),
            'occurred_at' => optional($this->occurred_at)->toIso8601String(),
            // Lifecycle timestamps and duration
            'lifecycle' => $lifecycle,
            'triggered_at' => optional($this->triggered_at)->toIso8601String(),
            'completed_at' => optional($this->completed_at)->toIso8601String(),
            'duration_ms' => $this->duration_ms,
            'actor' => [
                'id' => $this->actor_id,
                'type' => $this->actor_type,
                'name' => $this->actor_name,
                'email' => $this->actor_email,
                'role' => $this->actor_role,
                'department' => $this->actor_department,
                'snapshot' => $this->actor_snapshot,
            ],
            // Recipient info for personal integrations (WhatsApp, Email, Call, SMS)
            'recipient' => $this->extractRecipientInfo($integrationKey),
            'correlation_id' => $this->correlation_id,
            // Child integration logs (for parent/action logs)
            'children' => $this->whenLoaded('children', fn() => $this->children->map(fn($child) => [
                'id' => $child->id,
                'log_type' => $child->log_type,
                'integration_key' => $child->integration_key,
                'event_type' => $child->event_type,
                'source' => $child->source,
                'trigger_source' => $child->trigger_source,
                'status' => $child->status,
                'execution_status' => $child->execution_status,
                'message' => $child->message,
                'response_time_ms' => $child->response_time_ms,
                'error_code' => $child->error_code,
                'error_message' => $child->error_message,
                'integration_metadata' => $child->integration_metadata,
                'payload' => $child->payload ?? [],
                'lifecycle' => [
                    'triggered_at' => optional($child->triggered_at)->toIso8601String(),
                    'completed_at' => optional($child->completed_at)->toIso8601String(),
                    'duration_ms' => $child->duration_ms,
                    'execution_status' => $child->execution_status,
                ],
                'triggered_at' => optional($child->triggered_at)->toIso8601String(),
                'completed_at' => optional($child->completed_at)->toIso8601String(),
                'occurred_at' => optional($child->occurred_at)->toIso8601String(),
                'notification_channel' => $child->relationLoaded('notificationChannel') && $child->notificationChannel ? [
                    'id' => $child->notificationChannel->id,
                    'name' => $child->notificationChannel->name,
                    'type' => $child->notificationChannel->type,
                ] : null,
                'integration' => $child->relationLoaded('integration') && $child->integration ? [
                    'id' => $child->integration->id,
                    'name' => $child->integration->name,
                    'key' => $child->integration->key,
                ] : null,
                'actor' => [
                    'name' => $child->actor_name,
                    'email' => $child->actor_email,
                ],
                'recipient' => $this->extractRecipientInfoFromChild($child),
            ])->values()->all()),
            // Summary of child integration executions (for parent logs)
            'children_summary' => $childrenSummary,
            'domain_integration' => $this->whenLoaded('domainIntegration', fn() => [
                'id' => $this->domainIntegration?->id,
                'enabled' => (bool) $this->domainIntegration?->enabled,
                'integration' => [
                    'id' => $this->domainIntegration?->integration?->id,
                    'name' => $this->domainIntegration?->integration?->name,
                    'key' => $this->domainIntegration?->integration?->key,
                    'is_launched' => (bool) $this->domainIntegration?->integration?->is_launched,
                ],
                'channels' => $this->domainIntegration?->notificationChannels?->map(fn($channel) => [
                    'id' => $channel->id,
                    'name' => $channel->name,
                    'type' => $channel->type,
                    'url' => $channel->url,
                    'is_active' => (bool) $channel->is_active,
                    'last_trigger_status' => $channel->last_trigger_status,
                ])->values()->all(),
                'channel_counts' => ($summary = $summarizeChannels($this->domainIntegration?->notificationChannels))['counts'] ?? null,
                'primary_channel' => $summary['primary'] ?? null,
            ]),
            'domain_integrations' => $this->whenLoaded('domain', function () use ($summarizeChannels) {
                return $this->domain?->domainIntegrations?->map(function ($integration) use ($summarizeChannels) {
                    $summary = $summarizeChannels($integration->notificationChannels);
                    return [
                        'id' => $integration->id,
                        'enabled' => (bool) $integration->enabled,
                        'integration' => [
                            'id' => $integration->integration?->id,
                            'name' => $integration->integration?->name,
                            'key' => $integration->integration?->key,
                            'is_launched' => (bool) $integration->integration?->is_launched,
                        ],
                        'channels' => $integration->notificationChannels?->map(fn($channel) => [
                            'id' => $channel->id,
                            'name' => $channel->name,
                            'type' => $channel->type,
                            'url' => $channel->url,
                            'is_active' => (bool) $channel->is_active,
                            'last_trigger_status' => $channel->last_trigger_status,
                        ])->values()->all(),
                        'channel_counts' => $summary['counts'],
                        'primary_channel' => $summary['primary'],
                    ];
                })->values()->all();
            }),
        ];
    }

    /**
     * Extract recipient information from payload for personal integrations.
     */
    private function extractRecipientInfo(?string $integrationKey): ?array
    {
        if (!$integrationKey) {
            return null;
        }

        $payload = $this->payload ?? [];
        $metadata = $this->integration_metadata ?? [];

        return match ($integrationKey) {
            'whatsapp', 'sms' => [
                'type' => $integrationKey,
                'to' => $metadata['recipient_phone'] ?? $payload['recipient_phone'] ?? $payload['phone_number'] ?? $payload['to'] ?? null,
                'message_preview' => $this->truncateMessage($payload['message'] ?? $this->message ?? null),
            ],
            'call' => [
                'type' => 'call',
                'to' => $metadata['recipient_phone'] ?? $payload['recipient_phone'] ?? $payload['phone_number'] ?? $payload['to'] ?? null,
                'duration' => $metadata['duration_ms'] ?? $payload['duration'] ?? null,
                'message_preview' => $this->truncateMessage($payload['message'] ?? $this->message ?? null),
            ],
            'email' => [
                'type' => 'email',
                'to' => $metadata['recipient_email'] ?? $payload['recipient_email'] ?? $payload['email'] ?? $payload['to'] ?? null,
                'subject' => $metadata['subject'] ?? $payload['subject'] ?? null,
                'message_preview' => $this->truncateMessage($payload['message'] ?? $this->message ?? null),
            ],
            'discord', 'slack', 'telegram' => [
                'type' => $integrationKey,
                'webhook_name' => $metadata['channel_name'] ?? $this->notificationChannel?->name ?? $payload['webhook_name'] ?? $payload['channel_name'] ?? null,
                'channel' => $payload['channel'] ?? $metadata['channel_id'] ?? null,
            ],
            'clickup' => [
                'type' => 'clickup',
                'task_name' => $metadata['task_name'] ?? $payload['task_name'] ?? null,
                'list_name' => $metadata['channel_name'] ?? $this->notificationChannel?->name ?? $payload['list_name'] ?? null,
                'task_id' => $metadata['task_id'] ?? $payload['task_id'] ?? null,
            ],
            'webhook' => [
                'type' => 'webhook',
                'webhook_name' => $metadata['webhook_name'] ?? $payload['webhook_name'] ?? null,
                'url' => $metadata['url'] ?? $payload['url'] ?? null,
            ],
            default => null,
        };
    }

    /**
     * Extract recipient information from a child log.
     */
    private function extractRecipientInfoFromChild($child): ?array
    {
        $integrationKey = $child->integration_key;
        if (!$integrationKey) {
            return null;
        }

        $payload = $child->payload ?? [];
        $metadata = $child->integration_metadata ?? [];

        return match ($integrationKey) {
            'whatsapp', 'sms' => [
                'type' => $integrationKey,
                'to' => $metadata['recipient_phone'] ?? $payload['recipient_phone'] ?? $payload['to'] ?? null,
            ],
            'call' => [
                'type' => 'call',
                'to' => $metadata['recipient_phone'] ?? $payload['recipient_phone'] ?? $payload['to'] ?? null,
                'duration' => $metadata['duration_ms'] ?? $payload['duration'] ?? null,
            ],
            'email' => [
                'type' => 'email',
                'to' => $metadata['recipient_email'] ?? $payload['recipient_email'] ?? $payload['to'] ?? null,
                'subject' => $metadata['subject'] ?? $payload['subject'] ?? null,
            ],
            'discord', 'slack', 'telegram' => [
                'type' => $integrationKey,
                'webhook_name' => $metadata['channel_name'] ?? $child->notificationChannel?->name ?? $payload['webhook_name'] ?? $payload['channel_name'] ?? null,
                'channel' => $payload['channel'] ?? $metadata['channel_id'] ?? null,
            ],
            'clickup' => [
                'type' => 'clickup',
                'task_name' => $metadata['task_name'] ?? $payload['task_name'] ?? null,
                'list_name' => $metadata['channel_name'] ?? $child->notificationChannel?->name ?? $payload['list_name'] ?? null,
                'task_id' => $metadata['task_id'] ?? $payload['task_id'] ?? null,
            ],
            'webhook' => [
                'type' => 'webhook',
                'webhook_name' => $metadata['webhook_name'] ?? $payload['webhook_name'] ?? null,
                'url' => $metadata['url'] ?? $payload['url'] ?? null,
            ],
            default => null,
        };
    }

    private function truncateMessage(?string $message, int $maxLength = 100): ?string
    {
        if (!$message) {
            return null;
        }

        if (mb_strlen($message) <= $maxLength) {
            return $message;
        }

        return mb_substr($message, 0, $maxLength) . '...';
    }
}
