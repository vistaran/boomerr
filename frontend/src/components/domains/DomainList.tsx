import { getFaviconUrl } from "../../services/favicon-service";
import type { Domain } from "../../types/domains";

function signalWaveClasses(status: string, pausedReason?: 'plan_limit' | 'user' | null) {
    if (pausedReason === 'plan_limit') {
        return "bg-amber-400/30 border border-amber-400/50";
    }
    switch (status) {
        case "up":
            return "bg-emerald-400/30 border border-emerald-400/50";
        case "down":
            return "bg-rose-400/30 border border-rose-400/50";
        default:
            return "bg-slate-400/30 border border-slate-400/50";
    }
}

function signalCoreClasses(status: string, pausedReason?: 'plan_limit' | 'user' | null) {
    if (pausedReason === 'plan_limit') {
        return "bg-amber-400 border border-amber-300";
    }
    switch (status) {
        case "up":
            return "bg-emerald-400 border border-emerald-300";
        case "down":
            return "bg-rose-400 border border-rose-300";
        default:
            return "bg-slate-400 border border-slate-300";
    }
}

type DomainListProps = {
    domains: Domain[];
    selectedDomainId?: string | null;
    onDomainSelect?: (domain: Domain) => void;
    sidebarCollapsed?: boolean;
};

export function DomainList({ domains, selectedDomainId, onDomainSelect, sidebarCollapsed = false }: DomainListProps) {
    if (domains.length === 0) {
        return (
            <div className="text-slate-500 text-[13px] italic px-2 py-2">
                No domains configured.
            </div>
        );
    }

    return (
        <ul className={"flex flex-col gap-0.5 px-2 py-2 " + (sidebarCollapsed ? "items-center" : "")}>
            {domains.map((d) => (
                <li key={d.id}>
                    <span
                        className={
                            (sidebarCollapsed
                                ? "flex flex-col items-center justify-center w-12 h-12 my-1 rounded-lg cursor-pointer border border-transparent hover:border-sky-500/60 hover:bg-slate-800/60 "
                                : "w-full flex items-center gap-2 rounded-lg my-0.5 px-1 py-2 text-left transition-all hover:cursor-pointer ") +
                            ((selectedDomainId === d.ulid || selectedDomainId === String(d.id))
                                ? "bg-sky-900/60 border border-sky-700 text-sky-200 shadow"
                                : "hover:bg-slate-800/60 text-slate-300 border border-transparent")
                        }
                        onClick={() => onDomainSelect?.(d)}
                    >
                        {getFaviconUrl(d.url) ? (
                            <img
                                src={getFaviconUrl(d.url)!}
                                alt={`${d.name} favicon`}
                                className={sidebarCollapsed ? "h-7 w-7 rounded" : "h-5 w-5 rounded"}
                            />
                        ) : (
                            <div className={sidebarCollapsed ? "h-7 w-7 rounded bg-slate-700 flex items-center justify-center" : "h-5 w-5 rounded bg-slate-700 flex items-center justify-center"}>
                                🌐
                            </div>
                        )}
                        {!sidebarCollapsed && (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="truncate text-sm font-medium">{d.name}</span>
                                {d.paused_reason === 'plan_limit' && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                        Plan Limit
                                    </span>
                                )}
                            </div>
                        )}
                        <span className={sidebarCollapsed ? "hidden" : "ml-auto flex items-center justify-center relative"} style={{ width: 24, minWidth: 24, maxWidth: 24, height: 24 }}>
                            <span
                                className={
                                    "absolute inline-flex h-full w-full rounded-full animate-ping " +
                                    signalWaveClasses(d.status, d.paused_reason)
                                }
                                style={{
                                    animationDelay: `0.7s`,
                                    animationDuration: "1.8s",
                                }}
                            />
                            <span
                                className={
                                    "relative inline-flex h-2.5 w-2.5 rounded-full " +
                                    signalCoreClasses(d.status, d.paused_reason)
                                }
                                style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", position: "absolute" }}
                            ></span>
                        </span>
                    </span>
                    {/* Show domain name below icon in collapsed mode */}
                    {sidebarCollapsed && (
                        <span className={"block text-xs text-slate-400 text-center truncate w-12 mt-1 " + (selectedDomainId === d.ulid ? "text-sky-300 font-semibold" : "")} title={d.name}>{d.name.length > 10 ? d.name.slice(0, 10) + "…" : d.name}</span>
                    )}
                </li>
            ))}
        </ul>
    );
}
