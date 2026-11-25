@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>You have reached the <strong>maximum number of monitors</strong> allowed on your current Boomerr plan.</p>

@component('emails.components.info-box', ['type' => 'warning', 'title' => 'Monitor Capacity Reached'])
Your active domains and endpoints are fully protected. However, you won't be able to add additional websites, APIs, or SSL monitors until you upgrade your account.
@endcomponent

<p style="margin: 20px 0 10px; font-weight: 600; color: #1e293b;">Upgrading to a Pro plan gives you:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
    <tr>
        <td style="padding: 6px 0; color: #475569; font-size: 14px;">
            <strong style="color: #6366f1;">✓ Increased Monitor Slots:</strong> Monitor up to 50+ websites, subdomains, and API endpoints.
        </td>
    </tr>
    <tr>
        <td style="padding: 6px 0; color: #475569; font-size: 14px;">
            <strong style="color: #6366f1;">✓ 30-Second Check Frequency:</strong> Detect incidents before your customers do.
        </td>
    </tr>
    <tr>
        <td style="padding: 6px 0; color: #475569; font-size: 14px;">
            <strong style="color: #6366f1;">✓ Automated Ad-Pause:</strong> Instantly pause paid Google & Meta ad campaigns during outages.
        </td>
    </tr>
</table>

@component('emails.components.button', ['url' => config('app.frontend_url') . '/billing'])
Upgrade Your Workspace Plan →
@endcomponent

<p style="margin-top: 24px;">Need custom enterprise limits or dedicated probe nodes? Simply reply to this email.</p>

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent
