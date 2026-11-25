@component('emails.components.layout')

<div class="email-greeting">Verify Your Email Address</div>

<p>Hello,</p>

<p>Thank you for signing up for <strong>Boomerr</strong>! Please verify your email address to activate your workspace and start tracking your web infrastructure.</p>

@component('emails.components.button', ['url' => $url])
Verify Email Address
@endcomponent

@component('emails.components.info-box', ['type' => 'default'])
<span style="font-size: 13px; color: #64748b;">
    If the button above does not work, copy and paste this verification URL into your browser:<br>
    <a href="{{ $url }}" style="color: #2563eb; word-break: break-all;">{{ $url }}</a>
</span>
@endcomponent

<p style="font-size: 13px; color: #64748b; margin-top: 16px;">
    This verification link is valid for 24 hours. If you did not create a Boomerr account, no action is needed and you can safely disregard this message.
</p>

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Security Team</div>
</div>

@endcomponent
