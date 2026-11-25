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

class TrialCaseStudyEmail extends Mailable implements ShouldQueue
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

        return $this->dynamicEnvelope('trial_email_2_case_study', 'How engineering teams eliminate costly downtime incidents 💡', $data);
    }

    public function content(): Content
    {
        $data = [
            'firstName' => explode(' ', $this->user->name)[0] ?? 'there',
            'user' => $this->user,
            'unsubscribeUrl' => $this->unsubscribeUrl,
        ];

        return $this->dynamicContent('trial_email_2_case_study', 'emails.lifecycle.trial_case_study', $data);
    }

    public function attachments(): array
    {
        return [];
    }
}