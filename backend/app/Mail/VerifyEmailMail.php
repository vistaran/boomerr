<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class VerifyEmailMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(public string $verifyUrl) {}

    public function build()
    {
        $template = \App\Models\EmailTemplate::where('key', 'verify_email')->where('is_active', true)->first();
        if ($template) {
            $data = [
                'url' => $this->verifyUrl,
                'unsubscribeUrl' => (config('app.frontend_url') ?? config('app.url')) . '/email-preferences',
            ];
            try {
                return $this
                    ->subject($template->renderSubject($data))
                    ->html($template->render($data));
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Failed rendering dynamic verify_email template: " . $e->getMessage());
            }
        }

        return $this
            ->subject('Verify your Boomerr account')
            ->view('emails.verify-email')
            ->with([
                'url' => $this->verifyUrl,
            ]);
    }
}
