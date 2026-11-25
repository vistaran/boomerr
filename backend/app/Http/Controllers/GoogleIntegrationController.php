<?php

namespace App\Http\Controllers;

use App\Models\GoogleAdsAccount;
use App\Models\GoogleAdsCampaign;
use App\Models\User;
use App\Models\UserIntegration;
use App\Services\GoogleAdsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class GoogleIntegrationController extends Controller
{
    private ?GoogleAdsService $googleAdsService = null;

    public function __construct()
    {
        try {
            $this->googleAdsService = app(GoogleAdsService::class);
        } catch (\Throwable $e) {
            Log::error('GoogleIntegrationController constructor failed: ' . $e->getMessage());
        }
    }

    public function connect(Request $request)
    {
        try {
            $user = Auth::user();
            $clientId = config('services.google_ads.client_id');
            $redirectUri = config('app.url') . '/integrations/google/callback';
            $frontend = config('app.frontend_url', env('FRONTEND_URL', '/'));

            if (!$user || !$clientId || !$redirectUri) {
                if ($request->expectsJson()) {
                    return response()->json(['error' => 'Unauthorized or missing configuration'], 401);
                }
                return redirect(rtrim((string) $frontend, '/') . '/settings/google-accounts?fb=error');
            }

            $workspace = $user->currentWorkspace();
            if ($workspace && !\App\Services\PlanLimitService::hasIntegration($workspace, 'google_ads')) {
                if ($request->expectsJson()) {
                    return response()->json([
                        'error' => 'Your current plan does not support Google Ads integration. Please upgrade.',
                        'error_code' => 'plan_limit_integration'
                    ], 403);
                }
                return redirect(rtrim((string) $frontend, '/') . '/settings/google-accounts?error=plan_limit');
            }

            $oauthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
                'client_id' => $clientId,
                'redirect_uri' => $redirectUri,
                'response_type' => 'code',
                'scope' => 'https://www.googleapis.com/auth/adwords openid email profile',
                'access_type' => 'offline',
                'prompt' => 'consent',
                'state' => (string)$user->id,
            ]);

            if ($request->expectsJson()) {
                return response()->json(['data' => ['oauthUrl' => $oauthUrl]]);
            }

            return redirect($oauthUrl);
        } catch (\Throwable $e) {
            Log::error('Google connect failed: ' . $e->getMessage());
            $frontend = config('app.frontend_url', env('FRONTEND_URL', '/'));
            return redirect(rtrim((string) $frontend, '/') . '/settings/google-accounts?error=server_error');
        }
    }

    public function callback(Request $request)
    {
        try {
            $frontend = config('app.frontend_url', env('FRONTEND_URL', '/'));
            $redirectBase = rtrim((string) $frontend, '/') . '/settings/google-accounts';

            // Check for errors from Google
            $error = $request->string('error')->toString();
            if ($error) {
                Log::error('Google OAuth callback returned error', [
                    'error' => $error,
                    'error_description' => $request->string('error_description')->toString(),
                ]);

                $errorReason = match ($error) {
                    'access_denied' => 'permission_denied',
                    default => 'oauth_failed',
                };

                return redirect($redirectBase . '?status=error&reason=' . $errorReason);
            }

            // Validate required params
            $code = $request->string('code')->toString();
            $state = $request->string('state')->toString();

            if (!$code || !$state) {
                Log::error('Google OAuth callback missing code or state', [
                    'code' => (bool) $code,
                    'state' => (bool) $state,
                ]);
                return redirect($redirectBase . '?status=error&reason=missing_params');
            }

            // Verify state (CSRF protection) - state contains user ID
            $user = Auth::user() ?? User::find((int) $state);
            if (!($user instanceof User) || (string) $user->id !== $state) {
                Log::error('Google OAuth state mismatch', [
                    'state' => $state,
                    'auth_user_id' => Auth::id(),
                ]);
                return redirect($redirectBase . '?status=error&reason=invalid_state');
            }

            $workspace = $user->currentWorkspace();
            if ($workspace && !\App\Services\PlanLimitService::hasIntegration($workspace, 'google_ads')) {
                Log::warning('Google Ads OAuth callback rejected: plan limit', ['workspace_id' => $workspace->id]);
                return redirect($redirectBase . '?status=error&reason=plan_limit');
            }

            // Exchange code for tokens
            $tokenData = $this->googleAdsService->exchangeCodeForTokens($code);

            if (!isset($tokenData['refresh_token'])) {
                Log::error('No refresh token received from Google', [
                    'user_id' => $user->id,
                    'token_keys' => array_keys($tokenData),
                ]);
                return redirect($redirectBase . '?status=error&reason=no_refresh_token');
            }

            // Get user info (email, etc.)
            $userInfo = [];
            if (isset($tokenData['access_token'])) {
                $userInfo = $this->googleAdsService->getUserInfo($tokenData['access_token']);
            }

            // Store the integration
            $integration = $this->googleAdsService->storeIntegration($user, $tokenData, $userInfo);

            Log::info('Google Ads integration created', [
                'user_id' => $user->id,
                'integration_id' => $integration->id,
                'email' => $userInfo['email'] ?? null,
            ]);

            // Sync accounts using the fresh access token from OAuth
            // This avoids an unnecessary token refresh since we just got a fresh token
            try {
                $syncResult = $this->googleAdsService->fullSync($integration, $tokenData['access_token']);
                Log::info('Google Ads sync completed', [
                    'integration_id' => $integration->id,
                    'result' => $syncResult,
                ]);
            } catch (\Exception $e) {
                Log::warning('Google Ads sync failed after OAuth', [
                    'integration_id' => $integration->id,
                    'error' => $e->getMessage(),
                ]);
                // Don't fail the whole OAuth flow if sync fails
            }

            return redirect($redirectBase . '?status=success');
        } catch (\Exception $e) {
            Log::error('Google OAuth callback failed', [
                'error' => $e->getMessage(),
            ]);

            $frontend = config('app.frontend_url', env('FRONTEND_URL', '/'));
            $redirectBase = rtrim((string) $frontend, '/') . '/settings/google-accounts';

            $reason = 'token_error';
            if (str_contains($e->getMessage(), 'invalid_grant')) {
                $reason = 'invalid_grant';
            }

            return redirect($redirectBase . '?status=error&reason=' . $reason);
        }
    }

    /**
     * Get the current user's Google Ads integration status.
     */
    public function status(Request $request)
    {
        try {
            $user = Auth::user();

            $integration = UserIntegration::where('user_id', $user->id)
                ->where('workspace_id', $user->workspace_id)
                ->where('provider', 'google_ads')
                ->first();

            if (!$integration) {
                return response()->json([
                    'isConnected' => false,
                ]);
            }

            $meta = is_array($integration->meta_json)
                ? $integration->meta_json
                : json_decode($integration->meta_json ?? '{}', true);

            return response()->json([
                'isConnected' => true,
                'integration' => [
                    'id' => $integration->id,
                    'ulid' => $integration->ulid,
                    'email' => $meta['email'] ?? null,
                    'name' => $meta['name'] ?? null,
                    'connected_at' => $integration->connected_at?->toIso8601String(),
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Google status failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Get all Google Ads accounts for the user's workspace.
     */
    public function getAccounts(Request $request)
    {
        try {
            $user = Auth::user();

            $integration = UserIntegration::where('user_id', $user->id)
                ->where('workspace_id', $user->workspace_id)
                ->where('provider', 'google_ads')
                ->first();

            if (!$integration) {
                return response()->json(['data' => []]);
            }

            $accounts = GoogleAdsAccount::where('user_integration_id', $integration->id)
                ->where('is_active', true)
                ->get();

            return response()->json([
                'data' => $accounts->map(fn($account) => [
                    'id' => $account->id,
                    'ulid' => $account->ulid,
                    'customer_id' => $account->customer_id,
                    'name' => $account->descriptive_name,
                    'currency' => $account->currency_code,
                    'timezone' => $account->time_zone,
                    'is_manager' => $account->is_manager,
                ]),
            ]);
        } catch (\Throwable $e) {
            Log::error('Google getAccounts failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Get campaigns for a Google Ads account.
     */
    public function getCampaigns(Request $request, int $accountId)
    {
        try {
            $user = Auth::user();

            // Verify the account belongs to the user
            $account = GoogleAdsAccount::where('id', $accountId)
                ->whereHas('userIntegration', function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                        ->where('workspace_id', $user->workspace_id);
                })
                ->first();

            if (!$account) {
                return response()->json(['error' => 'Account not found'], 404);
            }

            $campaigns = GoogleAdsCampaign::where('google_ads_account_id', $account->id)
                ->get();

            return response()->json([
                'data' => $campaigns->map(fn($campaign) => [
                    'id' => $campaign->id,
                    'ulid' => $campaign->ulid,
                    'campaign_id' => $campaign->campaign_id,
                    'name' => $campaign->name,
                    'status' => $campaign->status,
                    'channel_type' => $campaign->advertising_channel_type,
                    'budget_micros' => $campaign->budget_micros,
                    'start_date' => $campaign->start_date?->format('Y-m-d'),
                    'end_date' => $campaign->end_date?->format('Y-m-d'),
                ]),
            ]);
        } catch (\Throwable $e) {
            Log::error('Google getCampaigns failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Get ads for a campaign.
     */
    public function getAds(Request $request, int $campaignId)
    {
        try {
            $user = Auth::user();

            // Verify the campaign belongs to the user
            $campaign = GoogleAdsCampaign::where('id', $campaignId)
                ->whereHas('account.userIntegration', function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                        ->where('workspace_id', $user->workspace_id);
                })
                ->first();

            if (!$campaign) {
                return response()->json(['error' => 'Campaign not found'], 404);
            }

            $ads = $campaign->ads;

            return response()->json([
                'data' => $ads->map(fn($ad) => [
                    'id' => $ad->id,
                    'ulid' => $ad->ulid,
                    'ad_id' => $ad->ad_id,
                    'ad_group_id' => $ad->ad_group_id,
                    'name' => $ad->name,
                    'status' => $ad->status,
                    'type' => $ad->type,
                    'headlines' => $ad->headlines,
                    'descriptions' => $ad->descriptions,
                    'final_urls' => $ad->final_urls,
                ]),
            ]);
        } catch (\Throwable $e) {
            Log::error('Google getAds failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Sync Google Ads data.
     */
    public function sync(Request $request)
    {
        try {
            $user = Auth::user();

            $integration = UserIntegration::where('user_id', $user->id)
                ->where('workspace_id', $user->workspace_id)
                ->where('provider', 'google_ads')
                ->first();

            if (!$integration) {
                return response()->json(['error' => 'No Google Ads integration found'], 404);
            }

            $result = $this->googleAdsService->fullSync($integration);

            return response()->json([
                'message' => 'Sync completed successfully',
                'data' => $result,
            ]);
        } catch (\Exception $e) {
            Log::error('Google Ads sync failed', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Sync failed',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Disconnect Google Ads integration.
     */
    public function disconnect(Request $request)
    {
        try {
            $user = Auth::user();

            $integration = UserIntegration::where('user_id', $user->id)
                ->where('workspace_id', $user->workspace_id)
                ->where('provider', 'google_ads')
                ->first();

            if (!$integration) {
                return response()->json(['error' => 'No Google Ads integration found'], 404);
            }

            $this->googleAdsService->disconnect($integration);

            Log::info('Google Ads integration disconnected', [
                'user_id' => $user->id,
                'integration_id' => $integration->id,
            ]);

            return response()->json([
                'message' => 'Successfully disconnected Google Ads',
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to disconnect Google Ads', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to disconnect',
            ], 500);
        }
    }

    /**
     * Get full hierarchy: accounts → campaigns → ads.
     */
    public function getHierarchy(Request $request)
    {
        try {
            $user = Auth::user();

            $integration = UserIntegration::where('user_id', $user->id)
                ->where('workspace_id', $user->workspace_id)
                ->where('provider', 'google_ads')
                ->first();

            if (!$integration) {
                return response()->json(['data' => []]);
            }

            $accounts = GoogleAdsAccount::where('user_integration_id', $integration->id)
                ->where('is_active', true)
                ->with(['campaigns.ads'])
                ->get();

            return response()->json([
                'data' => $accounts->map(fn($account) => [
                    'id' => $account->id,
                    'ulid' => $account->ulid,
                    'customer_id' => $account->customer_id,
                    'name' => $account->descriptive_name,
                    'currency' => $account->currency_code,
                    'timezone' => $account->time_zone,
                    'is_manager' => $account->is_manager,
                    'campaigns' => $account->campaigns->map(fn($campaign) => [
                        'id' => $campaign->id,
                        'ulid' => $campaign->ulid,
                        'campaign_id' => $campaign->campaign_id,
                        'name' => $campaign->name,
                        'status' => $campaign->status,
                        'channel_type' => $campaign->advertising_channel_type,
                        'ads' => $campaign->ads->map(fn($ad) => [
                            'id' => $ad->id,
                            'ulid' => $ad->ulid,
                            'ad_id' => $ad->ad_id,
                            'name' => $ad->name,
                            'status' => $ad->status,
                            'type' => $ad->type,
                        ]),
                    ]),
                ]),
            ]);
        } catch (\Throwable $e) {
            Log::error('Google getHierarchy failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }
}
