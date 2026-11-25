@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>Downtime affects everyone from marketing and product to DevOps and customer support. Why shoulder incident management alone?</p>

<p>Invite your team members to your Boomerr workspace. Teammates can view telemetry dashboards, configure individual alert channels, and resolve incidents collaboratively.</p>

@component('emails.components.button', ['url' => config('app.frontend_url') . '/departments'])
Invite Your Team
@endcomponent

<p>Teammates can be assigned custom roles and granular permissions to match your organization's workflow.</p>

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent