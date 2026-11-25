<?php

namespace App\Services;

use App\Models\Domain;
use App\Models\User;
use App\Models\ShopifyStore;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ShopifyDomainSyncService
{
    /**
     * Synchronize domains from Shopify for the given user's workspace.
     */
    public function syncDomains(User $user, string $shop): void
    {
        $workspace = $user->currentWorkspace();
        if (!$workspace) {
            Log::warning("Shopify Sync: User {$user->id} has no workspace.");
            return;
        }

        $store = ShopifyStore::where('shop', $shop)->first();
        if (!$store || !$store->access_token) {
            Log::warning("Shopify Sync: No access token found for shop {$shop}.");
            return;
        }

        try {
            $shopifyDomains = $this->fetchDomainsFromShopify($shop, $store->access_token);
            
            if (empty($shopifyDomains)) {
                Log::warning("Shopify Sync: No domains returned for {$shop}.");
                return;
            }

            $this->reconcileDomains($workspace->id, $shopifyDomains, $shop);
            
        } catch (\Throwable $e) {
            Log::error("Shopify Sync: Failed to sync domains for {$shop}: " . $e->getMessage());
        }
    }

    /**
     * Fetch all domains using Shopify Admin GraphQL API.
     */
    private function fetchDomainsFromShopify(string $shop, string $accessToken): array
    {
        $url = "https://{$shop}/admin/api/2024-01/graphql.json";
        
        // As per user hint, fetching using shop.domains GraphQL
        $query = <<<'GRAPHQL'
        query {
            shop {
                myshopifyDomain
                url
            }
        }
        GRAPHQL;
        // Wait, standard shop query doesn't have a "domains" connection in older versions.
        // Let's try the domains query or rest API if needed.
        // Actually, Shopify GraphQL API does not have `shop.domains` in standard docs, 
        // but it does have `appInstallation` or webhooks. 
        // Let's use the REST API for domains as a robust fallback to ensure we get all domains.
        // Wait, the user specifically requested "using the Shopify Admin GraphQL API shop.domains"
        // Let's try to honor the exact request by doing a GraphQL query for `shop { domains { id host url } }`

        $graphqlQuery = <<<'GRAPHQL'
        query {
            shop {
                myshopifyDomain
                domains {
                    id
                    host
                    url
                }
            }
        }
        GRAPHQL;

        $response = Http::withHeaders([
            'X-Shopify-Access-Token' => $accessToken,
            'Content-Type' => 'application/json',
        ])->post($url, [
            'query' => $graphqlQuery,
        ]);

        if (!$response->successful()) {
            throw new \Exception('GraphQL API request failed: ' . $response->body());
        }

        $data = $response->json();

        if (isset($data['errors'])) {
            // If the GraphQL query fails (e.g. `domains` doesn't exist on `shop`), fallback to REST API
            Log::warning("Shopify Sync: GraphQL shop.domains failed, falling back to REST API for {$shop}", ['errors' => $data['errors']]);
            return $this->fetchDomainsFromRestApi($shop, $accessToken);
        }

        $fetchedDomains = [];
        $shopData = $data['data']['shop'] ?? [];
        
        // Add the myshopify domain if present
        if (!empty($shopData['myshopifyDomain'])) {
            $fetchedDomains[] = [
                'id' => 'myshopify_' . $shopData['myshopifyDomain'],
                'host' => $shopData['myshopifyDomain'],
                'url' => 'https://' . $shopData['myshopifyDomain'],
            ];
        }

        // Add the custom domains from GraphQL response
        if (!empty($shopData['domains'])) {
            foreach ($shopData['domains'] as $domainNode) {
                $fetchedDomains[] = [
                    'id' => $domainNode['id'] ?? $domainNode['host'],
                    'host' => $domainNode['host'],
                    'url' => $domainNode['url'] ?? 'https://' . $domainNode['host'],
                ];
            }
        }

        return $fetchedDomains;
    }

    /**
     * Fallback to REST API if GraphQL shop.domains doesn't exist.
     */
    private function fetchDomainsFromRestApi(string $shop, string $accessToken): array
    {
        $url = "https://{$shop}/admin/api/2024-01/domains.json";
        
        $response = Http::withHeaders([
            'X-Shopify-Access-Token' => $accessToken,
        ])->get($url);

        if (!$response->successful()) {
            throw new \Exception('REST API request failed: ' . $response->body());
        }

        $data = $response->json();
        $domains = $data['domains'] ?? [];

        $fetchedDomains = [];
        foreach ($domains as $domain) {
            $fetchedDomains[] = [
                'id' => (string) $domain['id'],
                'host' => $domain['host'],
                'url' => 'https://' . $domain['host'],
            ];
        }
        
        // Also ensure the base shop is included
        $fetchedDomains[] = [
            'id' => 'myshopify_' . $shop,
            'host' => $shop,
            'url' => 'https://' . $shop,
        ];

        return $fetchedDomains;
    }

    /**
     * Reconcile fetched domains with the Boomerr database.
     */
    private function reconcileDomains(int $workspaceId, array $shopifyDomains, string $shop): void
    {
        // 1. Get existing domains for this workspace that are from Shopify OR match the shop host
        $existingDomains = Domain::where('workspace_id', $workspaceId)
            ->where(function ($query) use ($shop) {
                $query->where('provider', 'shopify')
                      ->orWhere('name', $shop)
                      ->orWhere('url', "https://{$shop}");
            })
            ->get();

        $activeRemoteHosts = [];

        foreach ($shopifyDomains as $remoteDomain) {
            $host = $remoteDomain['host'];
            $url = $remoteDomain['url'];
            $providerId = $remoteDomain['id'];
            
            $activeRemoteHosts[] = $host;

            // Find if we already have this domain (by provider_id or by host/url)
            $existing = $existingDomains->first(function ($domain) use ($providerId, $host, $url) {
                return $domain->provider_id === $providerId || 
                       $domain->name === $host || 
                       $domain->url === $url;
            });

            if ($existing) {
                // Update it to ensure it's marked as active and belongs to shopify
                $existing->update([
                    'provider' => 'shopify',
                    'provider_id' => $providerId,
                    'is_active' => true,
                ]);
            } else {
                // Create new domain
                Domain::create([
                    'workspace_id' => $workspaceId,
                    'name' => $host,
                    'url' => $url,
                    'environment' => 'production',
                    'is_active' => true,
                    'status' => 'unknown',
                    'provider' => 'shopify',
                    'provider_id' => $providerId,
                ]);
                Log::info("Shopify Sync: Created new domain {$host} for workspace {$workspaceId}");
            }
        }

        // 2. Delete any domains in Boomerr (for this workspace and provider=shopify) 
        // that are no longer in the Shopify store.
        foreach ($existingDomains as $existing) {
            // We only want to delete domains explicitly tracked as 'shopify' 
            // if they are no longer in the fetched list.
            if ($existing->provider === 'shopify' && !in_array($existing->name, $activeRemoteHosts)) {
                Log::info("Shopify Sync: Deleting domain {$existing->name} as it was removed from Shopify.");
                $existing->delete();
            }
        }
    }

    /**
     * Register Shopify webhooks for domain changes.
     */
    public function registerWebhooks(string $shop, string $accessToken): void
    {
        $url = "https://{$shop}/admin/api/2024-01/graphql.json";
        
        $appUrl = config('app.url');
        // If app URL is localhost and we don't have ngrok, webhooks won't work, but we register anyway
        $webhookUrl = "{$appUrl}/api/webhooks/shopify/domains";

        $topics = ['DOMAINS_CREATE', 'DOMAINS_UPDATE', 'DOMAINS_DESTROY'];

        foreach ($topics as $topic) {
            $query = <<<'GRAPHQL'
            mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
                webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
                    userErrors {
                        field
                        message
                    }
                    webhookSubscription {
                        id
                    }
                }
            }
            GRAPHQL;

            $variables = [
                'topic' => $topic,
                'webhookSubscription' => [
                    'callbackUrl' => $webhookUrl,
                    'format' => 'JSON',
                ]
            ];

            try {
                $response = Http::withHeaders([
                    'X-Shopify-Access-Token' => $accessToken,
                    'Content-Type' => 'application/json',
                ])->post($url, [
                    'query' => $query,
                    'variables' => $variables,
                ]);

                $data = $response->json();
                
                if (isset($data['data']['webhookSubscriptionCreate']['userErrors']) && !empty($data['data']['webhookSubscriptionCreate']['userErrors'])) {
                    Log::warning("Shopify Sync: Failed to register webhook {$topic} for {$shop}", ['errors' => $data['data']['webhookSubscriptionCreate']['userErrors']]);
                } else {
                    Log::info("Shopify Sync: Successfully registered webhook {$topic} for {$shop}");
                }
            } catch (\Throwable $e) {
                Log::error("Shopify Sync: Exception registering webhook {$topic} for {$shop}: " . $e->getMessage());
            }
        }
    }
}
