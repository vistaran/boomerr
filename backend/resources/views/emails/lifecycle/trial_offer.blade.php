@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>Your Boomerr Pro trial has officially ended, and your account has reverted to the Free tier. You've lost access to 1-minute checks, multi-channel alerts, and automated Ad-Pausing.</p>

@component('emails.components.info-box', ['type' => 'success', 'title' => 'Exclusive 20% Discount Code'])
We'd love to have you back on Pro! Use coupon code <span class="code-pill">COMEBACK20</span> at checkout for <strong>20% off</strong> your first 3 months of Boomerr Pro.
@endcomponent

@component('emails.components.button', ['url' => config('app.frontend_url') . '/billing'])
Claim 20% Off Pro
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent