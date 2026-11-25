@php
    $frontendBase = rtrim(config('app.frontend_url') ?? config('app.url'), '/');
    $acceptUrl = $frontendBase . '/accept-invitation/' . $invitation->token;
@endphp

@component('emails.components.layout')

<div class="email-greeting">You're Invited to Join a Workspace</div>

<p>Hello,</p>

<p>
    You have been invited to collaborate on <strong>Boomerr</strong>. Join your team to view real-time domain health, analyze incident telemetry, and configure uptime alerts.
</p>

@component('emails.components.button', ['url' => $acceptUrl])
Accept Team Invitation
@endcomponent

@component('emails.components.info-box', ['type' => 'default'])
<span style="font-size: 13px; color: #64748b;">
    If the button does not work, copy and paste this link into your browser:<br>
    <a href="{{ $acceptUrl }}" style="color: #2563eb; word-break: break-all;">{{ $acceptUrl }}</a>
</span>
@endcomponent

<p style="font-size: 13px; color: #64748b; margin-top: 16px;">
    This invitation link is valid for 1 hour. If you were not expecting this invitation, you can safely ignore this email.
</p>

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent