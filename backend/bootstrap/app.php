<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Http;
use Illuminate\Foundation\Configuration\Middleware;
use Laravel\Sanctum\Http\Middleware\CheckForAnyAbility;
use Laravel\Sanctum\Http\Middleware\CheckAbilities;
use App\Http\Middleware\VerifyMonitoringApiKey;
use App\Models\SystemLog;
use App\Http\Middleware\EnsureUserCanManageCompanyResources;
use App\Http\Middleware\EnsureEmailIsVerified;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use App\Http\Middleware\SecurityHeadersMiddleware;
use Illuminate\Http\Middleware\HandleCors;
use App\Http\Middleware\CheckIpBlockList;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Illuminate\Auth\AuthenticationException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        channels: __DIR__ . '/../routes/channels.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
        then: function () {
            Route::middleware('api')
                ->prefix('api/admin')
                ->group(base_path('routes/admin.php'));

            Route::middleware('api')
                ->prefix('admin')
                ->group(base_path('routes/admin.php'));
        },
    )
    ->withCommands([
        __DIR__ . '/../app/Console/Commands',
    ])
    ->withMiddleware(function (Middleware $middleware): void {

        $middleware->trustProxies(at: '*');

        $middleware->validateCsrfTokens(except: [
            'api/*',
            'admin/*',
            'broadcasting/*',
            'webhooks/*',
            'shopify/*',
            'integrations/*',
            'auth/*',
            'webhooks/meta/whatsapp',
            'shopify/callback',   // Shopify OAuth redirect - no CSRF token
            'newsletter/*',
            'status/*',
        ]);

        $middleware->use([
            HandleCors::class,
            CheckIpBlockList::class,      // Blocked IP check
            SecurityHeadersMiddleware::class, // Add security headers to all responses
        ]);

        $middleware->alias([
            'verified' => EnsureEmailIsVerified::class,
            'can-manage-company' => EnsureUserCanManageCompanyResources::class,
            'monitoring.auth' => VerifyMonitoringApiKey::class,
            'abilities' => CheckAbilities::class,
            'ability' => CheckForAnyAbility::class,
        ]);
    })
    ->withBroadcasting(__DIR__ . '/../routes/channels.php')
    ->withExceptions(function (Exceptions $exceptions): void {
        // Exception reporting
        $exceptions->report(function (\Throwable $e) {
            if ($e instanceof HttpException) {
                return;
            }

            // Log to SystemLog for Admin panel visibility
            if (class_exists(SystemLog::class)) {
                try {
                    SystemLog::create([
                        'log_type' => 'error',
                        'severity' => 'critical',
                        'source' => 'system.exception',
                        'message' => $e->getMessage(),
                    ]);
                } catch (\Throwable $logErr) {
                    // Ignore DB errors during logging to avoid loops
                }
            }
        });

        // Handle unauthenticated requests with a consistent JSON structure
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Unauthenticated. Please provide a valid token.',
                ], 401);
            }
        });

        // Handle unauthorized requests with a consistent JSON structure
        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Forbidden: You do not have permission to access this resource.',
                ], 403);
            }
        });
    })->create();
