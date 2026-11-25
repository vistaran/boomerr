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

class CheckDashboardEmail extends Mailable implements ShouldQueue
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

        return $this->dynamicEnvelope('check_dashboard', 'Quick check: How are your Boomerr monitors performing?', $data);
    }

    public function content(): Content
    {
        $data = [
            'firstName' => explode(' ', $this->user->name)[0] ?? 'there',
            'user' => $this->user,
            'unsubscribeUrl' => $this->unsubscribeUrl,
        ];

        return $this->dynamicContent('check_dashboard', 'emails.lifecycle.check_dashboard', $data);
    }

    public function attachments(): array
    {
        return [];
    }
}