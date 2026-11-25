@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>It's been a few weeks since your last visit, but we wanted to assure you: <strong>Boomerr has been diligently monitoring your domains 24/7/365</strong>.</p>

<p>Log in to view your monthly availability statistics, latency averages, and verify your incident escalation settings are current.</p>

@component('emails.components.button', ['url' => config('app.frontend_url') . '/dashboard'])
View Monthly Report
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent