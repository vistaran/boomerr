@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hi {{ $firstName ?? 'there' }},</div>

<p>Did you know you can customize exactly what constitutes an outage for your web services?</p>

@component('emails.components.info-box', ['type' => 'brand', 'title' => 'Advanced Health Assertions'])
<ul style="margin: 0 0 0 16px; padding: 0;">
    <li><strong>HTTP Status Code Matching</strong> - Catch 401s, 500s, or custom redirection loops</li>
    <li><strong>Keyword Content Match</strong> - Ensure your page actually renders the expected copy, not an empty white screen</li>
    <li><strong>Response Time Thresholds</strong> - Get notified if your response latency exceeds acceptable limits</li>
</ul>
@endcomponent

<p>Fine-tune your monitoring checks in just a few clicks.</p>

@component('emails.components.button', ['url' => config('app.frontend_url') . '/overview'])
Configure Advanced Assertions
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Team</div>
</div>

@endcomponent