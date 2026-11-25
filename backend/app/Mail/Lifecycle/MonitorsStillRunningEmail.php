<?php

namespace App\Mail\Lifecycle;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Mail\Concerns\HasDynamicEmailTemplate;

class MonitorsStillRunningEmail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels, HasDynamicEmailTemplate;

    public $user;
    public $unsubscribeUrl;

    public function __construct(User $user)
    {
        $this->user = $user;
        $this->unsubscribeUrl = config('app.frontend_url') . '/email-preferences';
    }

    public function envelope(): Envelope
    {
        $data = [
            'firstName' => explode(' ', $this->user->name)[0] ?? 'there',
            'user' => $this->user,
            'unsubscribeUrl' => $this->unsubscribeUrl,
        ];

        return $this->dynamicEnvelope('reactivation_email_1_running', 'Your monitors are still running, but we haven\'t seen you in a week 👀', $data);
    }

    public function content(): Content
    {
        $data = [
            'firstName' => explode(' ', $this->user->name)[0] ?? 'there',
            'user' => $this->user,
            'unsubscribeUrl' => $this->unsubscribeUrl,
        ];

        return $this->dynamicContent('reactivation_email_1_running', 'emails.lifecycle.monitors_still_running', $data);
    }

    public function attachments(): array
    {
        return [];
    }
}