<?php

namespace App\Services\Billing;

use App\Enums\SubscriptionStatus;
use App\Models\PlanPrice;
use App\Models\Subscription;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

class WorkspaceSubscriptionService
{
    public function ensureDefaultFreeSubscription(Workspace $workspace): ?Subscription
    {
        $existingSubscription = $workspace->activeSubscription()->first();

        if ($existingSubscription) {
            return $existingSubscription;
        }

        return DB::transaction(function () use ($workspace) {
            $lockedWorkspace = Workspace::query()
                ->whereKey($workspace->id)
                ->lockForUpdate()
                ->first();

            if (!$lockedWorkspace) {
                return null;
            }

            $activeSubscription = $lockedWorkspace->activeSubscription()->first();

            if ($activeSubscription) {
                return $activeSubscription;
            }

            $freePlanPrice = PlanPrice::query()
                ->where('is_active', true)
                ->where('price', 0)
                ->whereHas('plan', function ($query) {
                    $query->where('code', 'free')->where('is_active', true);
                })
                ->orderBy('id')
                ->get()
                ->sortBy(fn (PlanPrice $price) => $price->interval === 'monthly' ? 0 : 1)
                ->first();

            if (!$freePlanPrice) {
                return null;
            }

            return Subscription::create([
                'workspace_id' => $lockedWorkspace->id,
                'plan_price_id' => $freePlanPrice->id,
                'gateway' => null,
                'gateway_subscription_id' => null,
                'currency' => $freePlanPrice->currency,
                'unit_amount' => $freePlanPrice->price,
                'status' => SubscriptionStatus::ACTIVE,
            ]);
        });
    }
}
