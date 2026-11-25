<?php

namespace App\Notifications;

use App\Models\Domain;
use App\Models\Incident;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class DomainNewIncidentNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public Domain $domain;
    public ?Incident $incident;

    public function __construct(Domain $domain, ?Incident $incident = null)
    {
        $this->domain = $domain;
        $this->incident = $incident;
    }

    public function via(object $notifiable): array
    {
        return ['mail', 'database', 'broadcast'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $latestEvent = \App\Models\DomainStatusEvent::where('domain_id', $this->domain->id)->latest('checked_at')->first();
        $mail = (new MailMessage)
            ->subject("⚠️ New Incident: {$this->domain->name}")
            ->greeting('Attention,')
            ->line("A new incident has been recorded for the domain **{$this->domain->name}** while it is still DOWN.")
            ->line('URL: ' . $this->domain->url);
            
        if ($latestEvent && $latestEvent->region) {
            $regionName = \App\Services\MonitoringService::getLocationFromRegion($latestEvent->region);
            $mail->line("Region: {$regionName} ({$latestEvent->region})")
                 ->line("Response Time: " . ($latestEvent->response_time_ms ?? 'N/A') . " ms")
                 ->line("Time: " . \Carbon\Carbon::parse($latestEvent->checked_at)->format('Y-m-d H:i:s T'));
        }
            
        $mail->lineIf($this->incident, "Incident: " . env('FRONTEND_URL') . "/incidents/{$this->incident->ulid}")
            ->line('We will notify you of further changes.');
        return $mail;
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
        return [
            'type' => 'domain_status',
            'action' => 'new_incident',
            'domain' => [
                'id' => $this->domain->id,
                'name' => $this->domain->name,
                'url' => $this->domain->url,
                'environment' => $this->domain->environment,
            ],
            'incident' => $this->incident ? [
                'id' => $this->incident->id,
                'ulid' => $this->incident->ulid,
                'title' => $this->incident->title,
            ] : null,
        ];
    }
}
