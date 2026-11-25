<?php

namespace App\Helpers;

use Exception;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;

class SecurityHelper
{
    public const MAX_REDIRECTS = 5;

    /**
     * Validate a user-provided URL against SSRF, loopback, private networks, and metadata endpoints.
     * Throws a ValidationException if unsafe.
     *
     * @param string $url
     * @param string $attributeName
     * @return string The normalized URL
     * @throws ValidationException
     */
    public static function validateUrl(string $url, string $attributeName = 'url'): string
    {
        $reason = null;
        if (!self::isSafeUrl($url, $reason)) {
            throw ValidationException::withMessages([
                $attributeName => [$reason ?: 'The provided URL resolves to a prohibited or private network address.'],
            ]);
        }

        return $url;
    }

    /**
     * Check if a URL is safe to query (no private IPs, loopback, cloud metadata, or unsafe schemes).
     *
     * @param string $url
     * @param string|null $reason Out parameter providing rejection reason
     * @return bool
     */
    public static function isSafeUrl(string $url, ?string &$reason = null): bool
    {
        $parsed = parse_url(trim($url));
        if (!$parsed || empty($parsed['host'])) {
            $reason = 'Invalid or malformed URL.';
            return false;
        }

        $scheme = strtolower($parsed['scheme'] ?? '');
        if (!in_array($scheme, ['http', 'https'], true)) {
            $reason = 'Only HTTP and HTTPS protocols are permitted.';
            return false;
        }

        $rawHost = $parsed['host'];
        $cleanHost = trim($rawHost, '[]');

        if (empty($cleanHost)) {
            $reason = 'Invalid host in URL.';
            return false;
        }

        // 1. Literal host name checks
        $lowerHost = strtolower($cleanHost);
        if ($lowerHost === 'localhost' || str_ends_with($lowerHost, '.localhost') || str_ends_with($lowerHost, '.local') || str_ends_with($lowerHost, '.internal')) {
            $reason = 'Localhost and internal domain names are prohibited.';
            return false;
        }

        // 2. Resolve DNS records (A & AAAA)
        $ips = self::resolveHostIps($cleanHost);
        if (empty($ips)) {
            $reason = "Could not resolve hostname '{$cleanHost}' to an IP address.";
            return false;
        }

        // 3. Validate EVERY resolved IP
        foreach ($ips as $ip) {
            if (!self::isPublicIp($ip)) {
                $reason = "The host '{$cleanHost}' resolves to a private, loopback, or reserved IP address ({$ip}).";
                return false;
            }
        }

        return true;
    }

    /**
     * Resolve all IPv4 and IPv6 addresses for a given hostname.
     *
     * @param string $host
     * @return array<string>
     */
    public static function resolveHostIps(string $host): array
    {
        $clean = trim($host, '[]');
        if (filter_var($clean, FILTER_VALIDATE_IP)) {
            return [$clean];
        }

        $ips = [];

        // Query DNS A and AAAA records
        $records = @dns_get_record($clean, DNS_A + DNS_AAAA);
        if (is_array($records)) {
            foreach ($records as $r) {
                if (!empty($r['ip'])) {
                    $ips[] = $r['ip'];
                } elseif (!empty($r['ipv6'])) {
                    $ips[] = $r['ipv6'];
                }
            }
        }

        // Fallback to gethostbynamel for IPv4
        if (empty($ips)) {
            $ipv4List = @gethostbynamel($clean);
            if (is_array($ipv4List)) {
                foreach ($ipv4List as $ip) {
                    $ips[] = $ip;
                }
            }
        }

        // Fallback to gethostbyname
        if (empty($ips)) {
            $single = @gethostbyname($clean);
            if ($single && $single !== $clean) {
                $ips[] = $single;
            }
        }

        return array_values(array_unique($ips));
    }

    /**
     * Strictly verifies whether an IP is public and globally routable.
     * Blocks RFC 1918, RFC 3927 (AWS metadata 169.254.x.x), loopback, ULA, and mapped IPv6.
     *
     * @param string $ip
     * @return bool
     */
    public static function isPublicIp(string $ip): bool
    {
        // 1. Must be a valid IP format
        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            return false;
        }

        // 2. Standard filter validation against private & reserved ranges
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return false;
        }

        // 3. IPv4 specific checks
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $long = ip2long($ip);
            if ($long === false) {
                return false;
            }

            // 0.0.0.0/8 (Current network)
            if (($long & 0xFF000000) === 0x00000000) {
                return false;
            }
            // 127.0.0.0/8 (Loopback)
            if (($long & 0xFF000000) === 0x7F000000) {
                return false;
            }
            // 10.0.0.0/8 (Private RFC 1918)
            if (($long & 0xFF000000) === 0x0A000000) {
                return false;
            }
            // 100.64.0.0/10 (Carrier-grade NAT)
            if (($long & 0xFFC00000) === 0x64400000) {
                return false;
            }
            // 169.254.0.0/16 (Link-local / AWS & Cloud Metadata)
            if (($long & 0xFFFF0000) === 0xA9FE0000) {
                return false;
            }
            // 172.16.0.0/12 (Private RFC 1918)
            if (($long & 0xFFF00000) === 0xAC100000) {
                return false;
            }
            // 192.168.0.0/16 (Private RFC 1918)
            if (($long & 0xFFFF0000) === 0xC0A80000) {
                return false;
            }
            // 224.0.0.0/4 (Multicast) and 240.0.0.0/4 (Reserved)
            if (($long & 0xE0000000) === 0xE0000000) {
                return false;
            }
            // 255.255.255.255 (Broadcast)
            if ($long === -1 || $long === 0xFFFFFFFF) {
                return false;
            }
        }

        // 4. IPv6 specific checks
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $lower = strtolower($ip);
            if ($lower === '::1' || $lower === '::') {
                return false;
            }

            // Handle IPv4-mapped IPv6 (::ffff:x.x.x.x or ::ffff:hex)
            if (str_starts_with($lower, '::ffff:')) {
                $mappedPart = substr($lower, 7);
                if (filter_var($mappedPart, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                    return self::isPublicIp($mappedPart);
                }
                return false; // Reject ambiguous mapped addresses
            }

            $binary = inet_pton($ip);
            if ($binary === false || strlen($binary) !== 16) {
                return false;
            }

            $firstByte = ord($binary[0]);
            $secondByte = ord($binary[1]);

            // fe80::/10 (Link-local unicast: 0xFE80 - 0xFEBF)
            if ($firstByte === 0xFE && ($secondByte & 0xC0) === 0x80) {
                return false;
            }

            // fc00::/7 (Unique local address ULA: 0xFC00 - 0xFDFF)
            if (($firstByte & 0xFE) === 0xFC) {
                return false;
            }

            // ff00::/8 (Multicast)
            if ($firstByte === 0xFF) {
                return false;
            }
        }

        return true;
    }

    /**
     * Execute an HTTP GET / HEAD / POST request safely with:
     * 1. Disabled automatic redirects (CURLOPT_FOLLOWLOCATION = false).
     * 2. Manual redirect validation for up to 5 hops, verifying every hop's target IP.
     * 3. IP pinning via CURLOPT_RESOLVE to prevent DNS rebinding attacks.
     *
     * @param string $url
     * @param array $options [
     *     'method' => 'GET'|'HEAD'|'POST',
     *     'timeout' => int (seconds),
     *     'max_redirects' => int,
     *     'headers' => array,
     *     'body' => string|null,
     *     'nobody' => bool (HEAD check),
     *     'user_agent' => string,
     *     'verify_ssl' => bool,
     * ]
     * @return array [
     *     'success' => bool,
     *     'http_code' => int,
     *     'final_url' => string,
     *     'total_time_ms' => int,
     *     'namelookup_time_ms' => int,
     *     'connect_time_ms' => int,
     *     'starttransfer_time_ms' => int,
     *     'redirect_count' => int,
     *     'primary_ip' => string|null,
     *     'headers' => array,
     *     'header_string' => string,
     *     'body' => string,
     *     'error' => string|null,
     * ]
     * @throws Exception If an SSRF attempt is detected during initial validation or any redirect hop
     */
    public static function executeSafeRequest(string $url, array $options = []): array
    {
        $currentUrl = $url;
        $maxRedirects = $options['max_redirects'] ?? self::MAX_REDIRECTS;
        $timeout = $options['timeout'] ?? 15;
        $method = strtoupper($options['method'] ?? 'GET');
        $nobody = $options['nobody'] ?? ($method === 'HEAD');
        $userAgent = $options['user_agent'] ?? ('BoomerrSecurityBot/1.0 (+https://' . (config('app.url') ? parse_url(config('app.url'), PHP_URL_HOST) : 'localhost') . ')');
        $customHeaders = $options['headers'] ?? [];
        $body = $options['body'] ?? null;
        $verifySsl = $options['verify_ssl'] ?? true;

        $redirectCount = 0;
        $totalStartTime = microtime(true);
        $lastInfo = [];
        $lastError = null;
        $lastHeaderString = '';
        $lastBody = '';

        while ($redirectCount <= $maxRedirects) {
            // 1. Validate current hop URL
            $reason = null;
            if (!self::isSafeUrl($currentUrl, $reason)) {
                throw new Exception("SSRF Protection Blocked Request: {$reason} (Target: {$currentUrl})");
            }

            $parsed = parse_url($currentUrl);
            $rawHost = $parsed['host'];
            $cleanHost = trim($rawHost, '[]');
            $scheme = strtolower($parsed['scheme'] ?? 'https');
            $port = $parsed['port'] ?? ($scheme === 'https' ? 443 : 80);

            // 2. Resolve safe IPs and build CURLOPT_RESOLVE map
            $resolvedIps = self::resolveHostIps($cleanHost);
            
            // Prefer IPv4 for transport when available, as standard container environments lack IPv6 routing
            $ipv4s = array_values(array_filter($resolvedIps, fn($ip) => filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)));
            $targetIps = !empty($ipv4s) ? $ipv4s : $resolvedIps;
            $primaryIp = $targetIps[0] ?? null;

            $resolveEntries = [];
            foreach ($targetIps as $ip) {
                $formattedIp = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) ? "[{$ip}]" : $ip;
                $resolveEntries[] = "{$cleanHost}:{$port}:{$formattedIp}";
            }

            // 3. Initialize and configure cURL handle
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $currentUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HEADER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, min(6, $timeout));
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false); // DO NOT follow automatically!
            curl_setopt($ch, CURLOPT_USERAGENT, $userAgent);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, $verifySsl);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, $verifySsl ? 2 : 0);

            if (!empty($ipv4s)) {
                curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
            }

            if (!empty($resolveEntries)) {
                curl_setopt($ch, CURLOPT_RESOLVE, $resolveEntries);
            }

            if ($nobody) {
                curl_setopt($ch, CURLOPT_NOBODY, true);
            } elseif ($method === 'POST') {
                curl_setopt($ch, CURLOPT_POST, true);
                if ($body !== null) {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
                }
            } elseif ($method !== 'GET') {
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
                if ($body !== null) {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
                }
            }

            if (!empty($customHeaders)) {
                curl_setopt($ch, CURLOPT_HTTPHEADER, $customHeaders);
            }

            $rawResponse = curl_exec($ch);
            $lastError = curl_error($ch);
            $lastInfo = curl_getinfo($ch);
            $headerSize = $lastInfo['header_size'] ?? 0;

            if ($rawResponse !== false && $headerSize > 0) {
                $lastHeaderString = substr($rawResponse, 0, $headerSize);
                $lastBody = substr($rawResponse, $headerSize);
            } else {
                $lastHeaderString = '';
                $lastBody = '';
            }

            curl_close($ch);

            $statusCode = (int) ($lastInfo['http_code'] ?? 0);

            // 4. Check for redirect responses
            if (in_array($statusCode, [301, 302, 303, 307, 308], true)) {
                $location = self::extractRedirectLocation($lastHeaderString);
                if (!empty($location)) {
                    $nextUrl = self::resolveRelativeUrl($currentUrl, $location);
                    $redirectCount++;
                    if ($redirectCount > $maxRedirects) {
                        throw new Exception("SSRF / HTTP Error: Exceeded maximum allowed redirects ({$maxRedirects}).");
                    }
                    $currentUrl = $nextUrl;
                    continue; // Loop next hop
                }
            }

            // No more redirects or non-redirect status reached
            break;
        }

        $totalDurationMs = (int) round((microtime(true) - $totalStartTime) * 1000);
        $headersArray = self::parseHeaders($lastHeaderString);

        return [
            'success' => empty($lastError) && ($lastInfo['http_code'] ?? 0) > 0,
            'http_code' => (int) ($lastInfo['http_code'] ?? 0),
            'final_url' => $currentUrl,
            'total_time_ms' => $totalDurationMs,
            'namelookup_time_ms' => (int) round(($lastInfo['namelookup_time'] ?? 0) * 1000),
            'connect_time_ms' => (int) round(($lastInfo['connect_time'] ?? 0) * 1000),
            'starttransfer_time_ms' => (int) round(($lastInfo['starttransfer_time'] ?? 0) * 1000),
            'redirect_count' => $redirectCount,
            'primary_ip' => $lastInfo['primary_ip'] ?? $primaryIp,
            'headers' => $headersArray,
            'header_string' => $lastHeaderString,
            'body' => $lastBody,
            'error' => $lastError ?: null,
        ];
    }

    /**
     * Extract Location header from raw HTTP headers string.
     */
    private static function extractRedirectLocation(string $headerString): ?string
    {
        if (preg_match('/^Location:\s*(.+)$/im', $headerString, $matches)) {
            return trim($matches[1]);
        }
        return null;
    }

    /**
     * Resolve a potentially relative URL against a base URL.
     */
    private static function resolveRelativeUrl(string $base, string $relative): string
    {
        if (parse_url($relative, PHP_URL_SCHEME) !== null) {
            return $relative; // Already absolute
        }

        $baseParsed = parse_url($base);
        $scheme = $baseParsed['scheme'] ?? 'http';
        $host = $baseParsed['host'] ?? '';
        $port = isset($baseParsed['port']) ? ':' . $baseParsed['port'] : '';

        if (str_starts_with($relative, '//')) {
            return $scheme . ':' . $relative;
        }

        if (str_starts_with($relative, '/')) {
            return "{$scheme}://{$host}{$port}{$relative}";
        }

        $path = $baseParsed['path'] ?? '/';
        $dir = preg_replace('#/[^/]*$#', '', $path);
        return "{$scheme}://{$host}{$port}{$dir}/{$relative}";
    }

    /**
     * Parse raw headers string into an associative array.
     */
    private static function parseHeaders(string $rawHeaders): array
    {
        $headers = [];
        $lines = explode("\r\n", trim($rawHeaders));
        foreach ($lines as $line) {
            if (str_contains($line, ':')) {
                [$k, $v] = explode(':', $line, 2);
                $key = strtolower(trim($k));
                $headers[$key] = trim($v);
            }
        }
        return $headers;
    }
}
