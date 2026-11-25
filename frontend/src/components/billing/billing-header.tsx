import type { Tab } from "./types";

interface BillingHeaderProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    isPlansLoading: boolean;
    currentPlanCode: string | null;
    subscriptionStatus: string | null;
    trialEndsAt: string | null;
    hasTriedPaidPlan: boolean;
    subscriptionStatusBadge: (status: string | null) => { className: string; label: string };
}

export function BillingHeader({
    activeTab,
    setActiveTab,
    isPlansLoading,
    currentPlanCode,
    subscriptionStatus,
    trialEndsAt,
    hasTriedPaidPlan,
    subscriptionStatusBadge,
}: BillingHeaderProps) {
    return (
        <>
            <h1 className="text-4xl font-bold text-center mb-2 text-white">Billing</h1>

            <div className="text-center mb-8">
                <p className="text-slate-400">
                    Current Plan:{" "}
                    <span className="text-white font-semibold capitalize">
                        {isPlansLoading ? "Loading..." : currentPlanCode ?? "Free"}
                    </span>
                    {!isPlansLoading && subscriptionStatus && (
                        <span
                            className={`ml-2 text-xs px-2 py-0.5 rounded-full border capitalize ${subscriptionStatusBadge(subscriptionStatus).className}`}
                        >
                            {subscriptionStatusBadge(subscriptionStatus).label}
                        </span>
                    )}
                </p>
                {!isPlansLoading && trialEndsAt && (
                    <p className="text-sm text-amber-400 mt-1">
                        Trial ends{" "}
                        {new Date(trialEndsAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                )}
            </div>

            {!hasTriedPaidPlan && currentPlanCode === "free" && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-full px-5 py-2.5 mb-6 text-center shadow-[0_0_15px_rgba(16,185,129,0.15)] w-fit mx-auto">
                    <p className="text-emerald-400 font-medium text-sm flex items-center">
                        <span className="mr-2">💡</span>
                        Try any paid plan free for 14 days. No commitment, cancel anytime.
                    </p>
                </div>
            )}

            <div className="border-b border-slate-800 mb-8">
                <div className="flex gap-8">
                    {(["subscription", "plans", "transactions"] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-2 py-4 text-sm font-medium transition relative !outline-none ${activeTab === tab
                                ? "text-white"
                                : "text-slate-400 hover:text-slate-200"
                                }`}
                        >
                            {tab === "subscription" ? "Subscription Details" : tab === "plans" ? "Plans" : "Transaction History"}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500"></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}
