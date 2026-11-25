<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserIntegration;
use App\Models\Workspace;
use App\Services\FacebookAdsAssignmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use App\Models\DomainFacebookAssignment;

class FacebookIntegrationController extends Controller
{
    private ?FacebookAdsAssignmentService $assignmentService = null;

    public function __construct(
        private readonly FacebookAdsAssignmentService $assignmentServiceArg
    ) {
        try {
            $this->assignmentService = $assignmentServiceArg;
        } catch (\Throwable $e) {
            Log::error('FacebookIntegrationController constructor failed: ' . $e->getMessage());
            $this->assignmentService = null;
        }
    }
    public function connect(Request $request)
    {
        try {
            // Optional server-side connect; not strictly needed if frontend opens FB directly
            $user = Auth::user();
            $frontend = config('app.frontend_url', env('FRONTEND_URL', '/'));

            if ($user instanceof User) {
                $workspace = $user->currentWorkspace();
                if ($workspace && !\App\Services\PlanLimitService::hasIntegration($workspace, 'facebook_ads')) {
                    return redirect(rtrim((string) $frontend, '/') . '/settings/facebook-accounts?fb=plan_restricted');
                }
            }

            $clientId = config('services.facebook.app_id');
            $redirectUri = config('app.url') . '/integrations/facebook/callback';
            if (!$clientId || !$redirectUri) {
                return redirect(rtrim((string) $frontend, '/') . '/settings/facebook-accounts?fb=error');
            }
            $scope = implode(',', [
                'ads_read',
                'ads_management',
                'business_management',
                'pages_read_engagement',
            ]);
            $state = (string) ($user instanceof User ? $user->id : $request->string('state')->toString());
            if (!$state) {
                return redirect(rtrim((string) $frontend, '/') . '/settings/facebook-accounts?fb=error');
            }
            $params = http_build_query([
                'client_id' => $clientId,
                'redirect_uri' => $redirectUri,
                'response_type' => 'code',
                'scope' => $scope,
                'state' => $state,
            ]);
            return redirect('https://www.facebook.com/v22.0/dialog/oauth?' . $params);
        } catch (\Throwable $e) {
            Log::error('Facebook connect failed: ' . $e->getMessage());
            $frontend = config('app.frontend_url', env('FRONTEND_URL', '/'));
            return redirect(rtrim((string) $frontend, '/') . '/settings/facebook-accounts?fb=error');
        }
    }

    public function callback(Request $request)
    {
        try {
            $frontend = config('app.frontend_url', env('FRONTEND_URL', '/'));

            $error = $request->string('error')->toString();
            $code  = $request->string('code')->toString();
            $state = $request->string('state')->toString();

            if ($error) {
                Log::error('Facebook OAuth callback returned error', [
                    'error' => $error,
                    'error_reason' => $request->string('error_reason')->toString(),
                    'error_description' => $request->string('error_description')->toString(),
                ]);
                return redirect(rtrim($frontend, '/') . '/settings/facebook-accounts?fb=denied');
            }

            if (!$code || !$state) {
                Log::error('Facebook OAuth callback missing code or state', [
                    'code' => $code,
                    'state' => $state,
                ]);
                return redirect(rtrim($frontend, '/') . '/settings/facebook-accounts?fb=error');
            }

            $user = Auth::user();

            if (!($user instanceof User)) {
                $user = User::where('ulid', $state)->first();
            }

            if (!($user instanceof User) || (string) $user->ulid !== $state) {
                return redirect(rtrim($frontend, '/') . '/settings/facebook-accounts?fb=error');
            }

            $workspace = $user->currentWorkspace();
            if ($workspace && !\App\Services\PlanLimitService::hasIntegration($workspace, 'facebook_ads')) {
                return redirect(rtrim($frontend, '/') . '/settings/facebook-accounts?fb=plan_restricted');
            }

            $appId       = config('services.facebook.app_id');
            $appSecret   = config('services.facebook.app_secret');
            $redirectUri = config('services.facebook.redirect_uri') ?? (config('app.url') . '/integrations/facebook/callback');

            if (!$appId || !$appSecret || !$redirectUri) {
                Log::error('Facebook OAuth configuration missing', [
                    'app_id' => (bool) $appId,
                    'app_secret' => (bool) $appSecret,
                    'redirect_uri' => (bool) $redirectUri,
                ]);
                return redirect(rtrim($frontend, '/') . '/settings/facebook-accounts?fb=error');
            }

            $fbApiUrl = rtrim(
                config('services.facebook.api_url', 'https://graph.facebook.com/v22.0'),
                '/'
            );

            /** ------------------------------------------------------------
             * STEP 1: Exchange code → short token
             * ------------------------------------------------------------ */
            $tokenRes = Http::get("{$fbApiUrl}/oauth/access_token", [
                'client_id'     => $appId,
                'redirect_uri'  => $redirectUri,
                'client_secret' => $appSecret,
                'code'          => $code,
            ]);

            if (!$tokenRes->ok()) {
                Log::error('FB short token exchange failed', [
                    'status' => $tokenRes->status(),
                    'body' => $tokenRes->json(),
                ]);
                return redirect(rtrim($frontend, '/') . '/settings/facebook-accounts?fb=error');
            }

            $shortToken = $tokenRes->json('access_token');

            /** ------------------------------------------------------------
             * STEP 2: Exchange → long-lived token
             * ------------------------------------------------------------ */
            $llRes = Http::get("{$fbApiUrl}/oauth/access_token", [
                'grant_type'        => 'fb_exchange_token',
                'client_id'         => $appId,
                'client_secret'     => $appSecret,
                'fb_exchange_token' => $shortToken,
            ]);

            if (!$llRes->ok()) {
                Log::error('FB long token exchange failed', [
                    'status' => $llRes->status(),
                    'body' => $llRes->json(),
                ]);
                return redirect(rtrim($frontend, '/') . '/settings/facebook-accounts?fb=error');
            }

            $longToken = $llRes->json('access_token') ?? $shortToken;

            /** ------------------------------------------------------------
             * STEP 3: Determine user-selected business & ad account
             * ------------------------------------------------------------ */
            $selection = $this->extractFacebookSelection($request, $appSecret);
            $selectedAdAccountIds = $selection['ad_account_ids'];
            $selectedBusinessIds = $selection['business_ids'];

            /** ------------------------------------------------------------
             * STEP 4: Fetch ad account details with pagination
             * ------------------------------------------------------------ */
            $accounts = [];
            $params = [
                'access_token' => $longToken,
                'fields'       => 'id,name,account_status,business{id,name}',
                'limit'        => 100,
            ];

            try {
                $res = Http::get("{$fbApiUrl}/me/adaccounts", $params);
                if (!$res->ok()) {
                    Log::error('FB ad accounts fetch failed', [
                        'status' => $res->status(),
                        'body' => $res->json(),
                    ]);
                    return redirect(rtrim($frontend, '/') . '/settings/facebook-accounts?fb=error');
                }

                $batch = $res->json('data') ?? [];
                if (is_array($batch)) {
                    $accounts = array_merge($accounts, $batch);
                }

                $paging = $res->json('paging') ?? [];
                $next = is_array($paging) ? ($paging['next'] ?? null) : null;

                // Iterate through pages if available
                $maxPages = 10; // safety cap
                while ($next && $maxPages-- > 0) {
                    $pageRes = Http::get($next);
                    if (!$pageRes->ok()) {
                        break;
                    }
                    $pageData = $pageRes->json('data') ?? [];
                    if (is_array($pageData) && count($pageData) > 0) {
                        $accounts = array_merge($accounts, $pageData);
                    }
                    $paging = $pageRes->json('paging') ?? [];
                    $next = is_array($paging) ? ($paging['next'] ?? null) : null;
                }
            } catch (\Throwable $e) {
                Log::error('FB ad accounts pagination error', [
                    'error' => $e->getMessage(),
                ]);
            }

            $normalizedSelectedAccountIds = $this->normalizeAdAccountIds($selectedAdAccountIds);
            $normalizedSelectedBusinessIds = array_values(array_unique(array_filter(array_map(static fn($id) => (string) $id, $selectedBusinessIds))));

            // If the user granted access to all accounts (no granular target_ids), keep all
            if (empty($normalizedSelectedAccountIds)) {
                $filteredAccounts = $accounts;
                // Optionally narrow by business if provided
                if (!empty($normalizedSelectedBusinessIds)) {
                    $filteredAccounts = array_values(array_filter($filteredAccounts, function ($account) use ($normalizedSelectedBusinessIds) {
                        $businessId = isset($account['business']['id']) ? (string) $account['business']['id'] : null;
                        return $businessId !== null && in_array($businessId, $normalizedSelectedBusinessIds, true);
                    }));
                }
            } else {
                // Only keep selected accounts
                $filteredAccounts = array_values(array_filter($accounts, function ($account) use ($normalizedSelectedAccountIds, $normalizedSelectedBusinessIds, $selectedAdAccountIds) {
                    if (!is_array($account) || empty($account['id'])) {
                        return false;
                    }

                    $accountId = (string) $account['id'];
                    $normalizedAccountId = $this->normalizeAdAccountId($accountId);

                    $matchesAccount = in_array($normalizedAccountId, $normalizedSelectedAccountIds, true)
                        || in_array($accountId, $selectedAdAccountIds, true);

                    if (!$matchesAccount) {
                        return false;
                    }

                    if (!empty($normalizedSelectedBusinessIds)) {
                        $businessId = isset($account['business']['id']) ? (string) $account['business']['id'] : null;

                        return $businessId !== null && in_array($businessId, $normalizedSelectedBusinessIds, true);
                    }

                    return true;
                }));
            }

            if (!empty($normalizedSelectedAccountIds) && empty($filteredAccounts)) {
                Log::warning('FB selected ad account not returned for user', [
                    'selected_ad_accounts' => $selectedAdAccountIds,
                ]);

                return redirect(rtrim($frontend, '/') . '/settings/facebook-accounts?fb=error');
            }

            if (empty($filteredAccounts)) {
                return redirect(rtrim($frontend, '/') . '/settings/facebook-accounts?fb=no_accounts');
            }

            $grantedScopes = $request->input('granted_scopes');
            $grantedScopesArray = [];
            if (is_string($grantedScopes)) {
                $grantedScopesArray = array_filter(array_map('trim', explode(',', $grantedScopes)));
            } elseif (is_array($grantedScopes)) {
                $grantedScopesArray = array_values(array_filter(array_map('strval', $grantedScopes)));
            }

            /** ------------------------------------------------------------
             * STEP 5: Persist a single integration per selected ad account
             * ------------------------------------------------------------ */
            foreach ($filteredAccounts as $account) {
                $accountId = (string) ($account['id'] ?? '');
                if ($accountId === '') {
                    continue;
                }

                $integrationAttributes = [
                    'workspace_id' => $user->workspace_id,
                    'provider'     => 'facebook_ads',
                    'account_id'   => $accountId,
                ];

                $metaPayload = [
                    'account' => $account,
                    'selection' => [
                        'ad_account_ids' => $selectedAdAccountIds,
                        'business_ids' => $selectedBusinessIds,
                    ],
                    'granted_scopes' => $grantedScopesArray,
                    'token_info' => [
                        'obtained_at' => now()->toIso8601String(),
                        'type' => 'long_lived_user_access_token',
                    ],
                ];

                $metaJson = json_encode($metaPayload);

                if ($metaJson === false) {
                    Log::warning('FB integration meta could not be encoded', [
                        'account_id' => $accountId,
                    ]);
                    continue;
                }

                UserIntegration::updateOrCreate(
                    $integrationAttributes,
                    [
                        'user_id'      => $user->id,
                        'access_token' => Crypt::encryptString($longToken),
                        'meta_json'    => $metaJson,
                        'status'       => 'active',
                        'connected_at' => now(),
                    ]
                );
            }

            return redirect(rtrim($frontend, '/') . '/settings/facebook-accounts?fb=success');
        } catch (\Throwable $e) {
            $frontend = config('app.frontend_url', env('FRONTEND_URL', '/'));
            Log::error('Facebook OAuth callback error', [
                'error' => $e->getMessage(),
                'trace' => Str::limit($e->getTraceAsString(), 1000),
            ]);

            return redirect(rtrim($frontend, '/') . '/settings/facebook-accounts?fb=error');
        }
    }

    public function listAds(Request $request)
    {
        try {
            $user = $request->user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            if (!$user->canManageCompanyResources()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $integrationUlid = $request->string('integration_ulid')->toString();
            $accountIdParam = $request->string('account_id')->toString();

            $integrationsQuery = UserIntegration::where('workspace_id', $user->workspace_id)
                ->where('provider', 'facebook_ads')
                ->where('status', 'active');

            if ($integrationUlid) {
                $integrationsQuery->where('ulid', $integrationUlid);
            } elseif ($accountIdParam) {
                $integrationsQuery->where('account_id', $accountIdParam);
            }

            $integrations = $integrationsQuery->get();
            if ($integrations->isEmpty()) {
                return response()->json(['data' => [], 'message' => 'Not connected'], 200);
            }

            try {
                $fbApiUrl = rtrim(config('services.facebook.api_url', env('FACEBOOK_API_URL', 'https://graph.facebook.com/v22.0')), '/');
                $groups = [];
                $seenAccountIds = [];

                foreach ($integrations as $integration) {
                    try {
                        $accountId = $integration->account_id;
                        if (!$accountId || isset($seenAccountIds[$accountId])) {
                            continue;
                        }
                        $seenAccountIds[$accountId] = true;

                        $token = Crypt::decryptString($integration->access_token);

                        $adsRes = Http::get("{$fbApiUrl}/{$accountId}/ads", [
                            'access_token' => $token,
                            'fields' => 'id,name,adlabels,status,effective_status,configured_status,adset{id,name},campaign{id,name,status}',
                            'limit' => 100,
                        ]);

                        if (!$adsRes->ok()) {
                            $errorPayload = $adsRes->json('error');
                            if (!is_array($errorPayload)) {
                                $errorPayload = [];
                            }

                            Log::warning('FB list ads failed', [
                                'account_id' => $accountId,
                                'status' => $adsRes->status(),
                                'body' => $adsRes->body(),
                                'error' => $errorPayload,
                            ]);

                            if ($this->shouldRevokeIntegrationForGraphError($errorPayload)) {
                                Log::info('Revoking Facebook integration because access token is invalid', [
                                    'integration_id' => $integration->id,
                                    'account_id' => $accountId,
                                    'error' => $errorPayload,
                                ]);
                                $this->revokeIntegration($integration, [
                                    'reason' => 'graph_invalid_token',
                                    'account_id' => $accountId,
                                    'error' => $errorPayload,
                                ]);
                                continue;
                            }

                            $ads = [];
                        } else {
                            $ads = $adsRes->json('data') ?? [];

                            // Keep assignment original_status in sync with fetched ad/campaign statuses
                            try {
                                foreach ($ads as $ad) {
                                    $adId = $ad['id'] ?? null;
                                    $adStatusRaw = $ad['configured_status'] ?? $ad['status'] ?? $ad['effective_status'] ?? null;

                                    if ($adId && $adStatusRaw !== null) {
                                        $newAdStatus = is_string($adStatusRaw) ? strtoupper($adStatusRaw) : $adStatusRaw;
                                        DomainFacebookAssignment::where('user_integration_id', $integration->id)
                                            ->where('facebook_entity_id', $adId)
                                            ->where(function ($q) use ($newAdStatus) {
                                                $q->whereNull('original_status')
                                                  ->orWhere('original_status', '!=', $newAdStatus);
                                            })
                                            ->update(['original_status' => $newAdStatus]);
                                    }

                                    // If ad contains campaign info, sync campaign status to assignments tied to that campaign
                                    $campaign = $ad['campaign'] ?? null;
                                    if (is_array($campaign) && !empty($campaign['id'])) {
                                        $campaignId = (string) $campaign['id'];
                                        $campaignStatusRaw = $campaign['status'] ?? null;
                                        if ($campaignStatusRaw !== null) {
                                            $newCampaignStatus = is_string($campaignStatusRaw) ? strtoupper($campaignStatusRaw) : $campaignStatusRaw;
                                            DomainFacebookAssignment::where('user_integration_id', $integration->id)
                                                ->where(function ($q) use ($campaignId) {
                                                    $q->where('facebook_entity_id', $campaignId)
                                                      ->orWhere('campaign_id', $campaignId);
                                                })
                                                ->where(function ($q) use ($newCampaignStatus) {
                                                    $q->whereNull('original_status')
                                                      ->orWhere('original_status', '!=', $newCampaignStatus);
                                                })
                                                ->update(['original_status' => $newCampaignStatus]);
                                        }
                                    }
                                }
                            } catch (\Throwable $e) {
                                Log::warning('Failed to sync FB ad/campaign status to assignments', [
                                    'integration_id' => $integration->id,
                                    'account_id' => $accountId,
                                    'error' => $e->getMessage(),
                                ]);
                            }
                        }

                        $meta = [];
                        if (!empty($integration->meta_json)) {
                            $meta = json_decode($integration->meta_json, true) ?: [];
                        }

                        $groups[] = [
                            'integration_id' => $integration->id,
                            'integration_ulid' => $integration->ulid,
                            'account_id' => $accountId,
                            'account' => $meta['account'] ?? null,
                            'ads' => $ads,
                        ];
                    } catch (\Throwable $e) {
                        Log::error('Facebook listAds error for integration', [
                            'integration_id' => $integration->id ?? null,
                            'account_id' => $integration->account_id ?? null,
                            'error' => $e->getMessage(),
                        ]);

                        $groups[] = [
                            'integration_id' => $integration->id ?? null,
                            'integration_ulid' => $integration->ulid ?? null,
                            'account_id' => $integration->account_id ?? null,
                            'account' => null,
                            'ads' => [],
                            'error' => $e->getMessage(),
                        ];
                    }
                }

                return response()->json(['data' => $groups]);
            } catch (\Throwable $e) {
                Log::error('Facebook listAds error: ' . $e->getMessage());
                return response()->json(['message' => 'Server error'], 500);
            }
        } catch (\Throwable $e) {
            Log::error('Facebook listAds failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    public function setAdStatus(Request $request, string $campaignId)
    {
        try {
            $user = $request->user();

            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            if (!$user->canManageCompanyResources()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $validated = $request->validate([
                'enabled' => ['required', 'boolean'],
            ]);

            $integration = UserIntegration::where('workspace_id', $user->workspace_id)
                ->where('provider', 'facebook_ads')
                ->where('account_id', $request->fb_account_id)
                ->where('status', 'active')
                ->first();

            if (!$integration) {
                return response()->json(['message' => 'Not connected'], 422);
            }

            if (!$this->assignmentService) {
                Log::error('Facebook assignmentService is not initialized');
                return response()->json(['message' => 'Service unavailable'], 500);
            }

            $result = $this->assignmentService->setAdStatus(
                $integration,
                $campaignId,
                $validated['enabled']
            );

            if (!$result['success']) {
                return response()->json([
                    'message' => $result['message'] ?? 'Failed to update ad status',
                    'error' => $result['response'] ?? null,
                ], $result['status'] ?? 500);
            }

            return response()->json([
                'message' => 'Updated',
                'data' => $result['data'],
            ]);
        } catch (\Throwable $e) {
            Log::error('Facebook setAdStatus failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    public function checkStatus(Request $request, string $workspace_ulid)
    {
        try {
            $user = $request->user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            if (!$user->canManageCompanyResources()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $workspace = Workspace::where('ulid', $workspace_ulid)->first();
            if (! $workspace) {
                return response()->json(['message' => 'Workspace not found'], 404);
            }

            $integration = UserIntegration::where('workspace_id', $workspace->id)
                ->where('provider', 'facebook_ads')
                ->where('status', 'active')
                ->first();
            if (!$integration) {
                return response()->json(['message' => 'Not connected', 'isConnected' => false], 200);
            } else {
                return response()->json(['message' => 'Connected', 'isConnected' => true], 200);
            }
        } catch (\Throwable $e) {
            Log::error('Facebook checkStatus failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    public function listFbAccounts(Request $request, string $workspace_ulid)
    {
        try {
            $user = $request->user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            if (!$user->canManageCompanyResources()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $workspace = Workspace::where('ulid', $workspace_ulid)->first();
            if (! $workspace) {
                return response()->json(['message' => 'Workspace not found'], 404);
            }

            $integrations = UserIntegration::where('workspace_id', $workspace->id)
                ->where('provider', 'facebook_ads')
                ->where('status', 'active')
                ->orderByDesc('connected_at')
                ->get()
                ->unique('account_id')
                ->values();

            return response()->json(['data' => $integrations]);
        } catch (\Throwable $e) {
            Log::error('Facebook listFbAccounts failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    public function disconnect(Request $request, string $ulid)
    {
        try {
            $user = $request->user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }
            if (!$user->canManageCompanyResources()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $integration = UserIntegration::where('workspace_id', $user->workspace_id)
                ->where('ulid', $ulid)
                ->first();

            if (!$integration) {
                return response()->json(['message' => 'Integration not found'], 404);
            }

            $token = null;

            if (!empty($integration->access_token)) {
                try {
                    $token = Crypt::decryptString($integration->access_token);
                } catch (\Throwable $e) {
                    Log::warning('FB integration token decrypt failed', [
                        'integration_ulid' => $integration->ulid,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            if ($token) {
                $fbApiUrl = rtrim(
                    config('services.facebook.api_url', env('FACEBOOK_API_URL', 'https://graph.facebook.com/v22.0')),
                    '/'
                );

                try {
                    $revokeResponse = Http::delete("{$fbApiUrl}/me/permissions", [
                        'access_token' => $token,
                    ]);

                    if (!$revokeResponse->ok()) {
                        Log::warning('FB revoke permissions failed', [
                            'integration_ulid' => $integration->ulid,
                            'status' => $revokeResponse->status(),
                            'body' => $revokeResponse->json(),
                        ]);
                    }
                } catch (\Throwable $e) {
                    Log::error('FB revoke permissions threw exception', [
                        'integration_ulid' => $integration->ulid,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $this->revokeIntegration($integration, ['reason' => 'user_disconnect']);

            return response()->json(['message' => 'Disconnected successfully']);
        } catch (\Throwable $e) {
            Log::error('Facebook disconnect failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    private function revokeIntegration(UserIntegration $integration, array $context = []): void
    {
        try {
            if ($integration->status === 'revoked') {
                return;
            }

            $meta = [];
            if (!empty($integration->meta_json)) {
                $decodedMeta = json_decode($integration->meta_json, true);
                if (is_array($decodedMeta)) {
                    $meta = $decodedMeta;
                }
            }

            $tokenInfo = $meta['token_info'] ?? [];
            $tokenInfo['revoked_at'] = now()->toIso8601String();
            if (!empty($context['reason'])) {
                $tokenInfo['revoked_reason'] = $context['reason'];
            }
            if (!empty($context['account_id'])) {
                $tokenInfo['revoked_account_id'] = $context['account_id'];
            }
            if (!empty($context['error'])) {
                $tokenInfo['revoked_error'] = $context['error'];
            }

            $meta['token_info'] = $tokenInfo;

            $integration->status = 'revoked';
            $integration->access_token = null;
            $integration->meta_json = json_encode($meta) ?: null;
            $integration->save();
        } catch (\Throwable $e) {
            Log::error('Facebook revokeIntegration failed: ' . $e->getMessage());
        }
    }

    private function shouldRevokeIntegrationForGraphError(mixed $error): bool
    {
        try {
            if (!is_array($error)) {
                return false;
            }

            $code = isset($error['code']) ? (int) $error['code'] : null;
            if ($code !== 190) {
                return false;
            }

            $revocableSubcodes = [458, 459, 460, 463, 464, 467];
            $subcode = isset($error['error_subcode']) ? (int) $error['error_subcode'] : null;
            if ($subcode && in_array($subcode, $revocableSubcodes, true)) {
                return true;
            }

            $message = strtolower((string) ($error['message'] ?? ''));
            return Str::contains($message, [
                'error validating access token',
                'session has expired',
                'authorization has been revoked',
                'access token is invalid',
            ]);
        } catch (\Throwable $e) {
            Log::error('Facebook shouldRevokeIntegrationForGraphError failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Extract the user-selected Facebook ad accounts and businesses from the OAuth callback.
     */
    private function extractFacebookSelection(Request $request, string $appSecret): array
    {
        try {
            $adAccountIds = [];
            $businessIds = [];

            $signedRequest = $request->string('signed_request')->toString();

            if ($signedRequest !== '') {
                $decoded = $this->decodeSignedRequest($signedRequest, $appSecret);

                if (is_array($decoded)) {
                    $granularScopes = $decoded['granular_scopes'] ?? [];

                    foreach ($granularScopes as $scopeDefinition) {
                        if (!is_array($scopeDefinition)) {
                            continue;
                        }

                        $scopeName = $scopeDefinition['scope'] ?? null;
                        $targets = $scopeDefinition['target_ids'] ?? $scopeDefinition['target_id'] ?? [];

                        if (is_string($targets)) {
                            $targets = [$targets];
                        } elseif (!is_array($targets)) {
                            $targets = [];
                        }

                        $targets = array_values(array_filter(array_map('strval', $targets)));

                        if (in_array($scopeName, ['ads_management', 'ads_read'], true)) {
                            $adAccountIds = array_merge($adAccountIds, $targets);
                        } elseif ($scopeName === 'business_management') {
                            $businessIds = array_merge($businessIds, $targets);
                        }
                    }
                } else {
                    Log::warning('Facebook signed request verification failed');
                }
            }

            $accountIdParam = $request->input('account_id', $request->input('ad_account_id'));
            if (is_string($accountIdParam) && $accountIdParam !== '') {
                $adAccountIds[] = $accountIdParam;
            } elseif (is_array($accountIdParam)) {
                $adAccountIds = array_merge($adAccountIds, array_values(array_filter(array_map('strval', $accountIdParam))));
            }

            $businessIdParam = $request->input('business_id');
            if (is_string($businessIdParam) && $businessIdParam !== '') {
                $businessIds[] = $businessIdParam;
            } elseif (is_array($businessIdParam)) {
                $businessIds = array_merge($businessIds, array_values(array_filter(array_map('strval', $businessIdParam))));
            }

            return [
                'ad_account_ids' => array_values(array_unique(array_map('strval', $adAccountIds))),
                'business_ids' => array_values(array_unique(array_map('strval', $businessIds))),
            ];
        } catch (\Throwable $e) {
            Log::error('Facebook extractFacebookSelection failed: ' . $e->getMessage());
            return ['ad_account_ids' => [], 'business_ids' => []];
        }
    }

    private function decodeSignedRequest(string $signedRequest, string $appSecret): ?array
    {
        try {
            $parts = explode('.', $signedRequest, 2);
            if (count($parts) !== 2) {
                return null;
            }

            [$encodedSignature, $payload] = $parts;

            $rawSignature = $this->base64UrlDecode($encodedSignature);
            $decodedPayload = $this->base64UrlDecode($payload);

            if ($rawSignature === '' || $decodedPayload === '') {
                return null;
            }

            $data = json_decode($decodedPayload, true);

            if (!is_array($data)) {
                return null;
            }

            $algorithm = strtoupper((string) ($data['algorithm'] ?? ''));
            if ($algorithm !== 'HMAC-SHA256') {
                return null;
            }

            $expectedSignature = hash_hmac('sha256', $payload, $appSecret, true);

            if (!hash_equals($expectedSignature, $rawSignature)) {
                return null;
            }

            return $data;
        } catch (\Throwable $e) {
            Log::error('Facebook decodeSignedRequest failed: ' . $e->getMessage());
            return null;
        }
    }

    private function base64UrlDecode(string $value): string
    {
        try {
            $remainder = strlen($value) % 4;
            if ($remainder > 0) {
                $value .= str_repeat('=', 4 - $remainder);
            }

            $decoded = base64_decode(strtr($value, '-_', '+/'));

            return is_string($decoded) ? $decoded : '';
        } catch (\Throwable $e) {
            Log::error('Facebook base64UrlDecode failed: ' . $e->getMessage());
            return '';
        }
    }

    private function normalizeAdAccountIds(array $ids): array
    {
        try {
            $normalized = [];

            foreach ($ids as $id) {
                if (!is_string($id) && !is_numeric($id)) {
                    continue;
                }

                $stringId = (string) $id;
                if ($stringId === '') {
                    continue;
                }

                $normalized[] = $stringId;

                $stripped = $this->normalizeAdAccountId($stringId);
                if ($stripped !== '') {
                    $normalized[] = $stripped;
                }

                if (stripos($stringId, 'act_') !== 0 && $stripped !== '') {
                    $normalized[] = 'act_' . $stripped;
                }
            }

            return array_values(array_unique(array_filter($normalized)));
        } catch (\Throwable $e) {
            Log::error('Facebook normalizeAdAccountIds failed: ' . $e->getMessage());
            return [];
        }
    }

    private function normalizeAdAccountId(string $accountId): string
    {
        try {
            $normalized = preg_replace('/^act_/i', '', $accountId);

            return is_string($normalized) ? $normalized : $accountId;
        } catch (\Throwable $e) {
            Log::error('Facebook normalizeAdAccountId failed: ' . $e->getMessage());
            return $accountId;
        }
    }
}
