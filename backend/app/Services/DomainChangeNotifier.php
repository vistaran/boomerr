<?php

namespace App\Services;

use App\Enums\SystemLogEventType;
use App\Models\Domain;
use App\Models\DomainIntegration;
use App\Models\NotificationChannel;
use App\Models\SystemLog;
use App\Models\User;
use App\Notifications\DomainChangedNotification;
use App\Services\DiscordNotifier;
use App\Services\Logging\ActionLogHandle;
use App\Services\SlackNotifier;
use App\Services\TelegramNotifier;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class DomainChangeNotifier
{
    public function __construct(private readonly SystemLogService $systemLogs) {}

    /**
     * Notify all integrations (Slack, Discord) and all company members via email.
     *
     * @param string $action  One of: created, updated, deleted
     * @param Domain $domain  Domain instance (should have company relation eager loaded when possible)
     * @param array $changes  Array of [field => [...]] or list of ['field' => string, 'before' => mixed, 'after' => mixed]
     * @param User|null $actor User who performed the action
     */
    public function notify(string $action, Domain $domain, array $changes = [], ?User $actor = null): void
    {

        $company = $domain->company;
        if (! $company) {
            Log::warning('Domain change notification skipped because company is missing', [
                'domain_id' => $domain->id,
                'action' => $action,
            ]);
            return;
        }

        $company->loadMissing('users');

        $changesList = $this->normalizeChanges($changes);
        $changesText = $this->formatChangesForText($changesList);

        $actorName = $actor?->name ?? 'System';
        $actorEmail = $actor?->email;
        $actorDisplay = $actorEmail ? "$actorName ({$actorEmail})" : $actorName;

        $title = $this->buildTitle($action, $domain->name);
        $environment = $domain->environment ?? 'production';

        // Prepare snapshot array for email to avoid deleted model re-hydration issues
        $domainData = $this->snapshot($domain);

        $actionHandle = $this->beginDomainChangeAction($action, $domain, $domainData, $changesList, $actor);

        // Email all team members
        $recipients = $company->users;
        foreach ($recipients as $user) {
            $user->notify(new DomainChangedNotification($domainData, $action, $changesList, $actor));
            if ($actionHandle) {
                $actionHandle->recordIntegration('email', [
                    'event_type' => SystemLogEventType::SYSTEM_ALERT,
                    'category' => 'notification.email',
                    'source' => 'domain-change-notifier.email',
                    'message' => "Email sent to {$user->email}: {$title}",
                    'execution_status' => SystemLog::EXECUTION_SUCCESS,
                    'integration_metadata' => [
                        'recipient_email' => $user->email,
                        'recipient' => $user->name,
                        'subject' => $title,
                        'channel_type' => 'email',
                    ],
                    'actor' => $user,
                ]);
            }
        }

        $notificationChannels = $this->resolveNotificationChannels($domain);

        foreach ($notificationChannels as $channel) {
            // Safely resolve integration key from multiple sources
            $integrationKey = $channel->domainIntegration?->integration?->key
                ?? $channel->type
                ?? null;

            if (! $integrationKey) {
                Log::warning('Skipping notification channel due to missing integration key', [
                    'channel_id' => $channel->id,
                    'channel_name' => $channel->name,
                ]);
                continue;
            }

            try {

                switch ($integrationKey) {
                    case 'slack':
                        SlackNotifier::send($channel->url, $this->buildSlackPayload(
                            $title,
                            $domain,
                            $changesText,
                            $actorDisplay,
                            $environment,
                            $action
                        ), $channel->id, $actionHandle);
                        break;

                    case 'discord':
                        DiscordNotifier::send($channel->url, $this->buildDiscordPayload(
                            $title,
                            $domain,
                            $changesText,
                            $actorDisplay,
                            $environment,
                            $action
                        ), $channel->id, $actionHandle);
                        break;
                        
                    case 'telegram':
                        TelegramNotifier::send($channel->url, $this->buildTelegramPayload(
                            $title,
                            $domain,
                            $changesText,
                            $actorDisplay,
                            $environment,
                            $action
                        ), $channel->id, $actionHandle);
                        break;

                    default:
                        Log::debug('Unsupported integration type for domain change notification', [
                            'integration_key' => $integrationKey,
                            'channel_id' => $channel->id,
                        ]);
                        break;
                }
            } catch (\Exception $e) {
                Log::error('Failed to send domain change notification', [
                    'channel_id' => $channel->id,
                    'integration_key' => $integrationKey,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($actionHandle) {
            $actionHandle->markComplete(SystemLog::EXECUTION_SUCCESS, [
                'action' => $action,
                'domain_name' => $domain->name,
            ]);
        }
    }

    private function snapshot(Domain $domain): array
    {
        $domain->loadMissing('company');
        if (! $domain->workspace_id && $domain->company) {
            $domain->workspace_id = $domain->company->id;
        }

        return [
            'id' => $domain->id,
            'name' => $domain->name,
            'url' => $domain->url,
            'workspace_id' => $domain->workspace_id
                ?? $domain->getOriginal('workspace_id')
                ?? Domain::query()->whereKey($domain->id)->value('workspace_id'),
            'label' => $domain->label,
            'environment' => $domain->environment ?? 'production',
        ];
    }

    private function buildTitle(string $action, string $name): string
    {
        return match ($action) {
            'created' => "Domain added: {$name}",
            'updated' => "Domain updated: {$name}",
            'deleted' => "Domain deleted: {$name}",
            default   => "Domain change: {$name}",
        };
    }

    private function colorForAction(string $action): array
    {
        return match ($action) {
            'created' => ['slack' => '#22C55E', 'discord' => 0x22C55E, 'telegram_emoji' => '🟢'],
            'updated' => ['slack' => '#F59E0B', 'discord' => 0xF59E0B, 'telegram_emoji' => '🟡'],
            'deleted' => ['slack' => '#EF4444', 'discord' => 0xEF4444, 'telegram_emoji' => '🔴'],
            default   => ['slack' => '#0EA5E9', 'discord' => 0x0EA5E9, 'telegram_emoji' => '🔵'],
        };
    }

    private function buildSlackPayload(
        string $title,
        Domain $domain,
        string $changesText,
        string $actorDisplay,
        string $environment,
        string $action
    ): array {
        $colors = $this->colorForAction($action);

        return [
            'attachments' => [[
                'color' => $colors['slack'],
                'title' => ":globe_with_meridians: {$title}",
                'title_link' => $domain->url,
                'fields' => [
                    [
                        'title' => 'URL',
                        'value' => "<{$domain->url}|{$domain->url}>",
                        'short' => true,
                    ],
                    [
                        'title' => '🏷️ Environment',
                        'value' => '`' . ucfirst($environment) . '`',
                        'short' => true,
                    ],
                    [
                        'title' => '📝 Changes',
                        'value' => "```\n{$changesText}\n```",
                        'short' => false,
                    ],
                    [
                        'title' => '👤 Actor',
                        'value' => $actorDisplay,
                        'short' => true,
                    ],
                    [
                        'title' => '🕒 Time',
                        'value' => now()->toDateTimeString(),
                        'short' => true,
                    ],
                ],
                'footer' => config('app.name'),
                'footer_icon' => asset('favicon.ico'),
                'ts' => now()->timestamp,
            ]],
        ];
    }

    private function buildDiscordPayload(
        string $title,
        Domain $domain,
        string $changesText,
        string $actorDisplay,
        string $environment,
        string $action
    ): array {
        $colors = $this->colorForAction($action);

        return [
            'embeds' => [[
                'title' => $title,
                'url' => $domain->url,
                'color' => $colors['discord'],
                'fields' => [
                    [
                        'name' => '🌐 URL',
                        'value' => ucfirst($domain->url),
                        'inline' => true,
                    ],
                    [
                        'name' => '🏷️ Environment',
                        'value' => '`' . ucfirst($environment) . '`',
                        'inline' => true,
                    ],
                    [
                        'name' => '📝 Changes',
                        'value' => "```\n" . $changesText . "\n```",
                        'inline' => false,
                    ],
                    [
                        'name' => '👤 Actor',
                        'value' => $actorDisplay,
                        'inline' => true,
                    ],
                    [
                        'name' => '🕒 Time',
                        'value' => now()->toDateTimeString(),
                        'inline' => true,
                    ],
                ],
                'footer' => [
                    'text' => config('app.name'),
                    'icon_url' => asset('favicon.ico'),
                ],
                'timestamp' => now()->toIso8601String(),
            ]],
        ];
    }

    private function buildTelegramPayload(
        string $title,
        Domain $domain,
        string $changesText,
        string $actorDisplay,
        string $environment,
        string $action
    ): array {
        $colors = $this->colorForAction($action);
        $emoji = $colors['telegram_emoji'];

        $text = "{$emoji} <b>{$title}</b>\n\n";
        $text .= "<b>Domain:</b> <a href=\"{$domain->url}\">{$domain->url}</a>\n";
        $text .= "<b>Environment:</b> 🌐 " . ucfirst($environment) . "\n\n";
        $text .= "<b>Changes:</b>\n<pre>{$changesText}</pre>\n\n";
        $text .= "<b>Actor:</b> {$actorDisplay}\n";
        $text .= "<b>Time:</b> " . now()->toDateTimeString() . "\n\n";
        $text .= "<i>" . config('app.name') . "</i>";

        return [
            'text' => $text,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => true,
        ];
    }

    /**
     * Normalize change inputs to a consistent shape.
     * Accepts either associative array keyed by field or list of arrays.
     */
    private function normalizeChanges(array $changes): array
    {
        // If already a list of arrays with field/before/after, return as-is
        $allHaveKeys = ! empty($changes) && collect($changes)->every(
            fn($item) => is_array($item) && array_key_exists('field', $item)
        );

        if ($allHaveKeys) {
            return $changes;
        }

        $normalized = [];
        foreach ($changes as $field => $change) {
            if (is_array($change) && array_key_exists('before', $change) && array_key_exists('after', $change)) {
                $normalized[] = [
                    'field' => $field,
                    'before' => $change['before'],
                    'after' => $change['after'],
                ];
            } else {
                $normalized[] = [
                    'field' => (string) $field,
                    'before' => null,
                    'after' => is_array($change) ? json_encode($change) : $change,
                ];
            }
        }

        return $normalized;
    }

    private function formatChangesForText(array $changes): string
    {
        if (empty($changes)) {
            return 'No field changes';
        }

        $lines = [];
        foreach ($changes as $change) {
            $field = $change['field'] ?? 'field';
            $before = $this->stringify($change['before'] ?? null);
            $after = $this->stringify($change['after'] ?? null);
            $lines[] = sprintf('• %s: %s → %s', $field, $before, $after);
        }

        $text = implode("\n", $lines);

        // Slack/Discord have message length limits; keep it modest.
        return mb_strlen($text) > 1800
            ? mb_substr($text, 0, 1800) . "\n…"
            : $text;
    }

    private function stringify($value): string
    {
        if ($value === null || $value === '') {
            return '(blank)';
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        if (is_scalar($value)) {
            return (string) $value;
        }

        return json_encode($value);
    }

    private function beginDomainChangeAction(string $action, Domain $domain, array $domainSnapshot, array $changes, ?User $actor): ?ActionLogHandle
    {
        $workspaceId = $domainSnapshot['workspace_id'] ?? $domain->workspace_id ?? $domain->company?->id;

        if (! $workspaceId) {
            return null;
        }

        $eventType = match ($action) {
            'created' => SystemLogEventType::DOMAIN_CREATED,
            'updated' => SystemLogEventType::DOMAIN_UPDATED,
            'deleted' => SystemLogEventType::DOMAIN_DELETED,
            default => SystemLogEventType::DOMAIN_UPDATED,
        };

        // Link to the domain's enabled integration (and a primary channel if available)
        $linkedDomainIntegrationId = null;
        $linkedIntegrationId = null;
        $linkedNotificationChannelId = null;

        try {
            $di = DomainIntegration::where('domain_id', $domain->id)
                ->where('enabled', true)
                ->orderBy('id')
                ->first();
            if ($di) {
                $linkedDomainIntegrationId = $di->id;
                $linkedIntegrationId = $di->integration_id;

                // Try to pick a primary active channel for this integration
                $linkedNotificationChannelId = NotificationChannel::query()
                    ->where('domain_id', $domain->id)
                    ->where('integration_id', $di->id)
                    ->where('is_active', true)
                    ->orderBy('id')
                    ->value('id');
            }
        } catch (\Throwable $e) {
            // Non-fatal: proceed without integration/channel linkage
        }

        return $this->systemLogs->beginAction([
            'workspace_id' => $workspaceId,
            'domain_id' => $domainSnapshot['id'] ?? $domain->id,
            'event_type' => $eventType,
            'source' => 'domain-change-notifier',
            'status' => 'info',
            'message' => sprintf('Domain %s: %s', $action, $domainSnapshot['name'] ?? $domain->name),
            'payload' => [
                'action' => $action,
                'domain' => $domainSnapshot,
                'changes' => $changes,
            ],
            'actor' => $actor ?? $this->systemLogs->schedulerActor('system'),
        ]);
    }

    /**
     * Resolve active webhook channels for the given domain, preferring domain-scoped
     * channels and falling back to workspace-scoped ones when none exist yet.
     *
     * @return Collection<int, NotificationChannel>
     */
    private function resolveNotificationChannels(Domain $domain): Collection
    {
        $baseQuery = NotificationChannel::query()
            ->with('domainIntegration.integration')
            ->where('workspace_id', $domain->workspace_id)
            ->where('is_active', true)
            ->orderBy('id');

        $domainChannels = (clone $baseQuery)
            ->where('domain_id', $domain->id)
            ->get();

        if ($domainChannels->isNotEmpty()) {
            return $domainChannels;
        }

        return $baseQuery
            ->whereNull('domain_id')
            ->get();
    }
}
