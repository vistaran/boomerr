@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>Did you know that an estimated <strong>8% of ad budgets</strong> are wasted sending clicks to broken links or offline landing pages?</p>

<p>Boomerr solves this with automatic ad protection: the second your domain goes down, we instantly pause your active <strong>Google & Facebook Ad campaigns</strong>. Once your site recovers, campaigns automatically resume without human intervention.</p>

@component('emails.components.info-box', ['type' => 'brand', 'title' => 'Protect Your Marketing ROI'])
Zero wasted ad budget during downtime, automatic campaign reactivation upon recovery, and instant audit trails.
@endcomponent

@component('emails.components.button', ['url' => config('app.frontend_url') . '/settings/google-accounts'])
Connect Ad Accounts
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent