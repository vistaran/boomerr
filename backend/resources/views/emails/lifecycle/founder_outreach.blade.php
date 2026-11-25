@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting">Hey {{ $firstName ?? 'there' }},</div>

<p>I'm the founder of Boomerr. I noticed you haven't been using the platform much lately, and I wanted to reach out personally.</p>

<p>Building something truly useful is my highest priority. Is there anything holding you back? A missing integration? A confusing UI setting? Something we could do better?</p>

@component('emails.components.info-box', ['type' => 'default'])
You can reply directly to this email. I read and personally respond to every single response from our users.
@endcomponent

<div class="signoff">
    Best regards,<br>
    <div class="signoff-name">Varun</div>
    <div style="font-size: 13px; color: #64748b;">Founder, Boomerr</div>
</div>

@endcomponent