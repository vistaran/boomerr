<?php

namespace App\Services;

use Exception;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class SafeWebhookHttpClient
{
    /**
     * Resolve host, validate all IPs against SSRF/private/loopback ranges,
     * and execute a POST request pinned to a validated public IP via CURLOPT_RESOLVE.
     *
     * @param string $url
     * @param array $payload
     * @param array $headers
     * @param int $timeout
     * @return Response
     * @throws Exception
     */
    public static function post(string $url, array $payload = [], array $headers = [], int $timeout = 5): Response
    {
        $parsed = parse_url($url);
        if (!$parsed || !isset($parsed['host'])) {
            throw new Exception("SSRF blocked: Malformed webhook URL.");
        }

        $scheme = strtolower($parsed['scheme'] ?? '');
        if ($scheme !== 'https') {
            throw new Exception("SSRF blocked: Only HTTPS webhooks are allowed.");
        }

        $rawHost = $parsed['host'];
        // Strip square brackets if rawHost was an IPv6 literal (e.g. [2606:4700:...])
        $cleanHost = trim($rawHost, '[]');
        if (empty($cleanHost)) {
            throw new Exception("SSRF blocked: Invalid webhook host.");
        }

        // Fast check for literal localhost or loopback strings
        if (in_array(strtolower($cleanHost), ['localhost', '127.0.0.1', '::1', '0.0.0.0'])) {
            throw new Exception("SSRF blocked: Localhost addresses are not allowed.");
        }

        $resolvedIps = self::resolveHostIps($cleanHost);
        if (empty($resolvedIps)) {
            throw new Exception("SSRF blocked: Could not resolve webhook host.");
        }

        // Validate EVERY resolved IP to prevent mixed safe/unsafe IP rebinding
        foreach ($resolvedIps as $ip) {
            if (!self::isPublicIp($ip)) {
                throw new Exception("SSRF blocked: Host resolves to a private or reserved IP address ({$ip}).");
            }
        }

        // Prefer IPv4 for transport when available, as container environments lack IPv6 routing
        $ipv4s = array_values(array_filter($resolvedIps, fn($ip) => filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)));
        $targetIps = !empty($ipv4s) ? $ipv4s : $resolvedIps;

        $resolveEntries = [];
        $port = $parsed['port'] ?? 443;

        foreach ($targetIps as $ip) {
            $formattedIp = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) ? "[{$ip}]" : $ip;
            $resolveEntries[] = "{$cleanHost}:{$port}:{$formattedIp}";
        }

        if (empty($resolveEntries)) {
            throw new Exception("SSRF blocked: No valid public IP found for host.");
        }

        $curlOptions = [
            CURLOPT_RESOLVE => $resolveEntries,
        ];
        if (!empty($ipv4s)) {
            $curlOptions[CURLOPT_IPRESOLVE] = CURL_IPRESOLVE_V4;
        }

        $client = Http::timeout($timeout)
            ->withOptions([
                'curl' => $curlOptions,
            ]);

        if (!empty($headers)) {
            $client = $client->withHeaders($headers);
        }

        return $client->post($url, $payload);
    }

    /**
     * Resolve all IPv4 and IPv6 addresses for a host.
     *
     * @param string $host
     * @return array<string>
     */
    public static function resolveHostIps(string $host): array
    {
        // If already a valid IP address literal
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return [$host];
        }

        $ips = [];

        // Fetch A and AAAA DNS records
        $records = @dns_get_record($host, DNS_A + DNS_AAAA);
        if (is_array($records)) {
            foreach ($records as $record) {
                if (!empty($record['ip'])) {
                    $ips[] = $record['ip'];
                } elseif (!empty($record['ipv6'])) {
                    $ips[] = $record['ipv6'];
                }
            }
        }

        // Fallback to gethostbynamel for IPv4 if dns_get_record returned empty
        if (empty($ips)) {
            $ipv4List = @gethostbynamel($host);
            if (is_array($ipv4List)) {
                foreach ($ipv4List as $ip) {
                    $ips[] = $ip;
                }
            }
        }

        // Fallback to single gethostbyname
        if (empty($ips)) {
            $singleIp = @gethostbyname($host);
            if ($singleIp && $singleIp !== $host) {
                $ips[] = $singleIp;
            }
        }

        return array_values(array_unique($ips));
    }

    /**
     * Check if an IP address is a valid public, non-private, non-reserved, non-loopback address.
     *
     * @param string $ip
     * @return bool
     */
    public static function isPublicIp(string $ip): bool
    {
        return \App\Helpers\SecurityHelper::isPublicIp($ip);
    }
}
