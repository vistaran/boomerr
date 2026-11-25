@php($domain = $domain ?? null)

@component('emails.components.layout', ['title' => 'Domain Alert: Service Down'])

<div class="email-greeting" style="color: #dc2626;">🚨 Immediate Attention Required: Domain Down</div>

@if ($domain)
    <p>
        Boomerr edge probes detected that <strong>{{ $domain->name }}</strong> is currently <strong>OFFLINE</strong> and failing HTTP health checks.
    </p>

    @component('emails.components.info-box', ['type' => 'danger', 'title' => 'Incident Summary'])
        <strong>Domain:</strong> {{ $domain->name }}<br>
        <strong>Monitored URL:</strong> <a href="{{ $domain->url }}" target="_blank" style="color: #b91c1c;">{{ $domain->url }}</a><br>
        @if(isset($event) && $event->region)
            <strong>Probing Region:</strong> {{ \App\Services\MonitoringService::getLocationFromRegion($event->region) }} ({{ $event->region }})<br>
            <strong>Response Latency:</strong> {{ $event->response_time_ms ?? 'Timeout / Refused' }} ms<br>
            <strong>Detected At:</strong> {{ \Carbon\Carbon::parse($event->checked_at)->format('Y-m-d H:i:s T') }}
        @endif
    @endcomponent

    @component('emails.components.button', ['url' => config('app.frontend_url') . '/overview'])
        View Live Incident Telemetry
    @endcomponent
@else
    <p>
        Your monitored domain is currently <strong>DOWN</strong> and not responding to HTTP health checks.
    </p>

    @isset($url)
        @component('emails.components.info-box', ['type' => 'danger', 'title' => 'Offline URL'])
            <a href="{{ $url }}" target="_blank" style="color: #b91c1c;">{{ $url }}</a>
        @endcomponent

        @component('emails.components.button', ['url' => config('app.frontend_url') . '/overview'])
            View Domain Details
        @endcomponent
    @endisset
@endif

<p style="font-size: 13px; color: #64748b; margin-top: 20px;">
    Our monitoring cluster will continue testing your endpoint every minute from independent global nodes and notify you immediately once recovery is confirmed.
</p>

<div class="signoff">
    Automated Incident Operations,<br>
    <div class="signoff-name">Boomerr Alert Engine</div>
</div>

@endcomponent
