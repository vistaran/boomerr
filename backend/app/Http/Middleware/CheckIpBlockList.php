<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CheckIpBlockList
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        $clientIp = $request->ip();

        if (Cache::has('banned_ip:' . $clientIp)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Forbidden: Your IP has been temporarily banned due to suspicious activity.'
            ], 403);
        }

        $response = $next($request);

        // --- CONVERSION FIX ---
        // Ensure everything returned to the global stack is a proper Response object
        if (!($response instanceof \Symfony\Component\HttpFoundation\Response) && method_exists($response, 'toResponse')) {
            return $response->toResponse($request);
        }

        return $response;
    }
}
