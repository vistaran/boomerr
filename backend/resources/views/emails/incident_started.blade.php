@component('emails.components.layout')

<div class="email-greeting" style="color: #b91c1c;">New Incident Detected: {{ $incident->incident_title }}</div>

<p>An active service disruption has been registered by Boomerr automated monitors. Our platform is continuously polling your services and telemetry endpoints.</p>

@php
    $details = [
        'Incident ID' => $incident->incident_id,
        'Current Status' => '<span style="color: #dc2626; font-weight: bold; text-transform: uppercase;">' . ucfirst($incident->incident_status) . '</span>',
        'Started At' => $incident->incident_started_at?->toDayDateTimeString() ?? now()->toDayDateTimeString(),
    ];
    if ($incident->incident_impact) {
        $details['Reported Impact'] = e($incident->incident_impact);
    }
@endphp

@component('emails.components.key-value', ['items' => $details])
    @if($incident->incident_affected_services && count($incident->incident_affected_services) > 0)
        <tr>
            <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 500; width: 38%;">Affected Services</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">
                {{ implode(', ', $incident->incident_affected_services) }}
            </td>
        </tr>
    @endif
@endcomponent

<p>We are actively probing your infrastructure and will dispatch update notifications as status changes.</p>

@component('emails.components.button', ['url' => config('app.url') . '/status'])
View Live Status Page
@endcomponent

<div class="signoff">
    Incident Response Operations,<br>
    <div class="signoff-name">Boomerr SRE Team</div>
</div>

@endcomponent
