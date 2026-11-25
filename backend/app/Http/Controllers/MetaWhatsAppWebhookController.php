<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MetaWhatsAppWebhookController extends Controller
{
    public function verify(Request $request): JsonResponse|string
    {
        try {
            $mode = $request->query('hub_mode');
            $token = $request->query('hub_verify_token');
            $challenge = $request->query('hub_challenge');
            $expected = (string) config('services.facebook.whatsapp_verify_token', '');

            if ($mode !== 'subscribe' || $challenge === null) {
                return response()->json(['message' => 'Invalid webhook verification request.'], 400);
            }

            if ($expected === '') {
                Log::warning('Meta WhatsApp webhook verify token is not configured.');
                return response()->json(['message' => 'Webhook verify token is not configured.'], 500);
            }

            if (! hash_equals($expected, (string) $token)) {
                Log::warning('Meta WhatsApp webhook verification failed.', [
                    'mode' => $mode,
                    'provided_token_length' => strlen((string) $token),
                ]);

                return response()->json(['message' => 'Verification failed.'], 403);
            }

            Log::info('Meta WhatsApp webhook verified successfully.');

            return (string) $challenge;
        } catch (\Throwable $e) {
            Log::error('MetaWhatsAppWebhookController verify failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    public function receive(Request $request): JsonResponse
    {
        try {
            if (! $this->hasValidSignature($request)) {
                Log::warning('Meta WhatsApp webhook signature validation failed.', [
                    'has_signature' => $request->header('X-Hub-Signature-256') !== null,
                ]);

                return response()->json(['message' => 'Invalid webhook signature.'], 403);
            }

            $payload = $request->all();

            Log::info('Meta WhatsApp webhook received.', [
                'object' => $payload['object'] ?? null,
                'entry_count' => is_array($payload['entry'] ?? null) ? count($payload['entry']) : 0,
            ]);

            $entries = is_array($payload['entry'] ?? null) ? $payload['entry'] : [];

            foreach ($entries as $entry) {
                $changes = is_array($entry['changes'] ?? null) ? $entry['changes'] : [];

                foreach ($changes as $change) {
                    $value = $change['value'] ?? [];
                    $statuses = is_array($value['statuses'] ?? null) ? $value['statuses'] : [];

                    foreach ($statuses as $status) {
                        $this->logStatus($status);
                    }

                    $messages = is_array($value['messages'] ?? null) ? $value['messages'] : [];
                    foreach ($messages as $message) {
                        Log::info('Meta WhatsApp inbound message event', [
                            'from' => $message['from'] ?? null,
                            'id' => $message['id'] ?? null,
                            'type' => $message['type'] ?? null,
                        ]);
                    }
                }
            }

            return response()->json(['received' => true]);
        } catch (\Throwable $e) {
            Log::error('MetaWhatsAppWebhookController receive failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    private function hasValidSignature(Request $request): bool
    {
        try {
            $secret = (string) config('services.facebook.whatsapp_webhook_secret', '');

            if ($secret === '') {
                return true;
            }

            $signatureHeader = (string) $request->header('X-Hub-Signature-256', '');
            if (! str_starts_with($signatureHeader, 'sha256=')) {
                return false;
            }

            $providedSignature = substr($signatureHeader, 7);
            $expectedSignature = hash_hmac('sha256', $request->getContent(), $secret);

            return hash_equals($expectedSignature, $providedSignature);
        } catch (\Throwable $e) {
            Log::error('MetaWhatsAppWebhookController hasValidSignature failed: ' . $e->getMessage());
            return false;
        }
    }

    private function logStatus(array $status): void
    {
        try {
            $statusValue = strtolower((string) ($status['status'] ?? 'unknown'));
            $errors = is_array($status['errors'] ?? null) ? $status['errors'] : [];
            $errorCodes = array_values(array_filter(array_map(static fn($error) => $error['code'] ?? null, $errors)));

            $context = [
                'message_id' => $status['id'] ?? null,
                'recipient_id' => $status['recipient_id'] ?? null,
                'status' => $statusValue,
                'timestamp' => $status['timestamp'] ?? null,
                'conversation_id' => data_get($status, 'conversation.id'),
                'conversation_origin' => data_get($status, 'conversation.origin.type'),
                'pricing_model' => data_get($status, 'pricing.pricing_model'),
                'pricing_category' => data_get($status, 'pricing.category'),
                'errors' => $errors,
                'error_codes' => $errorCodes,
            ];

            if ($statusValue === 'failed' || $errors !== []) {
                Log::error('Meta WhatsApp delivery failed', $context);
                return;
            }

            if ($statusValue === 'delivered' || $statusValue === 'read') {
                Log::info('Meta WhatsApp delivery update', $context);
                return;
            }

            Log::warning('Meta WhatsApp delivery status update', $context);
        } catch (\Throwable $e) {
            Log::error('MetaWhatsAppWebhookController logStatus failed: ' . $e->getMessage());
        }
    }
}
