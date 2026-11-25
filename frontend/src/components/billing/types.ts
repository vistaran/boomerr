export type Interval = "monthly" | "yearly";
export type SwitchMode = "immediate" | "cycle_end";
export type Tab = "plans" | "subscription" | "transactions";

export interface PlanPrice {
    id: number;
    interval: Interval;
    price: number;
    currency: string;
}

export interface Plan {
    id: number;
    name: string;
    code: string;
    prices: PlanPrice[];
    available_currencies?: string[];
    details?: {
        features: Record<string, boolean>;
        limits: Record<string, number | null>;
        integrations: Record<string, boolean>;
    };
}

export interface Transaction {
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
}
