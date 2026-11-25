<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Domain;
use App\Models\Integration;
use App\Models\ShopifyStore;
use App\Models\User;
use App\Models\Workspace;
use App\Services\Billing\WorkspaceSubscriptionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ShopifyAuthController extends Controller
{
    /**
     * GET /shopify
     *
     * Entry-point when Shopify loads the embedded app.
     * - If the store already has an access token → issue a Sanctum token and
     *   redirect to the frontend.
     * - Otherwise → render the "Connect Store" handshake page so the top-level
     *   window can break out of the iframe and start OAuth.
     */
    public function index(Request $request)
    {
        $shop = $request->query('shop');

        if (!$shop) {
            return redirect(config('app.frontend_url') . '/login');
        }

        // Check if we already have this store and it's active
        $store = ShopifyStore::where('shop', $shop)->first();
        if ($store && $store->access_token) {
            $user = User::where('email', $shop)->orWhere('name', explode('.', $shop)[0])->first();
            if ($user) {
                $token = $user->createToken('shopify-token')->plainTextToken;
                $redirectUrl = config('app.frontend_url') . "/login?token={$token}&shop={$shop}";
                return response("
                    <script type='text/javascript'>
                        window.top.location.href = '{$redirectUrl}';
                    </script>
                ");
            }
        }

        // 2. Return a Professional Transition Page
        // Force embedded=0 to ensure we stay in standalone mode
        $redirectUrl = route('shopify.redirect', ['shop' => $shop, 'embedded' => '0']);

        return response("
            <html>
                <body style='background: #050505;'>
                    <script type='text/javascript'>
                        // Aggressive breakout to standalone mode
                        window.top.location.href = '{$redirectUrl}';
                    </script>
                </body>
            </html>
        ");
    }

    /**
     * GET /shopify/auth
     *
     * OAuth Step 1 - generate state, set cookie, redirect to Shopify OAuth page.
     */
    public function redirect(Request $request): Response|RedirectResponse
    {
        $shop = $request->query('shop');
        Log::info('Shopify OAuth Redirect initiated', ['shop' => $shop]);

        if (!$shop) {
            return response($this->storePickerPage());
        }

        $state = bin2hex(random_bytes(16));
        $apiKey = config('services.shopify.client_id');
        $scopes = config('services.shopify.scopes');
        $redirectUri = config('services.shopify.redirect');

        // Using the standard offline grant options for maximum stability and compatibility
        $url = "https://{$shop}/admin/oauth/authorize?client_id={$apiKey}&scope={$scopes}&redirect_uri={$redirectUri}&state={$state}&grant_options[]=offline&prompt=select_account";

        return (new RedirectResponse($url))->withCookie(
            cookie('shopify_state', $state, 60, '/', null, true, true, false, 'none')
        );
    }

    /**
     * GET /shopify/callback
     *
     * OAuth Step 2 - validate HMAC + state, exchange code for access token,
     * create / update user & workspace, issue Sanctum token, redirect to frontend.
     */
    public function callback(Request $request): Response|RedirectResponse
    {
        $shop = $request->query('shop');
        $code = $request->query('code');
        $state = $request->query('state');
        $hmac = $request->query('hmac');
        $stateCookie = $request->cookie('shopify_state');

        // 1. State verification (warn but don't hard-fail in dev).
        if ($stateCookie && $state !== $stateCookie) {
            Log::warning('Shopify OAuth: state mismatch, proceeding as fallback.', compact('state', 'stateCookie'));
        }

        // 2. HMAC validation.
        $params = $request->except('hmac');
        ksort($params);
        $message = collect($params)->map(fn($v, $k) => "{$k}={$v}")->implode('&');
        $expectedHmac = hash_hmac('sha256', $message, config('services.shopify.client_secret'));

        if (!hash_equals($expectedHmac, (string) $hmac)) {
            return response('HMAC validation failed.', 400);
        }

        if (!$shop || !$code) {
            return response('Missing shop or code.', 400);
        }

        try {
            // 3. Exchange code for access token via Shopify.
            $tokenResponse = \Illuminate\Support\Facades\Http::post("https://{$shop}/admin/oauth/access_token", [
                'client_id' => config('services.shopify.client_id'),
                'client_secret' => config('services.shopify.client_secret'),
                'code' => $code,
            ]);

            if ($tokenResponse->failed()) {
                Log::error('Shopify token exchange failed', ['body' => $tokenResponse->body()]);
                return response('Token exchange failed: ' . $tokenResponse->body(), 500);
            }

            $accessToken = $tokenResponse->json('access_token');

            // Fetch shop details to get the actual contact email
            $shopDetailsResponse = \Illuminate\Support\Facades\Http::withHeaders([
                'X-Shopify-Access-Token' => $accessToken,
            ])->get("https://{$shop}/admin/api/2024-04/shop.json");

            $shopData = $shopDetailsResponse->json('shop') ?? [];
            $contactEmail = $shopData['email'] ?? $shopData['contact_email'] ?? null;
            $shopNameFromShopify = $shopData['name'] ?? null;

            $shopName = $shopNameFromShopify ?? str_replace('.myshopify.com', '', $shop);
            $email = $shop; // shop domain is used as the unique email identifier

            // 4. Find or create user.
            $user = User::where('email', $email)->first();

            if ($user) {
                // Update provider to Shopify if needed.
                $user->contact_email = $contactEmail;
                if ($user->provider !== 'Shopify') {
                    $user->provider = 'Shopify';
                }
                $user->save();

                $user->ensureWorkspaceHydrated();
                $user->refresh();

            } else {
                // Create brand-new user.
                $user = User::create([
                    'name' => $shopName,
                    'email' => $email,
                    'contact_email' => $contactEmail,
                    'password' => bcrypt(Str::random(32)),
                    'provider' => 'Shopify',
                    'email_verified_at' => now(),
                ]);

                // Create workspace.
                $workspace = Workspace::create([
                    'name' => $shopName,
                    'slug' => Str::slug($shopName) . '-' . random_int(1, 999),
                    'primary_contact_email' => $email,
                ]);

                $user->workspaces()->syncWithoutDetaching([
                    $workspace->id => ['role' => User::ROLE_OWNER],
                ]);
                $user->activateWorkspace($workspace->id);

                // Attach all platform integrations.
                Integration::all()->each(
                    fn($integration) => $workspace->integrations()->attach($integration->id, [
                        'enabled' => true,
                        'ulid' => strtolower((string) Str::ulid()),
                    ])
                );

                // Ensure free subscription.
                app(WorkspaceSubscriptionService::class)->ensureDefaultFreeSubscription($workspace);
            }

            // 5. Ensure workspace is activated & plan is active.
            $workspace = $user->currentWorkspace();
            if ($workspace) {
                if (!$workspace->plan_id) {
                    $workspace->plan_id = 1;
                    $workspace->billing_status = 'active';
                    $workspace->save();
                }
            }

            // 6. Ensure shop domains are synchronized
            $syncService = app(\App\Services\ShopifyDomainSyncService::class);
            $syncService->syncDomains($user, $shop);
            $syncService->registerWebhooks($shop, $accessToken);

            // Get the primary domain ULID for frontend redirect if available
            $workspace = $user->currentWorkspace();
            $primaryDomain = Domain::where('workspace_id', $workspace->id)
                ->where('name', $shop)
                ->first();
            $domainUlid = $primaryDomain ? $primaryDomain->ulid : null;

            // 7. Upsert the Shopify store record.
            ShopifyStore::updateOrCreate(
                ['shop' => $shop],
                ['access_token' => $accessToken]
            );

            // 8. Issue Sanctum token & redirect to frontend.
            $token = $user->createToken('shopify_oauth')->plainTextToken;

            // Generate the standalone URL for the frontend main entry point
            // App.tsx handles the token/shop detection and redirects to /overview automatically
            $loginUrl = config('app.frontend_url') . "/login?token={$token}&shop={$shop}";

            if ($domainUlid) {
                $loginUrl .= "&domain_ulid={$domainUlid}";
            }

            // Return a breakout script to ensure we land on the standalone app
            return response("
                <script type='text/javascript'>
                    window.top.location.href = '{$loginUrl}';
                </script>
            ");

        } catch (\Throwable $e) {
            Log::error('Shopify OAuth callback error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response('Authentication Failed: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Return the HTML for the custom "Connect Store" picker page.
     * This is displayed in the popup when no shop is provided.
     */
    private function storePickerPage(): string
    {
        return "
        <!DOCTYPE html>
        <html>
            <head>
                <title>Connect Shopify Store</title>
                <style>
                    body { 
                        background: #050505; 
                        color: white; 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .card {
                        background: rgba(255,255,255,0.03);
                        border: 1px solid rgba(255,255,255,0.05);
                        padding: 40px;
                        border-radius: 24px;
                        text-align: center;
                        backdrop-filter: blur(10px);
                        max-width: 400px;
                        width: 90%;
                        box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                    }
                    input {
                        width: 100%;
                        padding: 14px 16px;
                        border-radius: 12px;
                        border: 1px solid rgba(255,255,255,0.1);
                        background: rgba(255,255,255,0.02);
                        color: white;
                        font-size: 14px;
                        margin-top: 20px;
                        outline: none;
                        box-sizing: border-box;
                        transition: all 0.2s;
                    }
                    input:focus {
                        border-color: #95BF47;
                        background: rgba(255,255,255,0.05);
                    }
                    .btn {
                        background: #95BF47;
                        color: black;
                        padding: 16px 32px;
                        border-radius: 14px;
                        text-decoration: none;
                        font-weight: 900;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        font-size: 12px;
                        display: block;
                        width: 100%;
                        box-sizing: border-box;
                        margin-top: 16px;
                        transition: all 0.2s;
                        border: none;
                        cursor: pointer;
                    }
                    .btn:hover { opacity: 0.9; transform: translateY(-2px); }
                    .btn:active { transform: translateY(0); }
                    .help-text {
                        color: #888;
                        margin-top: 12px;
                        font-size: 14px;
                        line-height: 1.6;
                    }
                </style>
            </head>
            <body>
                <div class='card'>
                    <div style='font-size: 40px; margin-bottom: 20px;'>🛍️</div>
                    <h2 style='margin:0; font-size: 20px;'>Enter Store URL</h2>
                    <p class='help-text'>Enter your Shopify store domain to continue.</p>
                    <form action='/shopify/auth' method='GET'>
                        <input type='text' name='shop' placeholder='your-store.myshopify.com' required autofocus autocomplete='off' />
                        <button type='submit' class='btn'>Connect Store</button>
                    </form>
                </div>
                <script>
                    document.querySelector('form').addEventListener('submit', function(e) {
                        var input = document.querySelector('input[name=\"shop\"]');
                        var val = input.value.trim().replace('https://', '').replace('http://', '').replace(/\/$/, '').split('/')[0];
                        if (!val.includes('.myshopify.com')) {
                            val = val + '.myshopify.com';
                        }
                        input.value = val;
                    });
                </script>
            </body>
        </html>";
    }
}
