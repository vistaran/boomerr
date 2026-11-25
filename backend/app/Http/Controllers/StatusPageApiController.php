<?php

namespace App\Http\Controllers;

use App\Services\PlatformStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class StatusPageApiController extends Controller
{
  public function __construct(private PlatformStatusService $statusService)
  {
  }

  /**
   * GET /api/status
   * Public endpoint - no authentication required.
   * Cached for 30 seconds so concurrent 30s polls from multiple clients don't all hit the DB.
   */
  public function index(): JsonResponse
  {
    $payload = Cache::remember('boomerr_status_payload', 30, function () {
      return $this->statusService->getStatusPayload();
    });

    return response()->json($payload);
  }

  /**
   * GET /api/status/incidents
   * Public endpoint to fetch historical incidents with pagination and filtering.
   */
  public function incidents(\Illuminate\Http\Request $request): JsonResponse
  {
    $query = \App\Models\BoomerrIncident::query()->orderByDesc('incident_started_at');

    if ($request->has('service')) {
      $query->whereJsonContains('incident_affected_services', $request->input('service'));
    }

    if ($request->has('status')) {
      $query->where('incident_status', $request->input('status'));
    }

    if ($request->has('date_from')) {
      $query->where('incident_started_at', '>=', $request->input('date_from'));
    }

    if ($request->has('date_to')) {
      $query->where('incident_started_at', '<=', $request->input('date_to'));
    }

    $incidents = $query->paginate(15);

    $incidents->getCollection()->transform(function ($incident) {
      return $this->statusService->formatIncident($incident);
    });

    return response()->json($incidents);
  }

  /**
   * GET /api/status/og-image.png
   * Dynamic OpenGraph image (spec §9.1) generating an SVG/PNG status banner with live status and 30d uptime.
   */
  public function ogImage(): \Illuminate\Http\Response
  {
    $payload = Cache::remember('boomerr_status_payload', 30, function () {
      return $this->statusService->getStatusPayload();
    });

    $status = $payload['overall_status'] ?? 'operational';
    $uptime = number_format($payload['uptime_30d'] ?? 100, 2);

    $statusLabels = [
      'operational' => ['label' => 'ALL SYSTEMS OPERATIONAL', 'color' => '#10b981', 'bg' => '#064e3b'],
      'degraded' => ['label' => 'PARTIAL SYSTEM DEGRADATION', 'color' => '#f59e0b', 'bg' => '#78350f'],
      'major_outage' => ['label' => 'MAJOR SYSTEM OUTAGE', 'color' => '#ef4444', 'bg' => '#7f1d1d'],
      'maintenance' => ['label' => 'SCHEDULED MAINTENANCE', 'color' => '#3b82f6', 'bg' => '#1e3a8a'],
    ];

    $cfg = $statusLabels[$status] ?? $statusLabels['operational'];
    $statusHost = (parse_url(config('app.frontend_url') ?? config('app.url', 'http://localhost:8080'), PHP_URL_HOST) ?: 'localhost') . '/status';

    $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#030712" />
      <stop offset="50%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="{$cfg['color']}" stop-opacity="0.25" />
      <stop offset="100%" stop-color="transparent" />
    </radialGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="rgba(0,0,0,0.6)" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />
  <circle cx="600" cy="180" r="500" fill="url(#glow)" />

  <!-- Top Accent Bar -->
  <rect x="0" y="0" width="1200" height="6" fill="{$cfg['color']}" />

  <!-- Brand Title -->
  <text x="80" y="110" fill="#f8fafc" font-family="Inter, -apple-system, sans-serif" font-size="34" font-weight="800" letter-spacing="-0.5">
    Boomerr <tspan fill="#3b82f6">Status</tspan>
  </text>
  <text x="80" y="145" fill="#64748b" font-family="Inter, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="3">
    GLOBAL UPTIME &amp; INFRASTRUCTURE TELEMETRY
  </text>

  <!-- Main Status Card -->
  <rect x="80" y="200" width="1040" height="280" rx="24" fill="rgba(15, 23, 42, 0.7)" stroke="{$cfg['color']}" stroke-width="2" stroke-opacity="0.4" filter="url(#shadow)" />

  <!-- Status Pill -->
  <rect x="130" y="250" width="380" height="48" rx="24" fill="{$cfg['bg']}" stroke="{$cfg['color']}" stroke-width="1.5" stroke-opacity="0.6" />
  <circle cx="156" cy="274" r="7" fill="{$cfg['color']}" />
  <text x="176" y="280" fill="{$cfg['color']}" font-family="Inter, -apple-system, sans-serif" font-size="15" font-weight="800" letter-spacing="1.5">
    {$cfg['label']}
  </text>

  <!-- Subtitle -->
  <text x="130" y="345" fill="#cbd5e1" font-family="Inter, -apple-system, sans-serif" font-size="20" font-weight="500">
    Real-time monitoring across 5 AWS regions &amp; core services
  </text>

  <!-- Stats Grid -->
  <text x="130" y="420" fill="#64748b" font-family="Inter, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="2">
    30-DAY COMPOSITE AVAILABILITY
  </text>
  <text x="130" y="455" fill="#ffffff" font-family="Inter, monospace" font-size="36" font-weight="900">
    {$uptime}%
  </text>

  <text x="800" y="420" fill="#64748b" font-family="Inter, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="2">
    GLOBAL NODES
  </text>
  <text x="800" y="455" fill="#ffffff" font-family="Inter, monospace" font-size="36" font-weight="900">
    5 ACTIVE REGIONS
  </text>

  <!-- Footer -->
  <text x="80" y="550" fill="#475569" font-family="Inter, -apple-system, sans-serif" font-size="16" font-weight="500">
    {$statusHost} · Updated live every 30 seconds
  </text>
</svg>
SVG;

    return response($svg, 200, [
      'Content-Type' => 'image/svg+xml',
      'Cache-Control' => 'public, max-age=30',
    ]);
  }
}
