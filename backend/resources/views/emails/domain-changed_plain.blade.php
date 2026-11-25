@php
    $isCreated = $action === 'created';
    $isUpdated = $action === 'updated';
    $isDeleted = $action === 'deleted';
    $badgeText = $isCreated ? 'ADDED' : ($isDeleted ? 'DELETED' : 'UPDATED');
@endphp
========================================================================
{{ strtoupper($badgeText) }} - {{ $timestamp }}
========================================================================

{{ $title }}

{{ $summary }}

------------------------------------------------------------------------
DOMAIN DETAILS
------------------------------------------------------------------------

Domain: {{ $domain['name'] ?? 'Domain' }}
URL: {{ $url }}
Environment: {{ $environment }}
Actor: {{ $actor }}
Timestamp: {{ $timestamp }}
Action: {{ ucfirst($action) }}

------------------------------------------------------------------------
CHANGES
------------------------------------------------------------------------

@if (empty($changes))
    • No field changes detected
@else
    @foreach ($changes as $index => $change)
        {{ $index + 1 }}. {{ strtoupper($change['field'] ?? 'field') }}
        Before: {{ \App\Notifications\DomainChangedNotification::stringify($change['before'] ?? null) }}
        After: {{ \App\Notifications\DomainChangedNotification::stringify($change['after'] ?? null) }}
        @if (!$loop->last)
        @endif
    @endforeach
@endif

------------------------------------------------------------------------

View Domain: {{ $url }}

========================================================================

If you did not expect this change, please review your domain settings
immediately.

--
This is an automated notification from {{ config('app.name') }}.
You are receiving this because you are subscribed to domain change alerts.
