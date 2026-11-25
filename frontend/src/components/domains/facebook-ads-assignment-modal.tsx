import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
    X,
    RefreshCcw,
    AlertTriangle,
    //   Pause,
    //    Play 
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
    getAvailableFacebookIntegrations,
    getAvailableFacebookAds,
    getDomainFacebookAssignments,
    updateFacebookAssignments,
    removeFacebookAssignments,
    // pauseDomainFacebookAds,
    // resumeDomainFacebookAds,
} from "../../services/integrations-service";
import FacebookIcon from "../../assets/facebook-icon.svg";

type Props = {
    domainId: string;
    domainName: string;
    domainStatus: string;
    isOpen: boolean;
    onClose: () => void;
    canManage?: boolean;
};

export default function FacebookAdsAssignmentModal({
    domainId,
    domainName,
    domainStatus,
    isOpen,
    onClose,
    canManage = true,
}: Props) {
    const queryClient = useQueryClient();
    const [selectedIntegrationId, setSelectedIntegrationId] = useState<number | null>(null);
    const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    // const [pauseResumeLoading, setPauseResumeLoading] = useState(false);

    // Fetch available integrations
    const {
        data: integrationsData,
        isLoading: integrationsLoading,
    } = useQuery({
        queryKey: ["domainFbIntegrations", domainId],
        queryFn: () => getAvailableFacebookIntegrations(domainId),
        enabled: isOpen,
    });

    // Fetch current assignments
    const {
        data: assignments = [],
        isLoading: assignmentsLoading,
        refetch: refetchAssignments,
    } = useQuery({
        queryKey: ["domainFbAssignments", domainId],
        queryFn: () => getDomainFacebookAssignments(domainId),
        enabled: isOpen,
    });

    // Fetch available ads for selected integration
    const {
        data: adsData,
        isLoading: adsLoading,
        refetch: refetchAds,
    } = useQuery({
        queryKey: ["domainFbAvailableAds", domainId, selectedIntegrationId],
        queryFn: () => getAvailableFacebookAds(domainId, selectedIntegrationId!),
        enabled: isOpen && !!selectedIntegrationId,
    });

    const integrations = useMemo(() => integrationsData?.integrations ?? [], [integrationsData?.integrations]);
    const currentIntegrationId = integrationsData?.current_integration_id ?? null;
    const availableAds = adsData?.ads ?? [];
    const assignedIds = useMemo(() => adsData?.assigned_ids ?? [], [adsData?.assigned_ids]);

    useEffect(() => {
        if (!open) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Set initial integration and selected ads
    useEffect(() => {
        if (currentIntegrationId) {
            setSelectedIntegrationId(currentIntegrationId);
        } else if (integrations.length > 0 && !selectedIntegrationId) {
            setSelectedIntegrationId(integrations[0].id);
        }
    }, [integrations, currentIntegrationId, selectedIntegrationId]);

    useEffect(() => {
        if (assignedIds.length > 0) {
            setSelectedAdIds(new Set(assignedIds));
        }
    }, [assignedIds]);

    // Check for system-paused ads
    const systemPausedCount = useMemo(() => {
        return assignments.filter((a) => a.is_system_paused).length;
    }, [assignments]);

    const handleToggleAd = (adId: string) => {
        setSelectedAdIds((prev) => {
            const next = new Set(prev);
            if (next.has(adId)) {
                next.delete(adId);
            } else {
                next.add(adId);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        const allIds = availableAds.map((ad) => ad.id);
        setSelectedAdIds(new Set(allIds));
    };

    const handleDeselectAll = () => {
        setSelectedAdIds(new Set());
    };

    const handleSave = async () => {
        if (!selectedIntegrationId) {
            toast.error("Please select a Facebook account");
            return;
        }

        setSaving(true);
        try {
            const entities = Array.from(selectedAdIds).map((id) => {
                const ad = availableAds.find((a) => a.id === id);
                return {
                    id,
                    type: "ad" as const,
                    name: ad?.name ?? undefined,
                    campaign_id: ad?.campaign?.id ?? undefined,
                    campaign_status: ad?.campaign?.status ?? undefined,
                };
            });

            const result = await updateFacebookAssignments(domainId, selectedIntegrationId, entities);
            const hasConflicts = (result.data.conflicts?.length ?? 0) > 0;

            if (hasConflicts) {
                toast.error(`${result.data.conflicts.length} ad(s) already assigned to other domains`);
            } else {
                toast.success(`${result.message}`);
            }

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ["domainFbAssignments", domainId] });
            queryClient.invalidateQueries({ queryKey: ["domainFbAvailableAds", domainId] });
            refetchAssignments();

            if (!hasConflicts) {
                onClose();
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to save assignments");
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveAll = async () => {
        if (!window.confirm("Remove all Facebook ad assignments from this domain?")) {
            return;
        }

        setSaving(true);
        try {
            await removeFacebookAssignments(domainId, undefined, true);
            toast.success("All assignments removed");
            setSelectedAdIds(new Set());
            queryClient.invalidateQueries({ queryKey: ["domainFbAssignments", domainId] });
            refetchAssignments();
            refetchAds();
        } catch (err) {
            console.error(err);
            toast.error("Failed to remove assignments");
        } finally {
            setSaving(false);
        }
    };

    // const handlePauseAds = async () => {
    //     setPauseResumeLoading(true);
    //     try {
    //         const result = await pauseDomainFacebookAds(domainId);
    //         toast.success(`Paused ${result.paused} ad(s), ${result.skipped} skipped`);
    //         refetchAssignments();
    //     } catch (err) {
    //         console.error(err);
    //         toast.error("Failed to pause ads");
    //     } finally {
    //         setPauseResumeLoading(false);
    //     }
    // };

    // const handleResumeAds = async () => {
    //     setPauseResumeLoading(true);
    //     try {
    //         const result = await resumeDomainFacebookAds(domainId);
    //         toast.success(`Resumed ${result.resumed} ad(s), ${result.skipped} skipped`);
    //         refetchAssignments();
    //     } catch (err) {
    //         console.error(err);
    //         toast.error("Failed to resume ads");
    //     } finally {
    //         setPauseResumeLoading(false);
    //     }
    // };

    if (!isOpen) return null;

    const isLoading = integrationsLoading || assignmentsLoading;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full mx-4 max-w-2xl h-auto max-h-[94vh] rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-700/50 shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30 bg-gradient-to-r from-slate-900/50 to-transparent">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30">
                            <img src={FacebookIcon} alt="Facebook" className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-50 leading-tight">
                                Assign Facebook Ads
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {domainName} • Status:{" "}
                                <span
                                    className={
                                        domainStatus === "up"
                                            ? "text-emerald-400 font-medium"
                                            : domainStatus === "down"
                                                ? "text-rose-400 font-medium"
                                                : "text-slate-400"
                                    }
                                >
                                    {domainStatus?.toUpperCase()}
                                </span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 p-1.5 rounded-lg !outline-none transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                    {/* Warning for system-paused ads */}
                    {systemPausedCount > 0 && (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/25 backdrop-blur-sm">
                            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-100">
                                <strong>{systemPausedCount}</strong> ad(s) are paused by system (domain was DOWN). Auto-resume when domain comes back UP.
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="py-16 text-center">
                            <RefreshCcw className="w-8 h-8 animate-spin mx-auto mb-3 text-slate-400" />
                            <p className="text-slate-400 font-medium">Loading...</p>
                        </div>
                    ) : integrations.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-slate-400 mb-3">No Facebook accounts connected.</p>
                            <a
                                href="/settings/facebook-accounts"
                                className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 font-medium text-sm"
                            >
                                Connect Facebook Account →
                            </a>
                        </div>
                    ) : (
                        <>
                            {/* Integration Selector */}
                            <div className="space-y-2.5">
                                <label className="block text-sm font-semibold text-slate-200">
                                    Facebook Account
                                </label>
                                <select
                                    value={selectedIntegrationId ?? ""}
                                    onChange={(e) => {
                                        const id = e.target.value ? Number(e.target.value) : null;
                                        setSelectedIntegrationId(id);
                                        setSelectedAdIds(new Set());
                                    }}
                                    disabled={!!currentIntegrationId && assignments.length > 0}
                                    className="w-full rounded-lg bg-slate-900 border border-slate-700 text-slate-200 px-2 py-1.5 text-sm !outline-none !focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition disabled:opacity-50 backdrop-blur-sm"
                                >
                                    <option value="">Select account...</option>
                                    {integrations.map((int) => (
                                        <option key={int.id} value={int.id}>
                                            {int.account_name || int.account_id}
                                            {int.business_name ? ` (${int.business_name})` : ""}
                                            {int.is_current ? " ★" : ""}
                                        </option>
                                    ))}
                                </select>
                                {currentIntegrationId && assignments.length > 0 && (
                                    <p className="text-xs text-slate-500 font-medium">
                                        Domain is linked to this account. Remove all assignments to change.
                                    </p>
                                )}
                            </div>

                            {/* Current Assignments Summary */}
                            {assignments.length > 0 && (
                                <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-2 backdrop-blur-sm">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-slate-200">
                                            Assigned Ads ({assignments.length})
                                        </span>
                                    </div>
                                    <div className="space-y-1 max-h-24 overflow-y-auto">
                                        {assignments.map((a) => (
                                            <div
                                                key={a.id}
                                                className="flex items-center gap-2 p-1 rounded bg-slate-700/10 hover:bg-slate-700/30 transition text-xs text-slate-300"
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.is_system_paused
                                                        ? "bg-amber-400"
                                                        : "bg-emerald-400"
                                                        }`}
                                                />
                                                <span className="truncate flex-1">
                                                    {a.facebook_entity_name || a.facebook_entity_id}
                                                </span>
                                                {a.is_system_paused && (
                                                    <span className="text-amber-400 text-[10px] font-medium flex-shrink-0">
                                                        PAUSED
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Available Ads */}
                            {selectedIntegrationId && (
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-slate-200">
                                            Available Ads
                                        </label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => refetchAds()}
                                                disabled={adsLoading}
                                                className={`text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 px-2 py-1 border border-slate-700 rounded-lg !outline-none transition flex items-center justify-center ${adsLoading ? "opacity-70 cursor-not-allowed" : ""}`}
                                            >
                                                <span className="flex items-center justify-center w-4 h-4">
                                                    <RefreshCcw
                                                        className={`w-4 h-4 ${adsLoading ? "animate-spin" : ""}`}
                                                    />
                                                </span>
                                            </button>
                                            <button
                                                onClick={handleSelectAll}
                                                className="text-xs text-sky-400 hover:text-sky-300 px-2 py-1 border border-sky-400/50 rounded-lg !outline-none hover:bg-sky-500/10 transition font-medium"
                                            >
                                                Select All
                                            </button>
                                            <button
                                                onClick={handleDeselectAll}
                                                className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1 border border-slate-700 rounded-lg !outline-none hover:bg-slate-700/30 transition font-medium"
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    </div>

                                    {adsLoading ? (
                                        <div className="py-12 text-center">
                                            <RefreshCcw className="w-7 h-7 animate-spin mx-auto mb-3 text-slate-400" />
                                            <p className="text-slate-400 font-medium">Loading ads...</p>
                                        </div>
                                    ) : availableAds.length === 0 ? (
                                        <div className="py-12 text-center text-slate-400 text-sm font-medium">
                                            No ads available or all are assigned.
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 max-h-auto overflow-y-auto divide-y divide-slate-700/20 backdrop-blur-sm">
                                            {availableAds.map((ad) => {
                                                const isSelected = selectedAdIds.has(ad.id);
                                                const isActive = ad.campaign.status === "ACTIVE";
                                                return (
                                                    <label
                                                        key={ad.id}
                                                        className={`flex items-center gap-4 px-3 py-1.5 cursor-pointer hover:bg-slate-700/30 transition ${isSelected ? "bg-sky-900/20" : ""}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handleToggleAd(ad.id)}
                                                            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500 cursor-pointer"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-medium text-slate-100 truncate">
                                                                {ad.name}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400 truncate">
                                                                {ad.campaign?.name ?? "No campaign"} • {ad.id}
                                                            </div>
                                                        </div>
                                                        <span
                                                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${isActive
                                                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                                                                : "bg-slate-700/40 text-slate-400"
                                                                }`}
                                                        >
                                                            {isActive ? "ACTIVE" : "PAUSED"}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/30 bg-gradient-to-r from-slate-900/50 to-transparent text-sm">
                    <div className="font-medium text-slate-400">
                        {selectedAdIds.size} ad{selectedAdIds.size !== 1 ? 's' : ''} selected
                    </div>
                    <div className="flex gap-2">
                        {assignments.length > 0 && canManage && (
                            <button
                                onClick={handleRemoveAll}
                                disabled={saving}
                                className="px-2.5 py-1 text-sm font-medium rounded-md border border-rose-600/40 text-rose-400 hover:bg-rose-500/10 hover:border-rose-600/60 disabled:opacity-50 transition"
                            >
                                Remove All
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-2.5 py-1 text-sm font-medium rounded-md border border-slate-600/40 text-slate-300 hover:bg-slate-800/50 hover:border-slate-600/60 transition"
                        >
                            Cancel
                        </button>
                        {canManage && (
                            <button
                                onClick={handleSave}
                                disabled={saving || !selectedIntegrationId}
                                className="px-3.5 py-1 text-sm font-medium rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-sky-500/20 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition"
                            >
                                {saving ? "Saving..." : "Save"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
