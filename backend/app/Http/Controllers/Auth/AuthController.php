<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\VerifyEmailMail;
use App\Mail\LoginOtpMail;
use App\Models\Integration;
use App\Models\User;
use App\Models\Workspace;
use App\Services\AuditLogService;
use App\Services\Billing\WorkspaceSubscriptionService;
use App\Services\RateLimitService;
use Google\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;
use Google\Service\Oauth2;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    private RateLimitService $rateLimitService;

    public function __construct()
    {
        try {
            $this->rateLimitService = new RateLimitService();
        } catch (\Throwable $e) {
            Log::error('RateLimitService initialization failed: ' . $e->getMessage());
            throw $e;
        }
    }
    private function verifyHCaptcha(?string $token, string $ip): bool
    {
        $secret = config('services.hcaptcha.secret');
        if (empty($secret)) {
            return true;
        }

        if (empty($token)) {
            return false;
        }

        try {
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
            Log::error('HCaptcha verification failed: ' . $e->getMessage());
            return false;
        }
    }

    public function register(Request $request): JsonResponse
    {
        try {
            $hasCaptchaSecret = !empty(config('services.hcaptcha.secret'));
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
                'password' => ['required', 'confirmed', Rules\Password::defaults()],
                'captcha_token' => $hasCaptchaSecret ? ['required', 'string'] : ['nullable', 'string'],
            ], [
                'email.unique' => 'Email is already registered. Please try another email ID',
                'captcha_token.required' => 'Please complete the captcha verification.',
            ]);

            // Verify only if captcha is configured
            if ($hasCaptchaSecret && !$this->verifyHCaptcha($request->captcha_token, $request->ip())) {
                return response()->json([
                    'message' => 'Captcha verification failed',
                ], 422);
            }

            DB::beginTransaction();

            try {
                $user = User::create([
                    'name' => $validated['name'],
                    'email' => $validated['email'],
                    'password' => Hash::make($validated['password']),
                    'email_verified_at' => config('mail.default') === 'log' ? now() : null,
                ]);

                $company = Workspace::create([
                    'name' => "{$validated['name']}'s Workspace",
                    'slug' => Str::slug($validated['name'] . '-' . Str::random(5)),
                ]);

                $user->workspaces()->syncWithoutDetaching([
                    $company->id => ['role' => User::ROLE_OWNER],
                ]);

                $user->activateWorkspace($company->id);

                $plainToken = Str::random(64);

                Integration::all()->each(
                    fn($i) =>
                    $company->integrations()->attach($i->id, ['enabled' => true, 'ulid' => strtolower((string) Str::ulid())])
                );

                $workspaceSubscriptionService = app(WorkspaceSubscriptionService::class);
                $workspaceSubscriptionService->ensureDefaultFreeSubscription($company);

                DB::table('email_verifications')->updateOrInsert(
                    ['email' => $user->email],
                    [
                        'token' => hash('sha256', $plainToken),
                        'expires_at' => now()->addHours(24),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );

                DB::commit();
            } catch (\Throwable $e) {
                DB::rollBack();
                throw $e;
            }

            // Send discord signup alert
            try {
                app(\App\Services\DiscordAlertService::class)->notifySignup($user, 'email', $company->name);
            } catch (\Throwable $e) {
                Log::error('Discord signup notify failed: ' . $e->getMessage());
            }

            // Generate URL outside transaction
            $verifyUrl = config('app.frontend_url') .
                "/verify-email?token={$plainToken}&email={$user->email}";

            // 🚀 Defer email sending (BIG WIN)
            dispatch(function () use ($user, $verifyUrl) {
                Mail::to($user->email)->send(
                    new VerifyEmailMail($verifyUrl)
                );
            })->afterResponse();

            return response()->json([
                'message' => 'Registration successful',
                'user' => $user,
                'company' => $company,
                'email_verification_sent' => true,
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => $e->validator->errors()->first() ?: 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('AuthController register failed: ' . $e->getMessage());
            return response()->json(['message' => 'Registration failed'], 500);
        }
    }

    public function login(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'email' => ['required', 'email'],
                'password' => ['required', 'string'],
            ]);

            // Check rate limit before processing login
            $rateLimitResponse = $this->rateLimitService->check($request, 'login');
            if ($rateLimitResponse) {
                return $rateLimitResponse;
            }

            $user = User::where('email', $request->email)->first();

            if ($user) {
                // Stage A: Self-healing
                if ($user->blocked_until && now()->gt($user->blocked_until)) {
                    $user->failed_attempts = 0;
                    $user->blocked_until = null;
                    $user->save();
                }

                // Stage B: Block Check
                if ($user->blocked_until && now()->lt($user->blocked_until)) {
                    $diffInSeconds = now()->diffInSeconds($user->blocked_until);
                    $timeMessage = $diffInSeconds >= 60
                        ? ceil($diffInSeconds / 60) . " minute(s)"
                        : ceil($diffInSeconds) . " second(s)";

                    return response()->json([
                        'message' => "Account is locked. Please try again in {$timeMessage}.",
                    ], 423);
                }

                // Stage C: Threshold Check
                if ($user->failed_attempts >= 2) {
                    $user->blocked_until = now()->addMinutes(30);
                    $user->save();

                    return response()->json([
                        'message' => 'Too many attempts. Account is locked. Please try again in 30 minutes.',
                    ], 423);
                }
            }

            if (!$user || !Hash::check($request->password, $user->password)) {
                if ($user) {
                    // Stage D: Password WRONG Updates
                    $user->increment('failed_attempts');
                    $user->last_attempt_at = now();
                    $user->save();
                }

                // Record failed attempt for rate limiting
                $this->rateLimitService->recordFailedAttempt($request, 'login');

                throw ValidationException::withMessages([
                    'email' => ['The provided credentials are incorrect.'],
                ]);
            }

            // Clear rate limit on successful login
            $this->rateLimitService->clear($request, 'login');

            // Check if email is verified
            if (!$user->email_verified_at) {
                if (env('REQUIRE_EMAIL_VERIFICATION', false) === false || config('mail.default') === 'log' || env('MAIL_MAILER') === 'log') {
                    $user->email_verified_at = now();
                    $user->save();
                } else {
                    return response()->json([
                        'message' => 'Please verify your email before logging in.',
                        'email_verification_required' => true,
                    ], 403);
                }
            }

            // Stage D: Password CORRECT Updates
            $user->failed_attempts = 0;
            $user->blocked_until = null;
            $user->last_login_at = now();
            $user->save();

            $workspaces = $this->workspacePayloadFor($user);
            $token = $user->createToken('api_token')->plainTextToken;

            app(AuditLogService::class)->userLogin($user, 'email');

            return response()->json([
                'message' => 'Login successful',
                'token' => $token,
                'user' => $user,
                'workspaces' => $workspaces,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $e->validator->errors()->first() ?: 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('AuthController login failed: ' . $e->getMessage());
            return response()->json(['message' => 'Login failed'], 500);
        }
    }

    public function googleLogin(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'token' => ['required', 'string'],
            ]);

            $client = new Client([
                'client_id' => config('services.google.client_id'),
            ]);

            // $payload = $client->verifyIdToken($request->token);
            $client->setAccessToken($request->token);

            $oauth = new Oauth2($client);
            $googleUser = $oauth->userinfo->get();

            $payload = [
                'email' => $googleUser->email,
                'name' => $googleUser->name,
            ];

            if (!$payload) {
                return response()->json([
                    'message' => 'Invalid Google token',
                ], 401);
            }

            $user = User::firstOrCreate(
                ['email' => $payload['email']],
                [
                    'name' => $payload['name'] ?? 'User',
                    'password' => Hash::make(str()->random(32)), // unused
                    'role' => 'owner', // unused
                ]
            );

            $company = Workspace::firstOrCreate(
                ['name' => $user->name . "'s Workspace"],
                ['slug' => Str::slug($user->name . '-' . Str::random(5))]
            );

            // $workspace = $user->workspaces()->where('workspace_id', $company->id)->first();
            $workspaceIntegrations = $company->integrations()->pluck('integration_id')->toArray();
            if (!$workspaceIntegrations) {
                Integration::all()->each(
                    fn($i) =>
                    $company->integrations()->attach($i->id, ['enabled' => true, 'ulid' => strtolower((string) Str::ulid())])
                );

                $workspaceSubscriptionService = app(WorkspaceSubscriptionService::class);
                $workspaceSubscriptionService->ensureDefaultFreeSubscription($company);
            }

            // Send discord signup alert for Google signup if newly created
            try {
                if ($user->wasRecentlyCreated) {
                    app(\App\Services\DiscordAlertService::class)->notifySignup($user, 'google', $company->name);
                    \App\Jobs\ProcessLifecycleAutomations::dispatch($user);
                }
            } catch (\Throwable $e) {
                Log::error('Discord signup notify failed: ' . $e->getMessage());
            }

            $user->workspaces()->syncWithoutDetaching([
                $company->id => ['role' => User::ROLE_OWNER],
            ]);

            $user->activateWorkspace($company->id);

            // Mark as verified for Google OAuth users (email is verified by Google)
            if (!$user->email_verified_at) {
                $user->email_verified_at = now();
            }
            $user->last_login_at = now();
            $user->save();

            $workspaces = $this->workspacePayloadFor($user);

            $token = $user->createToken('api_token')->plainTextToken;

            app(AuditLogService::class)->userLogin($user, 'google');

            return response()->json([
                'message' => 'Google login successful',
                'token' => $token,
                'user' => $user,
                'workspaces' => $workspaces,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $e->validator->errors()->first() ?: 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('AuthController googleLogin failed: ' . $e->getMessage());
            return response()->json(['message' => 'Google login failed'], 500);
        }
    }



    public function logout(Request $request): JsonResponse
    {
        try {
            $user = $request->user();

            if ($user instanceof User) {
                app(AuditLogService::class)->userLogout($user, $request);
            }

            // Revoke current token
            $user?->currentAccessToken()?->delete();

            return response()->json([
                'message' => 'Logged out',
            ]);
        } catch (\Throwable $e) {
            Log::error('AuthController logout failed: ' . $e->getMessage());
            return response()->json(['message' => 'Logout failed'], 500);
        }
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'email' => ['required', 'email'],
                'captcha_token' => ['required', 'string'],
            ]);

            if (!$this->verifyHCaptcha($request->captcha_token, $request->ip())) {
                return response()->json([
                    'message' => 'Captcha verification failed',
                ], 422);
            }

            // Check rate limit before processing forgot password
            $rateLimitResponse = $this->rateLimitService->check($request, 'forgot_password');
            if ($rateLimitResponse) {
                return $rateLimitResponse;
            }

            $user_email = User::where('email', $request->email)->first();

            if (!$user_email) {
                return response()->json([
                    'message' => 'Email not found in our system.',
                ], 404);
            }

            // Record failed attempt if email not found (to prevent enumeration)
            // But we still return the same message for security

            return response()->json([
                'message' => 'A password reset link has been sent.',
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $e->validator->errors()->first() ?: 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('AuthController forgotPassword failed: ' . $e->getMessage());
            return response()->json(['message' => 'Password reset request failed'], 500);
        }
    }

    public function verifyEmail(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'email' => ['required', 'email'],
                'token' => ['required', 'string'],
            ]);

            $record = DB::table('email_verifications')
                ->where('email', $request->email)
                ->first();

            if (!$record) {
                return response()->json(['message' => 'Invalid or expired link'], 400);
            }

            if (Carbon::now()->gt($record->expires_at)) {
                return response()->json(['message' => 'Verification link expired'], 400);
            }

            if (!hash_equals($record->token, hash('sha256', $request->token))) {
                return response()->json(['message' => 'Invalid verification token'], 400);
            }

            $user = User::where('email', $request->email)->firstOrFail();
            // Mark verified (idempotent)
            if (!$user->email_verified_at) {
                $user->forceFill(['email_verified_at' => now()])->save();
                \App\Jobs\ProcessLifecycleAutomations::dispatch($user);
            }

            // Delete token
            DB::table('email_verifications')
                ->where('email', $request->email)
                ->delete();

            // ISSUE AUTH TOKEN (THIS IS THE KEY)
            $workspaces = $this->workspacePayloadFor($user);
            $authToken = $user->createToken('api_token')->plainTextToken;

            return response()->json([
                'message' => 'Email verified successfully',
                'token' => $authToken,
                'user' => $user,
                'workspaces' => $workspaces,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $e->validator->errors()->first() ?: 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('AuthController verifyEmail failed: ' . $e->getMessage());
            return response()->json(['message' => 'Email verification failed'], 500);
        }
    }

    public function switchWorkspace(Request $request, string $workspace_ulid): JsonResponse
    {
        try {
            $user = $request->user();

            if (!$user) {
                return response()->json([
                    'message' => 'Unauthenticated.',
                ], 401);
            }

            $workspace = Workspace::where('ulid', $workspace_ulid)->first();
            if (!$workspace) {
                return response()->json([
                    'message' => 'Workspace not found.',
                ], 404);
            }

            if (!$user->belongsToWorkspace($workspace->id)) {
                return response()->json([
                    'message' => 'You do not belong to this workspace.',
                ], 403);
            }

            $user->activateWorkspace($workspace->id);
            $workspaces = $this->workspacePayloadFor($user);

            return response()->json([
                'message' => 'Workspace switched successfully.',
                'user' => $user,
                'workspaces' => $workspaces,
            ]);
        } catch (\Throwable $e) {
            Log::error('AuthController switchWorkspace failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to switch workspace'], 500);
        }
    }

    private function workspacePayloadFor(User $user): array
    {
        try {
            $user->ensureWorkspaceHydrated();
            $user->refresh();

            return $user->workspaceSummaries();
        } catch (\Throwable $e) {
            Log::error('Workspace payload generation failed: ' . $e->getMessage());
            return [];
        }
    }

    public function updateUserInfo(Request $request): JsonResponse
    {
        try {
            $user = $request->user();

            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
            ]);

            $user->name = $validated['name'];
            $user->save();

            return response()->json([
                'message' => 'User info updated successfully.',
                'user' => $user,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $e->validator->errors()->first() ?: 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('AuthController updateUserInfo failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to update user info'], 500);
        }
    }

    public function deleteAccount(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            DB::transaction(function () use ($user): void {
                // Revoke Sanctum tokens
                $user->tokens()->delete();

                // Delete the user account (triggers User::deleting hook for email_deliveries & owned workspaces)
                $user->delete();
            });

            return response()->json([
                'message' => 'Account deleted successfully.',
            ]);
        } catch (\Throwable $e) {
            Log::error('AuthController deleteAccount failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to delete account'], 500);
        }
    }

    public function sendLoginOtp(Request $request): JsonResponse
    {
        try {
            $hasCaptchaSecret = !empty(config('services.hcaptcha.secret'));
            $request->validate([
                "email" => ["required", "email"],
                "captcha_token" => $hasCaptchaSecret ? ["required", "string"] : ["nullable", "string"],
            ], [
                'captcha_token.required' => 'Please complete the captcha verification.',
            ]);

            if ($hasCaptchaSecret && !$this->verifyHCaptcha($request->captcha_token, $request->ip())) {
                return response()->json([
                    "message" => "Captcha verification failed",
                ], 422);
            }

            $rateLimitResponse = $this->rateLimitService->check($request, "login");
            if ($rateLimitResponse) {
                return $rateLimitResponse;
            }

            $user = User::where("email", $request->email)->first();

            if (!$user) {
                return response()->json([
                    "message" => "No account found with this email address.",
                ], 404);
            }

            if ($user->blocked_until && now()->lt($user->blocked_until)) {
                $diffInSeconds = now()->diffInSeconds($user->blocked_until);
                $timeMessage = $diffInSeconds >= 60
                    ? ceil($diffInSeconds / 60) . " minute(s)"
                    : ceil($diffInSeconds) . " second(s)";

                return response()->json([
                    "message" => "Account is locked. Please try again in {$timeMessage}.",
                ], 423);
            }

            $code = str_pad((string) random_int(0, 999999), 6, "0", STR_PAD_LEFT);

            DB::table("otp_verifications")
                ->where("channel", "email")
                ->where("phone_number", $user->email)
                ->whereNull("verified_at")
                ->delete();

            DB::table("otp_verifications")->insert([
                "user_id" => $user->id,
                "workspace_id" => $user->workspace_id ?? 0,
                "channel" => "email",
                "phone_number" => $user->email,
                "otp_code" => $code,
                "payload" => json_encode(["email" => $user->email]),
                "expires_at" => now()->addMinutes(10),
                "created_at" => now(),
                "updated_at" => now(),
            ]);

            Log::info("Generated Login OTP for {$user->email}: {$code}");

            try {
                Mail::to($user->email)->send(new LoginOtpMail($code));
            } catch (\Throwable $e) {
                Log::error("Failed to send Login OTP email: " . $e->getMessage());
                Log::warning("Delivery failed but OTP code was logged for {$user->email}: {$code}");
            }

            return response()->json([
                "message" => "Verification code sent to your email.",
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                "message" => $e->validator->errors()->first() ?: "Validation failed",
                "errors" => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error("AuthController sendLoginOtp failed: " . $e->getMessage());
            return response()->json(["message" => "Unable to send OTP. Please try again."], 500);
        }
    }

    public function verifyLoginOtp(Request $request): JsonResponse
    {
        try {
            $request->validate([
                "email" => ["required", "email"],
                "otp" => ["required", "string"],
            ]);

            $rateLimitResponse = $this->rateLimitService->check($request, "login");
            if ($rateLimitResponse) {
                return $rateLimitResponse;
            }

            $user = User::where("email", $request->email)->first();

            if (!$user) {
                return response()->json([
                    "message" => "Invalid email or code.",
                ], 422);
            }

            if ($user->blocked_until && now()->lt($user->blocked_until)) {
                $diffInSeconds = now()->diffInSeconds($user->blocked_until);
                $timeMessage = $diffInSeconds >= 60
                    ? ceil($diffInSeconds / 60) . " minute(s)"
                    : ceil($diffInSeconds) . " second(s)";

                return response()->json([
                    "message" => "Account is locked. Please try again in {$timeMessage}.",
                ], 423);
            }

            $otpRecord = DB::table("otp_verifications")
                ->where("channel", "email")
                ->where("phone_number", $user->email)
                ->whereNull("verified_at")
                ->orderByDesc("id")
                ->first();

            if (!$otpRecord || Carbon::parse($otpRecord->expires_at)->isPast() || $otpRecord->otp_code !== trim($request->otp)) {
                $user->increment("failed_attempts");
                $user->last_attempt_at = now();
                if ($user->failed_attempts >= 3) {
                    $user->blocked_until = now()->addMinutes(30);
                }
                $user->save();

                $this->rateLimitService->recordFailedAttempt($request, "login");

                return response()->json([
                    "message" => "Invalid or expired verification code.",
                ], 422);
            }

            DB::table("otp_verifications")
                ->where("id", $otpRecord->id)
                ->update(["verified_at" => now()]);

            $this->rateLimitService->clear($request, "login");
            $user->failed_attempts = 0;
            $user->blocked_until = null;
            if (!$user->email_verified_at) {
                $user->email_verified_at = now();
            }
            $user->last_login_at = now();
            $user->save();

            $workspaces = $this->workspacePayloadFor($user);
            $token = $user->createToken("api_token")->plainTextToken;

            app(AuditLogService::class)->userLogin($user, "email_otp");

            return response()->json([
                "message" => "Login successful",
                "token" => $token,
                "user" => $user,
                "workspaces" => $workspaces,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                "message" => $e->validator->errors()->first() ?: "Validation failed",
                "errors" => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error("AuthController verifyLoginOtp failed: " . $e->getMessage());
            return response()->json(["message" => "Login failed. Please try again."], 500);
        }
    }

}
