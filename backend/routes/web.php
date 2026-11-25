<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\FacebookIntegrationController;
use App\Http\Controllers\GoogleIntegrationController;
use App\Http\Controllers\MetaWhatsAppWebhookController;
use App\Http\Controllers\Auth\GitHubAuthController;
use App\Http\Controllers\Auth\ShopifyAuthController;

// 1. SHOPIFY OAUTH ROUTES (High Priority)
Route::get('/auth/shopify/callback', [ShopifyAuthController::class, 'callback'])->name('shopify.callback');
Route::get('/auth/shopify', [ShopifyAuthController::class, 'index'])->name('shopify.index');
Route::get('/shopify/auth', [ShopifyAuthController::class, 'redirect'])->name('shopify.redirect');

// Legacy paths (for compatibility)
Route::get('/shopify', [ShopifyAuthController::class, 'index']);
Route::get('/shopify/callback', [ShopifyAuthController::class, 'callback']);

// 2. WEBHOOKS
Route::get('/webhooks/meta/whatsapp', [MetaWhatsAppWebhookController::class, 'verify']);
Route::post('/webhooks/meta/whatsapp', [MetaWhatsAppWebhookController::class, 'handle']);

// 3. INTEGRATIONS (Facebook / Google)
Route::get('/integrations/facebook/connect', [FacebookIntegrationController::class, 'connect']);
Route::get('/integrations/facebook/callback', [FacebookIntegrationController::class, 'callback']);
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/integrations/google/connect', [GoogleIntegrationController::class, 'connect']);
});
Route::get('/integrations/google/callback', [GoogleIntegrationController::class, 'callback']);

// 4. GITHUB AUTH
Route::get('/auth/github/redirect', [GitHubAuthController::class, 'redirect'])->name('github.redirect');
Route::get('/auth/github/callback', [GitHubAuthController::class, 'callback'])->name('github.callback');

// 5. ROOT & FALLBACK (Serve React SPA)
Route::get('/', function (\Illuminate\Http\Request $request) {
    if ($request->has('shop')) {
        $shop = $request->query('shop');
        $targetUrl = url('/auth/shopify') . '?' . $request->getQueryString();
        return response("
            <script type='text/javascript'>
                const targetUrl = '{$targetUrl}';
                try {
                    const link = document.createElement('a');
                    link.href = targetUrl;
                    link.target = '_top';
                    (document.body || document.documentElement).appendChild(link);
                    link.click();
                } catch (e) {
                    window.top.location.href = targetUrl;
                }
            </script>
            <p>Redirecting to Shopify handshake...</p>
        ");
    }
    return view('app');
});

require __DIR__ . '/auth.php';

Route::fallback(function (\Illuminate\Http\Request $request) {
    if ($request->is('api/*') || $request->expectsJson()) {
        return response()->json(['message' => 'Endpoint not found.'], 404);
    }
    if (file_exists(public_path('index.html'))) {
        return response()->file(public_path('index.html'));
    }
    return response()->json(['message' => 'Not Found'], 404);
});
