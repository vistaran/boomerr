<?php

namespace App\Services;

use App\Models\Domain;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Iodev\Whois\Factory;

class WhoisService
{
    public function updateDomainExpiration(Domain $domain): void
    {
        try {
            $parts = parse_url($domain->url);
            $host = $parts['host'] ?? null;

            if (!$host) {
                return;
            }

            // Remove www.
            $host = preg_replace('/^www\./', '', $host);

            $whois = Factory::get()->createWhois();
            $info = $whois->loadDomainInfo($host);

            if ($info && $info->expirationDate) {
                $expiresAt = Carbon::createFromTimestamp($info->expirationDate);
                $daysRemaining = (int) now()->diffInDays($expiresAt, false);

                $domain->domain_expires_at = $expiresAt;
                $domain->domain_days_remaining = $daysRemaining;
                $domain->domain_last_checked_at = Carbon::now();
                $domain->save();
            } else {
                $domain->domain_last_checked_at = Carbon::now();
                $domain->save();
            }

        } catch (\Throwable $e) {
            Log::warning('WHOIS lookup failed for domain', [
                'domain_id' => $domain->id,
                'host' => $host ?? null,
                'error' => $e->getMessage()
            ]);
            $domain->domain_last_checked_at = Carbon::now();
            $domain->save();
        }
    }
}
