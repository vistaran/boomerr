<?php

namespace App\Services\SMS\Twilio;

use App\Contracts\SmsProviderInterface;
use Illuminate\Support\Facades\Log;
use Twilio\Rest\Client;

class TwilioSmsService implements SmsProviderInterface
{
    protected Client $client;
    protected ?string $from;

    public function __construct()
    {
        $sid   = (string) config('services.twilio.sid', '');
        $token = (string) config('services.twilio.token', '');
        $this->from = config('services.twilio.from') ? (string) config('services.twilio.from') : null;

        $this->client = new Client($sid, $token);
    }

    /**
     * Send an SMS message via Twilio.
     *
     * @return string  Message SID
     */
    public function send(string $to, string $message): string
    {
        if (! $this->from) {
            throw new \RuntimeException('TWILIO_FROM is not configured. Please set TWILIO_FROM in your .env file.');
        }

        try {
            $result = $this->client->messages->create($to, [
                'from' => $this->from,
                'body' => $message,
            ]);

            Log::info('Twilio SMS sent', [
                'to'          => $to,
                'message_sid' => $result->sid,
            ]);

            return $result->sid;
        } catch (\Throwable $e) {
            Log::error('Twilio SMS failed', [
                'to'    => $to,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
