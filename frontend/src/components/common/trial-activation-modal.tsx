import { CheckCircle, Zap, BarChart3, Settings, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TrialActivationModalProps {
    open: boolean;
    onClose: () => void;
    planName: string;
    trialEndDate: string;
}

export function TrialActivationModal({
    open,
    onClose,
    planName,
    trialEndDate,
}: TrialActivationModalProps) {
    const navigate = useNavigate();

    if (!open) return null;

    const handleGetStarted = () => {
        onClose();
        navigate("/overview");
    };

    const formattedDate = new Date(trialEndDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const daysLeft = Math.ceil(
        (new Date(trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/90"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 shadow-2xl backdrop-blur">
                {/* Celebration Header */}
                <div className="mb-6 flex flex-col items-center justify-center text-center w-full">
                    <div className="mb-4 flex items-center justify-center w-full">
                        <div className="relative">
                            <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/30 blur-xl" />
                            <CheckCircle className="relative h-16 w-16 text-emerald-400 mx-auto" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2 w-full text-center">
                        Trial Activated!
                    </h2>
                    <p className="text-sm text-slate-300 w-full text-center">
                        Welcome to <span className="font-semibold text-emerald-300">{planName}</span>
                    </p>
                </div>

                {/* Trial Details */}
                <div className="mb-6 space-y-3 rounded-xl bg-slate-800/50 p-4 border border-slate-700/50">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Trial Period</span>
                        <span className="text-sm font-semibold text-emerald-300">
                            14 Days
                        </span>
                    </div>
                    <div className="h-px bg-slate-700/50" />
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Expires</span>
                        <span className="text-sm font-semibold text-white">
                            {formattedDate}
                        </span>
                    </div>
                    <div className="h-px bg-slate-700/50" />
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Days Remaining</span>
                        <span className="text-sm font-semibold text-amber-300">
                            {daysLeft} days
                        </span>
                    </div>
                </div>

                {/* What to Explore */}
                <div className="mb-6">
                    <h3 className="mb-3 text-sm font-semibold text-slate-200">
                        What You Can Explore
                    </h3>
                    <div className="space-y-2.5">
                        <div className="flex items-start gap-3">
                            <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                            <span className="text-sm text-slate-300">
                                Full access to premium features and integrations
                            </span>
                        </div>
                        <div className="flex items-start gap-3">
                            <BarChart3 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                            <span className="text-sm text-slate-300">
                                Advanced analytics and monitoring dashboards
                            </span>
                        </div>
                        <div className="flex items-start gap-3">
                            <Settings className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                            <span className="text-sm text-slate-300">
                                Configure all integrations and automations
                            </span>
                        </div>
                    </div>
                </div>

                {/* CTA Buttons */}
                <div className="space-y-2">
                    <button
                        onClick={handleGetStarted}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:from-emerald-500 hover:to-emerald-400 transition-all duration-200 shadow-lg hover:shadow-emerald-500/25"
                    >
                        Get Started
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>

                {/* Footer Note */}
                <p className="mt-4 text-center text-xs text-slate-500">
                    No credit card will be charged until your trial ends
                </p>
            </div>
        </div>
    );
}
