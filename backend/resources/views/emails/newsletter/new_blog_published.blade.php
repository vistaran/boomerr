@component('emails.components.layout', ['title' => 'New on Boomerr: ' . ($blog['title'] ?? 'New Article'), 'unsubscribeUrl' => $unsubscribeUrl])

<div style="margin-bottom: 24px;">
    <div style="display: inline-block; padding: 4px 12px; background-color: #dbeafe; color: #1d4ed8; font-size: 11px; font-weight: 700; border-radius: 9999px; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 12px;">
        New Blog Post
    </div>

    <h2 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 8px 0 12px 0; line-height: 1.3; letter-spacing: -0.5px;">
        <a href="{{ $blogUrl }}" target="_blank" rel="noopener" style="color: #0f172a; text-decoration: none;">
            {{ $blog['title'] ?? 'Latest Insights from Boomerr' }}
        </a>
    </h2>

    @php
        $readTime = !empty($blog['avg_read_time']) ? $blog['avg_read_time'] . ' min read' : null;
        $author = !empty($blog['author_name']) ? 'By ' . $blog['author_name'] : 'By Boomerr Team';
        $date = !empty($blog['published_date']) ? date('M d, Y', strtotime($blog['published_date'])) : date('M d, Y');
    @endphp

    <div style="font-size: 13px; color: #64748b; margin-bottom: 20px;">
        <span>{{ $author }}</span>
        <span style="margin: 0 6px;">&bull;</span>
        <span>{{ $date }}</span>
        @if($readTime)
            <span style="margin: 0 6px;">&bull;</span>
            <span>{{ $readTime }}</span>
        @endif
    </div>
</div>

@if(!empty($blog['featured_image']))
<div style="margin-bottom: 24px; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
    <a href="{{ $blogUrl }}" target="_blank" rel="noopener" style="display: block;">
        <img src="{{ $blog['featured_image'] }}" alt="{{ $blog['title'] ?? 'Blog Cover' }}" style="width: 100%; max-height: 280px; object-fit: cover; display: block; border: 0;" />
    </a>
</div>
@endif

@if(!empty($blog['excerpt']) || !empty($blog['seo_description']) || !empty($blog['content']))
@php
    $description = $blog['excerpt'] ?? $blog['seo_description'] ?? null;
    if (empty($description) && !empty($blog['content'])) {
        $description = \Illuminate\Support\Str::limit(strip_tags($blog['content']), 220);
    }
@endphp
<p style="font-size: 16px; color: #334155; line-height: 1.65; margin-bottom: 24px;">
    {{ $description }}
</p>
@endif

@component('emails.components.button', ['url' => $blogUrl])
Read Full Article &rarr;
@endcomponent

<div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; line-height: 1.5;">
    <p style="font-size: 13px; color: #64748b; margin-bottom: 8px;">
        You are receiving this update because you subscribed to notifications from the <strong>Boomerr Blog</strong>.
    </p>
    <p style="font-size: 13px; color: #64748b; margin: 0;">
        If you no longer want these emails, you can <a href="{{ $unsubscribeUrl }}" target="_blank" rel="noopener" style="color: #2563eb; text-decoration: underline;">unsubscribe from blog notifications</a> at any time.
    </p>
</div>

<div class="signoff" style="margin-top: 24px;">
    Best regards,<br>
    <div class="signoff-name">The Boomerr Engineering Team</div>
</div>

@endcomponent
