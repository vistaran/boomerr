import { useNavigate, Link } from "react-router-dom";
import { Lock } from "lucide-react";
import type { WorkspaceIntegration } from "../../types/workspace-integrations";
import type { ReactNode } from "react";
import type { IntegrationActionVariant, IntegrationCardAction } from "./integration-settings";
import { ToggleSwitch } from "../common/toggle";

type IntegrationCardProps = {
    integration: WorkspaceIntegration;
    metaIcon?: ReactNode;
    launched: boolean;
    actions: IntegrationCardAction[];
    showToggle: boolean;
    toggleChecked: boolean;
    toggleDisabled: boolean;
    onToggle: (checked: boolean) => void;
    planLocked?: boolean;
};

const ACTION_BUTTON_STYLES: Record<IntegrationActionVariant, string> = {
    info: "text-sky-400 bg-sky-900/30",
    success: "text-green-400 bg-green-900/30",
};

export default function IntegrationCard({
    integration,
    metaIcon,
    launched,
    actions,
    showToggle,
    toggleChecked,
    toggleDisabled,
    onToggle,
    planLocked = false,
}: IntegrationCardProps) {
    return (
        <div
            className={`
                relative rounded-xl border p-4 transition-all
                ${planLocked
                    ? "border-amber-500/30 bg-amber-500/5 opacity-70"
                    : launched
                        ? "border-slate-700 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-800/70"
                        : "border-slate-800 bg-slate-900/30 opacity-60"
                }
            `}
        >
            <div className="flex items-center justify-between gap-2 md:gap-3 overflow-hidden">
                <div className="flex items-center gap-2 min-w-0">
                    {metaIcon && (
                        <div className="text-slate-300 flex-shrink-0">
                            {metaIcon}
                        </div>
                    )}

                    <div className="min-w-0 flex items-center gap-1">
                        <span className="text-sm font-medium text-slate-200 truncate">{integration.integration.name}</span>
                        {!launched && (
                            <span className="text-[9px] uppercase text-slate-500 px-1 py-0.5 rounded bg-slate-800 flex-shrink-0">Soon</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {planLocked ? (
                        <Link
                            to="/billing"
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
                            title="Upgrade your plan to access this integration"
                        >
                            <Lock size={9} />
                            Upgrade
                        </Link>
                    ) : (
                        <>
                            {actions.map(action => (
                                <button
                                    key={`${integration.ulid}-${action.label}-${action.variant}`}
                                    disabled={toggleDisabled}
                                    className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${ACTION_BUTTON_STYLES[action.variant]} !outline-none disabled:!cursor-not-allowed disabled:!opacity-50`}
                                    onClick={action.onClick}
                                >
                                    {action.label}
                                </button>
                            ))}
                            {showToggle && (
                                <ToggleSwitch
                                    checked={toggleChecked}
                                    onChange={onToggle}
                                    disabled={toggleDisabled}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}