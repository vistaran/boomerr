<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyMonitoringApiKey
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $expectedKey = config('services.monitoring.api_key');
        $providedKey = $request->bearerToken();

        $headerPresent = $request->hasHeader('Authorization');
        $tokenParsed = !empty($providedKey);
        $configLoaded = !empty($expectedKey);
        $keysMatch = ($providedKey === $expectedKey);

        if (!$configLoaded || !$keysMatch) {
            $reason = !$configLoaded ? 'Config key is missing' : (!$headerPresent ? 'Authorization header missing' : (!$tokenParsed ? 'Bearer token missing' : 'Key mismatch'));
            \Illuminate\Support\Facades\Log::warning("Monitoring API Auth Failed", [
                'header_present' => $headerPresent,
                'token_parsed' => $tokenParsed,
                'config_loaded' => $configLoaded,
                'reason' => $reason
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 401);
        }

        return $next($request);
    }
}
