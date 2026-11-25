<?php

namespace App\Notifications;

use App\Models\Domain;
use App\Models\Incident;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class DomainDownNotification extends Notification implements ShouldQueue
{
    use Queueable;

    private ?int $workspaceId = null;
    private ?Incident $incident = null;

    public function __construct(public Domain $domain, $incident = null)
    {
        $this->domain->loadMissing('company');
        if (! $this->domain->workspace_id && $this->domain->company) {
            $this->domain->workspace_id = $this->domain->company->id;
        }
        $this->workspaceId = $this->resolveWorkspaceId();
        $this->incident = $incident;
    }

    public function via(object $notifiable): array
    {
        return ['mail', 'database', 'broadcast'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $latestEvent = \App\Models\DomainStatusEvent::where('domain_id', $this->domain->id)->latest('checked_at')->first();
        $data = [
            'domain' => $this->domain,
            'url' => $this->domain->url,
            'event' => $latestEvent,
            'unsubscribeUrl' => (config('app.frontend_url') ?? config('app.url')) . '/email-preferences',
        ];

        $template = \App\Models\EmailTemplate::where('key', 'domain_down')->where('is_active', true)->first();
        if ($template) {
            try {
                return (new MailMessage)
                    ->subject($template->renderSubject($data))
                    ->view(['html' => new \Illuminate\Support\HtmlString($template->render($data))]);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Dynamic domain_down render failed: " . $e->getMessage());
            }
        }

        return (new MailMessage)
            ->subject("❌ Domain DOWN: {$this->domain->name}")
            ->view('emails.domain_down', [
                'domain' => $this->domain,
                'url' => $this->domain->url,
                'event' => $latestEvent,
            ]);
    }

    public function toArray(object $notifiable): array
    {
        return $this->payload();
    }

    public function toDatabase(object $notifiable): array
    {
        return $this->payload();
    }

    private function payload(): array
    {
        $workspaceId = $this->resolveWorkspaceId();

        return [
            'type' => 'domain_status',
            'action' => 'down',
            'workspace_id' => $workspaceId,
            'domain' => [
                'id' => $this->domain->id,
                'name' => $this->domain->name,
                'workspace_id' => $workspaceId,
                'url' => $this->domain->url,
                'environment' => $this->domain->environment,
            ],
            'last_response_time_ms' => $this->domain->last_response_time_ms,
        ];
    }

    private function resolveWorkspaceId(): ?int
    {
        if ($this->workspaceId !== null) {
            return $this->workspaceId;
        }

        if ($this->domain->workspace_id) {
            return $this->workspaceId = (int) $this->domain->workspace_id;
        }

        $original = $this->domain->getOriginal('workspace_id');
        if ($original) {
            return $this->workspaceId = (int) $original;
        }

        $companyId = $this->domain->company?->id;
        if ($companyId) {
            return $this->workspaceId = (int) $companyId;
        }

        $id = Domain::query()->whereKey($this->domain->id)->value('workspace_id');
        $this->workspaceId = $id ? (int) $id : null;
        return $this->workspaceId;
    }
}
