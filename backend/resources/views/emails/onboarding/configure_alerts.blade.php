@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>Your monitors are active and tracking uptime! However, you currently don't have secondary alert channels configured.</p>

<p>If your website encounters downtime at 3 AM, how quickly will your team know? Boomerr supports multi-channel instant notifications so you never miss an outage:</p>

@component('emails.components.info-box', ['type' => 'brand', 'title' => 'Supported Notification Channels'])
<ul style="margin: 0 0 0 16px; padding: 0;">
    <li><strong>Slack & Discord</strong> - Webhook notifications right into your ops channels</li>
    <li><strong>Telegram & WhatsApp</strong> - Real-time mobile alerts for critical incidents</li>
    <li><strong>SMS & Voice Calls</strong> - Escalate urgent downtime immediately</li>
</ul>
@endcomponent

@component('emails.components.button', ['url' => config('app.frontend_url') . '/settings'])
Configure Notification Channels
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent