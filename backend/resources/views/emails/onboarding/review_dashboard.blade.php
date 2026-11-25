@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>Your websites have been active on Boomerr for several days now. It's a great time to check in on your real-time analytics!</p>

<p>Log in to your workspace to view latency heatmaps, 99.99% uptime trends, regional performance metrics, and any micro-outages detected by our monitoring network.</p>

@component('emails.components.button', ['url' => config('app.frontend_url') . '/dashboard'])
View Uptime Dashboard
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent