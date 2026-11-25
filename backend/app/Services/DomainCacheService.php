<?php

namespace App\Services;

use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class DomainCacheService
{
    private const DEFAULT_TTL_SECONDS = 30;

    /**
     * Cache the resolved company domains for a short TTL to avoid redundant queries.
     */
    public function rememberCompanyDomains(int $workspaceId, Closure $resolver): array
    {
        $ttlSeconds = (int) config('cache.ttl.domains', self::DEFAULT_TTL_SECONDS);

        return Cache::remember(
            $this->companyKey($workspaceId),
            now()->addSeconds($ttlSeconds),
            function () use ($resolver) {
                $domains = $resolver();

                $collection = $domains instanceof Collection
                    ? $domains
                    : collect($domains);

                return $collection
                    ->map(fn ($domain) => $this->normalizeDomain($domain))
                    ->filter(fn (array $domain) => isset($domain['id']))
                    ->unique(fn (array $domain) => $domain['id'])
                    ->values()
                    ->all();
            }
        );
    }

    public function forgetCompanyDomains(int $workspaceId): void
    {
        Cache::forget($this->companyKey($workspaceId));
    }

    private function companyKey(int $workspaceId): string
    {
        return 'company:' . $workspaceId . ':domains';
    }

    private function normalizeDomain(mixed $domain): array
    {
        if ($domain instanceof Model) {
            return $domain->toArray();
        }

        if (is_array($domain)) {
            return $domain;
        }

        return (array) $domain;
    }
}
