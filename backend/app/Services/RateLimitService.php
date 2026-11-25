<?php

namespace App\Services;

use App\Models\RateLimit;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class RateLimitService
{
    /**
     * Rate limit configuration for different types
     */
    private const CONFIG = [
        'login' => [
            'maxAttempts' => 3,
            'decayMinutes' => 30,
        ],
        'forgot_password' => [
            'maxAttempts' => 3,
            'decayMinutes' => 30,
        ],
    ];

    /**
     * Check if the request should be rate limited
     * Returns JsonResponse if rate limited, null if OK
     */
    public function check(Request $request, string $type): ?JsonResponse
    {
        $config = self::CONFIG[$type] ?? null;

        if (!$config) {
            return null;
        }

        $ip = $request->ip();
        $email = $request->input('email');
        $maxAttempts = $config['maxAttempts'];
        $decayMinutes = $config['decayMinutes'];

        // Check IP-based rate limit
        $ipResponse = $this->checkRateLimit($ip, null, $type, $maxAttempts, $decayMinutes);
        if ($ipResponse) {
            return $ipResponse;
        }

        // Check email-based rate limit if email is provided
        if ($email) {
            $emailResponse = $this->checkRateLimit(null, $email, $type, $maxAttempts, $decayMinutes);
            if ($emailResponse) {
                return $emailResponse;
            }
        }

        return null;
    }

    /**
     * Record a failed attempt
     */
    public function recordFailedAttempt(Request $request, string $type): void
    {
        $config = self::CONFIG[$type] ?? null;

        if (!$config) {
            return;
        }

        $ip = $request->ip();
        $email = $request->input('email');
        $maxAttempts = $config['maxAttempts'];
        $decayMinutes = $config['decayMinutes'];

        // Record IP-based failed attempt
        $this->recordAttempt($ip, null, $type, $maxAttempts, $decayMinutes);

        // Record email-based failed attempt if email is provided
        if ($email) {
            $this->recordAttempt(null, $email, $type, $maxAttempts, $decayMinutes);
        }
    }

    /**
     * Clear rate limit on successful attempt
     */
    public function clear(Request $request, string $type): void
    {
        $ip = $request->ip();
        $email = $request->input('email');

        // Clear IP-based rate limit
        RateLimit::where('ip_address', $ip)
            ->where('type', $type)
            ->delete();

        // Clear email-based rate limit if email is provided
        if ($email) {
            RateLimit::where('email', strtolower($email))
                ->where('type', $type)
                ->delete();
        }
    }

    /**
     * Check rate limit for a specific identifier (IP or email)
     */
    private function checkRateLimit(?string $ip, ?string $email, string $type, int $maxAttempts, int $decayMinutes): ?JsonResponse
    {
        $query = RateLimit::where('type', $type);

        if ($ip) {
            $query->where('ip_address', $ip);
        } elseif ($email) {
            $query->where('email', strtolower($email));
        } else {
            return null;
        }

        $rateLimit = $query->first();

        // No record means no attempts yet
        if (!$rateLimit || $rateLimit->attempts < $maxAttempts) {
            return null;
        }

        // Check if lockout period has expired
        $lockoutEnd = Carbon::parse($rateLimit->last_accessed_at)->addMinutes($decayMinutes);

        if (now()->lt($lockoutEnd)) {
            $diffInSeconds = now()->diffInSeconds($lockoutEnd);
            $timeMessage = $this->formatTimeMessage($diffInSeconds);

            return response()->json([
                'status' => 'error',
                'message' => "Too many attempts. Account is temporarily locked. Please try again in {$timeMessage}.",
                'rate_limited' => true,
                'retry_after' => $diffInSeconds,
            ], 429);
        }

        // Lockout period has expired, clear stale record.
        // The next failed attempt will create/increment fresh counters in recordAttempt().
        $rateLimit->delete();

        return null;
    }

    /**
     * Record a rate limit attempt
     */
    private function recordAttempt(?string $ip, ?string $email, string $type, int $maxAttempts, int $decayMinutes): void
    {
        $query = RateLimit::where('type', $type);

        if ($ip) {
            $query->where('ip_address', $ip);
            $rateLimit = $query->first();

            if ($rateLimit) {
                $lockoutEnd = Carbon::parse($rateLimit->last_accessed_at)->addMinutes($decayMinutes);

                // If currently locked out and period hasn't expired, don't increment
                if ($rateLimit->attempts >= $maxAttempts && now()->lt($lockoutEnd)) {
                    return;
                }

                // Reset if lockout period expired
                if (now()->gt($lockoutEnd)) {
                    $rateLimit->update([
                        'attempts' => 1,
                        'last_accessed_at' => now(),
                    ]);
                } else {
                    $rateLimit->increment('attempts');
                    $rateLimit->update(['last_accessed_at' => now()]);
                }
            } else {
                RateLimit::create([
                    'ip_address' => $ip,
                    'email' => null,
                    'type' => $type,
                    'attempts' => 1,
                    'last_accessed_at' => now(),
                ]);
            }
        } elseif ($email) {
            $query->where('email', strtolower($email));
            $rateLimit = $query->first();

            if ($rateLimit) {
                $lockoutEnd = Carbon::parse($rateLimit->last_accessed_at)->addMinutes($decayMinutes);

                // If currently locked out and period hasn't expired, don't increment
                if ($rateLimit->attempts >= $maxAttempts && now()->lt($lockoutEnd)) {
                    return;
                }

                // Reset if lockout period expired
                if (now()->gt($lockoutEnd)) {
                    $rateLimit->update([
                        'attempts' => 1,
                        'last_accessed_at' => now(),
                    ]);
                } else {
                    $rateLimit->increment('attempts');
                    $rateLimit->update(['last_accessed_at' => now()]);
                }
            } else {
                RateLimit::create([
                    'ip_address' => null,
                    'email' => strtolower($email),
                    'type' => $type,
                    'attempts' => 1,
                    'last_accessed_at' => now(),
                ]);
            }
        }
    }

    /**
     * Format time message for display
     */
    private function formatTimeMessage(int $seconds): string
    {
        if ($seconds >= 60) {
            $minutes = ceil($seconds / 60);
            return $minutes . " minute(s)";
        }
        return $seconds . " second(s)";
    }
}
