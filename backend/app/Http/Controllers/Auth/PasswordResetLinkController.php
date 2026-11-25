<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\RateLimitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class PasswordResetLinkController extends Controller
{
    private RateLimitService $rateLimitService;

    public function __construct()
    {
        try {
            $this->rateLimitService = new RateLimitService();
        } catch (\Throwable $e) {
            Log::error('Failed to initialize RateLimitService in PasswordResetLinkController: ' . $e->getMessage());
        }
    }

    /**
     * Handle an incoming password reset link request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $request->validate(['email' => 'required|email']);

            // Check rate limit before processing
            $rateLimitResponse = $this->rateLimitService->check($request, 'forgot_password');
            if ($rateLimitResponse) {
                return $rateLimitResponse;
            }

            // Validate that the email exists in our system
            $user = User::where('email', $request->email)->first();

            if (!$user) {
                // Record failed attempt for rate limiting (even when email not found)
                $this->rateLimitService->recordFailedAttempt($request, 'forgot_password');

                return response()->json([
                    'message' => 'No user account exists for the provided email address.',
                ], 404);
            }

            $status = Password::sendResetLink($request->only('email'));

            // If reset link was sent successfully, clear rate limit
            if ($status === Password::RESET_LINK_SENT) {
                $this->rateLimitService->clear($request, 'forgot_password');
            }

            return $status === Password::RESET_LINK_SENT
                ? response()->json(['message' => 'Reset link sent'])
                : response()->json(['message' => 'Unable to send reset link'], 400);
        } catch (\Throwable $e) {
            Log::error('PasswordResetLinkController store failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to send password reset link'], 500);
        }
    }
}
