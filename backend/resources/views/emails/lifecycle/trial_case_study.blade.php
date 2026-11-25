@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>Downtime doesn't just damage customer trust - it burns real ad dollars every single minute.</p>

@component('emails.components.info-box', ['type' => 'brand', 'title' => 'Case Study: How AgencyX Saved $4,000'])
During an unexpected 4-hour upstream cloud outage, Boomerr automatically paused all active Google and Meta ad sets for AgencyX within 60 seconds. When systems recovered, campaigns smoothly resumed with zero wasted clicks.
@endcomponent

<p>Your Boomerr Pro trial expires <strong>tomorrow</strong>. Keep your ad spend and digital infrastructure protected 24/7.</p>

@component('emails.components.button', ['url' => config('app.frontend_url') . '/billing'])
Lock In Your Pro Protection
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent