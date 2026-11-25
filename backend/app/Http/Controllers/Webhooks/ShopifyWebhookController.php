<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\Domain;
use App\Models\ShopifyStore;
use App\Models\Workspace;

class ShopifyWebhookController extends Controller
{
    /**
     * Handle Shopify domain creation/update.
     */
    public function handleDomainUpdate(Request $request)
    {
        $shop = $request->header('x-shopify-shop-domain');
        if (!$this->verifyWebhook($request)) {
            Log::warning("Shopify Webhook: Invalid signature for shop {$shop}");
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $payload = $request->json()->all();
        $providerId = $payload['id'] ?? null;
        $host = $payload['host'] ?? null;
        $url = $payload['url'] ?? "https://{$host}";

        if (!$providerId || !$host) {
            Log::warning("Shopify Webhook: Missing domain data", ['payload' => $payload]);
            return response()->json(['success' => true]);
        }

        $workspace = $this->getWorkspaceForShop($shop);
        if (!$workspace) {
            Log::warning("Shopify Webhook: No workspace found for shop {$shop}");
            return response()->json(['success' => true]);
        }

        $domain = Domain::where('workspace_id', $workspace->id)
            ->where(function ($query) use ($providerId, $host) {
                $query->where('provider_id', $providerId)
                      ->orWhere('name', $host);
            })
            ->first();

        if ($domain) {
            $domain->update([
                'provider' => 'shopify',
                'provider_id' => $providerId,
                'name' => $host,
                'url' => $url,
                'is_active' => true,
            ]);
            Log::info("Shopify Webhook: Updated domain {$host} for workspace {$workspace->id}");
        } else {
            Domain::create([
                'workspace_id' => $workspace->id,
                'name' => $host,
                'url' => $url,
                'environment' => 'production',
                'is_active' => true,
                'status' => 'unknown',
                'provider' => 'shopify',
                'provider_id' => $providerId,
            ]);
            Log::info("Shopify Webhook: Created new domain {$host} for workspace {$workspace->id}");
        }

        return response()->json(['success' => true]);
    }

    /**
     * Handle Shopify domain deletion.
     */
    public function handleDomainDestroy(Request $request)
    {
        $shop = $request->header('x-shopify-shop-domain');
        if (!$this->verifyWebhook($request)) {
            Log::warning("Shopify Webhook: Invalid signature for shop {$shop}");
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $payload = $request->json()->all();
        $providerId = $payload['id'] ?? null;

        if (!$providerId) {
            return response()->json(['success' => true]);
        }

        $workspace = $this->getWorkspaceForShop($shop);
        if (!$workspace) {
            return response()->json(['success' => true]);
        }

        $domain = Domain::where('workspace_id', $workspace->id)
            ->where('provider_id', $providerId)
            ->where('provider', 'shopify')
            ->first();

        if ($domain) {
            // As per user request, we now hard delete instead of deactivating
            Log::info("Shopify Webhook: Deleting domain {$domain->name} for workspace {$workspace->id}");
            $domain->delete();
        }

        return response()->json(['success' => true]);
    }

    /**
     * Verify the Shopify webhook HMAC signature.
     */
    private function verifyWebhook(Request $request): bool
    {
        $hmac = $request->header('x-shopify-hmac-sha256');
        if (!$hmac) {
            return false;
        }

        $data = $request->getContent();
        $secret = config('services.shopify.client_secret');
        
        $calculatedHmac = base64_encode(hash_hmac('sha256', $data, $secret, true));

        return hash_equals($calculatedHmac, $hmac);
    }

    /**
     * Find the workspace associated with a Shopify store.
     */
    private function getWorkspaceForShop(string $shop): ?Workspace
    {
        $store = ShopifyStore::where('shop', $shop)->first();
        if (!$store) {
            return null;
        }

        // The user who installed the app
        $user = \App\Models\User::where('email', $shop)->first();
        if (!$user) {
            return null;
        }

        return $user->currentWorkspace();
    }
}
