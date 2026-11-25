<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeadersMiddleware
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
        $response = $next($request);

        // --- CONVERSION FIX ---
        if (!($response instanceof Response) && method_exists($response, 'toResponse')) {
            $response = $response->toResponse($request);
        }

        // Only proceed if we have a valid response object
        if (!($response instanceof Response)) {
            return $response;
        }

        // Shopify specific logic: Allow framing so our breakout script can run
        if ($request->is('shopify*') || $request->is('auth/shopify*') || $request->has('shop')) {
            $response->headers->remove('X-Frame-Options');
            $response->headers->remove('Frame-Options');
            $response->headers->set('Content-Security-Policy', "frame-ancestors https://admin.shopify.com https://*.myshopify.com https://*.trycloudflare.com;", true);
        } else {
            if (!$response->headers->has('X-Frame-Options')) {
                $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
            }
            if (!$response->headers->has('Content-Security-Policy')) {
                $response->headers->set('Content-Security-Policy', "frame-ancestors 'self';");
            }
        }

        return $response;
    }
}
