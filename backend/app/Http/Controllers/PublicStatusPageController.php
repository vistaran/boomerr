<?php

namespace App\Http\Controllers;

use App\Models\StatusPage;
use App\Models\DomainStatusEvent;
use Illuminate\Http\Request;
use Carbon\Carbon;

class PublicStatusPageController extends Controller
{
    public function show($slug)
    {
        $statusPage = StatusPage::where('slug', $slug)
            ->where('is_published', true)
            ->with(['domains' => function ($query) {
                $query->select('domains.id', 'domains.url', 'domains.name', 'domains.last_response_status', 'domains.last_checked_at', 'domains.created_at');
            }])
            ->first();

        if (!$statusPage) {
            return response()->json(['message' => 'Status page not found'], 404);
        }

        $now = now();
        $thirtyDaysAgo = now()->subDays(30);

        $domainsData = $statusPage->domains->map(function ($domain) use ($thirtyDaysAgo, $now) {
            // Get uptime events for the last 30 days
            $events = DomainStatusEvent::where('domain_id', $domain->id)
                ->where('created_at', '>=', $thirtyDaysAgo)
                ->orderBy('created_at', 'asc')
                ->get();

            // Calculate overall 30-day uptime and daily uptimes
            $downPeriods = [];
            $lastDownTime = null;

            foreach ($events as $event) {
                $status = strtolower($event->status);
                if ($status === 'down') {
                    if ($lastDownTime === null) {
                        $lastDownTime = $event->created_at;
                    }
                } elseif ($status === 'up' && $lastDownTime !== null) {
                    $downPeriods[] = ['start' => $lastDownTime, 'end' => $event->created_at];
                    $lastDownTime = null;
                }
            }

            // If still down
            if ($lastDownTime !== null) {
                $downPeriods[] = ['start' => $lastDownTime, 'end' => $now];
            }

            $downSeconds = 0;
            foreach ($downPeriods as $period) {
                $start = max($period['start'], $thirtyDaysAgo);
                $end = min($period['end'], $now);
                if ($start < $end) {
                    $downSeconds += $start->diffInSeconds($end);
                }
            }

            $totalSeconds = $thirtyDaysAgo->diffInSeconds($now);
            $uptimePercentage = 100;
            if ($totalSeconds > 0) {
                $uptimePercentage = max(0, 100 - (($downSeconds / $totalSeconds) * 100));
            }

            // Generate daily data for the 30-day bar chart
            $dailyBars = [];
            for ($i = 29; $i >= 0; $i--) {
                $dayStart = now()->subDays($i)->startOfDay();
                $dayEnd = now()->subDays($i)->endOfDay();
                
                if ($domain->created_at && $dayEnd < $domain->created_at) {
                    $dailyBars[] = [
                        'date' => $dayStart->format('Y-m-d'),
                        'status' => 'nodata',
                        'uptime_percentage' => null
                    ];
                    continue;
                }

                $dayDownSeconds = 0;
                foreach ($downPeriods as $period) {
                    $pStart = max($period['start'], $dayStart);
                    $pEnd = min($period['end'], $dayEnd);
                    if ($pStart < $pEnd) {
                        $dayDownSeconds += $pStart->diffInSeconds($pEnd);
                    }
                }
                
                $dayTotalSeconds = $dayStart->diffInSeconds(min($dayEnd, $now));
                if ($dayTotalSeconds <= 0) $dayTotalSeconds = 86400; // fallback

                $dayUptime = 100;
                if ($dayTotalSeconds > 0) {
                    $dayUptime = max(0, 100 - (($dayDownSeconds / $dayTotalSeconds) * 100));
                }
                
                $dailyBars[] = [
                    'date' => $dayStart->format('Y-m-d'),
                    'status' => $dayDownSeconds > 0 ? 'down' : 'operational',
                    'uptime_percentage' => round($dayUptime, 4)
                ];
            }

            return [
                'id' => $domain->id,
                'name' => $domain->name ?: $domain->url,
                'status' => $domain->last_response_status,
                'uptime_percentage' => round($uptimePercentage, 3),
                'daily_bars' => $dailyBars,
            ];
        });

        $overallStatus = 'operational';
        if ($domainsData->contains('status', 'DOWN') || $domainsData->contains('status', 'ERROR')) {
            $overallStatus = 'down';
        }

        return response()->json([
            'name' => $statusPage->name,
            'logo_path' => $statusPage->logo_path,
            'overall_status' => $overallStatus,
            'domains' => $domainsData,
            'last_updated' => now()->toIso8601String(),
        ]);
    }
}
