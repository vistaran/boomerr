<?php

namespace App\Mail;

use App\Models\FeatureAnnouncement;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Mail\Concerns\HasDynamicEmailTemplate;

class FeatureAnnouncementMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels, HasDynamicEmailTemplate;

    public $feature;
    public $user;

    /**
     * Create a new message instance.
     */
    public function __construct(FeatureAnnouncement $feature, ?User $user = null)
    {
        $this->feature = $feature;
        $this->user = $user;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $statusPrefix = match ($this->feature->status) {
            'live' => '🟢 New Feature Live: ',
            'in_beta' => '🟡 Beta Release: ',
            'announced' => '📢 Announcement: ',
            default => '🚀 Coming Soon: ',
        };

        return $this->dynamicEnvelope(
            'feature_announcement',
            $statusPrefix . $this->feature->title,
            [
                'feature' => $this->feature,
                'user' => $this->user,
                'firstName' => $this->user ? ($this->user->first_name ?? explode(' ', $this->user->name)[0] ?? 'there') : 'there',
            ]
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return $this->dynamicContent(
            'feature_announcement',
            'emails.feature_announcement',
            [
                'feature' => $this->feature,
                'user' => $this->user,
                'firstName' => $this->user ? ($this->user->first_name ?? explode(' ', $this->user->name)[0] ?? 'there') : 'there',
            ]
        );
    }
}

