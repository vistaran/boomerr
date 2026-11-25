<?php

namespace App\Services\SMS\Msg91;

use App\Contracts\SmsProviderInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class Msg91SmsService implements SmsProviderInterface
{
    /**
     * Send an SMS message via MSG91 Flow API.
     *
     * @return string MSG91 request ID (or generated UUID fallback)
     */
    public function send(string $to, string $message, array $variables = []): string
    {
        $apiKey   = (string) config('services.msg91.api_key', '');
        $senderId = (string) config('services.msg91.sender_id', '');
        $flowId   = $this->resolveFlowId($message);

        if ($apiKey === '' || $senderId === '' || $flowId === '') {
            throw new \RuntimeException(
                'MSG91 credentials are not fully configured. '
                    . 'Please set MSG91_API_KEY, MSG91_SENDER_ID, and MSG91_FLOW_ID in your .env file.'
            );
        }

        $normalizedMobile = $this->normalizePhone($to);

        $payload = [
            'flow_id' => $flowId,
            'sender' => $senderId,
            'mobiles' => $normalizedMobile,
            'message' => $message,
            ...$variables
        ];

        try {
            $response = Http::withHeaders([
                'authkey' => $apiKey,
                'Content-Type' => 'application/json',
            ])
                ->acceptJson()
                ->timeout(15)
                ->post('https://api.msg91.com/api/v5/flow/', $payload);

            if (! $response->successful()) {
                Log::error('MSG91 SMS failed', [
                    'to' => $to,
                    'normalized_to' => $normalizedMobile,
                    'status_code' => $response->status(),
                    'response' => $response->json(),
                    'response_body' => $response->body(),
                ]);

                throw new \RuntimeException(
                    'MSG91 SMS request failed with status ' . $response->status() . ': ' . $response->body()
                );
            }

            $responseJson = $response->json();
            $requestId = (string) (
                data_get($responseJson, 'message')
                ?? data_get($responseJson, 'message')
                ?? ''
            );

            if ($requestId === '') {
                $requestId = (string) Str::uuid();

                Log::warning('MSG91 response missing request_id, generated fallback UUID', [
                    'to' => $normalizedMobile,
                    'generated_request_id' => $requestId,
                    'response' => $responseJson,
                ]);
            }

            Log::info('MSG91 SMS sent', [
                'to' => $normalizedMobile,
                'request_id' => $requestId,
            ]);

            return $requestId;
        } catch (\Throwable $e) {
            Log::error('MSG91 SMS exception', [
                'to' => $to,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Normalize recipient phone for MSG91 (digits only, includes country code).
     */
    private function normalizePhone(string $to): string
    {
        $digits = preg_replace('/\D+/', '', $to);

        if ($digits === null || $digits === '') {
            throw new \RuntimeException('Invalid recipient phone number. Use E.164 format, e.g. +919876543210.');
        }

        if (strlen($digits) === 10) {
            $digits = '91' . $digits;
        }

        if (strlen($digits) < 11) {
            throw new \RuntimeException('Invalid recipient phone number. Country code is required.');
        }

        return $digits;
    }

    /**
     * Resolve the most suitable MSG91 flow id for the outgoing SMS message.
     */
    private function resolveFlowId(string $message): string
    {
        $defaultFlowId = (string) config('services.msg91.flow_id', '');
        $flowType = $this->detectFlowType($message);

        $flowId = (string) config("services.msg91.flows.{$flowType}", '');

        $resolvedFlowId = $flowId !== '' ? $flowId : $defaultFlowId;

        if ($resolvedFlowId === '') {
            throw new \RuntimeException(
                'MSG91 flow ID is not configured. '
                    . 'Set MSG91_FLOW_ID or a specific MSG91 flow variable (for example MSG91_FLOW_ID_OTP).'
            );
        }

        return $resolvedFlowId;
    }

    /**
     * Infer SMS use-case from message content so callers stay unchanged.
     */
    private function detectFlowType(string $message): string
    {
        $normalized = strtolower(trim($message));

        if (
            str_contains($normalized, 'verification code')
            || str_contains($normalized, 'otp')
        ) {
            return 'otp';
        }

        if (
            str_contains($normalized, 'domain down')
            || str_contains($normalized, 'is down')
        ) {
            return 'domain_down';
        }

        if (
            str_contains($normalized, 'domain up')
            || str_contains($normalized, 'is up')
        ) {
            return 'domain_up';
        }

        if (
            str_contains($normalized, 'ssl')
            && (
                str_contains($normalized, 'expiry')
                || str_contains($normalized, 'expires')
                || str_contains($normalized, 'expiring')
            )
        ) {
            return 'ssl_alert';
        }

        if (str_contains($normalized, 'test sms alert')) {
            return 'test';
        }

        return 'default';
    }
}
