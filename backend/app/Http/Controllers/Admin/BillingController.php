<?php

namespace App\Http\Controllers\Admin;

use App\Enums\SubscriptionStatus;
use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\PlanPrice;
use App\Models\Subscription;
use App\Models\Workspace;
use App\Services\Billing\WorkspaceBillingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BillingController extends Controller
{
    public function index(Request $request)
    {
        $subscriptions = Subscription::with("workspace")->orderBy("created_at", "desc")->paginate(20);
        return response()->json($subscriptions);
    }

    public function assignCustomPlan(Request $request, WorkspaceBillingService $workspaceBillingService)
    {
        $request->validate([
            "workspace_id" => "required|exists:workspaces,id",
            "plan_code" => "required|string",
        ]);

        $plan = Plan::where("code", $request->plan_code)->firstOrFail();
        if (!$plan->isCustom()) {
            return response()->json([
                "message" => "Only custom or enterprise plans can be manually assigned by admin."
            ], 422);
        }

        $workspace = Workspace::query()->whereKey($request->workspace_id)->lockForUpdate()->firstOrFail();

        $price = PlanPrice::where("plan_id", $plan->id)
            ->where("is_active", true)
            ->orderBy("price")
            ->first();

        if (!$price) {
            return response()->json([
                "message" => "Custom plan is not configured with an active price."
            ], 422);
        }

        DB::beginTransaction();
        try {
            $workspace->subscriptions()
                ->whereIn("status", SubscriptionStatus::nonTerminalStatuses())
                ->update([
                    "status" => SubscriptionStatus::CANCELLED,
                    "cancelled_at" => now(),
                    "switch_requested_plan_price_id" => null,
                    "switch_requested_interval" => null,
                    "switch_requested_at" => null,
                ]);

            $subscription = Subscription::create([
                "workspace_id" => $workspace->id,
                "plan_price_id" => $price->id,
                "gateway" => null,
                "gateway_subscription_id" => null,
                "currency" => strtoupper((string) ($price->currency ?: config("billing.default_currency", "USD"))),
                "unit_amount" => (int) $price->price,
                "status" => SubscriptionStatus::ACTIVE,
            ]);

            $workspaceBillingService->syncFromSubscription($workspace, $subscription);

            DB::commit();

            return response()->json([
                "message" => "Custom plan assigned successfully.",
                "workspace_id" => $workspace->id,
                "plan_name" => $plan->name,
            ]);
        } catch (\Throwable $exception) {
            DB::rollBack();

            Log::error("Admin custom plan assignment failed", [
                "workspace_id" => $workspace->id,
                "plan_id" => $plan->id,
                "error" => $exception->getMessage(),
            ]);

            return response()->json([
                "message" => "Unable to assign custom plan."
            ], 500);
        }
    }
}
