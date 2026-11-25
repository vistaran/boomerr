<?php

namespace App\Events\Concerns;

use App\Models\Domain;

trait SerializesDomain
{
    protected function serializeDomain(Domain $domain): array
    {
        return [
            'id' => $domain->id,
            'ulid' => $domain->ulid,
            'workspace_id' => $domain->workspace_id,
            'name' => $domain->name,
            'url' => $domain->url,
            'label' => $domain->label,
            'environment' => $domain->environment,
            'is_active' => (bool) $domain->is_active,
            'status' => $domain->status,
            'last_response_time_ms' => $domain->last_response_time_ms,
            'last_checked_at' => optional($domain->last_checked_at)?->toIso8601String(),
            'min_response_time_ms' => $domain->min_response_time_ms,
            'max_response_time_ms' => $domain->max_response_time_ms,
            'ssl_issuer' => $domain->ssl_issuer,
            'ssl_valid_from' => optional($domain->ssl_valid_from)?->toIso8601String(),
            'ssl_valid_to' => optional($domain->ssl_valid_to)?->toIso8601String(),
            'ssl_days_remaining' => $domain->ssl_days_remaining,
            'ssl_last_checked_at' => optional($domain->ssl_last_checked_at)?->toIso8601String(),
            'domain_expires_at' => optional($domain->domain_expires_at)?->toIso8601String(),
            'domain_days_remaining' => $domain->domain_days_remaining,
            'domain_last_checked_at' => optional($domain->domain_last_checked_at)?->toIso8601String(),
            'created_at' => optional($domain->created_at)?->toIso8601String(),
            'updated_at' => optional($domain->updated_at)?->toIso8601String(),
        ];
    }
}
