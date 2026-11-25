@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>It's been a little while since you checked your Boomerr dashboard, but your monitors have been working behind the scenes without pause.</p>

<p>Take a quick look to review your monthly uptime stats, average DNS latency, and SSL certificate validity dates.</p>

@component('emails.components.button', ['url' => config('app.frontend_url') . '/dashboard'])
Check Out Your Status
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent