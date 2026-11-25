<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Incident Report - {{ $incident->ulid }}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @page {
            margin: 20mm;
            size: A4;
        }
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: #fff;
            color: #1e293b;
            margin: 0;
            padding: 0;
        }
        .watermark-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1000;
            pointer-events: none;
        }
        .report-container {
            padding: 10px;
        }
        .screenshot-container {
            max-width: 100%;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
            margin-top: 10px;
        }
        .ai-box {
            background-color: #f0f9ff;
            border-left: 4px solid #0ea5e9;
            padding: 15px;
            border-radius: 0 8px 8px 0;
        }
        .timeline-item {
            border-left: 2px solid #e2e8f0;
            padding-left: 20px;
            padding-bottom: 20px;
            position: relative;
        }
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -7px;
            top: 0;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: #0ea5e9;
        }
        .status-ongoing { background-color: #fee2e2; color: #b91c1c; }
        .status-resolved { background-color: #dcfce7; color: #15803d; }

        .watermark-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1000;
            pointer-events: none;
        }
    </style>
</head>
<body>
    <div class="watermark-container">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <defs>
                <pattern id="watermark-pattern" x="0" y="0" width="350" height="350" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
                    <text x="175" y="175" text-anchor="middle" font-size="42" fill="rgba(15, 23, 42, 0.06)" font-family="Inter, Arial, sans-serif" font-weight="bold">Boomerr</text>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#watermark-pattern)" />
        </svg>
    </div>
    <div class="report-container">
        <!-- HEADER -->
        <div class="flex justify-between items-start mb-8">
            <div>
                <h1 class="text-3xl font-bold text-slate-900">Incident Report</h1>
                <p class="text-slate-500 mt-1">Generated on {{ now()->format('d M Y, H:i:s') }}</p>
            </div>
            <div class="text-right flex flex-col items-end">
            </div>
        </div>

        <!-- SUMMARY CARDS -->
        <div class="grid grid-cols-1 gap-6 mb-8">
            <!-- INCIDENT OVERVIEW -->
            <div class="border border-slate-200 rounded-xl p-5">
                <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Incident Overview</h2>
                <div class="space-y-2">
                    <div class="flex justify-between gap-4">
                        <span class="text-slate-500">Incident ID:</span>
                        <span class="font-mono font-medium text-slate-900">#{{ $incident->ulid }}</span>
                    </div>
                    <div class="flex justify-between gap-4">
                        <span class="text-slate-500 min-w-[80px]">Domain:</span>
                        <span class="font-medium text-slate-900 text-right">{{ $incident->domain->name }}</span>
                    </div>
                    <div class="flex justify-between items-center gap-4">
                        <span class="text-slate-500">Status:</span>
                        @if($incident->status === 'ongoing')
                            <span class="font-bold text-rose-600 uppercase">Ongoing</span>
                        @else
                            <span class="font-bold text-emerald-600 uppercase">Resolved</span>
                        @endif
                    </div>
                </div>
            </div>

            <!-- TIMELINE -->
            <div class="border border-slate-200 rounded-xl p-5">
                <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Timeline</h2>
                <div class="space-y-2">
                    <div class="flex justify-between gap-4">
                        <span class="text-slate-500">Started At:</span>
                        <span class="font-medium text-slate-900">{{ $incident->started_at->format('d M Y, H:i:s') }}</span>
                    </div>
                    <div class="flex justify-between gap-4">
                        <span class="text-slate-500">Resolved At:</span>
                        <span class="font-medium text-slate-900">
                            {{ $incident->resolved_at ? $incident->resolved_at->format('d M Y, H:i:s') : 'N/A' }}
                        </span>
                    </div>
                    <div class="flex justify-between gap-4">
                        <span class="text-slate-500">Duration:</span>
                        <span class="font-medium text-slate-900">
                            @if($incident->resolved_at)
                                {{ $incident->started_at->diffForHumans($incident->resolved_at, true) }}
                            @else
                                {{ $incident->started_at->diffForHumans(now(), true) }} (so far)
                            @endif
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- AI ANALYSIS -->
        @if($incident->ai_analysis || $incident->ai_summary)
            <div class="mb-8">
                <h2 class="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 14.95a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM15 10a5 5 0 11-10 0 5 5 0 0110 0z"></path></svg>
                    AI Investigation Summary
                </h2>
                <div class="ai-box">
                    <p class="text-slate-700 leading-relaxed italic">
                        "{{ $incident->ai_analysis ?: $incident->ai_summary }}"
                    </p>
                </div>
            </div>
        @endif

        <!-- TECHNICAL DETAILS -->
        <div class="mb-8">
            <h2 class="text-lg font-bold text-slate-900 mb-3">Technical Diagnostics</h2>
            <div class="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <table class="w-full text-sm">
                    <tr>
                        <td class="py-2 text-slate-500 w-1/3">Target URL:</td>
                        <td class="py-2 font-mono text-slate-900">{{ $incident->domain->url }}</td>
                    </tr>
                    <tr>
                        <td class="py-2 text-slate-500">HTTP Status:</td>
                        <td class="py-2 font-bold text-rose-600">{{ $incident->http_status ?? 'N/A' }}</td>
                    </tr>
                    @if($incident->duration_ms)
                    <tr>
                        <td class="py-2 text-slate-500">Response Time:</td>
                        <td class="py-2 text-slate-900">{{ $incident->duration_ms }}ms</td>
                    </tr>
                    @endif
                    @if($incident->exception)
                    <tr>
                        <td class="py-2 text-slate-500">Error Details:</td>
                        <td class="py-2 text-rose-700 font-mono text-xs break-all bg-rose-50 p-2 rounded mt-1 block">
                            {{ $incident->exception }}
                        </td>
                    </tr>
                    @endif
                </table>
            </div>
        </div>

        <!-- SCREENSHOT -->
        @if($incident->screenshot_url)
            <div class="mb-8" style="page-break-inside: avoid;">
                <h2 class="text-lg font-bold text-slate-900 mb-3">Visual Evidence</h2>
                <p class="text-xs text-slate-500 mb-2">Captured at the moment of failure:</p>
                <div class="screenshot-container">
                    <img src="{{ $incident->screenshot_url }}" alt="Incident Screenshot" class="w-full">
                </div>
            </div>
        @endif

        <!-- SYSTEM LOGS -->
        @if(count($systemLogs) > 0)
            <div class="mb-8" style="page-break-inside: avoid;">
                <h2 class="text-lg font-bold text-slate-900 mb-4">Event Sequence</h2>
                <div class="ml-2">
                    @foreach($systemLogs->take(10) as $log)
                        <div class="timeline-item">
                            <div class="text-xs font-bold text-slate-400">{{ $log->created_at->format('H:i:s') }}</div>
                            <div class="text-sm text-slate-700 font-medium">{{ $log->message }}</div>
                            @if($log->meta)
                                <div class="text-[10px] text-slate-400 font-mono mt-1 truncate">
                                    {{ json_encode($log->meta) }}
                                </div>
                            @endif
                        </div>
                    @endforeach
                </div>
            </div>
        @endif

    </div>
</body>
</html>
