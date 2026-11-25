<?php

namespace App\Http\Controllers;

use App\Contracts\WhatsAppProviderInterface;
use App\Models\Domain;
use App\Models\WhatsappNotificationSetting;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class WhatsAppSettingsController extends Controller
{
    /* -------------------------------------------------------
     | INDEX – list all WhatsApp configurations for the workspace
     | ------------------------------------------------------- */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $query = WhatsappNotificationSetting::where('workspace_id', $user->currentWorkspaceId());

            if ($request->filled('domain_id')) {
                $query->where('domain_id', $request->integer('domain_id'));
            }

            $configs = $query->orderBy('created_at', 'desc')->get();
            $workspace = $user->currentWorkspace();
            $credits = $workspace ? app(\App\Services\WhatsAppCreditService::class)->getCreditDetails($workspace) : null;

            return response()->json([
                'data' => $configs,
                'credits' => $credits,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('WhatsAppSettingsController index failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load WhatsApp configurations'], 500);
        }
    }

    /* -------------------------------------------------------
     | SEND-OTP – validate input, send OTP, return otp_id
     | ------------------------------------------------------- */
    public function sendOtp(Request $request, OtpService $otpService): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $validated = $request->validate([
                'name' => ['required', 'string', 'max:100'],
                'whatsapp_enabled' => ['required', 'boolean'],
                'phone_number' => ['required', 'string', 'max:30'],
                'down_threshold' => ['sometimes', 'integer', 'min:0', 'max:100'],
                'ssl_days_before' => ['sometimes', 'integer', 'min:1', 'max:90'],
                'domain_id' => ['required', 'integer', 'exists:domains,id'],
                'events' => ['sometimes', 'array'],
                'events.*' => ['string'],
            ]);

            $otp = $otpService->sendOtp(
                userId: $user->id,
                workspaceId: $user->currentWorkspaceId(),
                channel: 'whatsapp',
                phoneNumber: $validated['phone_number'],
                payload: $validated,
            );

            return response()->json([
                'message' => 'OTP sent to ' . $validated['phone_number'],
                'otp_id' => $otp->id,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('WhatsAppSettingsController sendOtp failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to send OTP'], 500);
        }
    }

    /* -------------------------------------------------------
     | VERIFY-OTP – verify code and create the WhatsApp config
     | ------------------------------------------------------- */
    public function verifyOtp(Request $request, OtpService $otpService): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $request->validate([
                'otp_id' => ['required', 'integer'],
                'code' => ['required', 'string', 'size:6'],
            ]);

            $otp = $otpService->verify($request->integer('otp_id'), $request->string('code')->toString());

            if (!$otp) {
                return response()->json(['message' => 'Invalid or expired OTP code.'], 422);
            }

            // OTP verified - create the WhatsApp configuration from the stored payload
            $config = WhatsappNotificationSetting::create(array_merge($otp->payload, [
                'workspace_id' => $otp->workspace_id,
                'user_id' => $otp->user_id,
                'events' => $otp->payload['events'] ?? ['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'],
            ]));

            return response()->json([
                'message' => 'Phone number verified. WhatsApp configuration created.',
                'data' => $config,
            ], 201);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('WhatsAppSettingsController verifyOtp failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to verify OTP'], 500);
        }
    }

    /* -------------------------------------------------------
     | RESEND-OTP – resend OTP for an existing verification
     | ------------------------------------------------------- */
    public function resendOtp(Request $request, OtpService $otpService): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $request->validate([
                'otp_id' => ['required', 'integer'],
            ]);

            $otp = $otpService->resend($request->integer('otp_id'));

            if (!$otp) {
                return response()->json(['message' => 'OTP not found or already verified.'], 422);
            }

            return response()->json([
                'message' => 'OTP resent successfully.',
                'otp_id' => $otp->id,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('WhatsAppSettingsController resendOtp failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to resend OTP'], 500);
        }
    }

    /* -------------------------------------------------------
     | STORE – create a new WhatsApp configuration (legacy)
     | ------------------------------------------------------- */
    public function store(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $validated = $request->validate([
                'name' => ['required', 'string', 'max:100'],
                'whatsapp_enabled' => ['required', 'boolean'],
                'phone_number' => ['required', 'string', 'max:30'],
                'down_threshold' => ['sometimes', 'integer', 'min:1', 'max:100'],
                'ssl_days_before' => ['sometimes', 'integer', 'min:1', 'max:90'],
                'domain_id' => ['required', 'integer', 'exists:domains,id'],
                'events' => ['sometimes', 'array'],
                'events.*' => ['string'],
            ]);

            $config = WhatsappNotificationSetting::create(array_merge($validated, [
                'workspace_id' => $user->currentWorkspaceId(),
                'user_id' => $user->id,
                'events' => $validated['events'] ?? ['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'],
            ]));

            return response()->json([
                'message' => 'WhatsApp configuration created.',
                'data' => $config,
            ], 201);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('WhatsAppSettingsController store failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to create WhatsApp configuration'], 500);
        }
    }

    /* -------------------------------------------------------
     | UPDATE – update an existing WhatsApp configuration
     | ------------------------------------------------------- */
    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $config = WhatsappNotificationSetting::where('workspace_id', $user->currentWorkspaceId())->find($id);
            if (!$config) {
                return response()->json(['message' => 'Configuration not found'], 404);
            }

            $validated = $request->validate([
                'name' => ['sometimes', 'string', 'max:100'],
                'whatsapp_enabled' => ['sometimes', 'boolean'],
                'phone_number' => ['sometimes', 'string', 'max:30'],
                'down_threshold' => ['sometimes', 'integer', 'min:1', 'max:100'],
                'ssl_days_before' => ['sometimes', 'integer', 'min:1', 'max:90'],
                'events' => ['sometimes', 'array'],
                'events.*' => ['string'],
            ]);

            $config->update($validated);

            return response()->json([
                'message' => 'WhatsApp configuration updated.',
                'data' => $config->fresh(),
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('WhatsAppSettingsController update failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to update WhatsApp configuration'], 500);
        }
    }

    /* -------------------------------------------------------
     | DESTROY – delete a WhatsApp configuration
     | ------------------------------------------------------- */
    public function destroy(int $id): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $config = WhatsappNotificationSetting::where('workspace_id', $user->currentWorkspaceId())->find($id);
            if (!$config) {
                return response()->json(['message' => 'Configuration not found'], 404);
            }

            $config->delete();

            return response()->json(['message' => 'WhatsApp configuration deleted.']);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('WhatsAppSettingsController destroy failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to delete WhatsApp configuration'], 500);
        }
    }

    /* -------------------------------------------------------
     | TEST – send a test WhatsApp message for a configuration
     | ------------------------------------------------------- */
    public function test(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $config = WhatsappNotificationSetting::where('workspace_id', $user->currentWorkspaceId())->find($id);
            if (!$config) {
                return response()->json(['message' => 'Configuration not found'], 404);
            }

            if (!$config->phone_number) {
                return response()->json(['message' => 'No phone number configured.'], 422);
            }

            $workspace = $user->currentWorkspace();
            $waCredits = app(\App\Services\WhatsAppCreditService::class);
            $creditReserved = false;

            if (config('billing.enabled', false) && $workspace) {
                $creditReserved = $waCredits->reserveCredit($workspace, 1);
                if (!$creditReserved) {
                    return response()->json([
                        'message' => 'Monthly WhatsApp credit limit reached. Upgrade your plan to send more WhatsApp messages.',
                        'error_code' => 'whatsapp_credits_exhausted',
                    ], 402);
                }
            }

            $message = '[' . config('app.name') . '] Test WhatsApp alert at ' . now()->toDateTimeString();

            $whatsapp = app(WhatsAppProviderInterface::class);

            // Fetch the actual domain linked to this config
            $domain = Domain::find($config->domain_id);

            if (!$domain) {
                if ($creditReserved && $workspace) {
                    $waCredits->refundCredit($workspace, 1);
                }
                return response()->json(['message' => 'No domain linked to this configuration.'], 422);
            }

            $sslDays = $domain->ssl_days_remaining;
            $sslDisplay = $sslDays === null ? 'N/A' : (string) $sslDays;

            $responseTime = $domain->last_response_time_ms
                ? $domain->last_response_time_ms . ' ms'
                : 'N/A';

            $sid = $whatsapp->sendTemplate(
                $config->phone_number,
                'boomerr_domain_status_alert',
                [
                    'domain_name' => $domain->name ?? $domain->url,
                    'status' => $domain->status === 'down' ? 'DOWN' : 'UP',
                    'url' => $domain->url,
                    'response' => (string) ($domain->last_response_status ?? 'N/A'),
                    'resp_time' => $responseTime,
                    'domain_env' => ucfirst($domain->environment ?? 'production'),
                    'ssl' => $sslDisplay,
                    'failures_count' => (string) ($domain->failure_count ?? 0),
                    'time' => now()->format('d M Y, H:i:s') . ' UTC',
                ],
                'en_IN',
                [],
            );

            return response()->json([
                'message' => 'Test WhatsApp message sent successfully to ' . $config->phone_number,
                'sid' => $sid,
            ]);
        } catch (\Throwable $e) {
            if (!empty($creditReserved) && !empty($workspace)) {
                $waCredits->refundCredit($workspace, 1);
            }

            \Illuminate\Support\Facades\Log::error('WhatsAppSettingsController test failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to send WhatsApp message'], 500);
        }
    }

    /* -------------------------------------------------------
     | CREDITS – get current WhatsApp credit allowance and usage
     | ------------------------------------------------------- */
    public function credits(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $workspace = $user->currentWorkspace();
            if (!$workspace) {
                return response()->json(['message' => 'Workspace not found'], 404);
            }

            $details = app(\App\Services\WhatsAppCreditService::class)->getCreditDetails($workspace);

            return response()->json(['data' => $details]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('WhatsAppSettingsController credits failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load credit details'], 500);
        }
    }
}
