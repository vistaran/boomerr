<?php

namespace App\Services;

use App\Contracts\WhatsAppProviderInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class FacebookWhatsAppService implements WhatsAppProviderInterface
{
    /**
     * Send a plain-text WhatsApp message (works only within 24-hour session window).
     */
    public function send(string $to, string $body): string
    {
        [$apiUrl, $phoneId, $accessToken] = $this->resolveCredentials();

        $traceId = (string) Str::uuid();
        $toNumber = $this->normalizePhone($to);

        $payload = [
            'messaging_product' => 'whatsapp',
            'to' => $toNumber,
            'type' => 'text',
            'text' => ['body' => $body],
        ];

        return $this->dispatch($apiUrl, $phoneId, $accessToken, $payload, $traceId, $toNumber);
    }

    /**
     * Send a WhatsApp message using a pre-approved Meta template.
     */
    public function sendTemplate(
        string $to,
        string $templateName,
        array $parameters = [],
        string $language = 'en',
        array $headerParameters = [],
        array $buttonParameters = [],
    ): string {
        [$apiUrl, $phoneId, $accessToken] = $this->resolveCredentials();

        $traceId = (string) Str::uuid();
        $toNumber = $this->normalizePhone($to);

        $components = [];

        // Header parameters (if any)
        if ($headerParameters !== []) {
            $headerParams = [];
            foreach ($headerParameters as $name => $value) {
                $entry = ['type' => 'text', 'text' => (string) $value];

                if (!is_int($name) && $name !== '') {
                    $entry['parameter_name'] = (string) $name;
                }

                $headerParams[] = $entry;
            }
            $components[] = [
                'type' => 'header',
                'parameters' => $headerParams,
            ];
        }

        // Body parameters
        if ($parameters !== []) {
            $bodyParams = [];
            foreach ($parameters as $name => $value) {
                $entry = ['type' => 'text', 'text' => (string) $value];

                if (!is_int($name) && $name !== '') {
                    $entry['parameter_name'] = (string) $name;
                }

                $bodyParams[] = $entry;
            }
            $components[] = [
                'type' => 'body',
                'parameters' => $bodyParams,
            ];
        }

        // URL button parameters (index-based)
        if ($buttonParameters !== []) {
            foreach (array_values($buttonParameters) as $index => $value) {
                $components[] = [
                    'type' => 'button',
                    'sub_type' => 'url',
                    'index' => (string) $index,
                    'parameters' => [
                        [
                            'type' => 'text',
                            'text' => (string) $value,
                        ],
                    ],
                ];
            }
        }

        $languageCode = $this->normalizeLanguageCode($language);

        $payload = [
            'messaging_product' => 'whatsapp',
            'to' => $toNumber,
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => ['code' => $languageCode],
            ],
        ];

        if ($components !== []) {
            $payload['template']['components'] = $components;
        }

        return $this->dispatch($apiUrl, $phoneId, $accessToken, $payload, $traceId, $toNumber);
    }

    /* ------------------------------------------------------------------ */
    /*  Internals                                                         */
    /* ------------------------------------------------------------------ */

    private function resolveCredentials(): array
    {
        $apiUrl = rtrim((string) config('services.facebook.whatsapp_api_url', ''), '/');
        $phoneId = (string) config('services.facebook.whatsapp_phone_id', '');
        $accessToken = (string) config('services.facebook.whatsapp_access_token', '');

        if ($apiUrl === '' || $phoneId === '' || $accessToken === '') {
            throw new \RuntimeException(
                'Facebook WhatsApp credentials are not fully configured. '
                . 'Please set FACEBOOK_API_URL, FACEBOOK_WHATSAPP_PHONE_ID, and FACEBOOK_ACCESS_TOKEN in your .env file.'
            );
        }

        return [$apiUrl, $phoneId, $accessToken];
    }

    private function normalizePhone(string $to): string
    {
        // Meta Cloud API expects digits only - no "+" prefix.
        $toNumber = preg_replace('/\D+/', '', $to);

        if ($toNumber === '' || $toNumber === null) {
            throw new \RuntimeException('Invalid WhatsApp recipient number. Use E.164 format, e.g. +919876543210.');
        }

        return $toNumber;
    }

    private function dispatch(
        string $apiUrl,
        string $phoneId,
        string $accessToken,
        array $payload,
        string $traceId,
        string $toNumber,
    ): string {
        try {
            Log::info('Facebook WhatsApp request', [
                'trace_id' => $traceId,
                'endpoint' => "{$apiUrl}/{$phoneId}/messages",
                'to' => $toNumber,
                'payload_type' => $payload['type'] ?? 'unknown',
                'template' => $payload['template']['name'] ?? null,
                'language' => data_get($payload, 'template.language.code'),
                'components' => data_get($payload, 'template.components'),
            ]);

            $response = Http::withToken($accessToken)
                ->acceptJson()
                ->timeout(15)
                ->post("{$apiUrl}/{$phoneId}/messages", $payload);

            $responseJson = $response->json();
            $responseError = $responseJson['error'] ?? null;

            Log::info('Facebook WhatsApp API response', [
                'trace_id' => $traceId,
                'status_code' => $response->status(),
                'response' => $responseJson,
            ]);

            if (!$response->successful()) {
                $errorMessage = data_get($responseError, 'message')
                    ?? data_get($responseError, 'error_user_msg')
                    ?? $response->body();

                $errorCode = data_get($responseError, 'code');
                $errorSubcode = data_get($responseError, 'error_subcode');

                $details = [];
                if ($errorCode !== null) {
                    $details[] = "code={$errorCode}";
                }
                if ($errorSubcode !== null) {
                    $details[] = "subcode={$errorSubcode}";
                }

                $detailsPart = $details !== [] ? ' (' . implode(', ', $details) . ')' : '';

                throw new \RuntimeException((string) $errorMessage . $detailsPart);
            }

            $messageId = (string) (data_get($responseJson, 'messages.0.id') ?? '');

            if ($messageId === '') {
                throw new \RuntimeException('Facebook WhatsApp response did not include a message id.');
            }

            $messageStatus = (string) (data_get($responseJson, 'messages.0.message_status') ?? '');

            Log::info('Facebook WhatsApp sent', [
                'trace_id' => $traceId,
                'to' => $toNumber,
                'message_id' => $messageId,
                'message_status' => $messageStatus,
                'contact_wa_id' => data_get($responseJson, 'contacts.0.wa_id'),
            ]);

            return $messageId;
        } catch (\Throwable $e) {
            Log::error('Facebook WhatsApp failed', [
                'trace_id' => $traceId,
                'to' => $toNumber,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    private function normalizeLanguageCode(string $language): string
    {
        $languageCode = str_replace('-', '_', trim($language));

        if ($languageCode === '') {
            return 'en';
        }

        if (strcasecmp($languageCode, 'en') === 0) {
            return 'en';
        }

        if (strcasecmp($languageCode, 'en_us') === 0) {
            return 'en_US';
        }

        return $languageCode;
    }
}
