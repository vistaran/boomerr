<?php

namespace App\Http\Middleware;

use Closure;
use App\Models\RateLimit;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RateLimitMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  $type
     * @param  int  $maxAttempts
     * @param  int  $decayMinutes
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next, string $type, int $maxAttempts, int $decayMinutes): Response
    {
        $ip = $request->ip();
        $now = now();

        $rateLimit = RateLimit::firstOrCreate(
            ['ip_address' => $ip, 'type' => $type],
            ['attempts' => 0, 'last_accessed_at' => $now]
        );

        // Check if block has expired
        if ($rateLimit->attempts >= $maxAttempts) {
            $lastAccessedAt = $rateLimit->last_accessed_at
                ? Carbon::parse($rateLimit->last_accessed_at)
                : $now;

            $lockoutEnd = $lastAccessedAt->copy()->addMinutes($decayMinutes);

            if ($now->lt($lockoutEnd)) {
                $diffInSeconds = $now->diffInSeconds($lockoutEnd);
                if ($diffInSeconds >= 60) {
                    $timeMessage = ceil($diffInSeconds / 60) . " minute(s)";
                } else {
                    $timeMessage = ceil($diffInSeconds) . " second(s)";
                }

                return response()->json([
                    'status' => 'error',
                    'message' => "Too many attempts. Account is temporarily locked. Please try again in {$timeMessage}.",
                ], 429);
            } else {
                // Reset after decay period
                $rateLimit->update([
                    'attempts' => 0,
                    'last_accessed_at' => $now,
                ]);
            }
        }

        // Increment attempts BEFORE processing
        $rateLimit->increment('attempts');
        $rateLimit->update(['last_accessed_at' => $now]);

        return $next($request);
    }
}
