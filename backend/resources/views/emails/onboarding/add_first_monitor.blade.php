@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>You recently created your Boomerr account, but we noticed you haven't added a website to monitor yet.</p>

<p>Adding your first monitor takes under 30 seconds. Once added, we'll start pinging your URL from multi-region edge locations and keep a close eye on uptime, response latency, and SSL health.</p>

@component('emails.components.button', ['url' => config('app.frontend_url') . '/overview'])
Add Your First Monitor
@endcomponent

<p>Need help testing an API, Shopify store, or custom endpoint? Just reply to this email anytime.</p>

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent