<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class SslEnrichmentService
{
    private const CONNECT_TIMEOUT = 5;
    private const REQUEST_TIMEOUT = 10;

    /**
     * Enrich SSL data for a given domain URL
     *
     * @param string $url The domain URL (e.g., https://example.com)
     * @return array Enriched SSL data
     */
    public function enrichSslData(string $url): array
    {
        $targetUrl = $url;
        try {
            $response = Http::timeout(5)->withOptions([
                'allow_redirects' => ['strict' => true, 'max' => 3],
                'verify' => false,
            ])->get($url);
            if ($response->handlerStats() && !empty($response->handlerStats()['url'])) {
                $targetUrl = $response->handlerStats()['url'];
            }
        } catch (Throwable $e) {
            // Ignore and use original URL
        }

        $host = parse_url($targetUrl, PHP_URL_HOST) ?? $targetUrl;
        $host = str_replace('www.', '', $host); // Remove www. prefix

        $enrichedData = [
            'subject' => null,
            'sans' => [],
            'serial_number' => null,
            'signature_algorithm' => null,
            'certificate_type' => null,
            'platform' => null,
            'hosting_provider' => null,
        ];

        try {
            // Parse SSL certificate
            $certData = $this->parseSslCertificate($host);
            if ($certData) {
                $enrichedData = array_merge($enrichedData, $certData);
            }

            // Fetch from Certificate Transparency (crt.sh)
            $ctData = $this->fetchFromCertificateTransparency($host);
            if ($ctData) {
                $enrichedData = array_merge($enrichedData, $ctData);
            }

            // Infer platform/provider from HTTP headers
            $platformData = $this->inferPlatformFromHeaders($url);
            if ($platformData) {
                $enrichedData = array_merge($enrichedData, $platformData);
            }
        } catch (Throwable $e) {
            Log::warning('SSL enrichment failed', [
                'host' => $host,
                'error' => $e->getMessage()
            ]);
        }

        // Ensure all fields have a value, default to "Unknown"
        return array_map(fn($value) => $value ?? 'Unknown', $enrichedData);
    }

    /**
     * Parse SSL certificate using OpenSSL
     *
     * @param string $host
     * @return array|null
     */
    private function parseSslCertificate(string $host): ?array
    {
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
                self::CONNECT_TIMEOUT,
                STREAM_CLIENT_CONNECT,
                $context
            );

            if ($client === false) {
                return null;
            }

            $params = stream_context_get_params($client);
            fclose($client);

            if (!isset($params['options']['ssl']['peer_certificate'])) {
                return null;
            }

            $cert = openssl_x509_parse($params['options']['ssl']['peer_certificate']);
            if (!$cert) {
                return null;
            }

            // Extract certificate fields
            $data = [
                'subject' => $cert['subject']['CN'] ?? null,
                'serial_number' => $cert['serialNumberHex'] ?? $cert['serialNumber'] ?? null,
                'signature_algorithm' => $cert['signatureTypeSN'] ?? null,
            ];

            // Extract SANs (Subject Alternative Names)
            $sans = [];
            if (isset($cert['extensions']['subjectAltName'])) {
                $altNames = explode(', ', $cert['extensions']['subjectAltName']);
                foreach ($altNames as $altName) {
                    if (str_starts_with($altName, 'DNS:')) {
                        $sans[] = substr($altName, 4);
                    }
                }
            }
            $data['sans'] = $sans;

            // Infer certificate type from issuer
            if (isset($cert['issuer']['CN'])) {
                $issuerCN = strtolower($cert['issuer']['CN']);
                if (str_contains($issuerCN, 'let\'s encrypt') || str_contains($issuerCN, 'letsencrypt')) {
                    $data['certificate_type'] = 'Let\'s Encrypt (DV)';
                } elseif (str_contains($issuerCN, 'digicert')) {
                    $data['certificate_type'] = 'DigiCert';
                } elseif (str_contains($issuerCN, 'cloudflare')) {
                    $data['certificate_type'] = 'Cloudflare';
                } elseif (str_contains($issuerCN, 'google')) {
                    $data['certificate_type'] = 'Google Trust Services';
                } elseif (str_contains($issuerCN, 'sectigo') || str_contains($issuerCN, 'comodo')) {
                    $data['certificate_type'] = 'Sectigo (Comodo)';
                } else {
                    $data['certificate_type'] = 'Standard SSL';
                }
            }

            return $data;
        } catch (Throwable $e) {
            Log::debug('Certificate parsing failed', ['host' => $host, 'error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Fetch data from Certificate Transparency logs (crt.sh)
     *
     * @param string $host
     * @return array|null
     */
    private function fetchFromCertificateTransparency(string $host): ?array
    {
        try {
            $response = Http::timeout(self::REQUEST_TIMEOUT)
                ->get('https://crt.sh/', [
                    'q' => $host,
                    'output' => 'json',
                ]);

            if (!$response->successful() || !$response->json()) {
                return null;
            }

            $entries = $response->json();
            if (empty($entries)) {
                return null;
            }

            // Get the most recent entry
            usort($entries, fn($a, $b) => strtotime($b['entry_timestamp'] ?? '0') <=> strtotime($a['entry_timestamp'] ?? '0'));
            $latestEntry = $entries[0] ?? null;

            if (!$latestEntry) {
                return null;
            }

            $data = [];

            // Extract issuer CA if not already set
            if (isset($latestEntry['issuer_ca_id'])) {
                // crt.sh provides CA ID, we could map this but for simplicity, we'll leave it
            }

            if (isset($latestEntry['name_value'])) {
                // Additional SANs from CT logs
                $ctSans = array_filter(explode("\n", $latestEntry['name_value']));
                if (!empty($ctSans)) {
                    $data['sans'] = $ctSans;
                }
            }

            return $data;
        } catch (Throwable $e) {
            Log::debug('Certificate Transparency fetch failed', ['host' => $host, 'error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Infer platform/hosting provider from HTTP headers
     *
     * @param string $url
     * @return array|null
     */
    private function inferPlatformFromHeaders(string $url): ?array
    {
        try {
            $response = Http::timeout(self::REQUEST_TIMEOUT)
                ->withOptions(['verify' => false])
                ->head($url);

            $headers = $response->headers();
            $data = [];

            // Check for Cloudflare
            if (isset($headers['cf-ray']) || isset($headers['CF-RAY'])) {
                $data['platform'] = 'Cloudflare';
                $data['hosting_provider'] = 'Cloudflare CDN';
            }

            // Check for AWS
            if (isset($headers['x-amz-cf-id']) || isset($headers['X-Amz-Cf-Id'])) {
                $data['platform'] = 'AWS CloudFront';
                $data['hosting_provider'] = 'Amazon Web Services';
            }

            // Check for Vercel
            if (isset($headers['x-vercel-id']) || isset($headers['X-Vercel-Id'])) {
                $data['platform'] = 'Vercel';
                $data['hosting_provider'] = 'Vercel';
            }

            // Check for Netlify
            if (isset($headers['x-nf-request-id']) || isset($headers['X-NF-Request-Id'])) {
                $data['platform'] = 'Netlify';
                $data['hosting_provider'] = 'Netlify';
            }

            // Check for cPanel (common header)
            if (isset($headers['x-powered-by'])) {
                $poweredBy = is_array($headers['x-powered-by']) ? implode(', ', $headers['x-powered-by']) : $headers['x-powered-by'];
                if (str_contains(strtolower($poweredBy), 'cpanel')) {
                    $data['platform'] = 'cPanel';
                }
            }

            // Check for server header
            if (isset($headers['server'])) {
                $server = is_array($headers['server']) ? implode(', ', $headers['server']) : $headers['server'];
                $serverLower = strtolower($server);

                if (str_contains($serverLower, 'cloudflare')) {
                    $data['platform'] = $data['platform'] ?? 'Cloudflare';
                } elseif (str_contains($serverLower, 'apache')) {
                    $data['platform'] = $data['platform'] ?? 'Apache';
                } elseif (str_contains($serverLower, 'nginx')) {
                    $data['platform'] = $data['platform'] ?? 'Nginx';
                } elseif (str_contains($serverLower, 'iis')) {
                    $data['platform'] = $data['platform'] ?? 'Microsoft IIS';
                } elseif (str_contains($serverLower, 'litespeed')) {
                    $data['platform'] = $data['platform'] ?? 'LiteSpeed';
                }
            }

            return !empty($data) ? $data : null;
        } catch (Throwable $e) {
            Log::debug('Platform inference failed', ['url' => $url, 'error' => $e->getMessage()]);
            return null;
        }
    }
}
