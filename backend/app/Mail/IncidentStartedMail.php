<?php

namespace App\Mail;

use App\Models\BoomerrIncident;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Mail\Concerns\HasDynamicEmailTemplate;

class IncidentStartedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels, HasDynamicEmailTemplate;

    public $incident;

    /**
     * Create a new message instance.
     */
    public function __construct(BoomerrIncident $incident)
    {
        $this->incident = $incident;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return $this->dynamicEnvelope(
            'incident_started',
            'New Incident: ' . $this->incident->incident_title,
            ['incident' => $this->incident]
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return $this->dynamicContent(
            'incident_started',
            'emails.incident_started',
            ['incident' => $this->incident]
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
