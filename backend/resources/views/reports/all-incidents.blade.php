<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Incidents Summary Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @page {
            margin: 10mm;
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

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        th {
            background-color: #f8fafc;
            text-align: left;
            padding: 12px 15px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            border-bottom: 2px solid #e2e8f0;
        }

        td {
            padding: 12px 15px;
            font-size: 12px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: top;
        }

        .status-badge {
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }

        .status-ongoing {
            background-color: #fee2e2;
            color: #b91c1c;
        }

        .status-resolved {
            background-color: #dcfce7;
            color: #15803d;
        }

        .status-resolved {
            background-color: #dcfce7;
            color: #15803d;
        }
    </style>
</head>

<body>
    <div class="watermark-container">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <defs>
                <pattern id="watermark-pattern" x="0" y="0" width="350" height="350" patternUnits="userSpaceOnUse"
                    patternTransform="rotate(-30)">
                    <text x="175" y="175" text-anchor="middle" font-size="42" fill="rgba(15, 23, 42, 0.06)"
                        font-family="Inter, Arial, sans-serif" font-weight="bold">Boomerr</text>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#watermark-pattern)" />
        </svg>
    </div>
    <div class="report-container">
        <!-- HEADER -->
        <div class="flex justify-between items-start mb-8">
            <div>
                <h1 class="text-3xl font-bold text-slate-900">Incidents Summary Report</h1>
                <p class="text-slate-500 mt-1">Generated on {{ now()->format('d M Y, H:i:s') }}</p>
            </div>
            <div class="text-right flex flex-col items-end">
            </div>
        </div>

        <!-- STATS -->
        <div class="grid grid-cols-4 gap-4 mb-8">
            <div class="border border-slate-100 rounded-lg p-4 bg-slate-50">
                <div class="text-xs text-slate-500 uppercase font-bold">Total Incidents</div>
                <div class="text-2xl font-bold text-slate-900">{{ count($incidents) }}</div>
            </div>
            <div class="border border-slate-100 rounded-lg p-4 bg-rose-50">
                <div class="text-xs text-rose-500 uppercase font-bold">Ongoing</div>
                <div class="text-2xl font-bold text-rose-700">{{ $incidents->where('status', 'ongoing')->count() }}
                </div>
            </div>
            <div class="border border-slate-100 rounded-lg p-4 bg-emerald-50">
                <div class="text-xs text-emerald-500 uppercase font-bold">Resolved</div>
                <div class="text-2xl font-bold text-emerald-700">{{ $incidents->where('status', 'resolved')->count() }}
                </div>
            </div>
            <div class="border border-slate-100 rounded-lg p-4 bg-blue-50">
                <div class="text-xs text-blue-500 uppercase font-bold">Domains Affected</div>
                <div class="text-2xl font-bold text-blue-700">{{ $incidents->pluck('domain_id')->unique()->count() }}
                </div>
            </div>
        </div>

        <!-- TABLE -->
        <table>
            <thead>
                <tr>
                    <th>Domain</th>
                    <th>Status</th>
                    <th>Started At</th>
                    <th>Resolved At</th>
                    <th>Duration</th>
                    <th>Root Cause Summary</th>
                </tr>
            </thead>
            <tbody>
                @foreach($incidents as $incident)
                    <tr>
                        <td>
                            <div class="font-bold text-slate-900">{{ $incident->domain->name }}</div>
                            <div class="text-[10px] text-slate-400">{{ $incident->domain->url }}</div>
                        </td>
                        <td>
                            @if($incident->status === 'ongoing')
                                <span class="status-badge status-ongoing">Ongoing</span>
                            @else
                                <span class="status-badge status-resolved">Resolved</span>
                            @endif
                        </td>
                        <td>{{ $incident->started_at->format('d M Y, H:i') }}</td>
                        <td>{{ $incident->resolved_at ? $incident->resolved_at->format('d M Y, H:i') : '-' }}</td>
                        <td>
                            @if($incident->resolved_at)
                                {{ $incident->started_at->diffForHumans($incident->resolved_at, true) }}
                            @else
                                {{ $incident->started_at->diffForHumans(now(), true) }}
                            @endif
                        </td>
                        <td>
                            <div class="italic text-slate-600 leading-relaxed">
                                {{ $incident->ai_analysis ?: 'No analysis available' }}
                            </div>
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>

    </div>
</body>

</html>