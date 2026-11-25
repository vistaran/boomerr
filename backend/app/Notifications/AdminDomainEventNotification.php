<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;

class AdminDomainEventNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public $message;
    public $eventType; // 'add' or 'delete'

    /**
     * Create a new notification instance.
     */
    public function __construct(string $message, string $eventType)
    {
        $this->message = $message;
        $this->eventType = $eventType;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $this->sendToWebhooks($notifiable);

        return (new MailMessage)
                    ->subject("Domain Event: {$this->eventType}")
                    ->line('A domain event has occurred in a user workspace.')
                    ->line($this->message)
                    ->action('View Admin Dashboard', url('/admin/dashboard'));
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'message' => $this->message,
            'event_type' => $this->eventType,
        ];
    }

    protected function sendToWebhooks(object $notifiable): void
    {
        $prefs = $notifiable->notification_preferences ?? [];

        // Check toggles based on the event type
        if ($this->eventType === 'add' && empty($prefs['growth_events'])) {
            return;
        }

        if ($this->eventType === 'delete' && empty($prefs['security_events'])) {
            return;
        }

        $icon = $this->eventType === 'add' ? '📈' : '🗑️';
        $content = "{$icon} Domain Event: {$this->message}";

        if (!empty($notifiable->slack_webhook_url)) {
            try {
                Http::timeout(5)->post($notifiable->slack_webhook_url, ['text' => $content]);
            } catch (\Exception $e) {
                // Ignore failure
            }
        }

        if (!empty($notifiable->discord_webhook_url)) {
            try {
                Http::timeout(5)->post($notifiable->discord_webhook_url, ['content' => $content]);
            } catch (\Exception $e) {
                // Ignore failure
            }
        }
    }
}
