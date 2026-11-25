<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use App\Services\Payments\PaymentGatewayFactory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class FillGatewayCustomerIds extends Command
{
    protected $signature = 'billing:fill-customer-ids
                            {--limit=100 : Maximum number of subscriptions to process}
                            {--dry-run : Do not persist updates, just report what would change}';

    protected $description = 'Populate gateway_customer_id for subscriptions that have a gateway_subscription_id but no gateway_customer_id.';

    public function handle(): int
    {
        $limit = (int) $this->option('limit');
        $dryRun = (bool) $this->option('dry-run');

        $query = Subscription::query()
            ->whereNotNull('gateway')
            ->whereNotNull('gateway_subscription_id')
            ->whereNull('gateway_customer_id')
            ->orderBy('id', 'asc')
            ->limit($limit);

        $count = $query->count();
        if ($count === 0) {
            $this->info('No subscriptions found that require gateway customer ids.');
            return 0;
        }

        $this->info("Processing {$count} subscription(s) (limit={$limit}, dry-run=" . ($dryRun ? 'yes' : 'no') . ")");

        $bar = $this->output->createProgressBar($count);
        $bar->start();

        $updated = 0;
        foreach ($query->get() as $subscription) {
            try {
                $gateway = PaymentGatewayFactory::make($subscription->gateway);
                $details = $gateway->getSubscriptionDetails($subscription->gateway_subscription_id);

                $customerId = $details['customer_id'] ?? ($details['customer'] ?? null);

                if ($customerId) {
                    $this->line('');
                    $this->info("Found customer_id={$customerId} for subscription {$subscription->gateway_subscription_id}");

                    if (!$dryRun) {
                        $subscription->update(['gateway_customer_id' => $customerId]);
                        $updated++;
                    } else {
                        $updated++;
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('Failed to fetch subscription details while filling customer ids', [
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

        $this->info("Done. {$updated} subscription(s) would be updated" . ($dryRun ? ' (dry-run)' : ''));

        return 0;
    }
}
