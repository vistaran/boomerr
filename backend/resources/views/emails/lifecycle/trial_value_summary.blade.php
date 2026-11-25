@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>Your free trial of <strong>Boomerr Pro</strong> expires in <strong>3 days</strong>. During this trial, our multi-region probes have tracked your systems and protected your uptime.</p>

@component('emails.components.info-box', ['type' => 'warning', 'title' => 'Trial Expiration Notice'])
Don't let your monitors drop back to 15-minute intervals. Avoid missing outages and keep your automated ad pauses active by picking a plan today.
@endcomponent

@component('emails.components.button', ['url' => config('app.frontend_url') . '/billing'])
Choose Your Plan
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent