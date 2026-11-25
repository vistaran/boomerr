<?php

namespace App\Http\Controllers\Tools;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ShopifyDetectorController extends Controller
{
    // A list of common Shopify apps and their signatures (scripts, classes, or keywords in HTML)
    private $appSignatures = [
        'Klaviyo' => ['klaviyo.com', 'klaviyo.js', 'onsite/js/klaviyo'],
        'Yotpo' => ['yotpo.com', 'yotpo.js'],
        'Loox' => ['loox.io', 'loox.js'],
        'Gorgias' => ['gorgias.chat', 'gorgias.com'],
        'Smile.io' => ['smile.io', 'smile-ui.js'],
        'Sezzle' => ['sezzle.com'],
        'Afterpay' => ['afterpay.com', 'squarecdn.com'],
        'Recharge' => ['rechargeapps.com'],
        'Bold' => ['boldcommerce.com', 'bold-'],
        'Privy' => ['privy.com', 'privy.js'],
        'Judge.me' => ['judge.me'],
        'Omnisend' => ['omnisend.com'],
        'Stamped.io' => ['stamped.io'],
        'PageFly' => ['pagefly.io', 'pagefly.css', 'pagefly.js'],
        'Shogun' => ['shogun', 'getshogun.com'],
        'GemPages' => ['gempages.net'],
        'Vitals' => ['vitals.co', 'vitals-'],
        'Printful' => ['printful.com'],
        'Attentive' => ['attentivemobile.com'],
        'Postscript' => ['postscript.io'],
        'Tidio' => ['tidio.co', 'tidiochat.com'],
        'Growave' => ['growave.io'],
        'PushOwl' => ['pushowl.com'],
        'Okendo' => ['okendo.io'],
        'Route' => ['route.com', 'route-widget'],
    ];

    public function check(Request $request)
    {
        $request->validate([
            'url' => 'required|string|max:2048',
        ]);

        $rawUrl = $request->input('url');
        $url = $this->normalizeUrl($rawUrl);

        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            return response()->json([
                'error' => 'Invalid URL provided.',
            ], 422);
        }

        // SSRF Guard: Validate scheme, resolved IP, and reject private/cloud-metadata addresses
        $reason = null;
        if (!\App\Helpers\SecurityHelper::isSafeUrl($url, $reason)) {
            return response()->json([
                'error' => $reason ?: 'Access to the specified URL or IP address is prohibited for security reasons.',
            ], 422);
        }

        try {
            $safeResult = \App\Helpers\SecurityHelper::executeSafeRequest($url, [
                'method' => 'GET',
                'timeout' => 10,
                'max_redirects' => 5,
                'verify_ssl' => false,
            ]);

            $statusCode = $safeResult['http_code'];
            if ($statusCode < 200 || $statusCode >= 300) {
                return response()->json([
                    'error' => 'Failed to reach the website (HTTP ' . $statusCode . ').',
                ], 400);
            }

            $html = $safeResult['body'];
            $results = $this->analyzeHtml($html);

            return response()->json([
                'url' => $url,
                'is_shopify' => $results['is_shopify'],
                'theme' => $results['theme'],
                'apps' => $results['apps'],
            ]);

        } catch (\Exception $e) {
            Log::error('Shopify Detector Error: ' . $e->getMessage(), ['url' => $url]);

            if (str_contains($e->getMessage(), 'SSRF Protection Blocked')) {
                return response()->json([
                    'error' => $e->getMessage(),
                ], 422);
            }

            $msg = 'An error occurred while analyzing the URL.';
            if (str_contains($e->getMessage(), 'Could not resolve host') || str_contains($e->getMessage(), 'cURL error 6')) {
                $msg = 'Could not resolve host: The domain does not exist or is unreachable.';
            } elseif (str_contains($e->getMessage(), 'timed out') || str_contains($e->getMessage(), 'cURL error 28')) {
                $msg = 'Connection timed out while trying to reach the website.';
            }

            return response()->json([
                'error' => $msg,
            ], 400);
        }
    }

    private function normalizeUrl(string $url): string
    {
        $url = trim($url);
        if (!str_starts_with($url, 'http://') && !str_starts_with($url, 'https://')) {
            $url = 'https://' . $url;
        }
        return $url;
    }

    private function analyzeHtml(string $html): array
    {
        $isShopify = false;

        // 1. Detect if it's a Shopify store
        if (
            str_contains($html, 'var Shopify = Shopify || {};') ||
            str_contains($html, 'cdn.shopify.com') ||
            str_contains($html, 'Shopify.theme') ||
            str_contains($html, 'shopify-payment-button')
        ) {
            $isShopify = true;
        }

        // 2. Extract Theme info
        $theme = [
            'name' => null,
            'id' => null,
            'store_id' => null,
        ];

        if (preg_match('/Shopify\.theme\s*=\s*({[^}]+});/i', $html, $matches)) {
            $themeData = json_decode($matches[1], true);
            if ($themeData) {
                $theme['name'] = $themeData['name'] ?? null;
                $theme['id'] = $themeData['id'] ?? null;
                $theme['store_id'] = $themeData['theme_store_id'] ?? null;
            }
        }

        // Alternative theme detection if the JS object is not found or is structured differently
        if (!$theme['name'] && preg_match('/"themeId":(\d+),"themeName":"([^"]+)"/i', $html, $matches)) {
            $theme['id'] = $matches[1];
            $theme['name'] = $matches[2];
        }

        // 3. Detect Apps
        $detectedApps = [];

        foreach ($this->appSignatures as $appName => $signatures) {
            foreach ($signatures as $signature) {
                if (stripos($html, $signature) !== false) {
                    $detectedApps[] = $appName;
                    break; // Stop checking other signatures for this app if one matches
                }
            }
        }

        return [
            'is_shopify' => $isShopify,
            'theme' => $theme,
            'apps' => $detectedApps,
        ];
    }
}
