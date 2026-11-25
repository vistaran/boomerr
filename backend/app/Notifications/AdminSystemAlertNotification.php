<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;

class AdminSystemAlertNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public $message;
    public $level;

    /**
     * Create a new notification instance.
     */
    public function __construct(string $message, string $level = 'error')
    {
        $this->message = $message;
        $this->level = $level;
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
                    ->subject("System Alert [{$this->level}]")
                    ->line('A system alert was triggered.')
                    ->line($this->message)
                    ->action('View Admin Dashboard', url('/admin/dashboard'))
                    ->line('Thank you for using our application!');
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
            'level' => $this->level,
        ];
    }

    protected function sendToWebhooks(object $notifiable): void
    {
        $prefs = $notifiable->notification_preferences ?? [];
        if (empty($prefs['system_errors'])) {
            return;
        }

        $content = "[{$this->level}] {$this->message}";

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
