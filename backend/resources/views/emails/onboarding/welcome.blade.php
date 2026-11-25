@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>Welcome to <strong>Boomerr</strong>! We're excited to have you on board.</p>

<p>To start monitoring your websites, SSL certificates, and APIs in real time, add your first domain below:</p>

@component('emails.components.button', ['url' => config('app.frontend_url') . '/overview'])
Add Your First Domain →
@endcomponent

<p>If you have any questions or need a hand, just reply directly to this email.</p>

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent