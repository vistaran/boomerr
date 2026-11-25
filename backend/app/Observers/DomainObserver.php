<?php

namespace App\Observers;

use App\Models\Domain;
use App\Services\DomainCacheService;
use Illuminate\Support\Facades\Cache;

class DomainObserver
{
    public function __construct(private readonly DomainCacheService $cacheService)
    {
    }

    public function saved(Domain $domain): void
    {
        $this->flushCompanyCache($domain);
    }

    public function deleted(Domain $domain): void
    {
        $this->flushCompanyCache($domain);
    }

    public function restored(Domain $domain): void
    {
        $this->flushCompanyCache($domain);
    }

    private function flushCompanyCache(Domain $domain): void
    {
        if ($domain->workspace_id) {
            $this->cacheService->forgetCompanyDomains((int) $domain->workspace_id);
            Cache::forget("workspace_{$domain->workspace_id}_dashboard_stats");
        }
        if ($domain->id) {
            Cache::forget("domain_{$domain->id}_30day_stats");
        }
    }
}
