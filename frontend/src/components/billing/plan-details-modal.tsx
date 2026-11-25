import type { Plan } from "./types";

interface PlanDetailsModalProps {
    open: boolean;
    plan: Plan | null;
    onClose: () => void;
}

export function PlanDetailsModal({ open, plan, onClose }: PlanDetailsModalProps) {
    if (!open || !plan) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full">
                <div className="sticky top-0 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">{plan.name} Plan</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition"
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

                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    {plan.details?.limits && Object.keys(plan.details.limits).length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-200 mb-3 uppercase tracking-wider">
                                Limits
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {Object.entries(plan.details.limits).map(([key, value]) => {
                                    let label = key;
                                    let displayValue: string | number | null = value;

                                    if (key === "max_monitors") {
                                        label = "Domains/Monitors";
                                        displayValue =
                                            value === null
                                                ? "Unlimited"
                                                : value === 1
                                                ? "1"
                                                : `Up to ${value}`;
                                    } else if (key === "max_team_members") {
                                        label = "Team Members";
                                        displayValue =
                                            value === null
                                                ? "Unlimited"
                                                : value === 0
                                                ? "Not Allowed"
                                                : value === 1
                                                ? "1"
                                                : `Up to ${value}`;
                                    } else if (key === "monitor_interval_minutes") {
                                        label = "Monitor Interval";
                                        displayValue = `${value} minute(s)`;
                                    } else if (key === "max_status_pages") {
                                        label = "Status Pages";
                                        displayValue =
                                            value === null
                                                ? "Unlimited"
                                                : value === 0
                                                ? "None"
                                                : `${value}`;
                                    } else if (key === "sms_credits_per_month") {
                                        if (value === null || value === undefined) return null;
                                        label = "SMS Credits";
                                        displayValue =
                                            value === 0
                                                ? "None"
                                                : `${value} / month (1 credit = 1 SMS)`;
                                    } else if (key === "whatsapp_credits_per_month") {
                                        if (value === null || value === undefined) return null;
                                        label = "WhatsApp Credits";
                                        displayValue =
                                            value === 0
                                                ? "None"
                                                : `${value} / month (1 credit = 1 WhatsApp)`;
                                    }

                                    return (
                                        <div key={key} className="bg-slate-800/40 rounded-lg p-3">
                                            <p className="text-xs text-slate-400 mb-1">{label}</p>
                                            <p className="text-sm font-medium text-white">{displayValue}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {plan.details?.features && Object.keys(plan.details.features).length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-200 mb-3 uppercase tracking-wider">
                                Features
                            </h3>
                            <div className="space-y-2">
                                {Object.entries(plan.details.features).map(([key, enabled]) => {
                                    const featureLabels: Record<string, string> = {
                                        domain_monitoring: "Domain Monitoring",
                                        ssl_monitoring: "SSL Monitoring",
                                        ai_response_time: "AI Response Time Analysis",
                                        ai_performance: "AI Performance Analysis",
                                        ai_seo_score: "AI SEO Score Analysis",
                                        ai_ux_monitoring: "AI UX Monitoring",
                                        ai_security_monitoring: "AI Security Monitoring",
                                        dns_tools: "DNS Tools",
                                        security_tools: "Security Tools",
                                        incident_reporting: "Incident Reporting",
                                        ai_analysis: "AI Analysis",
                                        multi_region_monitoring: "Multi-Region Monitoring",
                                    };

                                    const label = featureLabels[key] || key;

                                    return (
                                        <div key={key} className="flex items-center gap-3">
                                            {enabled ? (
                                                <svg
                                                    className="w-5 h-5 text-emerald-400 flex-shrink-0"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            ) : (
                                                <svg
                                                    className="w-5 h-5 text-slate-500 flex-shrink-0"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            )}
                                            <span
                                                className={`text-sm ${
                                                    enabled
                                                        ? "text-slate-300"
                                                        : "text-slate-500 line-through"
                                                }`}
                                            >
                                                {label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {plan.details?.integrations &&
                        Object.keys(plan.details.integrations).length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-200 mb-3 uppercase tracking-wider">
                                    Integrations
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {Object.entries(plan.details.integrations).map(
                                        ([key, enabled]) => {
                                            const integrationLabels: Record<string, string> = {
                                                email: "Email",
                                                sms: "SMS",
                                                whatsapp: "WhatsApp",
                                                calls: "Phone Calls",
                                                slack: "Slack",
                                                discord: "Discord",
                                                facebook_ads: "Facebook Lead Ads",
                                                google_ads: "Google Lead Ads",
                                            };

                                            const label = integrationLabels[key] || key;

                                            return (
                                                <div key={key} className="flex items-center gap-2">
                                                    {enabled ? (
                                                        <svg
                                                            className="w-4 h-4 text-emerald-400 flex-shrink-0"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                    ) : (
                                                        <svg
                                                            className="w-4 h-4 text-slate-500 flex-shrink-0"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                    )}
                                                    <span
                                                        className={`text-sm ${
                                                            enabled
                                                                ? "text-slate-300"
                                                                : "text-slate-500 line-through"
                                                        }`}
                                                    >
                                                        {label}
                                                    </span>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            </div>
                        )}
                </div>

                <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 px-6 py-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg font-medium text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
