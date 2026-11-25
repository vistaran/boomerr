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

class WinBackOfferEmail extends Mailable implements ShouldQueue
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

        return $this->dynamicEnvelope('win_back_offer', 'We miss you at Boomerr! Here is a welcome back offer 🎉', $data);
    }

    public function content(): Content
    {
        $data = [
            'firstName' => explode(' ', $this->user->name)[0] ?? 'there',
            'user' => $this->user,
            'unsubscribeUrl' => $this->unsubscribeUrl,
        ];

        return $this->dynamicContent('win_back_offer', 'emails.lifecycle.win_back_offer', $data);
    }

    public function attachments(): array
    {
        return [];
    }
}