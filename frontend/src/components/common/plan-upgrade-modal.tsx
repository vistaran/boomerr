import { Lock } from "lucide-react";
import { ConfirmModal } from "./confirm-modal";

type PlanUpgradeModalProps = {
    open: boolean;
    onClose: () => void;
    onUpgrade: () => void;
    title?: string;
    featureLabel: string;
    limitMessage: string;
    upgradeLabel?: string;
};

export function PlanUpgradeModal({
    open,
    onClose,
    onUpgrade,
    title = "Upgrade Required",
    featureLabel,
    limitMessage,
    upgradeLabel = "Upgrade Plan",
}: PlanUpgradeModalProps) {
    return (
        <ConfirmModal
            open={open}
            title={title}
            description={
                <div className="space-y-2">
                    <p className="text-slate-200">
                        You have reached your current plan limit for <span className="font-semibold text-slate-100">{featureLabel}</span>.
                    </p>
                    <p className="text-slate-300">{limitMessage}</p>
                    <p className="text-amber-300 inline-flex items-center gap-1.5">
                        <Lock size={14} />
                        Upgrade your plan to continue.
                    </p>
                </div>
            }
            confirmLabel={upgradeLabel}
            cancelLabel="Maybe Later"
            onCancel={onClose}
            onConfirm={onUpgrade}
            tone="primary"
        />
    );
}
