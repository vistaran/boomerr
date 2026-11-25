@props([
    'url' => '#',
    'align' => 'center',
    'bg' => '#2563eb',
    'color' => '#ffffff',
    'radius' => '8px',
])

@php
    $btnBg = $bg ?? '#2563eb';
    $btnColor = $color ?? '#ffffff';
    $btnRadius = $radius ?? '8px';
@endphp

<table class="button-wrapper" align="{{ $align }}" width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
        <td align="{{ $align }}">
            <table border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                    <td align="center" style="border-radius: {{ $btnRadius }};" bgcolor="{{ $btnBg }}">
                        <a href="{{ $url }}" class="button" target="_blank" rel="noopener" style="display: inline-block; padding: 13px 28px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: {{ $btnColor }} !important; text-decoration: none; border-radius: {{ $btnRadius }}; background: {{ $btnBg }}; background-color: {{ $btnBg }}; letter-spacing: 0.2px;">{{ $slot }}</a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>

