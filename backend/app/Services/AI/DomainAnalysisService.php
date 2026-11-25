<?php

namespace App\Services\AI;

use App\Models\Domain;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class DomainAnalysisService
{
    /**
     * Trigger DeepSeek to analyze a domain and return normalized payload.
     *
     * @return array{scores:array<string,int|null>,suggestions:array<string,array<int,string>>}
     */
    public function analyze(Domain $domain): array
    {
        $url = $domain->url;
        
        // Fetch real-time metrics
        $start = microtime(true);
        $loadTimeMs = 0;
        $title = 'Missing';
        $description = 'Missing';
        $status = 'Unknown';
        $htmlSize = 0.0;

        try {
            // Add scheme if missing
            $targetUrl = preg_match('#^https?://#i', $url) === 1 ? $url : 'https://' . $url;
            
            $siteResponse = Http::timeout(10)->withOptions(['verify' => false])->get($targetUrl);
            $loadTimeMs = (int) round((microtime(true) - $start) * 1000);
            $html = $siteResponse->body();
            $status = $siteResponse->status();
            $htmlSize = round(strlen($html) / 1024, 2);

            // Basic extraction
            if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $titleMatch)) {
                $title = trim(strip_tags($titleMatch[1]));
            }
            if (preg_match('/<meta[^>]*name=["\']description["\'][^>]*content=["\'](.*?)["\']/is', $html, $descMatch)) {
                $description = trim($descMatch[1]);
            }
        } catch (\Exception $e) {
            $status = 0;
            $loadTimeMs = $domain->last_response_time_ms ?? 0;
        }

        $apiKey = config('services.ai.key', env('DEEPSEEK_API_KEY', env('AI_API_KEY')));
        if (! $apiKey) {
            return $this->generateHeuristicAnalysis($domain, $loadTimeMs, $status, $htmlSize, $title, $description);
        }

        $model = config('services.ai.model', env('DEEPSEEK_MODEL', 'deepseek-chat'));
        $baseUrl = rtrim(config('services.ai.base_url', env('AI_BASE_URL', 'https://api.deepseek.com/v1')), '/');
        $endpoint = "{$baseUrl}/chat/completions";

        $prompt = <<<PROMPT
You are an expert web monitoring analyst. Analyze the following real metrics for the website {$url}:

Real-time Metrics:
- HTTP Status: {$status}
- Page Load Time: {$loadTimeMs} ms
- HTML Payload Size: {$htmlSize} KB
- SEO Title: {$title}
- SEO Meta Description: {$description}

Historical Database Metrics:
- Last Response Time: {$domain->last_response_time_ms} ms
- SSL Days Remaining: {$domain->ssl_days_remaining}
- Failure Count: {$domain->failure_count}

Based STRICTLY on this data and web best practices, rate the following out of 100:
- Performance (e.g. fast load time and small payload = high score)
- SEO (e.g. presence of title and description = high score)
- UX (e.g. fast load, HTTPS = good UX)

Return JSON with keys: performance, seo, ux, performanceSuggestions, seoSuggestions, uxSuggestions, securitySuggestions.
Each suggestions array must contain 5-6 concise, actionable bullet points focused on web monitoring improvements that reference these exact metrics where possible.
Do not return fewer than 5 suggestions for any category.
PROMPT;

        try {
            $response = Http::timeout(30)
                ->withToken($apiKey)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($endpoint, [
                    'model' => $model,
                    'messages' => [
                        ['role' => 'system', 'content' => 'You are a web analyst. Always output strictly valid JSON.'],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'temperature' => 0.2,
                    'response_format' => ['type' => 'json_object'],
                ]);

            if ($response->successful()) {
                $text = data_get($response->json(), 'choices.0.message.content');
                if ($text) {
                    $text = preg_replace('/```json\s*(.*?)\s*```/s', '$1', $text);
                    $text = preg_replace('/```\s*(.*?)\s*```/s', '$1', $text);
                    $payload = json_decode($text, true);

                    if (is_array($payload)) {
                        return [
                            'scores' => [
                                'performance' => $this->score($payload['performance'] ?? null),
                                'seo' => $this->score($payload['seo'] ?? null),
                                'ux' => $this->score($payload['ux'] ?? null),
                            ],
                            'suggestions' => [
                                'performance' => $this->lines($payload['performanceSuggestions'] ?? []),
                                'seo' => $this->lines($payload['seoSuggestions'] ?? []),
                                'ux' => $this->lines($payload['uxSuggestions'] ?? []),
                                'security' => $this->lines($payload['securitySuggestions'] ?? []),
                            ],
                        ];
                    }
                }
            }
        } catch (\Throwable $e) {
            // Fall back to heuristic analysis if AI request fails
        }

        return $this->generateHeuristicAnalysis($domain, $loadTimeMs, $status, $htmlSize, $title, $description);
    }

    /**
     * Generate baseline heuristic metrics and recommendations from real probe measurements.
     */
    protected function generateHeuristicAnalysis(Domain $domain, int $loadTimeMs, $status, float $htmlSize, string $title, string $description): array
    {
        $hasTitle = ($title !== 'Missing' && !empty($title));
        $hasDesc = ($description !== 'Missing' && !empty($description));
        $is200 = ($status === 200 || $status === '200');
        $effectiveLoadMs = $loadTimeMs > 0 ? $loadTimeMs : ($domain->last_response_time_ms ?? 500);

        // Performance Score (0-100)
        if ($effectiveLoadMs <= 250) {
            $perfScore = 96;
        } elseif ($effectiveLoadMs <= 600) {
            $perfScore = 88;
        } elseif ($effectiveLoadMs <= 1200) {
            $perfScore = 78;
        } elseif ($effectiveLoadMs <= 2500) {
            $perfScore = 65;
        } elseif ($effectiveLoadMs <= 5000) {
            $perfScore = 45;
        } else {
            $perfScore = 25;
        }

        // SEO Score (0-100)
        $seoScore = 30;
        if ($is200) $seoScore += 20;
        if ($hasTitle) $seoScore += 30;
        if ($hasDesc) $seoScore += 20;

        // UX Score (0-100)
        $uxScore = 40;
        if (str_starts_with(strtolower($domain->url), 'https://')) $uxScore += 30;
        if ($effectiveLoadMs <= 1500) $uxScore += 20;
        if ($is200) $uxScore += 10;

        $perfSuggestions = [
            "Response latency measured at {$effectiveLoadMs}ms.",
            $effectiveLoadMs > 1000
                ? "Initial server response time is elevated ({$effectiveLoadMs}ms). Consider implementing edge CDN caching or server-side cache layers."
                : "Server latency is within acceptable thresholds for standard web applications.",
            $htmlSize > 500
                ? "HTML document payload size is {$htmlSize} KB. Enable Gzip/Brotli compression and minify assets to minimize transfer overhead."
                : "HTML document transfer size ({$htmlSize} KB) is lightweight and optimal for fast initial paint.",
            "Verify browser cache expiration headers (Cache-Control: max-age) on static assets (CSS, JS, fonts).",
            "Enable HTTP/2 or HTTP/3 multiplexing to reduce TCP handshake overhead on resource requests."
        ];

        $seoSuggestions = [
            $hasTitle
                ? "Page title found: '{$title}'."
                : "Missing or empty <title> tag. Add a descriptive title (50-60 characters) to optimize search indexing.",
            $hasDesc
                ? "Meta description found: '" . mb_substr($description, 0, 80) . "...'."
                : "Missing <meta name=\"description\">. Include a unique summary to improve click-through rates in search snippets.",
            "Verify canonical link tag (<link rel=\"canonical\">) is configured to prevent duplicate indexing.",
            "Ensure robots.txt is accessible and correctly declares sitemap location.",
            "Maintain valid Open Graph and Twitter card meta tags for link previews."
        ];

        $uxSuggestions = [
            str_starts_with(strtolower($domain->url), 'https://')
                ? "HTTPS encryption is active, providing secure transport for visitors."
                : "Site is served over unencrypted HTTP. Migrate to HTTPS immediately to prevent browser security warnings.",
            $effectiveLoadMs < 1200
                ? "Fast initial response provides a smooth perceived loading experience."
                : "Loading speed may impact perceived responsiveness. Prioritize above-the-fold content loading.",
            "Ensure mobile viewport meta tag (<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">) is configured.",
            "Eliminate layout shifts (CLS) by declaring explicit aspect ratios or width/height attributes on media.",
            "Ensure core interactive elements (buttons, links) are easily tap-friendly with adequate spacing on mobile devices."
        ];

        $sslDays = $domain->ssl_days_remaining;
        $securitySuggestions = [
            $sslDays !== null
                ? "SSL/TLS certificate is active with {$sslDays} days remaining."
                : "Monitor SSL certificate expiration to prevent unexpected certificate invalidation.",
            "Enforce HTTP Strict Transport Security (HSTS) with 'includeSubDomains' and 'preload' flags.",
            "Implement Content-Security-Policy (CSP) headers to restrict unauthorized script execution and mitigate XSS.",
            "Configure 'X-Content-Type-Options: nosniff' and 'X-Frame-Options: SAMEORIGIN' to protect against MIME-sniffing and clickjacking.",
            "Ensure TLS 1.2 or TLS 1.3 is enforced with modern cipher suites and deprecated protocols (TLS 1.0/1.1) disabled."
        ];

        return [
            'scores' => [
                'performance' => $perfScore,
                'seo' => $seoScore,
                'ux' => $uxScore,
            ],
            'suggestions' => [
                'performance' => $perfSuggestions,
                'seo' => $seoSuggestions,
                'ux' => $uxSuggestions,
                'security' => $securitySuggestions,
            ],
        ];
    }

    protected function score($value): ?int
    {
        if ($value === null) {
            return null;
        }

        $int = (int) round((float) $value);
        return max(0, min(100, $int));
    }

    /**
     * @param mixed $value
     * @return array<int,string>
     */
    protected function lines($value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $lines = array_map(function ($item) {
            return is_string($item) ? trim($item) : null;
        }, $value);

        return array_values(array_filter($lines));
    }
}
