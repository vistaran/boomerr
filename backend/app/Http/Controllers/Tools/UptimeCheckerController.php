<?php

namespace App\Http\Controllers\Tools;

use App\Helpers\SecurityHelper;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class UptimeCheckerController extends Controller
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
                'error' => 'Invalid URL provided.',
            ], 422);
        }

        // SSRF Guard: Validate scheme, resolved IP, and block private/cloud-metadata addresses
        $reason = null;
        if (!SecurityHelper::isSafeUrl($url, $reason)) {
            return response()->json([
                'error' => $reason ?: 'Access to the specified URL or IP address is prohibited for security reasons.',
            ], 422);
        }

        try {
            $results = $this->performUptimeCheck($url);

            return response()->json([
                'url' => $url,
                'metrics' => $results,
            ]);
        } catch (\Exception $e) {
            Log::error('Uptime Checker Error: ' . $e->getMessage(), ['url' => $url]);

            if (str_contains($e->getMessage(), 'SSRF Protection Blocked')) {
                return response()->json([
                    'error' => $e->getMessage(),
                ], 422);
            }

            return response()->json([
                'error' => 'An error occurred while checking the URL.',
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

    private function performUptimeCheck(string $url): array
    {
        $requestResult = SecurityHelper::executeSafeRequest($url, [
            'method' => 'HEAD',
            'nobody' => true,
            'timeout' => 10,
            'max_redirects' => 5,
            'user_agent' => 'Mozilla/5.0 (compatible; BoomerrUptimeBot/1.0; +https://' . (parse_url(config('app.url', 'http://localhost'), PHP_URL_HOST) ?: 'localhost') . ')',
        ]);

        $statusCode = $requestResult['http_code'];
        $isUp = false;
        $status = 'offline';

        if ($statusCode >= 200 && $statusCode < 400) {
            $isUp = true;
            $status = 'online';
        } elseif ($statusCode >= 400 && $statusCode < 500) {
            $isUp = true;
            $status = 'degraded';
        }

        if (!$requestResult['success'] || $statusCode === 0) {
            $isUp = false;
            $status = 'offline';
        }

        return [
            'is_up' => $isUp,
            'status' => $status,
            'status_code' => $statusCode,
            'total_time_ms' => $requestResult['total_time_ms'],
            'namelookup_time_ms' => $requestResult['namelookup_time_ms'],
            'connect_time_ms' => $requestResult['connect_time_ms'],
            'ttfb_ms' => $requestResult['starttransfer_time_ms'],
            'redirect_count' => $requestResult['redirect_count'],
            'primary_ip' => $requestResult['primary_ip'],
            'error_message' => $requestResult['error'],
        ];
    }
}
