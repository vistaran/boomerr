<?php

use App\Http\Controllers\CompanyIntegrationController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\DeveloperWebhookController;
use App\Http\Controllers\DomainController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\StatusFeedController;
use App\Http\Controllers\StatusPageApiController;
use App\Http\Controllers\StatusSubscriptionController;
use App\Http\Controllers\Tools\AdLandingPageCheckerController;
use App\Http\Controllers\Tools\BadgeGeneratorController;
use App\Http\Controllers\Tools\DnsPropagationController;
use App\Http\Controllers\Tools\DnsRecordController;
use App\Http\Controllers\Tools\ShopifyDetectorController;
use App\Http\Controllers\Tools\SslCheckerController;
use App\Http\Controllers\Tools\UptimeCheckerController;
use App\Http\Controllers\Webhooks\ShopifyWebhookController;
use Illuminate\Broadcasting\BroadcastController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\EmailVerificationNotificationController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\DepartmentController;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\TeamInvitationController;
use App\Http\Controllers\TeamMemberController;
use App\Http\Controllers\WorkspaceController;
use App\Http\Controllers\DomainStatusStatsController;
use App\Http\Controllers\DomainResponseStatsController;
use App\Http\Controllers\IncidentController;
use App\Http\Controllers\AITrainingController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\DomainAnalysisController;
use App\Http\Controllers\DomainFacebookAssignmentController;
use App\Http\Controllers\DomainGoogleAssignmentController;
use App\Http\Controllers\FacebookIntegrationController;
use App\Http\Controllers\GoogleIntegrationController;
use App\Http\Controllers\ClickUpIntegrationController;
use App\Http\Controllers\SystemLogController;
use App\Http\Controllers\SslMonitoringController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\SmsSettingsController;
use App\Http\Controllers\WhatsAppSettingsController;
use App\Http\Controllers\ContactSalesController;
use App\Http\Controllers\MetaWhatsAppWebhookController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\StatusPageController;
use App\Http\Controllers\PublicStatusPageController;
use App\Http\Controllers\MonitoringController;
use App\Http\Controllers\Api\EmailPreferenceController;
use App\Http\Controllers\TelegramIntegrationController;
use App\Http\Controllers\IntegrationDeliveryController;
use App\Http\Controllers\NewsletterSubscriberController;

Route::post('/webhooks/telegram', [TelegramIntegrationController::class, 'webhook']);

Route::get('/webhooks/meta/whatsapp', [MetaWhatsAppWebhookController::class, 'verify']);
Route::post('/webhooks/meta/whatsapp', [MetaWhatsAppWebhookController::class, 'receive']);

Route::get('/status-pages/public/{slug}', [PublicStatusPageController::class, 'show']);

// Boomerr Platform Status Page - public, no auth required
Route::get('/status', [StatusPageApiController::class, 'index']);
Route::get('/status/incidents', [StatusPageApiController::class, 'incidents']);
Route::get('/status/feed.xml', [StatusFeedController::class, 'rss']);
Route::get('/status/og-image.png', [StatusPageApiController::class, 'ogImage']);
Route::post('/status/subscribe', [StatusSubscriptionController::class, 'store']);
Route::get('/status/unsubscribe/{token}', [StatusSubscriptionController::class, 'unsubscribe']);

// Blog Newsletter Subscription & Unsubscription
Route::prefix('newsletter')->group(function () {
    Route::post('/subscribe', [NewsletterSubscriberController::class, 'subscribe']);
    Route::get('/status/{token}', [NewsletterSubscriberController::class, 'status']);
    Route::post('/unsubscribe', [NewsletterSubscriberController::class, 'unsubscribe']);
    Route::post('/resubscribe', [NewsletterSubscriberController::class, 'resubscribe']);
    Route::post('/notify-blog', [NewsletterSubscriberController::class, 'notifyNewBlog']);
});

Route::middleware(['monitoring.auth'])->group(function () {
    Route::get('/monitoring/targets', [MonitoringController::class, 'targets']);
    Route::post('/monitoring/results', [MonitoringController::class, 'results']);
    Route::post('/monitoring/results/batch', [MonitoringController::class, 'batchResults']);
    Route::post('/monitoring/heartbeat', [MonitoringController::class, 'heartbeat']);
});

Route::middleware(['throttle:api'])->group(function () {
    Route::middleware(['auth:sanctum'])->get('/user', function (Request $request) {
        return $request->user();
    });
    // Route::get('/test', function () {
    //     return response()->json([
    //         'status' => 'success',
    //         'message' => 'API working'
    //     ]);
    // });

    // Shopify Webhooks
    Route::post('/webhooks/shopify/domains/create', [ShopifyWebhookController::class, 'handleDomainUpdate']);
    Route::post('/webhooks/shopify/domains/update', [ShopifyWebhookController::class, 'handleDomainUpdate']);
    Route::post('/webhooks/shopify/domains/destroy', [ShopifyWebhookController::class, 'handleDomainDestroy']);
    Route::get('/test', function () {
        return response()->json([
            'status' => 'success',
            'message' => 'CORS is working'
        ]);
    });

    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login')->name('login');
    Route::post('/login/send-otp', [AuthController::class, 'sendLoginOtp'])->middleware('throttle:login');
    Route::post('/login/verify-otp', [AuthController::class, 'verifyLoginOtp'])->middleware('throttle:login');
    Route::post('/auth/google', [AuthController::class, 'googleLogin']);

    Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])
        ->middleware('guest')
        ->name('password.email');

    Route::post('/reset-password', [NewPasswordController::class, 'store'])
        ->middleware('guest')
        ->name('password.store');

    Route::post('/verify-email', [AuthController::class, 'verifyEmail']);

    Route::post('/email/verification-notification', [EmailVerificationNotificationController::class, 'store'])
        ->middleware(['auth', 'throttle:6,1'])
        ->name('verification.send');

    Route::get('/team-invitations/lookup/{token}', [TeamInvitationController::class, 'lookup']);
    Route::post('/team-invitations/accept/{token}', [TeamInvitationController::class, 'accept']);

    // Razorpay webhook - must be OUTSIDE auth:sanctum (no auth token from Razorpay)
    Route::post('/billing/webhook', [BillingController::class, 'handleWebhook']);

    // ClickUp OAuth Callback - must be OUTSIDE auth:sanctum
    Route::get('/integrations/clickup/callback', [ClickUpIntegrationController::class, 'callback']);

    Route::middleware('auth:sanctum')->group(function () {

        // Dashboard Stats
        Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
        Route::post('/dashboard/default-region', [DashboardController::class, 'updateDefaultRegion']);

        Route::post('/contact-sales', [ContactSalesController::class, 'contact']);
        // Onboarding Settings
        Route::get('/onboarding/data', [OnboardingController::class, 'getOnboardingData']);
        Route::post('/onboarding/data', [OnboardingController::class, 'saveOnboardingData']);

        Route::post('/billing/subscribe', [BillingController::class, 'subscribe']);
        Route::get('/billing/plans', [BillingController::class, 'plans']);
        Route::post('/billing/cancel', [BillingController::class, 'cancel']);
        Route::post('/billing/retry', [BillingController::class, 'retryPayment']);
        Route::get('/billing/transactions', [BillingController::class, 'transactionHistory']);

        Route::post('/broadcasting/auth', [BroadcastController::class, 'authenticate']);

        // Domain Monitoring & Integrations
        Route::get('/domains', [DomainController::class, 'index']);
        Route::get('/monitoring-regions', function () {
            return response()->json([
                'data' => \App\Models\MonitoringRegion::where('is_active', true)->get(['aws_region', 'name'])
            ]);
        });
        Route::get('/domains/{domain_id}/status-stats', [DomainStatusStatsController::class, 'show']);
        Route::get('/domains/{domain_id}/regional-status', [DomainStatusStatsController::class, 'regionalStatus']);
        Route::get('/domains/{domain_id}/response-stats', [DomainResponseStatsController::class, 'show']);
        Route::get('/domains/{domain_id}/analysis', [DomainAnalysisController::class, 'show']);
        Route::get('/domains/{domain_id}/integrations', [CompanyIntegrationController::class, 'show']);

        // SSL Monitoring
        Route::get('/ssl-monitoring', [SslMonitoringController::class, 'index']);
        Route::get('/ssl-monitoring/{domain_ulid}', [SslMonitoringController::class, 'show']);

        Route::get('/company/integrations', [CompanyIntegrationController::class, 'show']);

        // Workspaces & Team
        Route::get('/workspaces', [WorkspaceController::class, 'index']);
        Route::post('/workspaces', [WorkspaceController::class, 'store']);
        Route::delete('/workspaces/current', [WorkspaceController::class, 'destroy']);
        Route::get('/workspaces/plan-info', [WorkspaceController::class, 'planInfo']);
        Route::post('/workspaces/{workspace_ulid}/switch', [AuthController::class, 'switchWorkspace']);
        Route::post('/workspaces/rename', [WorkspaceController::class, 'rename']);
        Route::put('/workspaces/developer-webhooks/toggle', [WorkspaceController::class, 'toggleDeveloperWebhooks']);
        Route::get('/team-invitations', [TeamInvitationController::class, 'index']);
        Route::get('/team/members', [TeamMemberController::class, 'index']);

        // Status Pages
        Route::get('/status-pages', [StatusPageController::class, 'index']);
        Route::post('/status-pages', [StatusPageController::class, 'store']);
        Route::get('/status-pages/{ulid}', [StatusPageController::class, 'show']);
        Route::put('/status-pages/{ulid}', [StatusPageController::class, 'update']);
        Route::delete('/status-pages/{ulid}', [StatusPageController::class, 'destroy']);

        Route::get('/domains/{domain_id}/integrations/{integration_ulid}/webhooks', [CompanyIntegrationController::class, 'integrationWebhooks']);

        // Telegram Integration
        Route::post('/domains/{domain_id}/integrations/telegram/connect', [TelegramIntegrationController::class, 'connect']);
        Route::get('/integrations/telegram/status/{token}', [TelegramIntegrationController::class, 'status']);

        // Incident Reporting API (protected by auth:sanctum)
        Route::get('/incidents', [IncidentController::class, 'index']);
        Route::get('/incidents/{id}', [IncidentController::class, 'show']);
        Route::post('/incidents/{id}/resolve', [IncidentController::class, 'resolve']);
        Route::post('/incidents/{id}/chat', [IncidentController::class, 'chat']);
        Route::post('/incidents/{id}/chat-stream', [IncidentController::class, 'chatStream']);
        Route::get('/incidents/{id}/get-chat', [IncidentController::class, 'getChat']);
        Route::get('/incidents/{incident}/screenshot-url', [IncidentController::class, 'screenshotUrl']);
        Route::get('/incidents/{id}/download-pdf', [IncidentController::class, 'downloadPdf']);
        Route::get('/incidents-report/download', [IncidentController::class, 'downloadAllPdf']);
        Route::get('/incidents-report/download-csv', [IncidentController::class, 'downloadAllCsv']);

        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead']);
        Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::get('/logs/system', [SystemLogController::class, 'index']);
        Route::get('/logs/audit', [AuditLogController::class, 'index']);

        // SMS Notification Settings (multi-config per workspace)
        Route::get('/sms-settings', [SmsSettingsController::class, 'index']);
        Route::get('/sms-settings/credits', [SmsSettingsController::class, 'credits']);
        Route::post('/sms-settings', [SmsSettingsController::class, 'store']);
        Route::post('/sms-settings/send-otp', [SmsSettingsController::class, 'sendOtp']);
        Route::post('/sms-settings/verify-otp', [SmsSettingsController::class, 'verifyOtp']);
        Route::post('/sms-settings/resend-otp', [SmsSettingsController::class, 'resendOtp']);
        Route::put('/sms-settings/{id}', [SmsSettingsController::class, 'update']);
        Route::delete('/sms-settings/{id}', [SmsSettingsController::class, 'destroy']);
        Route::post('/sms-settings/{id}/test', [SmsSettingsController::class, 'test']);

        // WhatsApp Notification Settings (multi-config per workspace)
        Route::get('/whatsapp-settings', [WhatsAppSettingsController::class, 'index']);
        Route::get('/whatsapp-settings/credits', [WhatsAppSettingsController::class, 'credits']);
        Route::post('/whatsapp-settings', [WhatsAppSettingsController::class, 'store']);
        Route::post('/whatsapp-settings/send-otp', [WhatsAppSettingsController::class, 'sendOtp']);
        Route::post('/whatsapp-settings/verify-otp', [WhatsAppSettingsController::class, 'verifyOtp']);
        Route::post('/whatsapp-settings/resend-otp', [WhatsAppSettingsController::class, 'resendOtp']);
        Route::put('/whatsapp-settings/{id}', [WhatsAppSettingsController::class, 'update']);
        Route::delete('/whatsapp-settings/{id}', [WhatsAppSettingsController::class, 'destroy']);
        Route::post('/whatsapp-settings/{id}/test', [WhatsAppSettingsController::class, 'test']);

        // Facebook Ads API
        Route::get('/integrations/facebook/ads', [FacebookIntegrationController::class, 'listAds']);
        Route::post('/integrations/facebook/ads/{id}/status', [FacebookIntegrationController::class, 'setAdStatus']);
        Route::post('/integrations/facebook/ads/status/{workspace_ulid}', [FacebookIntegrationController::class, 'checkStatus']);
        Route::post('/integrations/facebook/get-all-accounts/{workspace_ulid}', [FacebookIntegrationController::class, 'listFbAccounts']);
        Route::delete('/integrations/facebook/{ulid}', [FacebookIntegrationController::class, 'disconnect']);

        // Google Ads API
        Route::get('/integrations/google-ads/connect', [GoogleIntegrationController::class, 'connect']);

        // Domain Facebook Assignments (read-only for non-managers)
        Route::get('/domains/{domainId}/facebook-assignments', [DomainFacebookAssignmentController::class, 'index']);
        Route::get('/domains/{domainId}/facebook-assignments/integrations', [DomainFacebookAssignmentController::class, 'availableIntegrations']);
        Route::get('/domains/{domainId}/facebook-assignments/available-ads/{integration}', [DomainFacebookAssignmentController::class, 'availableAds']);
        Route::get('/workspace/facebook-assignments', [DomainFacebookAssignmentController::class, 'workspaceIndex']);

        // Domain Google Ads Assignments (read-only for non-managers)
        Route::get('/domains/{domainId}/google-assignments', [DomainGoogleAssignmentController::class, 'index']);
        Route::get('/domains/{domainId}/google-assignments/integrations', [DomainGoogleAssignmentController::class, 'availableIntegrations']);
        Route::get('/domains/{domainId}/google-assignments/available-campaigns/{integration}', [DomainGoogleAssignmentController::class, 'availableCampaigns']);

        // User Profile & Preferences
        Route::put('/user/profile', [AuthController::class, 'updateUserInfo']);
        Route::delete('/user/profile', [AuthController::class, 'deleteAccount']);
        Route::delete('/user', [AuthController::class, 'deleteAccount']);
        Route::get('/user/email-preferences', [EmailPreferenceController::class, 'show']);
        Route::put('/user/email-preferences', [EmailPreferenceController::class, 'update']);
        Route::get('/workspaces/integrations', [CompanyIntegrationController::class, 'workspaceIntegrations']);

        Route::middleware('can-manage-company')->group(function () {
            Route::post('/domains/fetch-title', [DomainController::class, 'fetchTitle']);
            Route::post('/domains/{domain}/analysis/reanalyze', [DomainAnalysisController::class, 'reanalyze']);
            Route::post('/domains', [DomainController::class, 'store']);
            Route::put('/domains/{domain_ulid}', [DomainController::class, 'update']);
            Route::delete('/domains/{domain_ulid}', [DomainController::class, 'destroy']);

            // Domain Facebook Assignments (write operations)
            Route::post('/domains/{domainId}/facebook-assignments', [DomainFacebookAssignmentController::class, 'store']);
            Route::put('/domains/{domainId}/facebook-assignments', [DomainFacebookAssignmentController::class, 'update']);
            Route::delete('/domains/{domainId}/facebook-assignments', [DomainFacebookAssignmentController::class, 'destroy']);
            Route::post('/domains/{domainId}/facebook-assignments/pause', [DomainFacebookAssignmentController::class, 'pause']);
            Route::post('/domains/{domainId}/facebook-assignments/resume', [DomainFacebookAssignmentController::class, 'resume']);

            // Domain Google Ads Assignments (write operations)
            Route::post('/domains/{domain}/google-assignments', [DomainGoogleAssignmentController::class, 'store']);
            Route::put('/domains/{domain}/google-assignments', [DomainGoogleAssignmentController::class, 'update']);
            Route::delete('/domains/{domain}/google-assignments', [DomainGoogleAssignmentController::class, 'destroy']);
            Route::post('/domains/{domain}/google-assignments/pause', [DomainGoogleAssignmentController::class, 'pause']);
            Route::post('/domains/{domain}/google-assignments/resume', [DomainGoogleAssignmentController::class, 'resume']);

            // AI Training & Analysis
            Route::get('/ai-training/data', [AITrainingController::class, 'generateTrainingData']);
            Route::get('/ai-training/prompt-text', [AITrainingController::class, 'generatePromptText']);

            // Analyze incident error response and store AI analysis
            Route::post('/incidents/{ulid}/analyze', [IncidentController::class, 'analyze']);

            Route::put('/domains/{domain_id}/integrations', [CompanyIntegrationController::class, 'update']);
            Route::post('/integrations/webhooks/{domain_id}', [CompanyIntegrationController::class, 'storeWebhook']);
            Route::put('/integrations/webhooks/{webhook_ulid}', [CompanyIntegrationController::class, 'updateWebhook']);
            Route::delete('/integrations/webhooks/{webhook_ulid}', [CompanyIntegrationController::class, 'destroyWebhook']);
            Route::post('/integrations/webhooks/{webhook_ulid}/test', [CompanyIntegrationController::class, 'testWebhook']);
            Route::get('/integrations/webhooks/{webhook_ulid}', [CompanyIntegrationController::class, 'getWebhook']);

            // Developer Webhooks
            Route::get('/developer-webhooks', [DeveloperWebhookController::class, 'index']);
            Route::post('/developer-webhooks', [DeveloperWebhookController::class, 'store']);
            Route::put('/developer-webhooks/{id}', [DeveloperWebhookController::class, 'update']);
            Route::delete('/developer-webhooks/{id}', [DeveloperWebhookController::class, 'destroy']);
            Route::post('/developer-webhooks/{id}/test', [DeveloperWebhookController::class, 'test'])->middleware('throttle:10,1');
            Route::get('/developer-webhooks/{id}/deliveries', [DeveloperWebhookController::class, 'deliveries']);

            // Integration Deliveries
            Route::get('/integration-deliveries', [IntegrationDeliveryController::class, 'index']);

            Route::put('/workspaces/integrations/{workspace_integration_ulid}', [CompanyIntegrationController::class, 'updateWorkspaceIntegration']);

            Route::put('/domains/integrations/{integration_ulid}', [CompanyIntegrationController::class, 'updateDomainIntegration']);

            Route::post('/domains/integrations/channels/{channel_ulid}/test', [CompanyIntegrationController::class, 'test']);
            // Route::post('/domains/integrations/channels/{id}/slack-test', [CompanyIntegrationController::class, 'slackTest']);

            Route::post('/team-invitations', [TeamInvitationController::class, 'create']);
            Route::delete('/team/members/{memberId}', [TeamMemberController::class, 'destroy']);

            Route::get('/departments', [DepartmentController::class, 'index']);
            Route::post('/departments', [DepartmentController::class, 'store']);
            Route::get('/departments/{department_ulid}', [DepartmentController::class, 'show']);

            Route::get('/departments/{department_ulid}/users', [DepartmentController::class, 'users']);
            Route::post('/departments/{department_ulid}/users', [DepartmentController::class, 'syncUsers']);

            Route::get('/departments/{department_ulid}/pending-invitations', [DepartmentController::class, 'deptPendingInvitations']);

            Route::post('/invitations/{id}/resend', [DepartmentController::class, 'resendInvitation']);
            Route::delete('/invitations/{id}', [DepartmentController::class, 'cancelInvitation']);

            Route::get(
                '/company/users',
                fn(Request $r) =>
                    User::where('workspace_id', $r->user()->workspace_id)
                        ->select('id', 'name', 'email')
                        ->get()
            );

            // Google Ads Integration API Routes
            Route::prefix('integrations/google')->group(function () {
                Route::get('/status', [GoogleIntegrationController::class, 'status']);
                Route::get('/accounts', [GoogleIntegrationController::class, 'getAccounts']);
                Route::get('/accounts/{accountId}/campaigns', [GoogleIntegrationController::class, 'getCampaigns']);
                Route::get('/campaigns/{campaignId}/ads', [GoogleIntegrationController::class, 'getAds']);
                Route::get('/hierarchy', [GoogleIntegrationController::class, 'getHierarchy']);
                Route::post('/sync', [GoogleIntegrationController::class, 'sync']);
                Route::delete('/disconnect', [GoogleIntegrationController::class, 'disconnect']);
            });

            // ClickUp Integration API Routes
            Route::prefix('integrations/clickup')->group(function () {
                Route::get('/connect', [ClickUpIntegrationController::class, 'connect']);
                Route::get('/status', [ClickUpIntegrationController::class, 'status']);
                Route::get('/hierarchy', [ClickUpIntegrationController::class, 'getHierarchy']);
                Route::delete('/disconnect', [ClickUpIntegrationController::class, 'disconnect']);
            });
        });

        Route::post('/logout', [AuthController::class, 'logout']);
    });


    // Public Runtime Configuration (used by frontend without rebuilding images)
    Route::get('/config', function () {
        return response()->json([
            'app_name' => config('app.name', 'Boomerr'),
            'reverb_key' => config('reverb.apps.apps.0.key', env('REVERB_APP_KEY', '')),
            'hcaptcha_site_key' => config('services.hcaptcha.site_key', env('HCAPTCHA_SITE_KEY', '')),
            'billing_enabled' => (bool) config('billing.enabled', env('ENABLE_BILLING', false)),
        ], 200, [
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
        ]);
    });

    // Lightweight Health Check Endpoint for Docker Healthchecks
    Route::get('/health', function () {
        return response()->json([
            'status' => 'ok',
            'timestamp' => now()->toIso8601String(),
        ], 200);
    });

    // routes/api.php
    Route::get('/version.json', function () {
        $file = public_path('version.json');

        if (is_file($file) && is_readable($file)) {
            try {
                $content = json_decode(file_get_contents($file), true);

                if (json_last_error() === JSON_ERROR_NONE) {
                    return response()->json(
                        $content,
                        200,
                        [
                            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
                            'Pragma' => 'no-cache',
                        ]
                    );
                }

                Log::warning('Invalid JSON in public/version.json');
            } catch (\Throwable $e) {
                Log::error('Failed to read version.json file: ' . $e->getMessage());
            }
        }

        return response()->json(
            [
                'version' => config('app.version', 'N/A'),
                'builtAt' => now()->toIso8601String(),
            ],
            200,
            [
                'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma' => 'no-cache',
            ]
        );
    });
});

// Public Tools Routes
Route::prefix('tools')->middleware('throttle:20,1')->group(function () {
    Route::get('/dns-records', [DnsRecordController::class, 'check']);
    Route::get('/dns-propagation', [DnsPropagationController::class, 'check']);
    Route::get('/ssl-checker', [SslCheckerController::class, 'check']);
    Route::get('/uptime-checker', [UptimeCheckerController::class, 'check']);
    Route::get('/ad-landing-page-checker', [AdLandingPageCheckerController::class, 'check']);
    Route::get('/shopify-detector', [ShopifyDetectorController::class, 'check']);
    Route::get('/badge', [BadgeGeneratorController::class, 'generate']);
});

