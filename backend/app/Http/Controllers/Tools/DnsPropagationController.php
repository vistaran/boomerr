<?php

namespace App\Http\Controllers\Tools;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Pool;

class DnsPropagationController extends Controller
{
    private $resolvers = [
        ['name' => 'Cloudflare', 'location' => 'Global', 'url' => 'https://cloudflare-dns.com/dns-query'],
        ['name' => 'Google', 'location' => 'Global', 'url' => 'https://dns.google/resolve'],
        ['name' => 'Quad9', 'location' => 'Global', 'url' => 'https://dns.quad9.net:5053/dns-query'],
        ['name' => 'AliDNS', 'location' => 'Asia', 'url' => 'https://dns.alidns.com/resolve'],
        ['name' => 'NextDNS', 'location' => 'Global', 'url' => 'https://dns.nextdns.io/dns-query'],
        ['name' => 'AdGuard', 'location' => 'Global', 'url' => 'https://dns.adguard-dns.com/dns-query'],
        ['name' => 'ControlD', 'location' => 'Global', 'url' => 'https://freedns.controld.com/p0'],
        ['name' => 'Mullvad', 'location' => 'Europe', 'url' => 'https://adblock.doh.mullvad.net/dns-query']
    ];

    public function check(Request $request)
    {
        $request->validate([
            'domain' => 'required|string|max:255',
            'type' => 'required|string|in:A,AAAA,CNAME,MX,NS,TXT'
        ]);

        $rawDomain = $request->input('domain');
        $domain = $this->normalizeDomain($rawDomain);
        $type = $request->input('type');

        if (!$domain || !preg_match('/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/', $domain)) {
            return response()->json([
                'error' => 'Invalid domain format provided.',
            ], 422);
        }

        // Cache the DNS check for 60 seconds to prevent abuse and speed up repeated lookups
        $cacheKey = 'tools:dns-propagation:' . md5($domain . ':' . $type);

        try {
            $results = Cache::remember($cacheKey, 60, function () use ($domain, $type) {
                return $this->performPropagationLookup($domain, $type);
            });

            return response()->json([
                'domain' => $domain,
                'type' => $type,
                'results' => $results['results'],
                'summary' => $results['summary']
            ]);
        } catch (\Exception $e) {
            Log::error('DNS Propagation Checker Error: ' . $e->getMessage(), ['domain' => $domain, 'type' => $type]);

            return response()->json([
                'error' => 'An error occurred while resolving DNS propagation. Please try again later.',
            ], 500);
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

    private function getRecordTypeNumber(string $type): int
    {
        $types = [
            'A' => 1,
            'NS' => 2,
            'CNAME' => 5,
            'MX' => 15,
            'TXT' => 16,
            'AAAA' => 28,
        ];
        return $types[$type] ?? 1;
    }

    private function performPropagationLookup(string $domain, string $type): array
    {
        $typeNum = $this->getRecordTypeNumber($type);
        
        $responses = Http::pool(function (Pool $pool) use ($domain, $type) {
            $requests = [];
            foreach ($this->resolvers as $resolver) {
                $requests[] = $pool->as($resolver['name'])
                    ->timeout(8)
                    ->withHeaders(['Accept' => 'application/dns-json'])
                    ->get($resolver['url'], [
                        'name' => $domain,
                        'type' => $type
                    ]);
            }
            return $requests;
        });

        // Fallback for CNAME on apex domain
        if ($type === 'CNAME' && !str_starts_with($domain, 'www.')) {
            $needsFallback = true;
            foreach ($this->resolvers as $resolver) {
                $name = $resolver['name'];
                $response = $responses[$name] ?? null;
                if ($response instanceof \Illuminate\Http\Client\Response && $response->successful()) {
                    $data = $response->json();
                    if (!empty($data['Answer'])) {
                        $needsFallback = false;
                        break;
                    }
                }
            }

            if ($needsFallback) {
                $domain = 'www.' . $domain;
                $responses = Http::pool(function (Pool $pool) use ($domain, $type) {
                    $requests = [];
                    foreach ($this->resolvers as $resolver) {
                        $requests[] = $pool->as($resolver['name'])
                            ->timeout(8)
                            ->withHeaders(['Accept' => 'application/dns-json'])
                            ->get($resolver['url'], [
                                'name' => $domain,
                                'type' => $type
                            ]);
                    }
                    return $requests;
                });
            }
        }

        $results = [];
        $successful = 0;
        $failed = 0;
        $allValues = [];

        foreach ($this->resolvers as $resolver) {
            $name = $resolver['name'];
            $response = $responses[$name] ?? null;
            if ($response instanceof \Illuminate\Http\Client\Response && $response->successful()) {
                $data = $response->json();

                // Status 0 means NOERROR
                if (isset($data['Status']) && $data['Status'] === 0) {
                    $values = [];
                    if (!empty($data['Answer'])) {
                        foreach ($data['Answer'] as $answer) {
                            if (isset($answer['type']) && $answer['type'] === $typeNum) {
                                // Clean up TXT records wrapping quotes
                                $val = $answer['data'] ?? '';
                                if ($type === 'TXT' && str_starts_with($val, '"') && str_ends_with($val, '"')) {
                                    $val = trim($val, '"');
                                }
                                $values[] = $val;
                            }
                        }
                    }

                    // Sort values for consistency check
                    sort($values);

                    $results[] = [
                        'resolver' => $name,
                        'location' => $resolver['location'],
                        'status' => 'success',
                        'values' => $values
                    ];

                    if (!empty($values)) {
                        $hash = md5(implode('|', $values));
                        $allValues[$hash] = true;
                    } else {
                        // Empty result (e.g. no records found)
                        $allValues['empty'] = true;
                    }

                    $successful++;
                } else {
                    $results[] = [
                        'resolver' => $name,
                        'location' => $resolver['location'],
                        'status' => 'failed',
                        'values' => []
                    ];
                    $failed++;
                }
            } else {
                $results[] = [
                    'resolver' => $name,
                    'location' => $resolver['location'],
                    'status' => 'failed',
                    'values' => []
                ];
                $failed++;
            }
        }

        $isConsistent = count($allValues) <= 1;

        return [
            'results' => $results,
            'summary' => [
                'total' => count($this->resolvers),
                'successful' => $successful,
                'failed' => $failed,
                'consistent' => $isConsistent && $successful > 0
            ]
        ];
    }
}
