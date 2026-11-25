import React, { useState } from "react";
import DateTimeDisplay from "../common/date-time-display";
import type { Interval, Plan } from "./types";
import { Copy, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { formatMoney } from "../../lib/currency";

interface SubscriptionTabProps {
    isLoading: boolean;
    currentPlanCode: string | null;
    subscriptionStatus: string | null;
    gatewaySubscriptionDetails: Record<string, any> | null;
    subscriptionStatusBadge: (status: string | null) => { className: string; label: string };
    userEmail?: string;
    plans: Plan[];
    interval: Interval;
    onCancel?: () => void | Promise<void>;
    cancelling?: boolean;
    canManagePlans?: boolean;
}

export function SubscriptionTab({
    isLoading,
    currentPlanCode,
    subscriptionStatus,
    gatewaySubscriptionDetails,
    subscriptionStatusBadge,
    userEmail,
    plans,
    interval,
    onCancel = () => { },
    cancelling = false,
    canManagePlans = false,
}: SubscriptionTabProps) {
    const [showCancelPopup, setShowCancelPopup] = useState(false);
    const [cancelRequested, setCancelRequested] = useState(false);
    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!currentPlanCode || currentPlanCode === "free" || !gatewaySubscriptionDetails) {
        return (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-10 flex flex-col items-center justify-center text-center mt-6">
                <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <RefreshCw className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-xl font-medium text-white mb-2">No Active Subscription</h3>
                <p className="text-slate-400 max-w-md">
                    You are currently on the Free plan. Upgrade your plan to see detailed subscription information here.
                </p>
            </div>
        );
    }

    const details = gatewaySubscriptionDetails;
    const badge = subscriptionStatusBadge(subscriptionStatus);
    const planName = plans.find(p => p.code === currentPlanCode)?.name || currentPlanCode;
    const planPrice = plans.find(p => p.code === currentPlanCode)?.prices.find(pr => pr.interval === interval);

    const isCancelRequested =
        cancelRequested ||
        subscriptionStatus === "cancel_at_cycle_end" ||
        Boolean(details?.cancel_at_cycle_end);

    const formattedAmount = details.plan?.item?.amount
        ? formatMoney(details.plan.item.amount, details.plan?.item?.currency || 'USD')
        : planPrice ? formatMoney(planPrice.price, planPrice.currency) : 'N/A';

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    return (
        <div className="mt-6 space-y-6">
            {/* Header Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl font-bold text-white">{formattedAmount}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${badge.className}`}>
                            {badge.label}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
                        {details.created_at && (
                            <div>Created on <DateTimeDisplay value={new Date(details.created_at * 1000)} formatOptions={{ day: '2-digit', month: 'short', year: 'numeric' }} /></div>
                        )}
                        {details.current_end && (
                            <div>Next charge: {formattedAmount} on <DateTimeDisplay value={new Date(details.current_end * 1000)} formatOptions={{ day: '2-digit', month: 'short', year: 'numeric' }} /></div>
                        )}
                        <div>No. of payments: {details.total_count || 0}</div>
                    </div>
                </div>

                {subscriptionStatus && !["expired"].includes(subscriptionStatus) && (
                    <div className="shrink-0 mt-4 sm:mt-0">
                        {cancelling ? (
                            <button
                                type="button"
                                disabled={true}
                                className="px-4 py-2 bg-red-500/50 text-red-100 border border-red-500/30 rounded-lg text-sm font-medium flex items-center justify-center cursor-not-allowed opacity-80"
                            >
                                <span className="animate-spin mr-2 h-3.5 w-3.5 border-2 border-red-100 border-t-transparent rounded-full" />
                                Cancelling...
                            </button>
                        ) : isCancelRequested ? (
                            <button
                                type="button"
                                disabled={true}
                                className="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-sm font-medium flex items-center justify-center cursor-not-allowed opacity-90"
                            >
                                Cancellation Requested
                            </button>
                        ) : subscriptionStatus === "cancelled" ? (
                            <button
                                type="button"
                                disabled={true}
                                className="px-4 py-2 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg text-sm font-medium flex items-center justify-center cursor-not-allowed"
                            >
                                Cancelled
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowCancelPopup(true);
                                }}
                                disabled={!canManagePlans}
                                className="px-4 py-2 bg-red-500/90 hover:bg-red-500/75 text-red-100 border border-red-500/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                            >
                                Cancel subscription
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Details Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative">
                <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-white">Subscription details</h3>
                </div>

                <div className="divide-y divide-slate-800/60">

                    {/* Amount */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 px-6 py-3">
                        <div className="text-sm text-slate-400 font-medium mb-1 sm:mb-0">Amount</div>
                        <div className="sm:col-span-2 text-sm text-slate-300">
                            {formattedAmount}
                        </div>
                    </div>

                    {/* Billing frequency */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 px-6 py-3">
                        <div className="text-sm text-slate-400 font-medium mb-1 sm:mb-0">Billing frequency</div>
                        <div className="sm:col-span-2 text-sm text-slate-300 capitalize">
                            Automatically every once a {interval === 'monthly' ? 'month' : 'year'}
                        </div>
                    </div>

                    {/* Subscription Starts At */}
                    {details.start_at && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 px-6 py-3">
                            <div className="text-sm text-slate-400 font-medium mb-1 sm:mb-0">
                                {subscriptionStatus === 'trial' || subscriptionStatus === 'on_trial' || subscriptionStatus === 'trialing' ? 'Trial ends at' : 'Subscription starts at'}
                            </div>
                            <div className="sm:col-span-2 text-sm text-slate-300">
                                <DateTimeDisplay value={new Date(details.start_at * 1000)} formatOptions={{ day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }} />
                            </div>
                        </div>
                    )}

                    {/* Next Due On */}
                    {details.charge_at && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 px-6 py-3">
                            <div className="text-sm text-slate-400 font-medium mb-1 sm:mb-0">Next billing date</div>
                            <div className="sm:col-span-2 text-sm text-slate-300">
                                <DateTimeDisplay value={new Date(details.charge_at * 1000)} formatOptions={{ day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }} />
                            </div>
                        </div>
                    )}

                    {/* Subscription Ends By */}
                    {details.end_at && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 px-6 py-3">
                            <div className="text-sm text-slate-400 font-medium mb-1 sm:mb-0">Subscription ends by</div>
                            <div className="sm:col-span-2 text-sm text-slate-300">
                                <DateTimeDisplay value={new Date(details.end_at * 1000)} formatOptions={{ day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }} />
                            </div>
                        </div>
                    )}


                    {/* Plan Details */}
                    {details.plan_id && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 px-6 py-3">
                            <div className="text-sm text-slate-400 font-medium mb-1 sm:mb-0">Plan details</div>
                            <div className="sm:col-span-2 text-sm">
                                <div className="text-slate-300">
                                    {planName} - {planPrice?.currency || 'USD'} | {formattedAmount} every {interval === 'monthly' ? 'month' : 'year'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Cancel Popup Modal */}
            {showCancelPopup && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowCancelPopup(false)}
                >
                    <div
                        className="bg-slate-900 border border-slate-800 rounded-xl p-6 md:p-8 relative overflow-hidden max-w-md w-full shadow-2xl transform scale-100 animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />

                        <div className="relative z-10 flex flex-col items-center text-center gap-6">
                            <div>
                                <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                                    <span className="text-2xl">😢</span>
                                </div>
                                <h3 className="text-xl font-semibold text-slate-200 mb-3">
                                    Thinking of saying goodbye?
                                </h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    We've loved having you with us. Cancelling means you'll lose access to your current premium features and active monitoring at the end of your billing cycle. If there's anything we can do to make your experience better, please let us know!
                                </p>
                            </div>

                            <div className="flex flex-col w-full gap-3">
                                <button
                                    onClick={() => {
                                        setShowCancelPopup(false);
                                    }}
                                    className="w-full px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                                >
                                    I still need my subscription 🥺
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            setCancelRequested(true);
                                            await onCancel();
                                        } catch {
                                            setCancelRequested(false);
                                        } finally {
                                            setShowCancelPopup(false);
                                        }
                                    }}
                                    disabled={!canManagePlans || cancelling}
                                    className="w-full px-5 py-2.5 rounded-lg border border-red-500/20 bg-red-500/90 text-red-100 text-sm font-medium hover:bg-red-500/75 hover:border-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {cancelling ? "Saying goodbye..." : "I still want to leave"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
