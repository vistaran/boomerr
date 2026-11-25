<?php

namespace App\Console\Commands;

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Services\Billing\SubscriptionStatusService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class FixTrialingToActiveTransition extends Command
{
    /**
     * The name and signature of the console command.
     *
     * php artisan billing:fix-trialing-to-active
     */
    protected $signature = 'billing:fix-trialing-to-active';

    /**
     * The console command description.
     */
    protected $description = 'Update stuck subscriptions from trialing to active status when trial period has ended.';

    public function __construct(private SubscriptionStatusService $statusService)
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        Log::info('Starting fix for trialing to active transition...');
        $this->info('Searching for subscriptions stuck in trialing status...');

        $subscriptions = Subscription::where('status', SubscriptionStatus::TRIALING)
            ->where('trial_ends_at', '<=', now())
            ->get();

        if ($subscriptions->isEmpty()) {
            $this->info('No subscriptions found in trialing status with expired trials.');
            return self::SUCCESS;
        }

        $this->info("Found {$subscriptions->count()} subscription(s) to fix.");

        $updated = 0;
        $failed = 0;

        foreach ($subscriptions as $subscription) {
            try {
                $this->line("Updating subscription ID {$subscription->id}...");

                $newStatus = $this->statusService->markActivated($subscription, [
                    'force_active' => true,
                ]);

                if ($newStatus === SubscriptionStatus::ACTIVE) {
                    $this->info("✓ Subscription ID {$subscription->id} successfully updated to ACTIVE");
                    Log::info("Subscription ID {$subscription->id} successfully updated to ACTIVE");
                    $updated++;
                } else {
                    $this->warn("⚠ Subscription ID {$subscription->id} status is now '$newStatus' (expected ACTIVE)");
                    Log::warning("Subscription ID {$subscription->id} status is now '$newStatus' (expected ACTIVE)");
                    $failed++;
                }
            } catch (\Exception $e) {
                $this->error("✗ Failed to update subscription ID {$subscription->id}: {$e->getMessage()}");
                Log::error("Failed to update subscription ID {$subscription->id}: {$e->getMessage()}");
                $failed++;
            }
        }

        $this->newLine();
        $this->info("Summary: {$updated} updated, {$failed} failed.");
        Log::info("Fix trialing to active transition complete. Updated: {$updated}, Failed: {$failed}");

        return self::SUCCESS;
    }
}
