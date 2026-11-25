@php($domain = $domain ?? null)

@component('emails.components.layout', ['title' => 'Domain Restored: Service Online'])

<div class="email-greeting" style="color: #16a34a;">✅ Service Restored: Domain Back Online</div>

@if ($domain)
    <p>
        Good news! Boomerr automated probes confirm that <strong>{{ $domain->name }}</strong> has recovered and is now responding normally.
    </p>

    @component('emails.components.info-box', ['type' => 'success', 'title' => 'Recovery Details'])
        <strong>Domain:</strong> {{ $domain->name }}<br>
        <strong>Monitored URL:</strong> <a href="{{ $domain->url }}" target="_blank" style="color: #15803d;">{{ $domain->url }}</a><br>
        @if(isset($event) && $event->region)
            <strong>Probing Region:</strong> {{ \App\Services\MonitoringService::getLocationFromRegion($event->region) }} ({{ $event->region }})<br>
            <strong>Response Latency:</strong> {{ $event->response_time_ms ?? 'N/A' }} ms<br>
            <strong>Restored At:</strong> {{ \Carbon\Carbon::parse($event->checked_at)->format('Y-m-d H:i:s T') }}
        @endif
    @endcomponent

    @component('emails.components.button', ['url' => config('app.frontend_url') . '/overview'])
        View Recovery Analytics
    @endcomponent
@else
    <p>
        Your monitored domain is now back <strong>ONLINE</strong> and operating normally.
    </p>

    @isset($url)
        @component('emails.components.info-box', ['type' => 'success', 'title' => 'Online URL'])
            <a href="{{ $url }}" target="_blank" style="color: #15803d;">{{ $url }}</a>
        @endcomponent

        @component('emails.components.button', ['url' => config('app.frontend_url') . '/overview'])
            View Domain Details
        @endcomponent
    @endisset
@endif

<p style="font-size: 13px; color: #64748b; margin-top: 20px;">
    Continuous telemetry has resumed. All multi-region checks are currently in healthy status.
</p>

<div class="signoff">
    Automated Incident Operations,<br>
    <div class="signoff-name">Boomerr Alert Engine</div>
</div>

@endcomponent
