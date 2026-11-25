@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>We miss having you active on Boomerr! We've made huge improvements to our core engine recently, including automated SSL health checks, Telegram & WhatsApp alerts, and sub-minute outage detection.</p>

@component('emails.components.info-box', ['type' => 'success', 'title' => 'Welcome Back: 1 Month of Pro on Us'])
To welcome you back to full reliability, we're extending <strong>1 full month of Boomerr Pro completely free</strong>. Reactivate today with zero risk.
@endcomponent

@component('emails.components.button', ['url' => config('app.frontend_url') . '/billing'])
Claim 1 Month Free Pro
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent