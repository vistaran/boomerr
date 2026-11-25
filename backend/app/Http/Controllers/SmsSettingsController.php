<?php

namespace App\Http\Controllers;

use App\Contracts\SmsProviderInterface;
use App\Models\SmsNotificationSetting;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SmsSettingsController extends Controller
{
    /* -------------------------------------------------------
     | INDEX – list all SMS configurations for the workspace
     | ------------------------------------------------------- */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $query = SmsNotificationSetting::where('workspace_id', $user->currentWorkspaceId());

            if ($request->filled('domain_id')) {
                $query->where('domain_id', $request->integer('domain_id'));
            }

            $configs = $query->orderBy('created_at', 'desc')->get();
            $workspace = $user->currentWorkspace();
            $credits = $workspace ? app(\App\Services\SmsCreditService::class)->getCreditDetails($workspace) : null;

            return response()->json([
                'data' => $configs,
                'credits' => $credits,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('SmsSettingsController index failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load SMS configurations'], 500);
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
                'sms_enabled' => ['required', 'boolean'],
                'phone_number' => ['required', 'string', 'max:20'],
                'down_threshold' => ['sometimes', 'integer', 'min:1', 'max:100'],
                'ssl_days_before' => ['sometimes', 'integer', 'min:1', 'max:90'],
                'domain_id' => ['required', 'integer', 'exists:domains,id'],
                'events' => ['sometimes', 'array'],
                'events.*' => ['string'],
            ]);

            $otp = $otpService->sendOtp(
                userId: $user->id,
                workspaceId: $user->currentWorkspaceId(),
                channel: 'sms',
                phoneNumber: $validated['phone_number'],
                payload: $validated,
            );

            return response()->json([
                'message' => 'OTP sent to ' . $validated['phone_number'],
                'otp_id' => $otp->id,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('SmsSettingsController sendOtp failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to send OTP: ' . $e->getMessage(),
            ], 422);
        }
    }

    /* -------------------------------------------------------
     | VERIFY-OTP – verify code and create the SMS config
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

            // OTP verified - create the SMS configuration from the stored payload
            $config = SmsNotificationSetting::create(array_merge($otp->payload, [
                'workspace_id' => $otp->workspace_id,
                'user_id' => $otp->user_id,
                'events' => $otp->payload['events'] ?? ['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'],
            ]));

            return response()->json([
                'message' => 'Phone number verified. SMS configuration created.',
                'data' => $config,
            ], 201);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('SmsSettingsController verifyOtp failed: ' . $e->getMessage());
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
            \Illuminate\Support\Facades\Log::error('SmsSettingsController resendOtp failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to resend OTP: ' . $e->getMessage(),
            ], 422);
        }
    }

    /* -------------------------------------------------------
     | STORE – create a new SMS configuration (legacy, kept for direct creation)
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
                'sms_enabled' => ['required', 'boolean'],
                'phone_number' => ['required', 'string', 'max:20'],
                'down_threshold' => ['sometimes', 'integer', 'min:1', 'max:100'],
                'domain_id' => ['required', 'integer', 'exists:domains,id'],
                'events' => ['sometimes', 'array'],
                'events.*' => ['string'],
            ]);

            $config = SmsNotificationSetting::create(array_merge($validated, [
                'workspace_id' => $user->currentWorkspaceId(),
                'user_id' => $user->id,
                'events' => $validated['events'] ?? ['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'],
            ]));

            return response()->json([
                'message' => 'SMS configuration created.',
                'data' => $config,
            ], 201);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('SmsSettingsController store failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to create SMS configuration'], 500);
        }
    }

    /* -------------------------------------------------------
     | UPDATE – update an existing SMS configuration
     | ------------------------------------------------------- */
    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $config = SmsNotificationSetting::where('workspace_id', $user->currentWorkspaceId())->find($id);
            if (!$config) {
                return response()->json(['message' => 'Configuration not found'], 404);
            }

            $validated = $request->validate([
                'name' => ['sometimes', 'string', 'max:100'],
                'sms_enabled' => ['sometimes', 'boolean'],
                'phone_number' => ['sometimes', 'string', 'max:20'],
                'down_threshold' => ['sometimes', 'integer', 'min:1', 'max:100'],
                'ssl_days_before' => ['sometimes', 'integer', 'min:1', 'max:90'],
                'events' => ['sometimes', 'array'],
                'events.*' => ['string'],
            ]);

            $config->update($validated);

            return response()->json([
                'message' => 'SMS configuration updated.',
                'data' => $config->fresh(),
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('SmsSettingsController update failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to update SMS configuration'], 500);
        }
    }

    /* -------------------------------------------------------
     | DESTROY – delete an SMS configuration
     | ------------------------------------------------------- */
    public function destroy(int $id): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $config = SmsNotificationSetting::where('workspace_id', $user->currentWorkspaceId())->find($id);
            if (!$config) {
                return response()->json(['message' => 'Configuration not found'], 404);
            }

            $config->delete();

            return response()->json(['message' => 'SMS configuration deleted.']);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('SmsSettingsController destroy failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to delete SMS configuration'], 500);
        }
    }

    /* -------------------------------------------------------
     | TEST – send a test SMS for a specific configuration
     | ------------------------------------------------------- */
    public function test(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspaceId()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $config = SmsNotificationSetting::where('workspace_id', $user->currentWorkspaceId())->find($id);
            if (!$config) {
                return response()->json(['message' => 'Configuration not found'], 404);
            }

            if (!$config->phone_number) {
                return response()->json(['message' => 'No phone number configured.'], 422);
            }

            $workspace = $user->currentWorkspace();
            $smsCredits = app(\App\Services\SmsCreditService::class);
            $creditReserved = false;

            if (config('billing.enabled', false) && $workspace) {
                $creditReserved = $smsCredits->reserveCredit($workspace, 1);
                if (!$creditReserved) {
                    return response()->json([
                        'message' => 'Monthly SMS credit limit reached. Upgrade your plan for more SMS alerts.',
                        'error_code' => 'sms_credits_exhausted',
                    ], 403);
                }
            }

            $message = '[' . config('app.name') . '] Test SMS alert at ' . now()->toDateTimeString();

            try {
                $sms = app(SmsProviderInterface::class);
                $sid = $sms->send($config->phone_number, $message, ['date' => now()->format('d-m-Y H:i A')]);
            } catch (\Throwable $sendEx) {
                if ($creditReserved && $workspace) {
                    $smsCredits->refundCredit($workspace, 1);
                }
                throw $sendEx;
            }

            return response()->json([
                'message' => 'Test SMS sent successfully to ' . $config->phone_number,
                'sid' => $sid,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('SmsSettingsController test failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to send SMS: ' . $e->getMessage(),
            ], 422);
        }
    }

    /* -------------------------------------------------------
     | CREDITS – get current SMS credit allowance and usage
     | ------------------------------------------------------- */
    public function credits(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspace()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $workspace = $user->currentWorkspace();
            $details = app(\App\Services\SmsCreditService::class)->getCreditDetails($workspace);

            return response()->json(['data' => $details]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('SmsSettingsController credits failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load SMS credit details'], 500);
        }
    }
}
