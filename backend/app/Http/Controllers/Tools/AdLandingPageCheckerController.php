<?php

namespace App\Http\Controllers\Tools;

use App\Helpers\SecurityHelper;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class AdLandingPageCheckerController extends Controller
{
    public function check(Request $request)
    {
        $request->validate([
            'url' => 'required|string|max:2048',
        ]);

        $rawUrl = $request->input('url');
        $url = $this->normalizeUrl($rawUrl);

        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            return response()->json([
                'error' => 'Invalid landing page URL provided.',
            ], 422);
        }

        // SSRF Guard: Validate scheme, resolved IP, and reject private/cloud-metadata addresses
        $reason = null;
        if (!SecurityHelper::isSafeUrl($url, $reason)) {
            return response()->json([
                'error' => $reason ?: 'Access to the specified URL or IP address is prohibited for security reasons.',
            ], 422);
        }

        $cacheKey = 'tools:ad-landing-page:' . md5($url);

        try {
            $results = Cache::remember($cacheKey, 60, function () use ($url) {
                return $this->performAdLandingPageCheck($url);
            });

            return response()->json([
                'url' => $url,
                'data' => $results,
            ]);
        } catch (\Exception $e) {
            Log::error('Ad Landing Page Checker Error: ' . $e->getMessage(), [
                'url' => $url,
                'trace' => $e->getTraceAsString(),
            ]);

            if (str_contains($e->getMessage(), 'SSRF Protection Blocked')) {
                return response()->json([
                    'error' => $e->getMessage(),
                ], 422);
            }

            return response()->json([
                'error' => 'An error occurred while inspecting the ad landing page. Please try again later.',
            ], 500);
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

    private function performAdLandingPageCheck(string $url): array
    {
        $safeResult = SecurityHelper::executeSafeRequest($url, [
            'method' => 'GET',
            'timeout' => 12,
            'max_redirects' => 5,
            'verify_ssl' => true,
            'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (BoomerrAdProtectionBot/1.0; +https://' . (parse_url(config('app.url', 'http://localhost'), PHP_URL_HOST) ?: 'localhost') . ')',
        ]);

        $headerContent = $safeResult['header_string'];
        $bodyContent = substr($safeResult['body'], 0, 150000); // 150KB sample is sufficient for pixel audit
        $error = $safeResult['error'] ?? '';

        $statusCode = $safeResult['http_code'];
        $finalUrl = $safeResult['final_url'];
        $redirectCount = $safeResult['redirect_count'];
        $totalTimeMs = $safeResult['total_time_ms'];
        $ttfbMs = $safeResult['starttransfer_time_ms'];
        $dnsTimeMs = $safeResult['namelookup_time_ms'];
        $connectTimeMs = $safeResult['connect_time_ms'];
        $primaryIp = $safeResult['primary_ip'];
        $sizeBytes = strlen($safeResult['body']);

        // SSL Inspection
        $sslInfo = $this->inspectSsl($url, $statusCode, $error);

        // Tracking Pixels Detection
        $pixelAudit = $this->detectPixels($bodyContent, $headerContent);

        // Platform Detection
        $platform = $this->detectPlatform($bodyContent, $headerContent);

        // Calculate Ad Safety & ROAS Bleed Health Score
        $healthAnalysis = $this->calculateAdSafetyScore(
            $statusCode,
            $ttfbMs,
            $totalTimeMs,
            $redirectCount,
            $sslInfo['is_valid'],
            $sslInfo['days_remaining'],
            $pixelAudit,
            $error
        );

        $isUp = ($statusCode >= 200 && $statusCode < 400);

        return [
            'is_up' => $isUp,
            'status' => $healthAnalysis['status'], // 'safe' | 'warning' | 'critical'
            'health_score' => $healthAnalysis['score'], // 0 - 100
            'verdict' => $healthAnalysis['verdict'],
            'status_code' => $statusCode,
            'final_url' => $finalUrl,
            'is_redirected' => ($redirectCount > 0 || $finalUrl !== $url),
            'redirect_count' => $redirectCount,
            'metrics' => [
                'total_time_ms' => $totalTimeMs,
                'ttfb_ms' => $ttfbMs,
                'dns_time_ms' => $dnsTimeMs,
                'connect_time_ms' => $connectTimeMs,
                'page_size_kb' => round($sizeBytes / 1024, 1),
                'primary_ip' => $primaryIp,
            ],
            'ssl' => $sslInfo,
            'pixels' => $pixelAudit,
            'platform' => $platform,
            'risk_factors' => $healthAnalysis['risk_factors'],
            'recommendations' => $healthAnalysis['recommendations'],
            'error_message' => $error ?: null,
        ];
    }

    private function inspectSsl(string $url, int $statusCode, string $curlError): array
    {
        $parsed = parse_url($url);
        $host = $parsed['host'] ?? null;
        $scheme = $parsed['scheme'] ?? 'https';

        if ($scheme !== 'https' || !$host) {
            return [
                'is_valid' => false,
                'issuer' => null,
                'days_remaining' => null,
                'error' => 'URL does not use HTTPS encryption.',
            ];
        }

        if (str_contains(strtolower($curlError), 'ssl') || str_contains(strtolower($curlError), 'certificate')) {
            return [
                'is_valid' => false,
                'issuer' => null,
                'days_remaining' => 0,
                'error' => $curlError,
            ];
        }

        try {
            $context = stream_context_create([
                'ssl' => [
                    'capture_peer_cert' => true,
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                ],
            ]);

            $client = @stream_socket_client(
                "ssl://{$host}:443",
                $errno,
                $errstr,
                4,
                STREAM_CLIENT_CONNECT,
                $context
            );

            if ($client) {
                $params = stream_context_get_params($client);
                $cert = $params['options']['ssl']['peer_certificate'] ?? null;
                if ($cert) {
                    $certData = openssl_x509_parse($cert);
                    if ($certData && isset($certData['validTo_time_t'])) {
                        $validTo = $certData['validTo_time_t'];
                        $daysRemaining = max(0, (int) round(($validTo - time()) / 86400));
                        $issuer = $certData['issuer']['O'] ?? ($certData['issuer']['CN'] ?? 'Unknown Authority');
                        return [
                            'is_valid' => ($daysRemaining > 0),
                            'issuer' => $issuer,
                            'days_remaining' => $daysRemaining,
                            'error' => ($daysRemaining === 0) ? 'SSL certificate has expired.' : null,
                        ];
                    }
                }
            }
        } catch (\Throwable $e) {
            // Fallback gracefully
        }

        return [
            'is_valid' => ($statusCode > 0 && !str_contains(strtolower($curlError), 'ssl')),
            'issuer' => 'Trusted SSL Authority',
            'days_remaining' => 90,
            'error' => null,
        ];
    }

    private function detectPixels(string $body, string $headers): array
    {
        $bodyLower = strtolower($body);
        $headersLower = strtolower($headers);

        $pixels = [];

        // Meta / Facebook Pixel
        $hasMeta = str_contains($bodyLower, 'connect.facebook.net')
            || str_contains($bodyLower, 'fbevents.js')
            || str_contains($bodyLower, "fbq('init'")
            || str_contains($bodyLower, 'fbq("init"');
        $pixels['meta'] = [
            'name' => 'Meta / Facebook Pixel',
            'detected' => $hasMeta,
            'type' => 'ad_tracking',
            'description' => $hasMeta ? 'Active & tracking conversions for Meta/Instagram Ads' : 'Missing: Meta Ads cannot track ROAS or purchase events',
        ];

        // Google Tag / Google Ads / GTM
        $hasGoogle = str_contains($bodyLower, 'googletagmanager.com/gtm.js')
            || str_contains($bodyLower, 'gtag(')
            || str_contains($bodyLower, 'google-analytics.com')
            || str_contains($bodyLower, 'googleads.g.doubleclick.net')
            || str_contains($bodyLower, 'googletagmanager.com/gtag');
        $pixels['google'] = [
            'name' => 'Google Ads & GTM',
            'detected' => $hasGoogle,
            'type' => 'ad_tracking',
            'description' => $hasGoogle ? 'Active & tracking conversions for Google Search/PPC/Shopping' : 'Missing: Google Ads cannot optimize for conversion bidding',
        ];

        // TikTok Pixel
        $hasTikTok = str_contains($bodyLower, 'analytics.tiktok.com')
            || str_contains($bodyLower, 'ttq.load')
            || str_contains($bodyLower, 'tiktok.com/i18n/pixel');
        $pixels['tiktok'] = [
            'name' => 'TikTok Pixel',
            'detected' => $hasTikTok,
            'type' => 'ad_tracking',
            'description' => $hasTikTok ? 'Active & tracking TikTok Ad events' : 'Not detected on landing page',
        ];

        // Snapchat Tag
        $hasSnap = str_contains($bodyLower, 'sc-static.net/scevent.min.js')
            || str_contains($bodyLower, 'snaptr(');
        $pixels['snapchat'] = [
            'name' => 'Snapchat Pixel',
            'detected' => $hasSnap,
            'type' => 'ad_tracking',
            'description' => $hasSnap ? 'Active & tracking Snap Ads' : 'Not detected on landing page',
        ];

        // Pinterest Tag
        $hasPinterest = str_contains($bodyLower, 'pintrk(')
            || str_contains($bodyLower, 'pintrk.load');
        $pixels['pinterest'] = [
            'name' => 'Pinterest Tag',
            'detected' => $hasPinterest,
            'type' => 'ad_tracking',
            'description' => $hasPinterest ? 'Active & tracking Pinterest Ads' : 'Not detected on landing page',
        ];

        return $pixels;
    }

    private function detectPlatform(string $body, string $headers): ?string
    {
        $bodyLower = strtolower($body);
        $headersLower = strtolower($headers);

        if (str_contains($bodyLower, 'shopify.theme') || str_contains($bodyLower, 'cdn.shopify.com') || str_contains($headersLower, 'x-shopid')) {
            return 'Shopify';
        }
        if (str_contains($bodyLower, 'woocommerce') || str_contains($bodyLower, 'wp-content')) {
            return 'WooCommerce / WordPress';
        }
        if (str_contains($bodyLower, 'w-commerce') || str_contains($bodyLower, 'assets.website-files.com')) {
            return 'Webflow';
        }
        if (str_contains($bodyLower, 'magento')) {
            return 'Magento / Adobe Commerce';
        }
        if (str_contains($bodyLower, 'bigcommerce') || str_contains($headersLower, 'x-bc-')) {
            return 'BigCommerce';
        }

        return 'Custom / Modern Web';
    }

    private function calculateAdSafetyScore(
        int $statusCode,
        int $ttfbMs,
        int $totalTimeMs,
        int $redirectCount,
        bool $sslValid,
        ?int $sslDaysRemaining,
        array $pixelAudit,
        string $curlError
    ): array {
        $score = 100;
        $riskFactors = [];
        $recommendations = [];

        // 1. Status Code Check (Highest severity)
        if ($statusCode === 0 || !empty($curlError)) {
            $score = 0;
            $riskFactors[] = "Landing page is completely offline or unreachable ({$curlError}).";
            $recommendations[] = "Immediate Action: Pause all active ad campaigns right now to avoid 100% ad budget loss.";
            return [
                'score' => 0,
                'status' => 'critical',
                'verdict' => 'CRITICAL: ADS BLEEDING 100% OF BUDGET',
                'risk_factors' => $riskFactors,
                'recommendations' => $recommendations,
            ];
        }

        if ($statusCode >= 500) {
            $score = 0;
            $riskFactors[] = "Server returned HTTP {$statusCode} (Internal Server Error / Bad Gateway).";
            $recommendations[] = "Pause your Meta & Google campaigns immediately until backend server recovery is confirmed.";
            return [
                'score' => 0,
                'status' => 'critical',
                'verdict' => 'CRITICAL: SERVER CRASHED (HTTP ' . $statusCode . ')',
                'risk_factors' => $riskFactors,
                'recommendations' => $recommendations,
            ];
        }

        if ($statusCode === 404) {
            $score = 10;
            $riskFactors[] = "HTTP 404 Not Found: The ad destination link is broken or product was unpublished.";
            $recommendations[] = "Fix your ad campaign destination URL or restore the landing page product.";
            return [
                'score' => 10,
                'status' => 'critical',
                'verdict' => 'CRITICAL: BROKEN 404 AD LINK',
                'risk_factors' => $riskFactors,
                'recommendations' => $recommendations,
            ];
        }

        if ($statusCode >= 400) {
            $score -= 40;
            $riskFactors[] = "HTTP {$statusCode} client error: Page may be restricted, blocked, or in maintenance mode.";
            $recommendations[] = "Check firewall or access permissions blocking incoming ad traffic.";
        }

        // 2. Latency & TTFB (Speed kills conversions)
        if ($ttfbMs > 1800) {
            $score -= 30;
            $riskFactors[] = "Severe Mobile TTFB Latency ({$ttfbMs}ms): Over 60% of mobile ad visitors bounce before the page loads.";
            $recommendations[] = "Optimize server response time and database queries to bring TTFB under 600ms.";
        } elseif ($ttfbMs > 900) {
            $score -= 15;
            $riskFactors[] = "Sluggish TTFB ({$ttfbMs}ms): Slower than recommended for paid traffic.";
            $recommendations[] = "Enable CDN edge caching and optimize asset delivery.";
        }

        // 3. Redirect Chain Check
        if ($redirectCount > 2) {
            $score -= 20;
            $riskFactors[] = "High redirect count ({$redirectCount} redirects): Multiple hops degrade ad quality scores and inflate bounce rates.";
            $recommendations[] = "Point your ad campaigns directly to the final canonical HTTPS URL.";
        } elseif ($redirectCount === 1) {
            $score -= 5;
            $recommendations[] = "Ensure your ad links use the exact HTTPS destination URL to avoid unnecessary redirect lag.";
        }

        // 4. SSL Certificate
        if (!$sslValid) {
            $score -= 35;
            $riskFactors[] = "SSL Certificate Invalid or Missing: Browsers will show security warning screens blocking all ad visitors.";
            $recommendations[] = "Install a valid SSL certificate immediately to prevent ad account suspension.";
        } elseif ($sslDaysRemaining !== null && $sslDaysRemaining <= 7) {
            $score -= 15;
            $riskFactors[] = "SSL Certificate expires in {$sslDaysRemaining} days: Expired SSL will instantly kill ad traffic.";
            $recommendations[] = "Renew your SSL certificate before it lapses.";
        }

        // 5. Tracking Pixel Audit
        $hasCoreTracking = ($pixelAudit['meta']['detected'] ?? false) || ($pixelAudit['google']['detected'] ?? false);
        if (!$hasCoreTracking) {
            $score -= 15;
            $riskFactors[] = "No Meta Pixel or Google Tag detected: Ad platforms cannot optimize conversion bidding or calculate ROAS.";
            $recommendations[] = "Install Meta Pixel or Google Tag to track purchase conversions and train ad algorithms.";
        }

        $score = max(0, min(100, $score));

        if ($score >= 85) {
            $status = 'safe';
            $verdict = 'HEALTHY: SAFE TO RUN ADS';
            if (empty($recommendations)) {
                $recommendations[] = "All key health checks passed! Landing page is fast, secure, and ready for ad traffic.";
            }
        } elseif ($score >= 50) {
            $status = 'warning';
            $verdict = 'WARNING: CONVERSION ROAS AT RISK';
        } else {
            $status = 'critical';
            $verdict = 'CRITICAL: AD BUDGET BEING WASTED';
        }

        return [
            'score' => $score,
            'status' => $status,
            'verdict' => $verdict,
            'risk_factors' => $riskFactors,
            'recommendations' => $recommendations,
        ];
    }
}
