<?php

namespace App\Services;

use App\Models\GoogleAdsAccount;
use App\Models\GoogleAdsAd;
use App\Models\GoogleAdsCampaign;
use App\Models\User;
use App\Models\UserIntegration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GoogleAdsService
{
    private const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
    private const ADS_API_BASE = 'https://googleads.googleapis.com/v23';
    private const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

    private ?string $clientId;
    private ?string $clientSecret;
    private string $developerToken;
    private string $redirectUri;

    public function __construct()
    {
        $this->clientId = config('services.google_ads.client_id');
        $this->clientSecret = config('services.google_ads.client_secret');
        $this->developerToken = (string) (config('services.google_ads.developer_token') ?? '');
        $this->redirectUri = (config('app.url') . '/integrations/google/callback');

        // Validate developer token is configured
        if (empty($this->developerToken)) {
            Log::warning('Google Ads Developer Token is not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN in .env');
        }
    }

    /**
     * Extract MCC ID from an integration's meta_json.
     */
    public function getMccIdFromIntegration(UserIntegration $integration): ?string
    {
        $meta = is_array($integration->meta_json)
            ? $integration->meta_json
            : json_decode($integration->meta_json ?? '{}', true);

        return $meta['mcc_customer_id'] ?? null;
    }

    /**
     * Store MCC ID in an integration's meta_json.
     */
    public function setMccIdOnIntegration(UserIntegration $integration, string $mccId): void
    {
        $meta = is_array($integration->meta_json)
            ? $integration->meta_json
            : json_decode($integration->meta_json ?? '{}', true);

        $meta['mcc_customer_id'] = preg_replace('/[^0-9]/', '', $mccId);

        $integration->update(['meta_json' => json_encode($meta)]);
    }

    /**
     * Perform a Google Ads API request with standardized headers, retry, timeout, and error handling.
     *
     * @param string $accessToken OAuth 2.0 access token
     * @param string $method HTTP method (GET or POST)
     * @param string $path API endpoint path
     * @param array|object $body Request body for POST requests
     * @param array $extraHeaders Additional headers to include
     * @param string|null $mccId The MCC (Manager) customer ID for login-customer-id header (null = don't include)
     */
    private function adsRequest(
        string $accessToken,
        string $method,
        string $path,
        array|object $body = [],
        array $extraHeaders = [],
        ?string $mccId = null
    ): \Illuminate\Http\Client\Response {
        $this->validateDeveloperToken();

        if (empty($accessToken)) {
            throw new \Exception('Access token is empty');
        }

        $url = rtrim(self::ADS_API_BASE, '/') . $path;

        // Extract customerId from URL path (e.g., /customers/1234567890/...)
        preg_match('/customers\/(\d+)/', $path, $matches);
        $requestCustomerId = $matches[1] ?? null;

        // Normalize MCC ID: strip hyphens and whitespace
        $normalizedMccId = $mccId ? preg_replace('/[^0-9]/', '', $mccId) : null;

        $headers = [
            'Authorization' => 'Bearer ' . $accessToken,
            'developer-token' => $this->developerToken,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];

        /**
         * login-customer-id header rules:
         * - listAccessibleCustomers → NO (mccId not provided)
         * - MCC calling itself → NO (requestCustomerId === normalizedMccId)
         * - MCC calling child account → YES (requestCustomerId !== normalizedMccId)
         */
        $shouldIncludeLoginCustomerId = (
            $normalizedMccId &&
            $requestCustomerId &&
            $requestCustomerId !== $normalizedMccId
        );

        if ($shouldIncludeLoginCustomerId) {
            $headers['login-customer-id'] = $normalizedMccId;
        }

        $headers = array_merge($headers, $extraHeaders);

        Log::debug('Google Ads API request', [
            'url' => $url,
            'method' => strtoupper($method),
            'request_customer_id' => $requestCustomerId,
            'mcc_id' => $normalizedMccId,
            'login_customer_id_header' => $headers['login-customer-id'] ?? '(not included)',
        ]);

        $req = Http::withHeaders($headers)
            ->timeout(30)
            ->retry(2, 500, fn($e) => $e instanceof \Illuminate\Http\Client\ConnectionException, throw: false);

        $response = match (strtoupper($method)) {
            'POST' => $req->post($url, $body),
            'GET' => $req->get($url),
            default => $req->post($url, $body),
        };

        Log::debug('Google Ads API response', [
            'status' => $response->status(),
            'successful' => $response->successful(),
        ]);

        return $response;
    }


    /**
     * Validate that developer token is configured.
     */
    private function validateDeveloperToken(): void
    {
        if (empty($this->developerToken)) {
            throw new \Exception('Google Ads Developer Token is not configured. Please set GOOGLE_ADS_DEVELOPER_TOKEN in your .env file.');
        }
    }

    /**
     * Exchange authorization code for tokens.
     */
    public function exchangeCodeForTokens(string $code): array
    {
        $response = Http::asForm()->post(self::TOKEN_ENDPOINT, [
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'code' => $code,
            'grant_type' => 'authorization_code',
            'redirect_uri' => $this->redirectUri,
        ]);

        if (!$response->successful()) {
            Log::error('Google OAuth token exchange failed', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);
            throw new \Exception('Failed to exchange authorization code: ' . ($response->json('error_description') ?? 'Unknown error'));
        }

        return $response->json();
    }

    /**
     * Refresh the access token using the refresh token.
     */
    public function refreshAccessToken(string $refreshToken): array
    {
        $response = Http::asForm()->post(self::TOKEN_ENDPOINT, [
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'refresh_token' => $refreshToken,
            'grant_type' => 'refresh_token',
        ]);

        if (!$response->successful()) {
            Log::error('Google OAuth token refresh failed', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);
            throw new \Exception('Failed to refresh access token: ' . ($response->json('error_description') ?? 'Unknown error'));
        }

        return $response->json();
    }

    /**
     * Get a valid access token for an integration (handles refresh if needed).
     */
    public function getValidAccessToken(UserIntegration $integration): string
    {
        $meta = is_array($integration->meta_json) ? $integration->meta_json : json_decode($integration->meta_json ?? '{}', true);
        $refreshToken = $integration->access_token ? Crypt::decryptString($integration->access_token) : null;

        if (!$refreshToken) {
            throw new \Exception('No refresh token available for this integration');
        }

        // Always refresh to get a fresh access token (we don't store access tokens)
        $tokens = $this->refreshAccessToken($refreshToken);

        return $tokens['access_token'];
    }

    /**
     * Get user info from Google.
     */
    public function getUserInfo(string $accessToken): array
    {
        $response = Http::withToken($accessToken)->get(self::USERINFO_ENDPOINT);

        if (!$response->successful()) {
            Log::warning('Failed to get Google user info', [
                'status' => $response->status(),
            ]);
            return [];
        }

        return $response->json();
    }

    /**
     * Store or update the user integration.
     */
    public function storeIntegration(User $user, array $tokenData, ?array $userInfo = null): UserIntegration
    {
        $refreshToken = $tokenData['refresh_token'] ?? null;
        $scopes = $tokenData['scope'] ?? '';

        if (!$refreshToken) {
            throw new \Exception('No refresh token received from Google');
        }

        // Find existing integration or create new one
        $integration = UserIntegration::updateOrCreate(
            [
                'user_id' => $user->id,
                'workspace_id' => $user->workspace_id,
                'provider' => 'google_ads',
            ],
            [
                'account_id' => $userInfo['id'] ?? null,
                'access_token' => Crypt::encryptString($refreshToken),
                'meta_json' => json_encode([
                    'email' => $userInfo['email'] ?? null,
                    'name' => $userInfo['name'] ?? null,
                    'picture' => $userInfo['picture'] ?? null,
                    'scopes' => $scopes,
                ]),
                'status' => 'active',
                'connected_at' => now(),
            ]
        );

        return $integration;
    }

    /**
     * Fetch accessible customer IDs.
     *
     * Note: This endpoint does NOT require login-customer-id header.
     * It returns all customer accounts the authenticated user has access to.
     */
    public function listAccessibleCustomers(string $accessToken): array
    {
        // Important: Do NOT include login-customer-id for this endpoint
        // Pass null for mccId to skip the header
        $response = $this->adsRequest(
            accessToken: $accessToken,
            method: 'GET',
            path: '/customers:listAccessibleCustomers',
            body: [],
            extraHeaders: [],
            mccId: null
        );

        if (!$response->successful()) {
            $body = $response->body();
            $isHtml = str_contains($body, '<html') || str_contains($body, '<!DOCTYPE');
            $jsonBody = $response->json();

            // Default error message
            $errorMsg = 'Unknown error.';
            $uiReason = 'unknown_error';

            // Check for Google Ads API error details
            $googleError = $jsonBody['error']['details'][0]['errors'][0] ?? null;
            $googleErrorCode = $googleError['errorCode']['authenticationError'] ?? null;
            $googleErrorMessage = $googleError['message'] ?? null;

            if ($googleErrorCode === 'NOT_ADS_USER') {
                $errorMsg = 'The Google account used for authentication is not associated with any Google Ads account. Please use a Google account that has access to at least one Google Ads account.';
                $uiReason = 'not_ads_user';
            } elseif ($googleErrorMessage) {
                $errorMsg = $googleErrorMessage;
                $uiReason = 'google_ads_error';
            } else {
                // Provide more specific error messages based on status code
                $errorMsg = match ($response->status()) {
                    401 => 'Authentication failed. The OAuth access token may be invalid, expired, or missing required scopes (https://www.googleapis.com/auth/adwords). ' .
                        'Error details: ' . ($jsonBody['error']['message'] ?? $body),
                    403 => 'Access denied. The developer token may not be approved or the Google Ads API may not be enabled. ' .
                        'Error details: ' . ($jsonBody['error']['message'] ?? $body),
                    404 => $isHtml
                        ? 'Google Ads API returned 404. Check that the API version (v23) is supported and the endpoint is correct.'
                        : 'Endpoint not found: ' . ($jsonBody['error']['message'] ?? $body),
                    default => $isHtml
                        ? 'Google Ads API returned HTML response. Check API configuration.'
                        : 'API error: ' . ($jsonBody['error']['message'] ?? $body),
                };
            }

            Log::error('Failed to list accessible customers', [
                'url' => self::ADS_API_BASE . '/customers:listAccessibleCustomers',
                'status' => $response->status(),
                'content_type' => $response->header('Content-Type'),
                'body' => $isHtml ? 'HTML response (404 page)' : $body,
                'body_preview' => substr($body, 0, 500),
                'error_details' => $jsonBody['error'] ?? null,
                'ui_reason' => $uiReason,
            ]);

            // Throw an exception with a UI-friendly reason code (can be caught and mapped in the controller/UI)
            throw new \Exception($errorMsg, 0, null);
        }

        $data = $response->json();

        Log::info('Successfully fetched accessible customers', [
            'count' => count($data['resourceNames'] ?? []),
        ]);

        return array_map(
            fn($resourceName) => str_replace('customers/', '', $resourceName),
            $data['resourceNames'] ?? []
        );
    }

    /**
     * Fetch account details for a customer ID.
     */
    public function getAccountDetails(
        string $accessToken,
        string $customerId,
        ?string $mccId = null
    ): array {
        $query = "
        SELECT
            customer.id,
            customer.descriptive_name,
            customer.currency_code,
            customer.time_zone,
            customer.manager
        FROM customer
        LIMIT 1
    ";

        try {
            $response = $this->adsRequest(
                accessToken: $accessToken,
                method: 'POST',
                path: "/customers/{$customerId}/googleAds:searchStream",
                body: ['query' => $query],
                extraHeaders: [],
                mccId: $mccId
            );
        } catch (\Throwable $e) {
            Log::warning('Failed to get account details (transport)', [
                'customer_id' => $customerId,
                'error' => $e->getMessage(),
            ]);
            return [];
        }

        if (!$response->successful()) {
            Log::warning('Failed to get account details', [
                'customer_id' => $customerId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return [];
        }

        $json = $response->json();
        $customer = $json[0]['results'][0]['customer'] ?? null;

        if (!$customer) {
            return [];
        }

        return [
            'customer_id' => $customer['id'],
            'descriptive_name' => $customer['descriptiveName'] ?? null,
            'currency_code' => $customer['currencyCode'] ?? null,
            'time_zone' => $customer['timeZone'] ?? null,
            'is_manager' => $customer['manager'] ?? false,
        ];
    }


    public function listChildAccounts(string $accessToken, string $managerCustomerId, ?string $mccId = null): array
    {
        $query = "
        SELECT
            customer_client.client_customer,
            customer_client.level,
            customer_client.manager
        FROM customer_client
        WHERE customer_client.level = 1
    ";

        $response = $this->adsRequest(
            accessToken: $accessToken,
            method: 'POST',
            path: "/customers/{$managerCustomerId}/googleAds:searchStream",
            body: ['query' => $query],
            extraHeaders: [],
            mccId: $mccId
        );

        if (!$response->successful()) {
            return [];
        }

        $results = $response->json();
        $childIds = [];

        foreach ($results as $batch) {
            foreach ($batch['results'] ?? [] as $row) {
                $resource = $row['customerClient']['clientCustomer'] ?? null;
                if ($resource) {
                    $childIds[] = str_replace('customers/', '', $resource);
                }
            }
        }

        return $childIds;
    }


    /**
     * Sync Google Ads accounts for an integration.
     * Dynamically discovers and stores MCC ID from listAccessibleCustomers.
     *
     * @param UserIntegration $integration The integration to sync
     * @param string|null $accessToken Optional access token (will refresh if not provided)
     */
    public function syncAccounts(UserIntegration $integration, ?string $accessToken = null): array
    {
        $accessToken = $accessToken ?? $this->getValidAccessToken($integration);
        $customerIds = $this->listAccessibleCustomers($accessToken);

        if (empty($customerIds)) {
            Log::warning('No accessible customers found for integration', [
                'integration_id' => $integration->id,
            ]);
            return [];
        }

        // The first accessible customer is typically the MCC (manager account)
        // Store it in the integration for future use
        $mccId = $customerIds[0];
        $this->setMccIdOnIntegration($integration, $mccId);

        Log::info('Discovered and stored MCC ID for integration', [
            'integration_id' => $integration->id,
            'mcc_id' => $mccId,
        ]);

        $accounts = [];

        foreach ($customerIds as $customerId) {
            // Manager account (MCC calling itself - no login-customer-id needed)
            $managerDetails = $this->getAccountDetails($accessToken, $customerId, null);

            $managerAccount = GoogleAdsAccount::updateOrCreate(
                [
                    'user_integration_id' => $integration->id,
                    'customer_id' => $customerId,
                ],
                [
                    'descriptive_name' => $managerDetails['descriptive_name'] ?? null,
                    'currency_code' => $managerDetails['currency_code'] ?? null,
                    'time_zone' => $managerDetails['time_zone'] ?? null,
                    'is_manager' => true,
                ]
            );

            $accounts[] = $managerAccount;

            // Child accounts - pass MCC ID for login-customer-id header
            $childIds = $this->listChildAccounts($accessToken, $customerId, $mccId);

            foreach ($childIds as $childId) {
                // Child account requires login-customer-id (MCC ID)
                $childDetails = $this->getAccountDetails($accessToken, $childId, $mccId);

                if (empty($childDetails)) {
                    continue;
                }

                $childAccount = GoogleAdsAccount::updateOrCreate(
                    [
                        'user_integration_id' => $integration->id,
                        'customer_id' => $childId,
                    ],
                    [
                        'descriptive_name' => $childDetails['descriptive_name'] ?? null,
                        'currency_code' => $childDetails['currency_code'] ?? null,
                        'time_zone' => $childDetails['time_zone'] ?? null,
                        'is_manager' => false,
                    ]
                );

                $accounts[] = $childAccount;
            }
        }

        return $accounts;
    }



    /**
     * Fetch campaigns for an account.
     */
    public function fetchCampaigns(string $accessToken, string $customerId, ?string $mccId = null): array
    {
        $query = "
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.serving_status,
            campaign.advertising_channel_type
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.id
    ";

        $response = $this->adsRequest(
            accessToken: $accessToken,
            method: 'POST',
            path: "/customers/{$customerId}/googleAds:searchStream",
            body: ['query' => $query],
            extraHeaders: [],
            mccId: $mccId
        );

        if (!$response->successful()) {
            Log::warning('Campaign fetch failed', [
                'customer_id' => $customerId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return [];
        }

        $campaigns = [];

        foreach ($response->json() as $batch) {
            foreach ($batch['results'] ?? [] as $row) {
                $c = $row['campaign'];
                $campaigns[] = [
                    'campaign_id' => $c['id'],
                    'name' => $c['name'],
                    'status' => $c['status'],
                    'serving_status' => $c['servingStatus'] ?? null,
                    'advertising_channel_type' => $c['advertisingChannelType'] ?? null,
                ];
            }
        }

        return $campaigns;
    }


    /**
     * Sync campaigns for an account.
     */
    public function syncCampaigns(GoogleAdsAccount $account, string $accessToken, ?string $mccId = null): array
    {
        $campaigns = [];

        // ONLY FETCH FOR NON-MANAGER ACCOUNTS
        if ($account->is_manager) {
            return [];
        }

        $campaignData = $this->fetchCampaigns(
            $accessToken,
            $account->customer_id,
            $mccId
        );

        foreach ($campaignData as $data) {
            $campaign = GoogleAdsCampaign::updateOrCreate(
                [
                    'google_ads_account_id' => $account->id,
                    'campaign_id' => $data['campaign_id'],
                ],
                [
                    'name' => $data['name'],
                    'status' => $data['status'],
                    'advertising_channel_type' => $data['advertising_channel_type'],
                    'serving_status' => $data['serving_status'],
                ]
            );

            $campaigns[] = $campaign;
        }

        return $campaigns;
    }

    /**
     * Fetch ads for an account.
     */
    public function fetchAds(string $accessToken, string $customerId, ?string $mccId = null): array
    {
        $query = "
        SELECT
            campaign.id,
            ad_group.id,
            ad_group.name,
            ad_group_ad.ad.id,
            ad_group_ad.ad.name,
            ad_group_ad.status
        FROM ad_group_ad
    ";

        $response = $this->adsRequest(
            accessToken: $accessToken,
            method: 'POST',
            path: "/customers/{$customerId}/googleAds:searchStream",
            body: ['query' => $query],
            extraHeaders: [],
            mccId: $mccId
        );

        if (!$response->successful()) {
            Log::warning('Failed to fetch ads', [
                'customer_id' => $customerId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return [];
        }

        $ads = [];

        foreach ($response->json() as $batch) {
            foreach ($batch['results'] ?? [] as $row) {
                $ads[] = [
                    'campaign_id' => $row['campaign']['id'] ?? null,
                    'ad_group_id' => $row['adGroup']['id'] ?? null,
                    'ad_id' => $row['adGroupAd']['ad']['id'],
                    'name' => $row['adGroupAd']['ad']['name'] ?? null,
                    'status' => $row['adGroupAd']['status'] ?? null,
                ];
            }
        }

        return $ads;
    }


    /**
     * Sync ads for an account.
     */
    public function syncAds(GoogleAdsAccount $account, string $accessToken, ?string $mccId = null): array
    {
        $ads = $this->fetchAds($accessToken, $account->customer_id, $mccId);
        $syncedAds = [];

        // Get campaign ID mapping
        $campaignMap = GoogleAdsCampaign::where('google_ads_account_id', $account->id)
            ->pluck('id', 'campaign_id')
            ->toArray();

        foreach ($ads as $adData) {
            try {
                $campaignId = $adData['campaign_id'] ?? null;
                $localCampaignId = $campaignMap[$campaignId] ?? null;

                if (!$localCampaignId) {
                    Log::warning('Campaign not found for ad', [
                        'campaign_id' => $campaignId,
                        'ad_id' => $adData['ad_id'],
                    ]);
                    continue;
                }

                $ad = GoogleAdsAd::updateOrCreate(
                    [
                        'google_ads_campaign_id' => $localCampaignId,
                        'ad_group_id' => $adData['ad_group_id'],
                        'ad_id' => $adData['ad_id'],
                    ],
                    [
                        'name' => $adData['name'],
                        'status' => $adData['status'],
                    ]
                );

                $syncedAds[] = $ad;
            } catch (\Exception $e) {
                Log::warning('Failed to sync ad', [
                    'ad_id' => $adData['ad_id'] ?? 'unknown',
                    'account_id' => $account->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $syncedAds;
    }

    /**
     * Full sync for an integration: accounts, campaigns, and ads.
     *
     * @param UserIntegration $integration The integration to sync
     * @param string|null $accessToken Optional access token (will refresh if not provided)
     */
    public function fullSync(UserIntegration $integration, ?string $accessToken = null): array
    {
        $accessToken = $accessToken ?? $this->getValidAccessToken($integration);

        // 1. Sync manager account (this also discovers and stores the MCC ID)
        $accounts = $this->syncAccounts($integration, $accessToken);

        // Get the MCC ID that was stored during syncAccounts
        $mccId = $this->getMccIdFromIntegration($integration->fresh());

        $result = [
            'accounts' => 0,
            'campaigns' => 0,
            'ads' => 0,
            'errors' => [],
        ];

        foreach ($accounts as $account) {
            if ($account->is_manager) {
                // 2. Fetch child accounts explicitly
                $childCustomerIds = $this->listChildAccounts(
                    $accessToken,
                    $account->customer_id,
                    $mccId
                );

                foreach ($childCustomerIds as $childCustomerId) {
                    // 3. Ensure child account exists in DB
                    $childAccount = GoogleAdsAccount::firstOrCreate(
                        [
                            'user_integration_id' => $integration->id,
                            'customer_id' => $childCustomerId,
                        ],
                        [
                            'is_manager' => false,
                            'is_active' => true,
                        ]
                    );

                    $result['accounts']++;

                    // 4. Sync campaigns (pass MCC ID for child account access)
                    $campaigns = $this->syncCampaigns($childAccount, $accessToken, $mccId);
                    $result['campaigns'] += count($campaigns);

                    // 5. Sync ads (pass MCC ID for child account access)
                    $ads = $this->syncAds($childAccount, $accessToken, $mccId);
                    $result['ads'] += count($ads);
                }
            }
        }

        return $result;
    }

    /**
     * Check if an integration's refresh token is still valid.
     */
    public function validateIntegration(UserIntegration $integration): bool
    {
        try {
            $this->getValidAccessToken($integration);
            return true;
        } catch (\Exception $e) {
            Log::warning('Google Ads integration validation failed', [
                'integration_id' => $integration->id,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Disconnect an integration (revoke tokens if possible).
     */
    public function disconnect(UserIntegration $integration): void
    {
        try {
            $refreshToken = Crypt::decryptString($integration->access_token);

            // Attempt to revoke the token
            Http::asForm()->post('https://oauth2.googleapis.com/revoke', [
                'token' => $refreshToken,
            ]);
        } catch (\Exception $e) {
            Log::warning('Failed to revoke Google token', [
                'integration_id' => $integration->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Delete related data
        $accountIds = $integration->googleAdsAccounts()->pluck('id');

        GoogleAdsAd::whereIn('google_ads_campaign_id', function ($query) use ($accountIds) {
            $query->select('id')
                ->from('google_ads_campaigns')
                ->whereIn('google_ads_account_id', $accountIds);
        })->delete();

        GoogleAdsCampaign::whereIn('google_ads_account_id', $accountIds)->delete();
        GoogleAdsAccount::whereIn('id', $accountIds)->delete();

        $integration->delete();
    }

    /**
     * Set a Google Ads campaign status (ENABLED or PAUSED) using the Google Ads API mutate endpoint.
     *
     * @param UserIntegration $integration
     * @param string $customerId  The Google Ads customer ID (no hyphens)
     * @param string $campaignId  The numeric campaign ID
     * @param bool $enabled       true = ENABLED, false = PAUSED
     * @return array  ['success' => bool, 'message' => string|null, 'status' => string|null]
     */
    public function setCampaignStatus(UserIntegration $integration, string $customerId, string $campaignId, bool $enabled): array
    {
        try {
            $accessToken = $this->getValidAccessToken($integration);
            $mccId = $this->getMccIdFromIntegration($integration);

            $cleanCustomerId = preg_replace('/[^0-9]/', '', $customerId);
            $desiredStatus = $enabled ? 'ENABLED' : 'PAUSED';

            $body = [
                'operations' => [
                    [
                        'updateMask' => 'status',
                        'update' => [
                            'resourceName' => "customers/{$cleanCustomerId}/campaigns/{$campaignId}",
                            'status' => $desiredStatus,
                        ],
                    ],
                ],
            ];

            $response = $this->adsRequest(
                accessToken: $accessToken,
                method: 'POST',
                path: "/customers/{$cleanCustomerId}/campaigns:mutate",
                body: $body,
                extraHeaders: [],
                mccId: $mccId
            );

            if (!$response->successful()) {
                Log::error('Google Ads set campaign status failed', [
                    'customer_id' => $cleanCustomerId,
                    'campaign_id' => $campaignId,
                    'desired_status' => $desiredStatus,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [
                    'success' => false,
                    'message' => 'Failed to update campaign status: ' . ($response->json('error.message') ?? 'Unknown error'),
                    'status' => null,
                ];
            }

            Log::info('Google Ads campaign status updated', [
                'customer_id' => $cleanCustomerId,
                'campaign_id' => $campaignId,
                'new_status' => $desiredStatus,
            ]);

            return [
                'success' => true,
                'message' => null,
                'status' => $desiredStatus,
            ];
        } catch (\Throwable $e) {
            Log::error('Google Ads setCampaignStatus error', [
                'customer_id' => $customerId,
                'campaign_id' => $campaignId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'status' => null,
            ];
        }
    }
}
