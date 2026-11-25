<?php

namespace App\Contracts;

interface WhatsAppProviderInterface
{
    /**
     * Send a plain-text WhatsApp message (free-form / session window).
     *
     * @param  string  $to    Recipient phone in E.164 format
     * @param  string  $body  Message text
     * @return string  Provider message ID / SID
     */
    public function send(string $to, string $body): string;

    /**
     * Send a WhatsApp message using a pre-approved template.
     *
     * @param  string  $to             Recipient phone in E.164 format
     * @param  string  $templateName   Approved template name (e.g. otp_verification)
     * @param  array   $parameters     Ordered list of template body parameters
     * @param  string  $language       Template language code (default: En)
     * @param  array   $headerParameters  Optional header parameters (images, text, etc.)
     * @return string  Provider message ID / SID
     */
    public function sendTemplate(
        string $to,
        string $templateName,
        array $parameters = [],
        string $language = 'en',
        array $headerParameters = [],
        array $buttonParameters = [],
    ): string;
}
