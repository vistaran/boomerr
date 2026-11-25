<?php

namespace App\Listeners;

use App\Events\DomainCreated;
use App\Events\DomainStatusUpdated;
use App\Jobs\DispatchWebhookJob;
use App\Models\Webhook;
use Illuminate\Events\Dispatcher;
use Illuminate\Support\Str;

class WebhookEventSubscriber
{

    /**
     * Handle domain status updated events.
     */
    public function handleDomainStatusUpdated(DomainStatusUpdated $event): void
    {
        if (!$event->statusChanged) {
            return;
        }

        $domain = clone $event->domain;
        $eventName = $domain->status === 'up' ? 'DOMAIN_UP' : 'DOMAIN_DOWN';
        $eventLabel = $domain->status === 'up' ? 'Domain Up' : 'Domain Down';

        $payload = $this->buildBasePayload($eventName, $domain);
        $payload['status'] = [
            'previous' => $domain->status === 'up' ? 'DOWN' : 'UP',
            'current' => strtoupper($domain->status)
        ];
        $payload['reason'] = $domain->last_error ?? 'N/A';
        $payload['metadata'] = [
            'response_time' => $domain->response_time,
            'check_interval' => $domain->check_interval
        ];

        $this->dispatchToWebhooks($domain->workspace_id, $eventLabel, $payload, $event->parentLogId);
    }

    protected function buildBasePayload(string $eventName, $domain)
    {
        return [
            'id' => 'evt_' . Str::random(10),
            'event' => $eventName,
            'timestamp' => now()->toIso8601String(),
            'workspace' => [
                'id' => (string) $domain->workspace_id,
                'name' => $domain->workspace->name ?? 'Workspace',
            ],
            'domain' => [
                'id' => (string) $domain->id,
                'name' => $domain->name,
                'url' => $domain->url ?? ('https://' . $domain->name),
            ]
        ];
    }

    protected function dispatchToWebhooks($workspaceId, string $eventLabel, array $payload, ?int $parentLogId = null)
    {
        $workspace = \App\Models\Workspace::find($workspaceId);
        if (!$workspace || !$workspace->developer_webhooks_enabled) {
            return;
        }

        $webhooks = Webhook::where('workspace_id', $workspaceId)
            ->where('enabled', true)
            ->whereHas('events', function ($q) use ($eventLabel) {
                $q->where('event_name', $eventLabel);
            })->get();

        foreach ($webhooks as $webhook) {
            DispatchWebhookJob::dispatch($webhook, $payload, $eventLabel, $payload['id'], 1, $parentLogId);
        }
    }

    /**
     * Register the listeners for the subscriber.
     */
    public function subscribe(Dispatcher $events): void
    {

        $events->listen(
            DomainStatusUpdated::class,
            [WebhookEventSubscriber::class, 'handleDomainStatusUpdated']
        );
    }
}
