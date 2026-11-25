@props(['items' => []])

<table class="spec-table" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
    @foreach($items as $label => $value)
        <tr>
            <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 500; width: 38%;">{{ $label }}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">{!! $value !!}</td>
        </tr>
    @endforeach
    {{ $slot ?? '' }}
</table>
