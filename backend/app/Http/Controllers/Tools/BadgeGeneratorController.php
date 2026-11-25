<?php

namespace App\Http\Controllers\Tools;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BadgeGeneratorController extends Controller
{
    public function generate(Request $request)
    {
        $url = $request->query('url');
        $style = $request->query('style', 'flat'); // flat, plastic, for-the-badge
        $theme = $request->query('theme', 'dark'); // light, dark

        if (!$url || !filter_var($this->normalizeUrl($url), FILTER_VALIDATE_URL)) {
            return response($this->getSvg('Invalid URL', 'error', $style, $theme))
                ->header('Content-Type', 'image/svg+xml')
                ->header('Cache-Control', 'no-cache, no-store, must-revalidate');
        }

        $url = $this->normalizeUrl($url);
        $isUp = $this->performUptimeCheck($url);

        $statusText = $isUp ? 'Online' : 'Offline';
        $statusColor = $isUp ? 'success' : 'error';

        return response($this->getSvg($statusText, $statusColor, $style, $theme))
            ->header('Content-Type', 'image/svg+xml')
            ->header('Cache-Control', 'public, max-age=60'); // Cache for 60 seconds
    }

    private function normalizeUrl(string $url): string
    {
        $url = trim($url);
        if (!str_starts_with($url, 'http://') && !str_starts_with($url, 'https://')) {
            $url = 'https://' . $url;
        }
        return $url;
    }

    private function performUptimeCheck(string $url): bool
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_NOBODY, true); // We only need HEAD to check status
        curl_setopt($ch, CURLOPT_TIMEOUT, 5); // Fast timeout for badges
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
        $botHost = parse_url(config('app.url', 'http://localhost:8080'), PHP_URL_HOST) ?: 'localhost';
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (compatible; BoomerrBadgeBot/1.0; +https://{$botHost})");

        curl_exec($ch);
        $error = curl_error($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($error || $statusCode === 0) {
            return false;
        }

        if ($statusCode >= 200 && $statusCode < 500) {
            return true;
        }

        return false;
    }

    private function getSvg(string $statusText, string $statusColor, string $style, string $theme): string
    {
        // Colors
        $leftBg = $theme === 'dark' ? '#1e293b' : '#f1f5f9';
        $leftText = $theme === 'dark' ? '#ffffff' : '#0f172a';

        $rightBg = $statusColor === 'success' ? '#10b981' : '#ef4444';
        $rightText = '#ffffff';

        $label = 'Uptime';

        // Calculate text widths roughly
        $labelWidth = strlen($label) * 7 + 10;
        $statusWidth = strlen($statusText) * 7 + 10;

        $totalWidth = $labelWidth + $statusWidth;

        // SVG templates based on style
        if ($style === 'for-the-badge') {
            $label = strtoupper($label);
            $statusText = strtoupper($statusText);
            $labelWidth = strlen($label) * 8 + 14;
            $statusWidth = strlen($statusText) * 8 + 14;
            $totalWidth = $labelWidth + $statusWidth;

            return '<svg xmlns="http://www.w3.org/2000/svg" width="' . $totalWidth . '" height="28" role="img" aria-label="' . $label . ': ' . $statusText . '">
                <title>' . $label . ': ' . $statusText . '</title>
                <g shape-rendering="crispEdges">
                    <rect width="' . $labelWidth . '" height="28" fill="' . $leftBg . '"/>
                    <rect x="' . $labelWidth . '" width="' . $statusWidth . '" height="28" fill="' . $rightBg . '"/>
                </g>
                <g fill="' . $leftText . '" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="10" font-weight="bold" letter-spacing="1.2">
                    <text x="' . ($labelWidth / 2) . '" y="19">' . $label . '</text>
                    <text fill="' . $rightText . '" x="' . ($labelWidth + ($statusWidth / 2)) . '" y="19">' . $statusText . '</text>
                </g>
            </svg>';
        }

        if ($style === 'plastic') {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="' . $totalWidth . '" height="20" role="img" aria-label="' . $label . ': ' . $statusText . '">
                <title>' . $label . ': ' . $statusText . '</title>
                <linearGradient id="s" x2="0" y2="100%">
                    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
                    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
                    <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
                    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
                </linearGradient>
                <clipPath id="r">
                    <rect width="' . $totalWidth . '" height="20" rx="3" fill="#fff"/>
                </clipPath>
                <g clip-path="url(#r)">
                    <rect width="' . $labelWidth . '" height="20" fill="' . $leftBg . '"/>
                    <rect x="' . $labelWidth . '" width="' . $statusWidth . '" height="20" fill="' . $rightBg . '"/>
                    <rect width="' . $totalWidth . '" height="20" fill="url(#s)"/>
                </g>
                <g fill="' . $leftText . '" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
                    <text aria-hidden="true" x="' . ($labelWidth * 10 / 2) . '" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="' . ($labelWidth * 10 - 200) . '">' . $label . '</text>
                    <text x="' . ($labelWidth * 10 / 2) . '" y="140" transform="scale(.1)" fill="' . $leftText . '" textLength="' . ($labelWidth * 10 - 200) . '">' . $label . '</text>
                    <text aria-hidden="true" x="' . (($labelWidth * 10) + ($statusWidth * 10 / 2)) . '" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="' . ($statusWidth * 10 - 200) . '">' . $statusText . '</text>
                    <text x="' . (($labelWidth * 10) + ($statusWidth * 10 / 2)) . '" y="140" transform="scale(.1)" fill="' . $rightText . '" textLength="' . ($statusWidth * 10 - 200) . '">' . $statusText . '</text>
                </g>
            </svg>';
        }

        // Default (flat)
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' . $totalWidth . '" height="20" role="img" aria-label="' . $label . ': ' . $statusText . '">
            <title>' . $label . ': ' . $statusText . '</title>
            <linearGradient id="s" x2="0" y2="100%">
                <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
                <stop offset="1" stop-opacity=".1"/>
            </linearGradient>
            <clipPath id="r">
                <rect width="' . $totalWidth . '" height="20" rx="3" fill="#fff"/>
            </clipPath>
            <g clip-path="url(#r)">
                <rect width="' . $labelWidth . '" height="20" fill="' . $leftBg . '"/>
                <rect x="' . $labelWidth . '" width="' . $statusWidth . '" height="20" fill="' . $rightBg . '"/>
                <rect width="' . $totalWidth . '" height="20" fill="url(#s)"/>
            </g>
            <g fill="' . $leftText . '" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
                <text aria-hidden="true" x="' . ($labelWidth * 10 / 2) . '" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="' . ($labelWidth * 10 - 100) . '">' . $label . '</text>
                <text x="' . ($labelWidth * 10 / 2) . '" y="140" transform="scale(.1)" fill="' . $leftText . '" textLength="' . ($labelWidth * 10 - 100) . '">' . $label . '</text>
                <text aria-hidden="true" x="' . (($labelWidth * 10) + ($statusWidth * 10 / 2)) . '" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="' . ($statusWidth * 10 - 100) . '">' . $statusText . '</text>
                <text x="' . (($labelWidth * 10) + ($statusWidth * 10 / 2)) . '" y="140" transform="scale(.1)" fill="' . $rightText . '" textLength="' . ($statusWidth * 10 - 100) . '">' . $statusText . '</text>
            </g>
        </svg>';
    }
}
