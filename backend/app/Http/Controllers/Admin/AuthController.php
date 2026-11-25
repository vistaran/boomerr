<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Admin;

class AuthController extends Controller
{
    private function verifyHCaptcha(?string $token, ?string $ip): bool
    {
        if (empty($token)) {
            return false;
        }

        try {
            $secret = config('services.hcaptcha.secret');
            if (empty($secret)) {
                return true;
            }

            $response = Http::asForm()->post(
                'https://hcaptcha.com/siteverify',
                [
                    'secret' => $secret,
                    'response' => $token,
                    'remoteip' => $ip,
                ]
            );

            return $response->json('success') === true;
        } catch (\Throwable $e) {
            Log::error('Admin HCaptcha verification failed: ' . $e->getMessage());
            return false;
        }
    }

    public function login(Request $request)
    {
        $hasCaptchaSecret = !empty(config('services.hcaptcha.secret'));

        $rules = [
            'email' => 'required|email',
            'password' => 'required',
        ];

        if ($hasCaptchaSecret) {
            $rules['captcha_token'] = 'required|string';
        } else {
            $rules['captcha_token'] = 'nullable|string';
        }

        $request->validate($rules, [
            'captcha_token.required' => 'Please complete the captcha verification.',
        ]);

        if ($hasCaptchaSecret && !$this->verifyHCaptcha($request->captcha_token, $request->ip())) {
            return response()->json([
                'message' => 'Captcha verification failed. Please try again.',
            ], 422);
        }

        $admin = Admin::where('email', $request->email)->first();

        if (!$admin || !Hash::check($request->password, $admin->password)) {
            return response()->json([
                'message' => 'Invalid login details'
            ], 401);
        }

        $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

        return response()->json([
            'admin' => $admin,
            'token' => $token,
        ]);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function updateSettings(Request $request)
    {
        $admin = $request->user();
        
        $validated = $request->validate([
            'slack_webhook_url' => ['nullable', 'url', 'starts_with:https://'],
            'discord_webhook_url' => ['nullable', 'url', 'starts_with:https://'],
            'notification_preferences' => 'nullable|array',
        ]);

        $admin->update($validated);

        return response()->json([
            'message' => 'Settings updated successfully',
            'admin' => $admin
        ]);
    }

    public function sendTestNotification(Request $request)
    {
        $validated = $request->validate([
            'channel' => 'required|string|in:Slack,Discord',
            'webhook_url' => ['required', 'url', 'starts_with:https://'],
        ]);

        $channel = $validated['channel'];
        $url = $validated['webhook_url'];
        $message = "[Test] This is a test notification for Boomerr Admin ($channel).";
        $payload = $channel === 'Slack' ? ['text' => $message] : ['content' => $message];

        try {
            $response = \App\Services\SafeWebhookHttpClient::post($url, $payload, [], 5);

            if (!$response->successful()) {
                return response()->json(['error' => 'Webhook server responded with status ' . $response->status()], 400);
            }

            return response()->json(['message' => 'Test notification sent!']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to send notification: ' . $e->getMessage()], 400);
        }
    }
}
