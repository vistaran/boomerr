import { useState, useEffect, useMemo } from "react";
import {
    RefreshCcw,
    AlertTriangle,
    Plus,
    ChevronsLeftIcon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Modal } from "../ui/Modal";
import ConfirmModal from "../common/confirm-modal";
import {
    getAvailableFacebookIntegrations,
    getAvailableFacebookAds,
    getDomainFacebookAssignments,
    updateFacebookAssignments,
    removeFacebookAssignments,
} from "../../services/integrations-service";
import CommonLoader from "../common/common-loader";
import type { DomainIntegration } from "../../types/domain-integrations";
import { usePlanLimits } from "../../hooks/use-plan-limits";

type Props = {
    domainId: string | null;
    domainName: string;
    domainStatus: string;
    canManage?: boolean;
    setSelectedProvider: (provider: DomainIntegration) => void
};

export function FacebookAdsInlinePanel({
    domainId,
    canManage = true,
    setSelectedProvider
}: Props) {
    const queryClient = useQueryClient();
    const [selectedIntegrationId, setSelectedIntegrationId] = useState<number | null>(null);
    const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showRemoveAllModal, setShowRemoveAllModal] = useState(false);

    // Convert string domainId to number
    const numericDomainId = domainId;
    const { hasIntegration } = usePlanLimits();
    const isFbAllowed = hasIntegration('facebook_ads');

    // Fetch available integrations
    const {
        data: integrationsData,
        isLoading: integrationsLoading,
    } = useQuery({
        queryKey: ["domainFbIntegrations", numericDomainId],
        queryFn: () => getAvailableFacebookIntegrations(numericDomainId),
        enabled: !!domainId && isFbAllowed,
    });

    // Fetch current assignments
    const {
        data: assignments = [],
        isLoading: assignmentsLoading,
        refetch: refetchAssignments,
    } = useQuery({
        queryKey: ["domainFbAssignments", numericDomainId],
        queryFn: () => getDomainFacebookAssignments(numericDomainId),
        enabled: !!domainId && isFbAllowed,
    });

    // Fetch available ads for selected integration
    const {
        data: adsData,
        isLoading: adsLoading,
        refetch: refetchAds,
    } = useQuery({
        queryKey: ["domainFbAvailableAds", numericDomainId, selectedIntegrationId],
        queryFn: () => getAvailableFacebookAds(numericDomainId, selectedIntegrationId!),
        enabled: !!domainId && !!selectedIntegrationId && isFbAllowed,
    });

    const integrations = useMemo(() => integrationsData?.integrations ?? [], [integrationsData?.integrations]);
    const currentIntegrationId = integrationsData?.current_integration_id ?? null;
    const availableAds = adsData?.ads ?? [];
    const assignedIds = useMemo(() => adsData?.assigned_ids ?? [], [adsData?.assigned_ids]);

    // Set initial integration and selected ads
    useEffect(() => {
        if (currentIntegrationId) {
            setSelectedIntegrationId(currentIntegrationId);
        } else if (integrations.length > 0 && !selectedIntegrationId) {
            setSelectedIntegrationId(integrations[0].id);
        }
    }, [integrations, currentIntegrationId, selectedIntegrationId]);

    // When selectedIntegrationId changes, reset selectedAdIds and refetch ads
    useEffect(() => {
        setSelectedAdIds(new Set());
        if (selectedIntegrationId) {
            refetchAds();
        }
    }, [selectedIntegrationId, refetchAds]);

    useEffect(() => {
        if (assignedIds.length > 0) {
            setSelectedAdIds(new Set(assignedIds));
        }
    }, [assignedIds]);

    // Close modal on ESC key
    useEffect(() => {
        if (!showAssignModal) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setShowAssignModal(false);
            }
        };

        window.addEventListener("keydown", handleEscape, true);
        return () => window.removeEventListener("keydown", handleEscape, true);
    }, [showAssignModal]);

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

            const result = await updateFacebookAssignments(numericDomainId, selectedIntegrationId, entities);
            const hasConflicts = (result.conflicts?.length ?? 0) > 0;

            if (hasConflicts) {
                toast.error(`${result.conflicts.length ?? 0} ad(s) already assigned to other domains`);
            } else {
                toast.success(`${result.assigned ?? result.updated} ad(s) assigned to domain`);
            }

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ["domainFbAssignments", numericDomainId] });
            queryClient.invalidateQueries({ queryKey: ["domainFbAvailableAds", numericDomainId] });
            refetchAssignments();
        } catch (err) {
            console.error(err);
            toast.error("Failed to save assignments");
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveAll = async () => {
        setSaving(true);
        try {
            await removeFacebookAssignments(numericDomainId, undefined, true);
            toast.success("All assignments removed");
            setSelectedAdIds(new Set());
            queryClient.invalidateQueries({ queryKey: ["domainFbAssignments", numericDomainId] });
            refetchAssignments();
            refetchAds();
        } catch (err) {
            console.error(err);
            toast.error("Failed to remove assignments");
        } finally {
            setSaving(false);
            setShowRemoveAllModal(false);
        }
    };

    const isLoading = integrationsLoading || assignmentsLoading;

    return (
        <div className="space-y-4 animate-fade-in">

            {/* Warning for system-paused ads */}
            {systemPausedCount > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/8 border border-amber-500/25 backdrop-blur-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-100">
                        <strong>{systemPausedCount}</strong> ad(s) are paused by system (domain was DOWN). Auto-resume when domain comes back UP.
                    </div>
                </div>
            )}

            <div className="flex flex-row justify-between items-center gap-3 sm:gap-4 w-full max-w-full min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <button
                        onClick={() => setSelectedProvider(null)}
                        className="inline-flex items-center gap-1 text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition !outline-none flex-shrink-0">
                        <ChevronsLeftIcon className="w-4 h-4" />
                        Back to Integrations
                    </button>

                    <span className="text-slate-600 flex-shrink-0">/</span>

                    <h2 className="text-base sm:text-lg font-semibold text-slate-100 truncate">
                        Facebook Ads
                    </h2>
                </div>

                {!isLoading && integrations.length > 0 && selectedIntegrationId && canManage && (
                    <div className="">
                        <button
                            onClick={() => setShowAssignModal(true)}
                            className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:shadow-xl hover:shadow-sky-500/40 hover:scale-105 transition-all duration-200"
                        >
                            <Plus className="w-4 h-4" />
                            Assign Ads
                        </button>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="py-16 flex justify-center items-center gap-3 text-center">
                    <CommonLoader />
                    <p className="text-slate-400 font-medium">Loading Ads...</p>
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
                    {/* Current Assignments Summary */}
                    {assignments.length > 0 ? (
                        <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-3 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-slate-200">
                                    Assigned Campaigns ({assignments.length})
                                </span>
                            </div>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {assignments.map((a) => (
                                    <div
                                        key={a.id}
                                        className="flex items-center gap-2 p-2 rounded bg-slate-700/20 hover:bg-slate-700/40 transition text-xs text-slate-300"
                                    >
                                        <span
                                            className={`w-2 h-2 rounded-full flex-shrink-0 ${(a.is_system_paused || a.original_status === "PAUSED")
                                                ? "bg-amber-400"
                                                : "bg-emerald-400"
                                                }`}
                                        />
                                        <span className="truncate flex-1">
                                            {a.facebook_entity_name || a.facebook_entity_id}
                                        </span>
                                        {(a.is_system_paused || a.original_status === "PAUSED") && (
                                            <span className="text-amber-400 text-[10px] font-medium flex-shrink-0">
                                                PAUSED
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) :
                        (
                            <div className="rounded-xl border-2 border-dashed border-slate-700/50 bg-slate-900/40 p-8 text-center animate-fade-in">
                                <div className="mx-auto w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
                                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <p className="text-base font-medium text-slate-300 mb-1">No campaigns assigned to this domain.</p>
                                {canManage && (
                                    <p className="text-sm text-slate-400">Get started by adding your first campaign above.</p>
                                )}
                            </div>
                        )
                    }

                    {/* Assign Ads Button */}

                    {/* Action Buttons */}
                    {assignments.length > 0 && canManage && (
                        <div className="flex justify-end pt-2 border-t border-slate-700/30">
                            <button
                                onClick={() => setShowRemoveAllModal(true)}
                                disabled={saving}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-rose-600/40 text-rose-400 hover:bg-rose-500/10 hover:border-rose-600/60 disabled:opacity-50 transition"
                            >
                                Remove All
                            </button>
                        </div>
                    )}
                    {/* Remove All Confirmation Modal */}
                    <ConfirmModal
                        open={showRemoveAllModal}
                        title="Remove All Assignments"
                        description="Remove all Facebook ad assignments from this domain? This action cannot be undone."
                        confirmLabel="Remove All"
                        cancelLabel="Cancel"
                        confirming={saving}
                        onConfirm={handleRemoveAll}
                        onCancel={() => setShowRemoveAllModal(false)}
                        tone="danger"
                    />
                </>
            )}

            {/* Assign Ads Modal */}
            {showAssignModal && selectedIntegrationId && (
                <Modal
                    title="Assign Facebook Campaigns"
                    onClose={() => setShowAssignModal(false)}
                    width="lg"
                >
                    {/* Integration Selector */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-200">
                            Facebook Account
                        </label>
                        <select
                            value={selectedIntegrationId ?? ""}
                            onChange={(e) => {
                                const id = e.target.value ? Number(e.target.value) : null;
                                setSelectedIntegrationId(id);
                            }}
                            disabled={!!currentIntegrationId && assignments.length > 0}
                            className="w-full rounded-lg bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 text-sm !outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition disabled:opacity-50 backdrop-blur-sm"
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
                            <p className="text-xs text-slate-500 font-medium mb-2">
                                Domain is linked to this account. Remove all assignments to change.
                            </p>
                        )}
                    </div>
                    <div className="space-y-4">
                        {/* Controls */}
                        <div className="flex items-center justify-between mt-4">
                            <div className="text-sm font-medium text-slate-400">
                                {selectedAdIds.size} campaign{selectedAdIds.size !== 1 ? 's' : ''} selected
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => refetchAds()}
                                    disabled={adsLoading}
                                    className={`text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 px-2 py-1 border border-slate-700 rounded-lg !outline-none transition flex items-center justify-center ${adsLoading ? "opacity-70 cursor-not-allowed" : ""}`}
                                >
                                    <RefreshCcw
                                        className={`w-4 h-4 ${adsLoading ? "animate-spin" : ""}`}
                                    />
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

                        {/* Available Ads List */}
                        {adsLoading ? (
                            <div className="flex justify-center gap-3 items-center py-12 text-center">
                                <CommonLoader />
                                <p className="text-slate-400 font-medium">Loading ads...</p>
                            </div>
                        ) : availableAds.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-sm font-medium">
                                No ads available or all are assigned.
                            </div>
                        ) : (
                            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 max-h-96 overflow-y-auto divide-y divide-slate-700/20 backdrop-blur-sm">
                                {availableAds.map((ad) => {
                                    const isSelected = selectedAdIds.has(ad.id);
                                    const isActive = ad.campaign.status === "ACTIVE";
                                    return (
                                        <label
                                            key={ad.id}
                                            className={`flex items-center gap-4 px-3 py-2 cursor-pointer hover:bg-slate-700/30 transition ${isSelected ? "bg-sky-900/20" : ""}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleAd(ad.id)}
                                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500 cursor-pointer"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-100 truncate">
                                                    {ad.name}
                                                </div>
                                                <div className="text-xs text-slate-400 truncate">
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

                        {/* Modal Action Buttons */}
                        <div className="flex justify-end gap-2 pt-4 border-t border-slate-700/30">
                            <button
                                onClick={() => setShowAssignModal(false)}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-700/30 disabled:opacity-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    await handleSave();
                                    setShowAssignModal(false);
                                }}
                                disabled={saving || !selectedIntegrationId}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-sky-500/20 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition"
                            >
                                {saving ? "Saving..." : "Save Assignments"}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
