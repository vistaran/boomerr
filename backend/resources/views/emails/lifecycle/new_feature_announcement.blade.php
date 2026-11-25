@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>An expired SSL certificate immediately throws alarming security warnings to every visitor, destroying conversion rates and organic SEO rankings. That's why we've launched <strong>Automated SSL Certificate Monitoring</strong>!</p>

@component('emails.components.info-box', ['type' => 'brand', 'title' => 'New Feature Highlights'])
<ul style="margin: 0 0 0 16px; padding: 0;">
    <li><strong>Advance Warning Alerts</strong> - Notifications sent 30, 14, and 3 days before expiry</li>
    <li><strong>Certificate Chain Validation</strong> - Automated checks for intermediate & root certs</li>
    <li><strong>Revocation & Cipher Telemetry</strong> - Instant detection of broken trust chains</li>
</ul>
@endcomponent

@component('emails.components.button', ['url' => config('app.frontend_url') . '/ssl-monitoring'])
Explore SSL Monitoring
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent