<?php

namespace App\Console\Commands;

use App\Models\Domain;
use App\Services\DomainHealthService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RunSslChecks extends Command
{
    /**
     * Command name: php artisan monitor:run-ssl-checks
     */
    protected $signature = 'monitor:run-ssl-checks';

    protected $description = 'Check SSL certificate info for HTTPS domains due for verification.';

    public function __construct(private DomainHealthService $healthService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        // Only check domains that:
        // 1. Have never been checked (ssl_last_checked_at is null)
        // 2. Or were checked more than 6 hours ago
        // 3. Or are expiring soon (ssl_days_remaining <= 3) and were checked more than 1 hour ago
        $now = now();
        $sixHoursAgo = $now->copy()->subHours(6);
        $oneHourAgo = $now->copy()->subHour();

        $domains = Domain::where('is_active', true)
            ->where(function ($query) use ($sixHoursAgo, $oneHourAgo) {
                $query->whereNull('ssl_last_checked_at')
                    ->orWhere('ssl_last_checked_at', '<=', $sixHoursAgo)
                    ->orWhere(function ($q) use ($oneHourAgo) {
                        $q->where('ssl_days_remaining', '<=', 3)
                          ->where('ssl_last_checked_at', '<=', $oneHourAgo);
                    });
            })
            ->get();

        if ($domains->isEmpty()) {
            return self::SUCCESS;
        }

        $this->info("Checking SSL for {$domains->count()} due domains...");

        foreach ($domains as $domain) {
            $this->line("Checking SSL for {$domain->url}...");
            try {
                $this->healthService->runSslCheck($domain);
            } catch (\Throwable $e) {
                Log::error("SSL check error for {$domain->url}", ['error' => $e->getMessage()]);
            }
        }

        return self::SUCCESS;
    }
}
