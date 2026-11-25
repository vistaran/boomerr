import type { Plan, Interval, SwitchMode } from "./types";
import { useState } from "react";
import { formatMoney } from "../../lib/currency";

interface PlanChangeConfirmationModalProps {
    open: boolean;
    currentPlan: Plan | null;
    newPlan: Plan | null;
    interval: Interval;
    currentPlanPrice: number | null;
    currentPlanCurrency?: string | null;
    newPlanPrice: number | null;
    newPlanCurrency?: string | null;
    isUpgrade: boolean;
    switchMode: SwitchMode;
    onSwitchModeChange: (mode: SwitchMode) => void;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading: boolean;
    hasTriedPaidPlan?: boolean;
}

export function PlanChangeConfirmationModal({
    open,
    currentPlan,
    newPlan,
    interval,
    currentPlanPrice,
    currentPlanCurrency,
    newPlanPrice,
    newPlanCurrency,
    isUpgrade,
    switchMode,
    onSwitchModeChange,
    onConfirm,
    onCancel,
    isLoading,
    hasTriedPaidPlan = true,
}: PlanChangeConfirmationModalProps) {
    const [showDetails, setShowDetails] = useState(false);

    if (!open || !currentPlan || !newPlan) return null;

    const currentMonthlyPrice = currentPlanPrice || 0;
    const newMonthlyPrice = newPlanPrice || 0;

    const priceForBilling = interval === "yearly" ? newMonthlyPrice * 12 : newMonthlyPrice;
    const formatPrice = (price: number) => {
        return formatMoney(price, newPlanCurrency || currentPlanCurrency || "USD");
    };

    const getChangeDescription = () => {
        const isFreeTrial = isUpgrade && currentMonthlyPrice === 0 && !hasTriedPaidPlan;

        if (isFreeTrial) {
            return "Start your 14-day free trial now! You won't be charged today. If you don't cancel, your subscription will automatically begin after the trial ends.";
        }

        if (isUpgrade) {
            if (switchMode === "immediate") {
                return "Your plan will switch immediately after you complete payment authentication for the new plan. You'll get access to premium features right away.";
            }

            // Check if current plan is free or paid
            if (currentMonthlyPrice === 0) {
                return "Your new plan will activate automatically after you complete payment authentication.";
            }

            return "Your current paid plan will continue until the end of this billing cycle. The new plan will activate automatically at renewal.";
        } else {
            // Downgrade
            if (switchMode === "immediate") {
                return "Your plan will switch immediately after you complete payment authentication for the new plan.";
            }

            const prorataMessage =
                currentMonthlyPrice > newMonthlyPrice
                    ? `Your plan will be downgraded. Your future billing will be ${formatPrice(priceForBilling)}/${interval === "monthly" ? "month" : "year"}.`
                    : `You'll be downgraded at the end of your current billing period.`;
            return prorataMessage;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full shadow-2xl">
                {/* Header */}
                <div className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">
                        {isUpgrade && currentMonthlyPrice === 0 && !hasTriedPaidPlan 
                            ? "Start 14-Day Free Trial" 
                            : isUpgrade ? "Upgrade Plan" : "Downgrade Plan"}
                    </h2>
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="text-slate-400 hover:text-slate-200 transition disabled:opacity-50"
                        aria-label="Close"
                    >
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Plan Comparison */}
                    <div className="space-y-3">
                        {!(isUpgrade && currentMonthlyPrice === 0 && !hasTriedPaidPlan) && (
                            <div>
                                <p className="text-xs text-slate-400 mb-1.5 uppercase tracking-wider">
                                    Current Plan
                                </p>
                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                    <p className="font-semibold text-white">{currentPlan.name}</p>
                                    <p className="text-sm text-slate-400">
                                        {currentMonthlyPrice === 0
                                            ? "Free"
                                            : `${formatMoney(currentMonthlyPrice, currentPlanCurrency || newPlanCurrency || "USD")}/${interval === "monthly" ? "month" : "year"}`}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div>
                            <p className="text-xs text-slate-400 mb-1.5 uppercase tracking-wider">
                                {isUpgrade && currentMonthlyPrice === 0 && !hasTriedPaidPlan ? "Selected Plan" : "New Plan"}
                            </p>
                            <div
                                className={`rounded-lg p-3 border ${
                                    isUpgrade
                                        ? "bg-indigo-500/10 border-indigo-500/50"
                                        : "bg-amber-500/10 border-amber-500/50"
                                }`}
                            >
                                <p className="font-semibold text-white">{newPlan.name}</p>
                                <p
                                    className={`text-sm ${
                                        isUpgrade ? "text-indigo-300" : "text-amber-300"
                                    }`}
                                >
                                    {newMonthlyPrice === 0
                                        ? "Free"
                                        : `${formatMoney(newMonthlyPrice, newPlanCurrency || currentPlanCurrency || "USD")}/${interval === "monthly" ? "month" : "year"}`}
                                </p>
                            </div>
                        </div>
                    </div>


                    {/* USD International Card Warning */}
                    {newPlanCurrency === "USD" && (
                        <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-3">
                            <p className="text-xs text-yellow-200 leading-relaxed">
                                <span className="font-semibold">⚠️ Note:</span> Only international bank cards are accepted for USD payments.
                            </p>
                        </div>
                    )}

                    {/* Change Description */}
                    <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                        <p className="text-sm text-slate-300 leading-relaxed">
                            {getChangeDescription()}
                        </p>
                    </div>

                    {currentMonthlyPrice > 0 && newMonthlyPrice > 0 && (
                        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50 space-y-2">
                            <p className="text-xs text-slate-400 uppercase tracking-wider">
                                Switch timing
                            </p>
                            <p className="text-xs text-slate-400">
                                Selected: {switchMode === "immediate" ? "Switch now" : "End of cycle"}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    aria-pressed={switchMode === "immediate"}
                                    onClick={() => onSwitchModeChange("immediate")}
                                    className={`rounded-lg px-3 py-2 text-xs font-medium border transition ${
                                        switchMode === "immediate"
                                            ? "bg-indigo-600/30 border-indigo-400 text-indigo-100 ring-1 ring-indigo-400"
                                            : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600"
                                    }`}
                                >
                                    {switchMode === "immediate" ? "✓ Switch now" : "Switch now"}
                                </button>
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    aria-pressed={switchMode === "cycle_end"}
                                    onClick={() => onSwitchModeChange("cycle_end")}
                                    className={`rounded-lg px-3 py-2 text-xs font-medium border transition ${
                                        switchMode === "cycle_end"
                                            ? "bg-indigo-600/30 border-indigo-400 text-indigo-100 ring-1 ring-indigo-400"
                                            : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600"
                                    }`}
                                >
                                    {switchMode === "cycle_end" ? "✓ End of cycle" : "End of cycle"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* More Details */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition w-full text-left"
                    >
                        {showDetails ? "Hide" : "Show"} what changes with this plan ↓
                    </button>

                    {showDetails && (
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-sm space-y-2">
                            {newPlan.details?.limits && (
                                <div>
                                    <p className="font-medium text-slate-200 mb-1.5">Limits:</p>
                                    <ul className="space-y-0.5 text-slate-400 text-xs">
                                        {Object.entries(newPlan.details.limits).map(
                                            ([key, value]) => {
                                                let label = key;
                                                let displayValue: string | number | null =
                                                    value;

                                                if (key === "max_monitors") {
                                                    label = "Max Monitors";
                                                    displayValue =
                                                        value === null
                                                            ? "Unlimited"
                                                            : value === 1
                                                              ? "1"
                                                              : `Up to ${value}`;
                                                } else if (
                                                    key === "max_team_members"
                                                ) {
                                                    label = "Team Members";
                                                    displayValue =
                                                        value === null
                                                            ? "Unlimited"
                                                            : value === 0
                                                              ? "Not Allowed"
                                                              : value === 1
                                                                ? "1"
                                                                : `Up to ${value}`;
                                                } else if (
                                                    key ===
                                                    "monitor_interval_minutes"
                                                ) {
                                                    label = "Monitor Interval";
                                                    displayValue = `${value} min`;
                                                } else if (
                                                    key === "max_status_pages"
                                                ) {
                                                    label = "Status Pages";
                                                    displayValue =
                                                        value === null
                                                            ? "Unlimited"
                                                            : value === 0
                                                              ? "None"
                                                              : `${value}`;
                                                } else if (
                                                    key === "sms_credits_per_month"
                                                ) {
                                                    if (value === null || value === undefined) return null;
                                                    label = "SMS Credits";
                                                    displayValue =
                                                        value === 0
                                                            ? "None"
                                                            : `${value} / mo (1 credit = 1 SMS)`;
                                                } else if (
                                                    key === "whatsapp_credits_per_month"
                                                ) {
                                                    if (value === null || value === undefined) return null;
                                                    label = "WhatsApp Credits";
                                                    displayValue =
                                                        value === 0
                                                            ? "None"
                                                            : `${value} / mo (1 credit = 1 WhatsApp)`;
                                                }

                                                return (
                                                    <li key={key}>
                                                        <span className="text-slate-300">
                                                            {label}:
                                                        </span>{" "}
                                                        {displayValue}
                                                    </li>
                                                );
                                            }
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Warning for Downgrade */}
                    {!isUpgrade && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                            <p className="text-xs text-amber-200 leading-relaxed">
                                <span className="font-semibold">⚠️ Note:</span> Downgrading may
                                reduce your limits. Any data exceeding the new plan's limits may
                                be affected.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-700 px-6 py-4 flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1 py-2.5 rounded-lg font-medium text-sm transition bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition text-white disabled:opacity-60 ${
                            isUpgrade
                                ? "bg-indigo-600 hover:bg-indigo-700"
                                : "bg-amber-600 hover:bg-amber-700"
                        }`}
                    >
                        {isLoading 
                            ? "Processing..." 
                            : (isUpgrade && currentMonthlyPrice === 0 && !hasTriedPaidPlan)
                                ? "Start 14-Day Free Trial"
                                : isUpgrade 
                                    ? "Confirm Upgrade" 
                                    : "Confirm Downgrade"}
                    </button>
                </div>
            </div>
        </div>
    );
}
