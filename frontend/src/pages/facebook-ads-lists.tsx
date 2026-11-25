import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuth } from "../context/auth-context";
import { getFacebookAds, setFacebookAdEnabled, type FacebookAd, type FacebookAdsGroup } from "../services/integrations-service";
import FacebookIcon from "../assets/facebook-icon.svg";
import { useNavigate, useParams } from "react-router-dom";
import { RefreshCcw } from "lucide-react";
import ResponsiveTable, { TableCell } from "../components/common/responsive-table";
import { usePlanLimits } from "../hooks/use-plan-limits";
const FacebookAdsList = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { accountId } = useParams();
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const fb = params.get("fb");
        if (fb === "success") {
            toast.success("Facebook Ads connected");
        } else if (fb === "denied") {
            toast.error("Facebook permissions denied");
        } else if (fb === "error") {
            toast.error("Facebook connection failed");
        }
        if (fb) {
            const url = new URL(window.location.href);
            url.searchParams.delete("fb");
            window.history.replaceState({}, "", url.toString());
        }
    }, []);

    const canToggle = useMemo(() => {
        const role = user?.role ?? "member";
        return role === "owner" || role === "admin";
    }, [user]);

    const queryClient = useQueryClient();
    const [toggling, setToggling] = useState<Record<string, boolean>>({});
    const { hasIntegration } = usePlanLimits();
    const isFbAllowed = hasIntegration('facebook_ads');

    const {
        data: groups = [],
        isLoading,
        isFetching,
        refetch: refetchAds,
    } = useQuery({
        queryKey: ["facebookAds", accountId],
        queryFn: () => getFacebookAds(accountId),
        enabled: isFbAllowed && !!accountId,
    });
    const adsLoading = isLoading || isFetching;
    const hasAds = groups.some((group) => (group.ads?.length ?? 0) > 0);

    const loadAds = async () => {
        refetchAds();
    };

    useEffect(() => {
        refetchAds();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleToggleAd = async (ad: FacebookAd, next: boolean, group: FacebookAdsGroup) => {
        if (!canToggle) return;
        const campaignId = ad.campaign?.id;
        const fbAccountId = group.account_id;
        if (!campaignId) {
            toast.error("No campaign found for this ad");
            return;
        }
        setToggling((m) => ({ ...m, [ad.id]: true }));
        try {
            const res = await setFacebookAdEnabled(campaignId, next, fbAccountId);
            await refetchAds();
            queryClient.setQueryData(["facebookAds", accountId], (prev: FacebookAdsGroup[] = []) =>
                prev.map((group) => ({
                    ...group,
                    ads: (group.ads ?? []).map((a) =>
                        a.id === ad.id ? { ...a, status: res.status, effective_status: res.status } : a
                    ),
                }))
            );
            toast.success(`Ad ${next ? "enabled" : "paused"}`);
        } catch (e) {
            console.error(e);
            toast.error("Failed to update ad");
        } finally {
            setToggling((m) => ({ ...m, [ad.id]: false }));
        }
    };

    const handleBack = () => {
        navigate('/settings/facebook-accounts');
    };

    return (
        <div className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4">
            <div className="space-y-6">
                <div className="mb-2">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3 text-slate-50">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="items-center text-slate-300 hover:text-slate-100 text-sm !outline-none"
                            aria-label="Back"
                        >
                            <svg width="30" height="30" fill="none" viewBox="0 0 20 20">
                                <path d="M12.5 15L8 10.5L12.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <img src={FacebookIcon} alt="Facebook" width={32} height={32} />
                        Facebook Ads
                    </h1>
                    <p className="mt-3 text-sm text-slate-300">Manage your connected Facebook Ads accounts and campaigns.</p>
                </div>
            </div>
            {/* Ads Listing */}
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-100">Running Ads</div>
                    <button
                        onClick={loadAds}
                        className="text-xs font-medium text-slate-200 border border-slate-600 px-2 py-1 rounded hover:bg-slate-800 disabled:opacity-60 !outline-none"
                        disabled={adsLoading}
                    >
                        <RefreshCcw className={`inline-block w-4 h-4 transition-transform ${adsLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                {adsLoading ? (
                    <div className="py-6 text-center text-slate-400">
                        <span className="inline-flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v2a6 6 0 00-6 6H4z" />
                            </svg>
                            Loading ads…
                        </span>
                    </div>
                ) : groups.length === 0 || !hasAds ? (
                    <div className="py-6 text-center text-slate-400">
                        No active ads. Connect or refresh to load.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groups.map((group) => {
                            const accountName = group.account?.name ?? group.account_id ?? "Facebook Account";
                            const accountStatus = group.account?.account_status;
                            return (
                                <div key={group.integration_ulid ?? group.account_id ?? accountName} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="text-sm font-semibold text-slate-100">{accountName}</div>
                                        {typeof accountStatus === "number" && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${accountStatus === 1 ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700/50 text-slate-300"}`}>
                                                {accountStatus === 1 ? "ACTIVE" : "RESTRICTED"}
                                            </span>
                                        )}
                                    </div>
                                    <div className="overflow-x-auto">
                                        <ResponsiveTable>
                                            <table className="min-w-full text-left text-xs">
                                                <thead className="text-slate-400">
                                                    <tr>
                                                        <th className="py-2 pr-4">Ad</th>
                                                        <th className="py-2 pr-4">Campaign</th>
                                                        <th className="py-2 pr-4">Status</th>
                                                        <th className="py-2 pr-4 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-slate-200">
                                                    {(group.ads ?? []).length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="py-4 text-center text-slate-400">
                                                                No ads found for this account.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        group.ads.map((ad) => {
                                                            const isActive = ad.campaign?.status === 'ACTIVE';
                                                            return (
                                                                <tr key={ad.id} className="border-t border-slate-700/50">
                                                                    <TableCell label="Ad" className="py-2 pr-4">
                                                                        <div className="font-medium">{ad.name ?? ad.id}</div>
                                                                        <div className="text-[11px] text-slate-400">{ad.id}</div>
                                                                    </TableCell>
                                                                    <TableCell label="Campaign" className="py-2 pr-4">{ad.campaign?.name ?? '-'}</TableCell>
                                                                    <TableCell label="Status" className="py-2 pr-4">
                                                                        <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] ${isActive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700/50 text-slate-300'}`}>
                                                                            {isActive ? 'ACTIVE' : 'PAUSED'}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell label="Action" className="py-2 pr-0">
                                                                        <button
                                                                            disabled={!canToggle || !!toggling[ad.id]}
                                                                            onClick={() => handleToggleAd(ad, !isActive, group)}
                                                                            className="text-xs font-medium px-2 py-1 rounded border border-slate-600 hover:bg-slate-800 disabled:opacity-50 w-fit">
                                                                            {toggling[ad.id] ? 'Saving…' : isActive ? 'Pause' : 'Enable'}
                                                                        </button>
                                                                    </TableCell>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </ResponsiveTable>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export default FacebookAdsList