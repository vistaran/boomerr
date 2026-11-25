@component('emails.components.layout', ['unsubscribeUrl' => $unsubscribeUrl ?? null])

<div class="email-greeting" style="color: #2563eb;">🚀 New Feature Announcement: {{ $feature->title }}</div>

<p style="font-size: 15px; color: #334155; line-height: 1.6; margin-top: 14px;">
    Hello <strong>{{ $firstName ?? 'there' }}</strong>,
</p>

<p style="font-size: 14px; color: #334155; line-height: 1.6;">
    We are excited to share an update on Boomerr's monitoring capabilities: <strong>{{ $feature->title }}</strong>.
</p>

@php
    $statusTitle = match ($feature->status) {
        'live' => '🟢 Live in Production',
        'in_beta' => '🟡 Now in Beta',
        'announced' => '📢 Announced',
        default => '🚀 Coming Soon'
    };
    if (!empty($feature->badge_text)) {
        $statusTitle .= ' (' . $feature->badge_text . ')';
    }
@endphp

@component('emails.components.info-box', [
    'type' => $feature->status === 'live' ? 'success' : ($feature->status === 'in_beta' ? 'warning' : 'brand'), 
    'title' => $statusTitle
])
<div style="font-size: 14px; color: #1e293b; line-height: 1.6; margin-bottom: 8px;">
    <strong>Overview:</strong> {{ $feature->summary }}
</div>

@if(!empty($feature->description))
<div style="font-size: 13px; color: #475569; line-height: 1.6; margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
    {!! nl2br(e($feature->description)) !!}
</div>
@endif

@if(!empty($feature->category) || !empty($feature->target_quarter))
<div style="margin-top: 10px; font-size: 12px; color: #64748b; line-height: 1.8;">
    @if(!empty($feature->category))
        <strong>Category:</strong> <span style="text-transform: capitalize;">{{ str_replace('_', ' ', $feature->category) }}</span><br>
    @endif
    @if(!empty($feature->target_quarter))
        <strong>Target Timeline:</strong> {{ $feature->target_quarter }}
    @endif
</div>
@endif
@endcomponent

<div style="text-align: center; margin: 28px 0 20px 0;">
@if(!empty($feature->cta_url))
    @component('emails.components.button', ['url' => str_starts_with($feature->cta_url, 'http') ? $feature->cta_url : config('app.frontend_url') . $feature->cta_url])
        {{ $feature->cta_label ?: 'View Feature Details' }}
    @endcomponent
@else
    @component('emails.components.button', ['url' => config('app.frontend_url') . '/overview'])
        Explore Boomerr Dashboard
    @endcomponent
@endif
</div>

<p style="font-size: 13px; color: #64748b; margin-top: 24px; line-height: 1.5;">
    Have thoughts or feedback on this feature? Reply directly to this email or reach out to our team anytime.
</p>

<div class="signoff" style="margin-top: 20px;">
    Best regards,<br>
    <div class="signoff-name" style="font-weight: 600; color: #0f172a;">The Boomerr Product Team</div>
</div>

@endcomponent
