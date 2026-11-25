<?php

namespace App\Http\Controllers\Tools;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class SslCheckerController extends Controller
{
    public function check(Request $request)
    {
        $request->validate([
            'domain' => 'required|string|max:255',
        ]);

        $rawDomain = $request->input('domain');
        $domain = $this->normalizeDomain($rawDomain);

        if (!$domain || !preg_match('/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/', $domain)) {
            return response()->json([
                'error' => 'Invalid domain format provided.',
            ], 422);
        }

        $cacheKey = 'tools:ssl:' . md5($domain);

        try {
            $results = Cache::remember($cacheKey, 300, function () use ($domain) {
                return $this->performSslCheck($domain);
            });

            return response()->json([
                'domain' => $domain,
                'certificate' => $results,
            ]);
        } catch (\Exception $e) {
            Log::error('SSL Checker Error: ' . $e->getMessage(), ['domain' => $domain]);

            return response()->json([
                'error' => $e->getMessage(),
            ], 400);
        }
    }

    private function normalizeDomain(string $domain): string
    {
        $domain = strtolower(trim($domain));
        if (str_starts_with($domain, 'http://'))
            $domain = substr($domain, 7);
        elseif (str_starts_with($domain, 'https://'))
            $domain = substr($domain, 8);
        $parts = explode('/', $domain);
        $domain = $parts[0];
        $parts = explode(':', $domain);
        $domain = $parts[0];
        return $domain;
    }

    private function performSslCheck(string $domain): array
    {
        $get = stream_context_create([
            "ssl" => [
                "capture_peer_cert" => true,
                "verify_peer" => false,
                "verify_peer_name" => false,
            ]
        ]);

        $timeout = 10;
        $client = @stream_socket_client(
            "ssl://" . $domain . ":443",
            $errorNumber,
            $errorString,
            $timeout,
            STREAM_CLIENT_CONNECT,
            $get
        );

        if (!$client) {
            throw new \Exception("Could not connect to $domain on port 443. The domain might be down or not support HTTPS.");
        }

        $params = stream_context_get_params($client);

        if (!isset($params['options']['ssl']['peer_certificate'])) {
            fclose($client);
            throw new \Exception("Could not retrieve SSL certificate for $domain.");
        }

        $certResource = $params['options']['ssl']['peer_certificate'];

        // Try to get crypto protocol version
        $meta = stream_get_meta_data($client);
        $protocol = $meta['crypto']['protocol'] ?? 'Unknown';
        $cipher = $meta['crypto']['cipher_name'] ?? 'Unknown';

        fclose($client);

        $certInfo = openssl_x509_parse($certResource);

        if ($certInfo === false) {
            throw new \Exception("Failed to parse the SSL certificate.");
        }

        $validFrom = $certInfo['validFrom_time_t'] ?? null;
        $validTo = $certInfo['validTo_time_t'] ?? null;

        $now = time();
        $isExpired = $validTo !== null && $validTo < $now;
        $isNotYetValid = $validFrom !== null && $validFrom > $now;

        $isValid = !$isExpired && !$isNotYetValid;

        $daysRemaining = 0;
        if ($validTo !== null) {
            $diff = $validTo - $now;
            $daysRemaining = $diff > 0 ? floor($diff / 86400) : 0;
        }

        // Extract SANs (Subject Alternative Names)
        $sans = [];
        if (isset($certInfo['extensions']['subjectAltName'])) {
            $altNames = explode(', ', $certInfo['extensions']['subjectAltName']);
            foreach ($altNames as $altName) {
                if (str_starts_with($altName, 'DNS:')) {
                    $sans[] = substr($altName, 4);
                }
            }
        }

        // Determine Validation Type
        $certType = 'Domain Validation (DV)';
        if (isset($certInfo['subject']['O'])) {
            // If organization is present, it's at least OV. Check for EV specific OIDs if needed, 
            // but a simple OV/EV guess:
            if (isset($certInfo['subject']['businessCategory']) || isset($certInfo['subject']['jurisdictionC'])) {
                $certType = 'Extended Validation (EV)';
            } else {
                $certType = 'Organization Validation (OV)';
            }
        }

        $serialNumber = $certInfo['serialNumberHex'] ?? 'Unknown';

        // Fetch Platform & Hosting via HTTP Headers
        $platform = 'Unknown';
        $hosting = 'Unknown';
        try {
            $response = \Illuminate\Support\Facades\Http::timeout(5)->withoutVerifying()->head('https://' . $domain);
            $serverHeader = strtolower($response->header('server') ?? '');
            $poweredBy = strtolower($response->header('x-powered-by') ?? '');

            // Guess Hosting
            if (str_contains($serverHeader, 'cloudflare'))
                $hosting = 'Cloudflare';
            elseif (str_contains($serverHeader, 'vercel'))
                $hosting = 'Vercel';
            elseif (str_contains($serverHeader, 'netlify'))
                $hosting = 'Netlify';
            elseif (str_contains($serverHeader, 'amazon') || str_contains($serverHeader, 'awselb'))
                $hosting = 'AWS';
            elseif (str_contains($serverHeader, 'google'))
                $hosting = 'Google Cloud';
            else
                $hosting = $response->header('server') ?? 'Unknown Server';

            // Guess Platform
            if (str_contains($poweredBy, 'next.js'))
                $platform = 'Next.js';
            elseif (str_contains($poweredBy, 'express'))
                $platform = 'Express.js';
            elseif (str_contains($poweredBy, 'php'))
                $platform = 'PHP';
            elseif (str_contains($poweredBy, 'asp.net'))
                $platform = 'ASP.NET';
            elseif ($response->header('x-shopify-stage'))
                $platform = 'Shopify';
            elseif (str_contains($serverHeader, 'nginx'))
                $platform = 'Nginx';
            elseif (str_contains($serverHeader, 'apache'))
                $platform = 'Apache';
        } catch (\Exception $e) {
            // Ignore if we can't fetch headers
        }

        return [
            'is_valid' => $isValid,
            'is_expired' => $isExpired,
            'days_remaining' => $daysRemaining,
            'valid_from' => $validFrom ? date('c', $validFrom) : null,
            'valid_to' => $validTo ? date('c', $validTo) : null,
            'issuer' => [
                'common_name' => $certInfo['issuer']['CN'] ?? 'Unknown',
                'organization' => $certInfo['issuer']['O'] ?? 'Unknown',
                'country' => $certInfo['issuer']['C'] ?? null,
            ],
            'subject' => [
                'common_name' => $certInfo['subject']['CN'] ?? 'Unknown',
                'organization' => $certInfo['subject']['O'] ?? null,
            ],
            'sans' => $sans,
            'serial_number' => $serialNumber,
            'type' => $certType,
            'signature_algorithm' => $certInfo['signatureTypeSN'] ?? 'Unknown',
            'protocol' => $protocol,
            'cipher' => $cipher,
            'hosting' => $hosting,
            'platform' => $platform,
        ];
    }
}
