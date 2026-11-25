@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>Here is your weekly reliability digest and platform intelligence report.</p>

@component('emails.components.info-box', ['type' => 'brand', 'title' => 'Industry Telemetry & News'])
{{ $industryNews ?? 'Global cloud providers observed an 11% uptick in edge routing anomalies this week. Ensure your multi-region quorum checks are enabled.' }}
@endcomponent

@component('emails.components.info-box', ['type' => 'default', 'title' => 'Feature Spotlight'])
{{ $featureSpotlight ?? 'Connect your Slack or Discord webhook channels in Settings to push real-time incident reports directly into engineering triage channels.' }}
@endcomponent

@component('emails.components.info-box', ['type' => 'warning', 'title' => 'Reliability Pro Tip'])
{{ $educationalTip ?? 'Configure response keyword assertions so that custom 500 error pages returning HTTP 200 headers are still immediately identified as outages.' }}
@endcomponent

@component('emails.components.button', ['url' => config('app.frontend_url') . '/dashboard'])
Open Telemetry Dashboard
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent