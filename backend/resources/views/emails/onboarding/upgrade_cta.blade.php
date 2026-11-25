@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>You've experienced how Boomerr keeps an active watch over your digital properties. If you're serious about protecting your revenue, brand reputation, and ad campaigns, unlock the full power of <strong>Boomerr Pro</strong>.</p>

@component('emails.components.info-box', ['type' => 'brand', 'title' => 'Boomerr Pro Superpowers'])
<ul style="margin: 0 0 0 16px; padding: 0;">
    <li><strong>1-Minute Check Intervals</strong> - Catch micro-outages before users notice</li>
    <li><strong>Automatic Ad-Pausing</strong> - Instantly freeze Google & Facebook Ads during downtime</li>
    <li><strong>Multi-Region Edge Probes</strong> - Avoid false positives with global quorum checks</li>
    <li><strong>Priority SMS & Voice Alerts</strong> - Direct escalation for critical failures</li>
</ul>
@endcomponent

@component('emails.components.button', ['url' => config('app.frontend_url') . '/billing'])
Upgrade to Boomerr Pro
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent