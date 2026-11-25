@component('emails.components.layout')

<div class="email-greeting" style="color: #15803d;">Incident Resolved: {{ $incident->incident_title }}</div>

<p>The incident affecting your systems has been resolved. Multi-region quorum probes confirm normal response codes and recovery across all services.</p>

@php
    $details = [
        'Incident ID' => $incident->incident_id,
        'Resolution Status' => '<span style="color: #16a34a; font-weight: bold; text-transform: uppercase;">' . ucfirst($incident->incident_status) . '</span>',
        'Started At' => $incident->incident_started_at?->toDayDateTimeString() ?? 'N/A',
        'Resolved At' => $incident->incident_resolved_at?->toDayDateTimeString() ?? now()->toDayDateTimeString(),
        'Total Duration' => $incident->duration ?? 'Resolved',
    ];
    if ($incident->incident_cause) {
        $details['Root Cause'] = e($incident->incident_cause);
    }
@endphp

@component('emails.components.key-value', ['items' => $details])
@endcomponent

<p>All automated monitoring routines and check schedules have returned to standard telemetry state.</p>

@component('emails.components.button', ['url' => config('app.url') . '/status'])
View Incident Timeline
@endcomponent

<div class="signoff">
    Incident Response Operations,<br>
    <div class="signoff-name">Boomerr SRE Team</div>
</div>

@endcomponent
