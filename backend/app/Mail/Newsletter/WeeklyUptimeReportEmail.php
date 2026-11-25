<?php

namespace App\Mail\Newsletter;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Mail\Concerns\HasDynamicEmailTemplate;

class WeeklyUptimeReportEmail extends Mailable implements ShouldQueue
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
            'unsubscribeUrl' => $this->unsubscribeUrl,
        ];

        return $this->dynamicEnvelope('newsletter_weekly_uptime_report', 'Boomerr: Weekly Uptime Report', $data);
    }

    public function content(): Content
    {
        $data = array_merge([
            'firstName' => explode(' ', $this->user->name)[0] ?? 'there',
            'unsubscribeUrl' => $this->unsubscribeUrl,
        ], $this->viewData);

        return $this->dynamicContent('newsletter_weekly_uptime_report', 'emails.newsletter.weekly_uptime_report', $data);
    }

    public function attachments(): array
    {
        return [];
    }
}