<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PlivoService
{
    public function initiateCall(string $phone, array $variables = []): bool
    {
        // Expect E.164 format (+14155552671)
        if (! str_starts_with($phone, '+')) {
            Log::warning('Invalid phone format for Plivo call', ['phone' => $phone]);
            return false;
        }

        $payload = array_merge([
            'from' => config('services.plivo.from'),
            'to'   => $phone,
        ], $variables); // PHLO variables

        $url = sprintf(
            'https://phlorunner.plivo.com/v1/account/%s/phlo/%s',
            config('services.plivo.auth_id'),
            "a823affc-b6ae-4b32-b6f2-da04b55a1313"
        );

        try {
            $response = Http::withBasicAuth(
                config('services.plivo.auth_id'),
                config('services.plivo.auth_token')
            )->post($url, $payload);

            if ($response->failed()) {
                Log::error('Plivo call failed', [
                    'phone' => $phone,
                    'response' => $response->body(),
                ]);
                return false;
            }

            Log::info('Plivo call initiated', [
                'phone' => $phone,
                'response' => $response->json(),
            ]);

            return true;
        } catch (\Throwable $e) {
            Log::error('Plivo exception', [
                'phone' => $phone,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }
}
