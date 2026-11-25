@php($otpCode = $otpCode ?? '000000')

@component('emails.components.layout', ['title' => 'Your Boomerr Login Code'])

<div class="email-greeting" style="color: #2563eb;">🔐 Verification Required: One-Time Login Code</div>

<p>
    A login attempt was initiated for your <strong>Boomerr</strong> account. Use the one-time verification code below to securely complete your login:
</p>

@component('emails.components.info-box', ['type' => 'brand', 'title' => 'Authentication Summary'])
    <div style="text-align: center; padding: 12px 0 16px;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #475569; margin-bottom: 8px;">Your 6-Digit OTP Code</div>
        <div style="display: inline-block; background-color: #ffffff; border: 2px solid #2563eb; border-radius: 10px; padding: 12px 32px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);">
            {{ $otpCode }}
        </div>
    </div>
    <div style="border-top: 1px solid #c7d2fe; padding-top: 12px; margin-top: 4px; font-size: 13px; line-height: 1.6; color: #334155;">
        <strong>Validity:</strong> Code is valid for <strong>10 minutes</strong><br>
        <strong>Confidentiality:</strong> Never share this code with anyone. Boomerr will never ask for your verification code.
    </div>
@endcomponent

@component('emails.components.button', ['url' => config('app.frontend_url') . '/login'])
    Return to Login
@endcomponent

<p style="font-size: 13px; color: #64748b; margin-top: 20px;">
    If you did not initiate this login request, please disregard this email. Your account credentials remain safe and no action is required.
</p>

<div class="signoff">
    Security & Authentication Operations,<br>
    <div class="signoff-name">Boomerr Security Engine</div>
</div>

@endcomponent
