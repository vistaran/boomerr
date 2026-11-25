<?php

namespace App\Notifications;

use App\Models\Domain;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class DomainSslExpiringNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public $domain;
    public $daysRemaining;

    public function __construct(Domain $domain, int $daysRemaining)
    {
        $this->domain = $domain;
        $this->daysRemaining = $daysRemaining;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        return (new MailMessage)
            ->subject('SSL Certificate Expiring Soon for ' . $this->domain->name)
            ->greeting('Hello!')
            ->line('The SSL certificate for the domain ' . $this->domain->name . ' (' . $this->domain->url . ') is expiring in ' . $this->daysRemaining . ' day' . ($this->daysRemaining === 1 ? '' : 's') . '.')
            ->line('Please renew the SSL certificate to avoid service disruption.')
            ->action('View Domain', url('/domains/' . $this->domain->id))
            ->line('Thank you for using our application!');
    }
}
