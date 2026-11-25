import type { Interval, Plan } from "./types";
import { useState } from "react";
import { contactSales } from "../../api/contact-sales";
import { useAuth } from "../../context/auth-context";
import { formatMoney } from "../../lib/currency";
import toast from "react-hot-toast";

interface PlanCardProps {
    canManagePlans: boolean;
    plan: Plan;
    interval: Interval;
    currentPlanPriceId: number | null;
    currentPlanCode: string | null;
    subscriptionStatus: string | null;
    loadingPlan: string | null;
    planOrder: string[];
    hasTriedPaidPlan?: boolean;
    onSubscribe: (planCode: string) => void;
    onOpenPlanDetails: (plan: Plan) => void;
}

function getPlanDetailsText(planDetails: Plan["details"]): string[] {
    if (!planDetails) return [];

    const details: string[] = [];

    if (planDetails.limits) {
        if (planDetails.limits.max_monitors) {
            if (planDetails.limits.max_monitors === 1) {
                details.push("1 domain");
            } else if (planDetails.limits.max_monitors > 1) {
                details.push(`Up to ${planDetails.limits.max_monitors} domains`);
            } else {
                details.push("Unlimited domains");
            }
        }

        if (planDetails.limits.monitor_interval_minutes) {
            details.push(`${planDetails.limits.monitor_interval_minutes}-minute check interval`);
        }

        if (planDetails.limits.max_status_pages !== undefined) {
            if (planDetails.limits.max_status_pages === 1) {
                details.push("1 status page");
            } else if (planDetails.limits.max_status_pages && planDetails.limits.max_status_pages > 1) {
                details.push(`Up to ${planDetails.limits.max_status_pages} status pages`);
            } else if (planDetails.limits.max_status_pages === null) {
                details.push("Unlimited status pages");
            }
        }

        if (planDetails.limits.sms_credits_per_month) {
            details.push(`${planDetails.limits.sms_credits_per_month} SMS credits/month (1 credit = 1 SMS)`);
        }

        if (planDetails.limits.whatsapp_credits_per_month) {
            details.push(`${planDetails.limits.whatsapp_credits_per_month} WhatsApp credits/month (1 credit = 1 WhatsApp)`);
        }

        if (planDetails.limits.max_team_members !== undefined) {
            if (planDetails.limits.max_team_members === 0) {
                details.push("No team members");
            } else if (planDetails.limits.max_team_members === 1) {
                details.push("1 team member");
            } else if (planDetails.limits.max_team_members) {
                details.push(`Up to ${planDetails.limits.max_team_members} team members`);
            } else {
                details.push("Unlimited team members");
            }
        }
    }

    if (planDetails.features) {
        const featureLabels: Record<string, string> = {
            ssl_monitoring: "SSL Monitoring",
            ai_response_time: "AI Response Analysis",
            ai_performance: "AI Performance Analysis",
            ai_seo_score: "AI SEO Scoring",
            ai_ux_monitoring: "AI UX Monitoring",
            ai_security_monitoring: "AI Security Analysis",
            dns_tools: "DNS Tools",
            security_tools: "Security Tools",
            incident_reporting: "Incident Reporting",
            ai_analysis: "AI Analysis",
        };

        Object.entries(planDetails.features).forEach(([key, enabled]) => {
            if (enabled && featureLabels[key]) {
                details.push(featureLabels[key]);
            }
        });
    }

    if (planDetails.integrations) {
        const integrationLabels: Record<string, string> = {
            slack: "Slack Integration",
            discord: "Discord Integration",
            sms: "SMS Alerts",
            whatsapp: "WhatsApp Alerts",
            calls: "Phone Alerts",
            telegram: "Telegram Alerts",
            facebook_ads: "Facebook Lead Ads",
            google_ads: "Google Lead Ads",
        };

        Object.entries(planDetails.integrations).forEach(([key, enabled]) => {
            // Avoid duplicate SMS/WhatsApp entry if already detailed in limits
            if (key === "sms" && planDetails.limits?.sms_credits_per_month) {
                return;
            }
            if (key === "whatsapp" && planDetails.limits?.whatsapp_credits_per_month) {
                return;
            }
            if (enabled && integrationLabels[key]) {
                details.push(integrationLabels[key]);
            }
        });
    }

    return details;
}

export default function PlanCard({
    canManagePlans,
    plan,
    interval,
    currentPlanPriceId,
    currentPlanCode,
    subscriptionStatus,
    loadingPlan,
    planOrder,
    hasTriedPaidPlan,
    onSubscribe,
    onOpenPlanDetails,
}: PlanCardProps) {
    const isEnterprise = plan.code === "enterprise";
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactLoading, setContactLoading] = useState(false);
    const price = isEnterprise ? null : plan.prices.find((p) => p.interval === interval);
    const isCurrent = (!isEnterprise) && (
        (price?.id === currentPlanPriceId) || 
        (plan.code === "free" && currentPlanCode === "free")
    );
    const canResubscribeCurrentPlan = isCurrent && subscriptionStatus === "halted";

    const currentIndex = planOrder.indexOf(currentPlanCode ?? "free");
    const planIndex = planOrder.indexOf(plan.code);

    let buttonText = "Subscribe";
    if (isCurrent) buttonText = canResubscribeCurrentPlan ? "Subscribe Again" : "Current Plan";
    else if (!hasTriedPaidPlan && !isEnterprise && plan.code !== "free") buttonText = "Start Free Trial";
    else if (planIndex > currentIndex && !isEnterprise) buttonText = "Upgrade";
    else if (planIndex < currentIndex && !isEnterprise) buttonText = "Downgrade";

    const displayFeatures = getPlanDetailsText(plan.details);

    // Contact Sales Modal
    const [contactMessage, setContactMessage] = useState("");

    const { user, workspaces } = useAuth();
    const currentWorkspace = workspaces.find((ws) => ws.is_current) ?? null;
    const handleContactSales = async () => {
        setContactLoading(true);
        try {
            await contactSales({
                message: contactMessage,
                workspace:
                    currentWorkspace?.name ??
                    (user?.workspace_id ? String(user.workspace_id) : undefined),
            });
            toast.success("Your inquiry was sent. We'll contact you soon.");
            setShowContactModal(false);
            setContactMessage("");
        } catch {
            toast.error("Failed to send inquiry. Please try again.");
        } finally {
            setContactLoading(false);
        }
    };

    return (
        <div
            className={`relative bg-slate-950/80 shadow-sm shadow-indigo-600/20 border-2 rounded-xl p-6 flex flex-col min-h-[360px] transition-all duration-200 ${isEnterprise
                    ? "border-amber-500/50"
                    : isCurrent
                        ? "border-indigo-500 ring-1 ring-indigo-500/30"
                        : "border-slate-800 hover:border-slate-700 hover:-translate-y-0.5"
                }`}
        >
            <div className="mb-3">
                <h3 className="text-lg font-semibold text-white flex items-center">{plan.name}
                    {isCurrent && (
                        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 ml-2.5">
                            Currently active
                        </span>
                    )}
                    {isEnterprise && (
                        <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 ml-2.5">
                            Custom Plan
                        </span>
                    )}
                </h3>
            </div>

            {isEnterprise ? (
                <div className="mb-3 pb-3 border-b border-slate-800">
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-amber-400">Custom</span>
                        <span className="text-sm text-slate-400">Pricing</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">
                        Based on your specific needs and features
                    </p>
                </div>
            ) : price ? (
                <div className="mb-3 pb-3 border-b border-slate-800">
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-white">
                            {price.price === 0 ? "Free" : formatMoney(price.price, price.currency)}
                        </span>
                        {price.price > 0 && (
                            <span className="text-sm text-slate-400">
                                /{interval === "monthly" ? "month" : "year"}
                            </span>
                        )}
                    </div>
                    {price.price === 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">Forever free</p>
                    )}
                </div>
            ) : null}

            <div className="mb-3 flex-grow">
                <p className="text-xs text-slate-400 font-medium mb-1.5 uppercase tracking-wider">
                    Features
                </p>
                <ul className="space-y-1">
                    {displayFeatures.slice(0, 4).map((detail, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-300 leading-tight">
                            <svg
                                className="w-3 h-3 mt-0.5 text-indigo-400 flex-shrink-0"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <span>{detail}</span>
                        </li>
                    ))}
                </ul>
                {displayFeatures.length > 4 && (
                    <button
                        onClick={() => onOpenPlanDetails(plan)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 pt-1.5 border-t border-slate-800/50 w-full text-left transition"
                    >
                        +{displayFeatures.length - 4} more features →
                    </button>
                )}
            </div>

            {isEnterprise ? (
                <>
                    <button
                        type="button"
                        className="w-full py-2 rounded-lg font-medium text-sm transition bg-amber-600 hover:bg-amber-700 text-white text-center block disabled:opacity-60"
                        onClick={() => setShowContactModal(true)}
                        disabled={!canManagePlans}
                    >
                        {canManagePlans ? "Contact Sales" : "Owner Only"}
                    </button>
                    {showContactModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 ">
                            <div className="bg-slate-900 rounded-xl p-5 w-full max-w-md shadow-lg relative">
                                <button className="absolute top-3 right-3 text-slate-400 hover:text-slate-200 text-2xl" onClick={() => setShowContactModal(false)}>&times;</button>
                                <h2 className="text-lg font-semibold text-white mb-3">Contact Sales</h2>
                                <form onSubmit={e => { e.preventDefault(); handleContactSales(); }}>
                                    <div className="mb-3">
                                        <label className="block text-xs text-slate-300 mb-1">Message</label>
                                        <textarea className="w-full rounded border border-slate-700 bg-slate-800 text-white px-3 py-2" value={contactMessage} onChange={e => setContactMessage(e.target.value)} required rows={4} />
                                    </div>
                                    <button type="submit" className="w-full py-2 rounded-lg font-medium text-sm transition bg-amber-600 hover:bg-amber-700 text-white text-center block" disabled={contactLoading}>
                                        {contactLoading ? "Sending..." : "Send Inquiry"}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <button
                    disabled={
                        !canManagePlans ||
                        (!canResubscribeCurrentPlan && isCurrent) ||
                        loadingPlan === `${plan.code}-${interval}`
                    }
                    onClick={() => onSubscribe(plan.code)}
                    className={`w-full py-2.5 rounded-lg font-medium text-sm transition ${isCurrent && !canResubscribeCurrentPlan
                            ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                        }`}
                >
                    {loadingPlan === `${plan.code}-${interval}`
                        ? "Processing…"
                        : !canManagePlans
                            ? "Owner Only"
                            : buttonText}
                </button>
            )}
        </div>
    );
}
