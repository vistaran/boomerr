@props(['type' => 'default', 'title' => null])

@php
    $bg = '#f8fafc';
    $border = '#e2e8f0';
    $titleColor = '#0f172a';
    
    if ($type === 'success') {
        $bg = '#f0fdf4';
        $border = '#bbf7d0';
        $titleColor = '#166534';
    } elseif ($type === 'danger') {
        $bg = '#fef2f2';
        $border = '#fecaca';
        $titleColor = '#991b1b';
    } elseif ($type === 'warning') {
        $bg = '#fffbeb';
        $border = '#fde68a';
        $titleColor = '#92400e';
    } elseif ($type === 'brand') {
        $bg = '#eef2ff';
        $border = '#c7d2fe';
        $titleColor = '#3730a3';
    }
@endphp

<div class="info-card {{ $type }}" style="background-color: {{ $bg }}; border: 1px solid {{ $border }}; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
    @if($title)
        <div style="font-size: 15px; font-weight: 700; color: {{ $titleColor }}; margin-bottom: 8px;">
            {{ $title }}
        </div>
    @endif
    <div style="font-size: 14px; color: #334155; line-height: 1.6;">
        {{ $slot }}
    </div>
</div>
