import PlanCard from "./plan-card";
import type { Interval, Plan } from "./types";

interface PlansTabProps {
    isLoading: boolean;
    canManagePlans: boolean;
    plans: Plan[];
    interval: Interval;
    setInterval: (interval: Interval) => void;
    currentPlanCode: string | null;
    currentPlanPriceId: number | null;
    subscriptionStatus: string | null;
    gatewayStatus: string | null;
    paymentUpdateUrl: string | null;
    loadingPlan: string | null;
    retrying: boolean;
    cancelling: boolean;
    checkingPaymentStatus: boolean;
    canResubscribeFromCurrentCard: boolean;
    canUpdatePaymentMethod: boolean;
    isGatewayTerminal: boolean;
    planOrder: string[];
    hasTriedPaidPlan: boolean;
    onSubscribe: (planCode: string) => void;
    onOpenPlanDetails: (plan: Plan) => void;
    onRetry: () => void;
    onCancel: () => void;
}

export function PlansTab({
    isLoading,
    canManagePlans,
    plans,
    interval,
    setInterval,
    currentPlanCode,
    currentPlanPriceId,
    subscriptionStatus,
    gatewayStatus,
    paymentUpdateUrl,
    loadingPlan,
    retrying,
    cancelling,
    checkingPaymentStatus,
    canResubscribeFromCurrentCard,
    canUpdatePaymentMethod,
    isGatewayTerminal,
    planOrder,
    hasTriedPaidPlan,
    onSubscribe,
    onOpenPlanDetails,
    onRetry,
    onCancel,
}: PlansTabProps) {
    return (
        <>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-2xl font-semibold text-white mb-0.5">Choose your plan</h2>
                    <p className="text-sm text-slate-400">Scale as you grow. Cancel anytime.</p>
                    {!canManagePlans && (
                        <p className="text-xs text-amber-400 mt-1.5">Only workspace owners can manage billing plans.</p>
                    )}
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-1 flex">
                    {(["monthly", "yearly"] as Interval[]).map((type) => (
                        <button
                            key={type}
                            onClick={() => setInterval(type)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${interval === type
                                ? "bg-indigo-600 text-white"
                                : "text-slate-400 hover:text-white"
                                }`}
                        >
                            {type === "monthly" ? "Monthly" : "Yearly"}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 justify-around">
                {isLoading
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={`plan-skeleton-${index}`}
                            className="bg-slate-950/80 border-2 border-slate-800 rounded-xl p-4 animate-pulse"
                        >
                            <div className="h-5 w-24 bg-slate-800 rounded mb-3" />
                            <div className="h-10 w-32 bg-slate-800 rounded mb-3 pb-3 border-b border-slate-800" />
                            <div className="space-y-2 mb-3">
                                <div className="h-3 w-full bg-slate-800 rounded" />
                                <div className="h-3 w-4/5 bg-slate-800 rounded" />
                                <div className="h-3 w-3/5 bg-slate-800 rounded" />
                            </div>
                            <div className="h-10 w-full bg-slate-800 rounded" />
                        </div>
                    ))
                    : plans.map((plan) => (
                        <PlanCard
                            key={plan.id}
                            canManagePlans={canManagePlans}
                            plan={plan}
                            interval={interval}
                            currentPlanPriceId={currentPlanPriceId}
                            currentPlanCode={currentPlanCode}
                            subscriptionStatus={subscriptionStatus}
                            loadingPlan={loadingPlan}
                            planOrder={planOrder}
                            hasTriedPaidPlan={hasTriedPaidPlan}
                            onSubscribe={onSubscribe}
                            onOpenPlanDetails={onOpenPlanDetails}
                        />
                    ))}
            </div>

            {(["pending", "past_due"] as string[]).includes(subscriptionStatus ?? "") &&
                currentPlanCode &&
                currentPlanCode !== "free" &&
                !isGatewayTerminal &&
                !canResubscribeFromCurrentCard && (
                    <div className="mt-6 pt-6 border-t border-red-800 bg-red-500/10 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-red-300 mb-1.5">Payment Failed</h3>
                        <p className="text-sm text-red-200/80 mb-3">
                            {checkingPaymentStatus
                                ? "Checking payment status with Razorpay..."
                                : "Your payment couldn't be processed. Please try again or your account will be limited to the free plan."}
                        </p>
                        <button
                            onClick={onRetry}
                            disabled={!canManagePlans || retrying || checkingPaymentStatus}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition"
                        >
                            {checkingPaymentStatus
                                ? "Checking Status..."
                                : retrying
                                    ? "Retrying…"
                                    : "Retry Payment"}
                        </button>
                        {canUpdatePaymentMethod && (
                            <button
                                onClick={() =>
                                    window.open(paymentUpdateUrl!, "_blank", "noopener,noreferrer")
                                }
                                disabled={!canManagePlans || checkingPaymentStatus}
                                className="ml-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition"
                            >
                                Update Payment Method
                            </button>
                        )}
                    </div>
                )}

            {subscriptionStatus === "halted" && canUpdatePaymentMethod && (
                <div className="mt-6 pt-6 border-t border-red-800 bg-red-500/10 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-red-300 mb-1.5">Subscription Halted</h3>
                    <p className="text-sm text-red-200/80 mb-3">
                        {checkingPaymentStatus
                            ? "Checking payment status with Razorpay..."
                            : "Update your payment method and complete payment to reactivate this subscription."}
                    </p>
                    <button
                        onClick={() =>
                            window.open(paymentUpdateUrl!, "_blank", "noopener,noreferrer")
                        }
                        disabled={!canManagePlans || checkingPaymentStatus}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition"
                    >
                        Update Payment Method
                    </button>
                    {gatewayStatus && (
                        <p className="text-xs text-red-200/70 mt-2 capitalize">
                            Gateway status: {gatewayStatus}
                        </p>
                    )}
                </div>
            )}

            {(["expired", "cancelled"] as string[]).includes(subscriptionStatus ?? "") && (
                <div className="mt-6 pt-6 border-t border-slate-700 bg-slate-900/40 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-200 mb-1.5">Subscription Ended</h3>
                    <p className="text-sm text-slate-300/80">
                        Your previous subscription is in a terminal state. Choose any plan above
                        to subscribe again, upgrade, or downgrade.
                    </p>
                </div>
            )}

        </>
    );
}
