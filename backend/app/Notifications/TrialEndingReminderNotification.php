<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;
use App\Models\Subscription;

class TrialEndingReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected Subscription $subscription;

    public function __construct(Subscription $subscription)
    {
        $this->subscription = $subscription;
    }

    public function via(object $notifiable): array
    {
        return ['mail']; // Later you can add 'database', 'slack'
    }

    public function toMail(object $notifiable): MailMessage
    {
        $daysLeft = (int) floor(now()->floatDiffInDays($this->subscription->trial_ends_at));

        return (new MailMessage)
            ->subject('Your Boomerr Trial is Ending Soon')
            ->greeting("Hi {$notifiable->name},")
            ->line("Your trial will end in {$daysLeft} day(s).")
            ->line('To avoid interruption, your subscription will automatically activate.')
            ->action('Manage Billing', url('/billing'))
            ->line('Thank you for using Boomerr!');
    }
}
