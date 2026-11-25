<?php

namespace App\Services;

use App\Contracts\WhatsAppProviderInterface;
use Illuminate\Support\Facades\Log;
use Twilio\Rest\Client;

class TwilioWhatsAppService implements WhatsAppProviderInterface
{
    protected Client $client;
    protected ?string $from;

    public function __construct()
    {
        $sid = (string) config('services.twilio.sid', '');
        $token = (string) config('services.twilio.token', '');
        $this->from = config('services.twilio.whatsapp_from')
            ? (string) config('services.twilio.whatsapp_from')
            : null;

        $this->client = new Client($sid, $token);
    }

    /**
     * Send a WhatsApp message via Twilio (plain text body).
     *
     * @param  string  $to       Recipient phone in E.164 format
     * @param  string  $body     Message text
     * @return string  Message SID
     */
    public function send(string $to, string $body): string
    {
        if (!$this->from) {
            throw new \RuntimeException(
                'TWILIO_WHATSAPP_FROM is not configured. Please set TWILIO_WHATSAPP_FROM in your .env file.'
            );
        }

        $toAddress = 'whatsapp:+' . ltrim($to, '+');
        $fromAddress = 'whatsapp:' . $this->from;

        try {
            $result = $this->client->messages->create($toAddress, [
                'from' => $fromAddress,
                'body' => $body,
            ]);

            Log::info('Twilio WhatsApp sent', [
                'to' => $toAddress,
                'message_sid' => $result->sid,
            ]);

            return $result->sid;
        } catch (\Throwable $e) {
            Log::error('Twilio WhatsApp failed', [
                'to' => $toAddress,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Send a template-based WhatsApp message via Twilio.
     * Twilio uses ContentSid for templates; falls back to plain text body from parameters.
     */
    public function sendTemplate(
        string $to,
        string $templateName,
        array $parameters = [],
        string $language = 'En',
        array $headerParameters = [],
        array $buttonParameters = [],
    ): string {
        // Twilio doesn't natively use Meta template names - fall back to text body
        $body = implode(' | ', array_map('strval', $parameters));

        Log::info('Twilio WhatsApp sendTemplate fallback to text', [
            'template' => $templateName,
            'to' => $to,
        ]);

        return $this->send($to, $body);
    }
}
