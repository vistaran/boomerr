<?php

namespace App\Mail\Onboarding;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Mail\Concerns\HasDynamicEmailTemplate;

class AddFirstMonitorEmail extends Mailable implements ShouldQueue
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

        return $this->dynamicEnvelope('onboarding_email_2_add_monitor', 'Start protecting your site: Add your first monitor ⚡', $data);
    }

    public function content(): Content
    {
        $data = [
            'firstName' => explode(' ', $this->user->name)[0] ?? 'there',
            'user' => $this->user,
            'unsubscribeUrl' => $this->unsubscribeUrl,
        ];

        return $this->dynamicContent('onboarding_email_2_add_monitor', 'emails.onboarding.add_first_monitor', $data);
    }

    public function attachments(): array
    {
        return [];
    }
}