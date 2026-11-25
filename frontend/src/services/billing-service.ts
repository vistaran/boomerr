import { api } from "../api";
import type { PlanInfo, PlanDetails } from "../types/plan";

export interface SubscribeResponse {
	subscription_id: string | null;
	public_key: string | null;
	currency?: string | null;
	payment_url?: string | null;
	reuse?: boolean;
	message?: string;
	is_trial_activated?: boolean;
	plan_name?: string;
	trial_ends_at?: string | null;
	switch_mode?: "immediate" | "cycle_end";
}

export const getPlans = async (currency?: string) => {
	return api.get<{
		plans: any[];
		requested_currency: string;
		resolved_currency: string;
		current_subscription_currency: string | null;
		supported_currencies: string[];
		current_plan_code: string | null;
		current_plan_price_id: number | null;
		current_plan_details: PlanDetails | null;
		status: string | null;
		gateway_status: string | null;
		gateway_subscription_details?: Record<string, any> | null;
		payment_update_url: string | null;
		trial_ends_at: string | null;
		is_past_due: boolean;
		failed_payment_attempts: number;
		has_tried_paid_plan: boolean;
	}>("/billing/plans", {
		params: { currency },
	});
};

export const subscribeToPlan = async (planCode: string, interval: string, currency?: string, keepDomainIds?: number[]) => {
	return api.post<SubscribeResponse>("/billing/subscribe", {
		plan_code: planCode,
		interval,
		currency,
		keep_domain_ids: keepDomainIds,
	});
};

export const subscribeToPlanWithMode = async (
	planCode: string,
	interval: string,
	switchMode: "immediate" | "cycle_end",
	currency?: string,
	keepDomainIds?: number[],
) => {
	return api.post<SubscribeResponse>("/billing/subscribe", {
		plan_code: planCode,
		interval,
		switch_mode: switchMode,
		currency,
		keep_domain_ids: keepDomainIds,
	});
};

export const cancelSubscription = async (gatewaySubscriptionId?: string) => {
	return api.post<{ message: string; current_period_end?: string }>("/billing/cancel", {
		...(gatewaySubscriptionId ? { gateway_subscription_id: gatewaySubscriptionId } : {}),
	});
};

export const retryPayment = async () => {
	return api.post<{
		retry_allowed: boolean;
		payment_url: string | null;
		message: string;
	}>("/billing/retry", {});
};

export const getTransactionHistory = async (page = 1) => {
	return api.get<{
		data: {
			id: number;
			gateway_payment_id: string | null;
			amount: number | null;
			currency: string;
			status: "captured" | "failed" | "refunded";
			description: string | null;
			paid_at: string | null;
			created_at: string;
			formatted_amount: string;
			subscription: {
				plan_price: {
					interval: string;
					plan: { name: string };
				} | null;
			} | null;
		}[];
		current_page: number;
		last_page: number;
		total: number;
	}>(`/billing/transactions?page=${page}`);
};

export const getPlanInfo = async (): Promise<PlanInfo> => {
	return api.get<PlanInfo>("/workspaces/plan-info");
};
