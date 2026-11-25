<?php

namespace App\Console\Commands;

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Services\Billing\SubscriptionStatusService;
use App\Services\Payments\PaymentGatewayFactory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SyncRazorpayPausedSubscriptions extends Command
{
    protected $signature = 'billing:sync-razorpay-paused
                            {--limit=100 : Maximum number of subscriptions to process}
                            {--dry-run : Do not persist updates, just report what would change}';

    protected $description = 'Sync subscriptions that are paused in Razorpay but still active in our database.';

    public function handle(SubscriptionStatusService $subscriptionStatusService): int
    {
        $limit = (int) $this->option('limit');
        $dryRun = (bool) $this->option('dry-run');

        // Query subscriptions that are active/trialing in our DB and use Razorpay
        $query = Subscription::query()
            ->where('gateway', 'razorpay')
            ->whereNotNull('gateway_subscription_id')
            ->whereIn('status', [SubscriptionStatus::ACTIVE, SubscriptionStatus::TRIALING])
            ->orderBy('id', 'asc')
            ->limit($limit);

        $count = $query->count();
        if ($count === 0) {
            $this->info('No active or trialing Razorpay subscriptions found.');
            return 0;
        }

        $this->info("Processing {$count} subscription(s) (limit={$limit}, dry-run=" . ($dryRun ? 'yes' : 'no') . ")");

        $bar = $this->output->createProgressBar($count);
        $bar->start();

        $updated = 0;
        $gateway = PaymentGatewayFactory::make('razorpay');

        foreach ($query->get() as $subscription) {
            try {
                $details = $gateway->getSubscriptionDetails($subscription->gateway_subscription_id);
                $status = strtolower($details['status'] ?? '');

                if ($status === 'paused') {
                    $this->line('');
                    $this->info("Found paused subscription in Razorpay for local subscription ID {$subscription->id} ({$subscription->gateway_subscription_id})");

                    if (!$dryRun) {
                        $subscriptionStatusService->markPaused($subscription);
                        $updated++;
                    } else {
                        $updated++;
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('Failed to fetch subscription details during sync', [
                    'subscription_id' => $subscription->id,
                    'gateway_subscription_id' => $subscription->gateway_subscription_id,
                    'error' => $e->getMessage(),
                ]);
                $this->line('');
                $this->error("Failed for {$subscription->gateway_subscription_id}: {$e->getMessage()}");
            }

            $bar->advance();
        }

        $bar->finish();
        $this->line('');

        $this->info("Done. {$updated} subscription(s) would be updated to PAUSED status" . ($dryRun ? ' (dry-run)' : ''));

        return 0;
    }
}
