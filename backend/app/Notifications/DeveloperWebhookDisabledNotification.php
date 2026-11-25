<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use App\Models\Webhook;

class DeveloperWebhookDisabledNotification extends Notification
{
    use Queueable;

    public $webhook;

    /**
     * Create a new notification instance.
     */
    public function __construct(Webhook $webhook)
    {
        $this->webhook = $webhook;
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
            $workspaceUlid = $this->webhook->workspace ? $this->webhook->workspace->ulid : '';
            $frontendUrl = rtrim(config('app.frontend_url', 'https://app.boomerr.ai'), '/');

            return (new MailMessage)
                ->subject('Developer Webhook Automatically Disabled')
                ->greeting('Hello,')
                ->line('Your Developer Webhook "' . $this->webhook->name . '" has been automatically disabled because it failed to deliver payloads 3 consecutive times.')
                ->line('Webhook URL: ' . $this->webhook->url)
                ->line('Please check your server or endpoint to ensure it is available and can accept POST requests.')
                ->action('Manage Webhooks', $frontendUrl . '/overview/' . $workspaceUlid . '/integrations')
                ->line('Once you resolve the issue, you can re-enable the webhook from your dashboard.');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            //
        ];
    }
}
