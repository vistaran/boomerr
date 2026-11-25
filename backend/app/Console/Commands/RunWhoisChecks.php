<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class RunWhoisChecks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'monitor:run-whois-checks';
    protected $description = 'Check WHOIS expiration info for domains and store expiry date.';

    public function __construct(private \App\Services\WhoisService $whoisService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $domains = \App\Models\Domain::where('is_active', true)->get();

        if ($domains->isEmpty()) {
            $this->warn('No active domains.');
            return self::SUCCESS;
        }

        foreach ($domains as $domain) {
            $this->line("Checking WHOIS for {$domain->url}...");
            $this->whoisService->updateDomainExpiration($domain);
        }

        return self::SUCCESS;
    }
}
