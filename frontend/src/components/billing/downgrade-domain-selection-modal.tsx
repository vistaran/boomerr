import { useState, useMemo, useEffect } from "react";
import { Search, Globe, AlertTriangle, CheckCircle2, X, Check, Info } from "lucide-react";
import type { Domain } from "../../types/domains";
import type { Plan } from "./types";

interface DowngradeDomainSelectionModalProps {
    open: boolean;
    onClose: () => void;
    currentPlan: Plan | null;
    targetPlan: Plan | null;
    domains: Domain[];
    isLoading: boolean;
    onConfirm: (keepDomainIds: number[]) => Promise<void> | void;
}

export function DowngradeDomainSelectionModal({
    open,
    onClose,
    currentPlan,
    targetPlan,
    domains,
    isLoading,
    onConfirm,
}: DowngradeDomainSelectionModalProps) {
    const maxAllowed = targetPlan?.details?.limits?.max_monitors ?? 10;

    // Filter candidate domains: active domains and plan_limit paused domains
    // Domains paused by the user ('user') are preserved and do not count against limits
    const candidateDomains = useMemo(() => {
        return domains.filter((d) => d.paused_reason !== "user");
    }, [domains]);

    const userPausedDomains = useMemo(() => {
        return domains.filter((d) => d.paused_reason === "user");
    }, [domains]);

    // Pre-select the first `maxAllowed` candidate domains (prioritizing already active domains)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");

    // Initialize selection when modal opens or candidates change
    useEffect(() => {
        if (open) {
            const activeFirst = [...candidateDomains].sort((a, b) => {
                if (a.is_active && !b.is_active) return -1;
                if (!a.is_active && b.is_active) return 1;
                return a.id - b.id;
            });
            const initialSelection = activeFirst.slice(0, maxAllowed).map((d) => d.id);
            setSelectedIds(new Set(initialSelection));
            setSearchQuery("");
        }
    }, [open, candidateDomains, maxAllowed]);

    if (!open || !targetPlan) return null;

    const filteredDomains = candidateDomains.filter(
        (d) =>
            d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedCount = selectedIds.size;
    const isOverLimit = selectedCount > maxAllowed;
    const isUnderLimit = selectedCount === 0;
    const isValid = selectedCount > 0 && selectedCount <= maxAllowed;

    const toggleDomain = (id: number) => {
        if (isLoading) return;
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSelectFirstAllowed = () => {
        if (isLoading) return;
        const firstBatch = candidateDomains.slice(0, maxAllowed).map((d) => d.id);
        setSelectedIds(new Set(firstBatch));
    };

    const handleClearAll = () => {
        if (isLoading) return;
        setSelectedIds(new Set());
    };

    const handleConfirm = () => {
        if (!isValid || isLoading) return;
        onConfirm(Array.from(selectedIds));
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-950/40">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Select Monitored Domains
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Downgrading from <span className="text-slate-300 font-medium">{currentPlan?.name ?? "Current Plan"}</span> to <span className="text-indigo-400 font-medium">{targetPlan.name}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="text-slate-400 hover:text-slate-200 transition p-1 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {/* Limit Notice Banner */}
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex items-start gap-3.5">
                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
                            <Info className="w-5 h-5" />
                        </div>
                        <div className="text-xs text-slate-300 leading-relaxed space-y-1">
                            <p className="font-semibold text-white text-sm">
                                {targetPlan.name} plan includes up to {maxAllowed} active monitor{maxAllowed === 1 ? "" : "s"}
                            </p>
                            <p className="text-slate-400">
                                You currently have <span className="text-white font-medium">{candidateDomains.filter((d) => d.is_active).length}</span> active domains.
                                Please select which <span className="text-indigo-300 font-semibold">{maxAllowed}</span> domains you want to keep monitoring. Unselected domains will be paused without deleting any historical check data.
                            </p>
                        </div>
                    </div>

                    {/* Selection Counter & Quick Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                        <div className="flex items-center gap-2.5">
                            <div className="text-xs text-slate-400 font-medium">Selection:</div>
                            <div
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                                    isOverLimit
                                        ? "bg-red-500/10 text-red-400 border-red-500/30"
                                        : isUnderLimit
                                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                        : selectedCount === maxAllowed
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                        : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                                }`}
                            >
                                {isOverLimit ? (
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                ) : selectedCount === maxAllowed ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : null}
                                <span>
                                    {selectedCount} / {maxAllowed} selected
                                </span>
                            </div>
                            {isOverLimit && (
                                <span className="text-[11px] text-red-400 font-medium">
                                    (Please uncheck {selectedCount - maxAllowed})
                                </span>
                            )}
                            {selectedCount < maxAllowed && selectedCount > 0 && (
                                <span className="text-[11px] text-slate-400">
                                    ({maxAllowed - selectedCount} slot{maxAllowed - selectedCount === 1 ? "" : "s"} left)
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSelectFirstAllowed}
                                disabled={isLoading}
                                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition font-medium border border-slate-700 disabled:opacity-50"
                            >
                                Select First {maxAllowed}
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAll}
                                disabled={isLoading || selectedCount === 0}
                                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition font-medium border border-slate-700 disabled:opacity-40"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Filter domains by name or URL..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Domain List */}
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {filteredDomains.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl">
                                No domains match your filter.
                            </div>
                        ) : (
                            filteredDomains.map((domain) => {
                                const isSelected = selectedIds.has(domain.id);
                                return (
                                    <div
                                        key={domain.id}
                                        onClick={() => toggleDomain(domain.id)}
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                                            isSelected
                                                ? "bg-indigo-950/20 border-indigo-500/40 hover:border-indigo-500/60 shadow-sm"
                                                : "bg-slate-950/40 border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 pr-2">
                                            <div
                                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                                                    isSelected
                                                        ? "bg-indigo-600 border-indigo-500 text-white"
                                                        : "border-slate-700 bg-slate-900"
                                                }`}
                                            >
                                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span className="text-sm font-medium text-white truncate">
                                                        {domain.name}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-400 truncate ml-5">
                                                    {domain.url}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {domain.status === "up" ? (
                                                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    Up
                                                </span>
                                            ) : domain.status === "down" ? (
                                                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                                    Down
                                                </span>
                                            ) : (
                                                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                                    Unknown
                                                </span>
                                            )}
                                            {domain.is_active ? (
                                                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                                    Currently Active
                                                </span>
                                            ) : (
                                                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                                    Paused
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Notice for User-Paused Domains if any */}
                    {userPausedDomains.length > 0 && (
                        <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-400 flex items-center justify-between">
                            <span>
                                <span className="font-semibold text-slate-300">{userPausedDomains.length}</span> domain{userPausedDomains.length === 1 ? "" : "s"} manually paused by you will remain paused.
                            </span>
                            <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                                Excluded from limit
                            </span>
                        </div>
                    )}

                    {/* Validation Warning Alert */}
                    {isOverLimit && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-300 animate-in fade-in duration-150">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                            <span>
                                <strong>Plan Limit Exceeded:</strong> You have selected {selectedCount} domains. The {targetPlan.name} plan permits up to {maxAllowed} active monitors. Please deselect {selectedCount - maxAllowed} domain{selectedCount - maxAllowed === 1 ? "" : "s"} to proceed.
                            </span>
                        </div>
                    )}

                    {isUnderLimit && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300 animate-in fade-in duration-150">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                            <span>
                                <strong>No Domains Selected:</strong> Please select at least 1 domain to keep actively monitored.
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-950/40 gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2.5 rounded-xl font-medium text-sm transition bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!isValid || isLoading}
                        className="px-5 py-2.5 rounded-xl font-medium text-sm transition text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-amber-600/20"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Processing Downgrade...</span>
                            </>
                        ) : (
                            <span>Confirm Downgrade ({selectedCount} Selected)</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
