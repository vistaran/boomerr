<?php

namespace App\Http\Controllers\Tools;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\Log;

class DnsRecordController extends Controller
{
    public function check(Request $request)
    {
        $request->validate([
            'domain' => 'required|string|max:255',
        ]);

        $rawDomain = $request->input('domain');
        $domain = $this->normalizeDomain($rawDomain);

        if (!$domain || str_contains($domain, '..') || !preg_match('/^(?!:\/\/)(?=.{1,255}$)(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)+[a-zA-Z]{2,}$/', $domain)) {
            return response()->json([
                'error' => 'Invalid domain format provided.',
            ], 422);
        }

        $cacheKey = 'tools:dns:' . md5($domain);

        try {
            $results = Cache::remember($cacheKey, 60, function () use ($domain) {
                return $this->performDnsLookup($domain);
            });

            return response()->json([
                'domain' => $domain,
                'records' => $results,
            ]);
        } catch (\Exception $e) {
            Log::error('DNS Record Checker Error: ' . $e->getMessage(), [
                'domain' => $domain,
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'An error occurred while resolving DNS records. Please try again later.',
            ], 500);
        }
    }

    private function normalizeDomain(string $domain): string
    {
        $domain = strtolower(trim($domain));

        // Remove protocol
        if (str_starts_with($domain, 'http://')) {
            $domain = substr($domain, 7);
        } elseif (str_starts_with($domain, 'https://')) {
            $domain = substr($domain, 8);
        }

        // Remove trailing slash and paths
        $parts = explode('/', $domain);
        $domain = $parts[0];

        // Remove ports
        $parts = explode(':', $domain);
        $domain = $parts[0];

        return $domain;
    }

    /**
     * Resolve DNS records using ultra-fast native DNS resolution with parallel DoH fallback.
     */
    private function performDnsLookup(string $domain): array
    {
        $results = [
            'A' => [],
            'AAAA' => [],
            'CNAME' => [],
            'MX' => [],
            'TXT' => [],
            'NS' => [],
        ];

        // 1. Primary Layer: Fast Native PHP DNS lookup (10ms - 100ms)
        $hasNativeResults = false;
        try {
            $nativeRecords = @dns_get_record($domain, DNS_A | DNS_AAAA | DNS_CNAME | DNS_MX | DNS_TXT | DNS_NS);
            if (is_array($nativeRecords) && !empty($nativeRecords)) {
                foreach ($nativeRecords as $r) {
                    $type = $r['type'] ?? '';
                    $ttl = $r['ttl'] ?? null;

                    switch ($type) {
                        case 'A':
                            if (!empty($r['ip'])) {
                                $results['A'][] = ['value' => $r['ip'], 'ttl' => $ttl];
                                $hasNativeResults = true;
                            }
                            break;
                        case 'AAAA':
                            if (!empty($r['ipv6'])) {
                                $results['AAAA'][] = ['value' => $r['ipv6'], 'ttl' => $ttl];
                                $hasNativeResults = true;
                            }
                            break;
                        case 'CNAME':
                            if (!empty($r['target'])) {
                                $results['CNAME'][] = ['value' => rtrim($r['target'], '.'), 'ttl' => $ttl];
                                $hasNativeResults = true;
                            }
                            break;
                        case 'MX':
                            if (!empty($r['target'])) {
                                $results['MX'][] = [
                                    'value' => rtrim($r['target'], '.'),
                                    'pri' => $r['pri'] ?? 0,
                                    'ttl' => $ttl
                                ];
                                $hasNativeResults = true;
                            }
                            break;
                        case 'TXT':
                            $txtVal = $r['txt'] ?? (isset($r['entries']) && is_array($r['entries']) ? implode('', $r['entries']) : '');
                            if ($txtVal !== '') {
                                $results['TXT'][] = ['value' => $txtVal, 'ttl' => $ttl];
                                $hasNativeResults = true;
                            }
                            break;
                        case 'NS':
                            if (!empty($r['target'])) {
                                $results['NS'][] = ['value' => rtrim($r['target'], '.'), 'ttl' => $ttl];
                                $hasNativeResults = true;
                            }
                            break;
                    }
                }
            }

            // CNAME Fallback: Apex domains cannot have CNAMEs by DNS RFC specification.
            // If user searches apex domain and no CNAME found, check www. subdomain.
            if (empty($results['CNAME']) && !str_starts_with($domain, 'www.')) {
                $wwwRecords = @dns_get_record('www.' . $domain, DNS_CNAME);
                if (is_array($wwwRecords)) {
                    foreach ($wwwRecords as $r) {
                        if (!empty($r['target'])) {
                            $results['CNAME'][] = [
                                'value' => rtrim($r['target'], '.') . ' (for www)',
                                'ttl' => $r['ttl'] ?? null,
                            ];
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            $hasNativeResults = false;
        }

        // If native DNS returned records, format and return immediately
        if ($hasNativeResults) {
            return $this->formatFinalResults($results);
        }

        // 2. Secondary Layer: Concurrent Parallel DoH pool (Cloudflare + Google fallback)
        return $this->resolveViaDoHPool($domain);
    }

    /**
     * Fallback resolution via asynchronous concurrent DoH pool.
     */
    private function resolveViaDoHPool(string $domain): array
    {
        $types = [
            'A' => 1,
            'AAAA' => 28,
            'CNAME' => 5,
            'MX' => 15,
            'TXT' => 16,
            'NS' => 2,
        ];

        $results = [
            'A' => [],
            'AAAA' => [],
            'CNAME' => [],
            'MX' => [],
            'TXT' => [],
            'NS' => [],
        ];

        $checkWwwCname = !str_starts_with($domain, 'www.');

        // Dispatch all DoH requests concurrently in parallel via Http::pool
        $responses = Http::pool(function (Pool $pool) use ($domain, $types, $checkWwwCname) {
            $reqs = [];
            foreach ($types as $typeName => $typeConst) {
                $reqs[$typeName] = $pool->as($typeName)
                    ->timeout(3)
                    ->withHeaders(['Accept' => 'application/dns-json'])
                    ->get('https://cloudflare-dns.com/dns-query', [
                        'name' => $domain,
                        'type' => $typeConst,
                    ]);
            }

            if ($checkWwwCname) {
                $reqs['WWW_CNAME'] = $pool->as('WWW_CNAME')
                    ->timeout(3)
                    ->withHeaders(['Accept' => 'application/dns-json'])
                    ->get('https://cloudflare-dns.com/dns-query', [
                        'name' => 'www.' . $domain,
                        'type' => 5,
                    ]);
            }

            return $reqs;
        });

        foreach ($types as $typeName => $typeConst) {
            $resp = $responses[$typeName] ?? null;
            if ($resp instanceof \Illuminate\Http\Client\Response && $resp->successful()) {
                $data = $resp->json();
                if (!empty($data['Answer']) && is_array($data['Answer'])) {
                    foreach ($data['Answer'] as $record) {
                        if (($record['type'] ?? null) === $typeConst) {
                            $results[$typeName][] = $this->formatDohRecord($record, $typeName);
                        }
                    }
                }
            }
        }

        // Check fallback for www. CNAME if apex CNAME was empty
        if (empty($results['CNAME']) && $checkWwwCname) {
            $wwwResp = $responses['WWW_CNAME'] ?? null;
            if ($wwwResp instanceof \Illuminate\Http\Client\Response && $wwwResp->successful()) {
                $data = $wwwResp->json();
                if (!empty($data['Answer']) && is_array($data['Answer'])) {
                    foreach ($data['Answer'] as $record) {
                        if (($record['type'] ?? null) === 5) {
                            $formatted = $this->formatDohRecord($record, 'CNAME');
                            $formatted['value'] = $formatted['value'] . ' (for www)';
                            $results['CNAME'][] = $formatted;
                        }
                    }
                }
            }
        }

        // If Cloudflare DoH was completely empty or failed, attempt Google DoH pool as final safeguard
        $totalFound = array_sum(array_map('count', $results));
        if ($totalFound === 0) {
            $results = $this->resolveViaGoogleDoHPool($domain, $types, $checkWwwCname);
        }

        return $this->formatFinalResults($results);
    }

    /**
     * Final fallback using Google DoH with parallel requests.
     */
    private function resolveViaGoogleDoHPool(string $domain, array $types, bool $checkWwwCname): array
    {
        $results = [
            'A' => [],
            'AAAA' => [],
            'CNAME' => [],
            'MX' => [],
            'TXT' => [],
            'NS' => [],
        ];

        try {
            $responses = Http::pool(function (Pool $pool) use ($domain, $types, $checkWwwCname) {
                $reqs = [];
                foreach ($types as $typeName => $typeConst) {
                    $reqs[$typeName] = $pool->as($typeName)
                        ->timeout(3)
                        ->get('https://dns.google/resolve', [
                            'name' => $domain,
                            'type' => $typeConst,
                        ]);
                }

                if ($checkWwwCname) {
                    $reqs['WWW_CNAME'] = $pool->as('WWW_CNAME')
                        ->timeout(3)
                        ->get('https://dns.google/resolve', [
                            'name' => 'www.' . $domain,
                            'type' => 5,
                        ]);
                }

                return $reqs;
            });

            foreach ($types as $typeName => $typeConst) {
                $resp = $responses[$typeName] ?? null;
                if ($resp instanceof \Illuminate\Http\Client\Response && $resp->successful()) {
                    $data = $resp->json();
                    if (!empty($data['Answer']) && is_array($data['Answer'])) {
                        foreach ($data['Answer'] as $record) {
                            if (($record['type'] ?? null) === $typeConst) {
                                $results[$typeName][] = $this->formatDohRecord($record, $typeName);
                            }
                        }
                    }
                }
            }

            if (empty($results['CNAME']) && $checkWwwCname) {
                $wwwResp = $responses['WWW_CNAME'] ?? null;
                if ($wwwResp instanceof \Illuminate\Http\Client\Response && $wwwResp->successful()) {
                    $data = $wwwResp->json();
                    if (!empty($data['Answer']) && is_array($data['Answer'])) {
                        foreach ($data['Answer'] as $record) {
                            if (($record['type'] ?? null) === 5) {
                                $formatted = $this->formatDohRecord($record, 'CNAME');
                                $formatted['value'] = $formatted['value'] . ' (for www)';
                                $results['CNAME'][] = $formatted;
                            }
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            // Ignore fallback errors
        }

        return $results;
    }

    private function formatDohRecord(array $record, string $type): array
    {
        $formatted = [
            'ttl' => $record['TTL'] ?? null,
            'value' => null,
        ];

        $data = $record['data'] ?? '';

        switch ($type) {
            case 'A':
            case 'AAAA':
            case 'CNAME':
            case 'NS':
                $formatted['value'] = rtrim($data, '.');
                break;
            case 'MX':
                $parts = explode(' ', $data, 2);
                if (count($parts) === 2) {
                    $formatted['pri'] = (int) $parts[0];
                    $formatted['value'] = rtrim($parts[1], '.');
                } else {
                    $formatted['value'] = rtrim($data, '.');
                }
                break;
            case 'TXT':
                $formatted['value'] = trim($data, '"');
                $formatted['value'] = stripslashes($formatted['value']);
                break;
        }

        return $formatted;
    }

    private function formatFinalResults(array $results): array
    {
        // Deduplicate records in each category by value & priority
        foreach ($results as $type => &$records) {
            $unique = [];
            $seen = [];
            foreach ($records as $rec) {
                if (empty($rec['value'])) {
                    continue;
                }
                $key = ($rec['pri'] ?? '') . ':' . $rec['value'];
                if (!isset($seen[$key])) {
                    $seen[$key] = true;
                    $unique[] = $rec;
                }
            }
            $records = $unique;
        }
        unset($records);

        // Sort MX records by priority ascending
        if (!empty($results['MX'])) {
            usort($results['MX'], function ($a, $b) {
                return ($a['pri'] ?? 0) <=> ($b['pri'] ?? 0);
            });
        }

        return $results;
    }
}
