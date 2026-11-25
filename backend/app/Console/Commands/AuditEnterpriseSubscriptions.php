<?php

namespace App\Console\Commands;

use App\Enums\SubscriptionStatus;
use App\Models\Plan;
use App\Models\PlanPrice;
use App\Models\Subscription;
use App\Models\Workspace;
use App\Services\Billing\WorkspaceBillingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AuditEnterpriseSubscriptions extends Command
{
    protected $signature = "billing:audit-enterprise {--fix : Revert illicit enterprise workspaces back to free}";

    protected $description = "Audit and optionally revert workspaces on enterprise plan without a valid payment gateway record.";

    public function handle(WorkspaceBillingService $workspaceBillingService): int
    {
        $this->info("Scanning for unauthorized enterprise workspaces...");

        $enterprisePlan = Plan::where("code", "enterprise")->first();
        if (!$enterprisePlan) {
            $this->warn("No enterprise plan found in database.");
            return 0;
        }

        $freePlan = Plan::where("code", "free")->first();
        if (!$freePlan) {
            $this->error("No free plan found in database.");
            return 1;
        }

        $freePrice = PlanPrice::where("plan_id", $freePlan->id)
            ->where("is_active", true)
            ->first();

        // Workspaces on enterprise plan with no razorpay_subscription_id
        $workspaces = Workspace::where("plan_id", $enterprisePlan->id)
            ->whereNull("razorpay_subscription_id")
            ->get();

        if ($workspaces->isEmpty()) {
            $this->info("No suspicious enterprise workspaces found. All clear!");
            return 0;
        }

        $this->warn(sprintf("Found %d suspicious enterprise workspace(s) without gateway subscription ID:", $workspaces->count()));

        $rows = [];
        foreach ($workspaces as $ws) {
            $rows[] = [
                $ws->id,
                $ws->name,
                $ws->billing_status,
                $ws->created_at,
            ];
        }

        $this->table(["ID", "Name", "Billing Status", "Created At"], $rows);

        if (!$this->option("fix")) {
            $this->line("");
            $this->comment("Run with --fix to revert these workspaces to the Free plan.");
            return 0;
        }

        $this->info("Applying fix: Reverting suspicious workspaces to Free plan...");

        foreach ($workspaces as $ws) {
            DB::transaction(function () use ($ws, $freePlan, $freePrice, $workspaceBillingService) {
                // Cancel active non-terminal subscriptions
                $ws->subscriptions()
                    ->whereIn("status", SubscriptionStatus::nonTerminalStatuses())
                    ->update([
                        "status" => SubscriptionStatus::CANCELLED,
                        "cancelled_at" => now(),
                    ]);

                if ($freePrice) {
                    $freeSub = Subscription::create([
                        "workspace_id" => $ws->id,
                        "plan_price_id" => $freePrice->id,
                        "gateway" => null,
                        "gateway_subscription_id" => null,
                        "currency" => "USD",
                        "unit_amount" => 0,
                        "status" => SubscriptionStatus::ACTIVE,
                    ]);

                    $workspaceBillingService->syncFromSubscription($ws, $freeSub);
                } else {
                    $ws->update([
                        "plan_id" => $freePlan->id,
                        "billing_status" => SubscriptionStatus::ACTIVE,
                        "razorpay_subscription_id" => null,
                    ]);
                }

                Log::warning("Reverted illicit enterprise workspace to Free plan", [
                    "workspace_id" => $ws->id,
                    "workspace_name" => $ws->name,
                ]);
            });

            $this->info(sprintf("Reverted workspace [%s] (ID: %d) to Free plan.", $ws->name, $ws->id));
        }

        $this->info("Remediation complete.");
        return 0;
    }
}
