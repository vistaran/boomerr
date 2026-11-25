<?php

namespace App\Mail\Concerns;

use App\Models\EmailTemplate;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Support\Facades\Log;

trait HasDynamicEmailTemplate
{
    /**
     * Resolve dynamic envelope from database or fall back to default subject.
     */
    protected function dynamicEnvelope(string $templateKey, string $defaultSubject, array $data = []): Envelope
    {
        try {
            $template = EmailTemplate::where('key', $templateKey)->where('is_active', true)->first();
            if ($template && !empty($template->subject)) {
                return new Envelope(subject: $template->renderSubject($data));
            }
        } catch (\Throwable $e) {
            Log::warning("Dynamic envelope render failed for [{$templateKey}]: " . $e->getMessage());
        }

        return new Envelope(subject: $defaultSubject);
    }

    /**
     * Resolve dynamic content from database or fall back to default view.
     */
    protected function dynamicContent(string $templateKey, string $defaultView, array $data = []): Content
    {
        try {
            $template = EmailTemplate::where('key', $templateKey)->where('is_active', true)->first();
            if ($template && !empty($template->body_html)) {
                return new Content(htmlString: $template->render($data));
            }
        } catch (\Throwable $e) {
            Log::warning("Dynamic content render failed for [{$templateKey}]: " . $e->getMessage());
        }

        return new Content(view: $defaultView, with: $data);
    }
}

