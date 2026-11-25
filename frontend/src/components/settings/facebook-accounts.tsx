import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import FacebookIcon from "../../assets/facebook-icon.svg";
import { Plus, X, AlertTriangle, RefreshCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
    disconnectFacebookAccount,
    listFacebookAdsAccounts,
} from "../../services/integrations-service";
import { useAuth } from "../../context/auth-context";
import { toast } from "react-hot-toast";
import DateTimeDisplay from "../common/date-time-display";

/* ---------------- Helpers ---------------- */

const normalizeAccountId = (value?: string) => (value ?? "").replace(/^act_/i, "");

const parseMetaAccounts = (metaJson?: string) => {
    try {
        const parsed = JSON.parse(metaJson || "{}");
        const selectionIds: string[] = Array.isArray(parsed?.selection?.ad_account_ids)
            ? parsed.selection.ad_account_ids.map((id: string) => String(id))
            : [];

        const matchesSelection = (id?: string) => {
            if (!id) return selectionIds.length === 0;
            const normalized = normalizeAccountId(String(id));
            if (selectionIds.length === 0) return true;
            return selectionIds.some((sel) => normalizeAccountId(sel) === normalized);
        };

        if (parsed.account && matchesSelection(parsed.account.id)) {
            return [parsed.account];
        }

        if (Array.isArray(parsed.accounts)) {
            const filtered = parsed.accounts.filter((account: any) => matchesSelection(account?.id));
            if (filtered.length > 0) {
                return filtered;
            }
            return parsed.accounts.slice(0, 1);
        }

        return [];
    } catch {
        return [];
    }
};

const FacebookAccounts = () => {
    const { user, workspaces } = useAuth();
    const workspaceId = React.useMemo(() => {
        if (!user) return null;
        if (user.workspace_ulid) return user.workspace_ulid;
        if (Array.isArray(workspaces)) {
            const current = workspaces.find((w: any) => w?.is_current);
            if (current?.ulid) return current.ulid;
            if (workspaces.length > 0 && workspaces[0]?.ulid) return workspaces[0].ulid;
        }
        return null;
    }, [user, workspaces]);
    const navigate = useNavigate();

    const [disconnectTarget, setDisconnectTarget] = useState<any>(null);

    useEffect(() => {
        if (!open) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setDisconnectTarget(null)
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, []);

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

    const {
        data: accounts = [],
        isLoading,
        isFetching,
        refetch,
    } = useQuery({
        queryKey: ["facebookAccounts", workspaceId],
        queryFn: () => listFacebookAdsAccounts(workspaceId ?? null),
        enabled: !!workspaceId,
    });

    const uniqueAccounts = React.useMemo(() => {
        const seen = new Set<string>();
        return (accounts || []).filter((account: any) => {
            const key = account?.account_id ?? account?.ulid ?? JSON.stringify(account);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [accounts]);
    const accountsLoading = isLoading || isFetching;

    useEffect(() => {
        if (workspaceId) refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    const handleDisconnect = async () => {
        if (!disconnectTarget) return;

        try {
            await disconnectFacebookAccount(disconnectTarget.ulid);
            toast.success("Account disconnected");
            setDisconnectTarget(null);
            refetch();
        } catch (err) {
            console.error(err);
            toast.error("Failed to disconnect account");
        }
    };

    const handleAddAccount = () => {
        const clientId = import.meta.env.VITE_FACEBOOK_APP_ID;
        const redirectUri = import.meta.env.VITE_FACEBOOK_REDIRECT_URI;
        if (!clientId || !redirectUri) {
            toast.error('Facebook OAuth not configured');
            return;
        }
        const scope = [
            'ads_read',
            'ads_management',
            'business_management',
            'pages_read_engagement',
        ].join(',');
        const state = String(user?.ulid ?? '0');
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope,
            state,
        });
        const oauthUrl = `https://www.facebook.com/v17.0/dialog/oauth?${params.toString()}`;
        window.open(oauthUrl, '_blank', 'noopener,noreferrer');

    }

    return (
        <div className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 text-slate-50">
                    <button
                        type="button"
                        onClick={() => navigate("/settings")}
                        className="text-slate-300 hover:text-slate-100 text-sm !outline-none"
                        aria-label="Back"
                    >
                        <svg width="30" height="30" fill="none" viewBox="0 0 20 20">
                            <path
                                d="M12.5 15L8 10.5L12.5 6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                    <img src={FacebookIcon} alt="Facebook" width={32} height={32} />
                    Connected Facebook Accounts
                </h1>
                <p className="mt-2 ml-10 text-sm text-slate-300">
                    Manage your connected Facebook Ads accounts.
                </p>
            </div>

            {/* Accounts Card */}
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                <div className="mb-4 flex items-center justify-between">
                    <button
                        onClick={handleAddAccount}
                        className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-r from-sky-500 to-indigo-500 px-1.5 py-1.5 text-xs font-bold text-white shadow hover:scale-105">
                        <Plus size={16} />
                        Add Account
                    </button>
                    <button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-sm border border-slate-600 px-1.5 py-1 text-xs text-slate-200 hover:bg-slate-700 !outline-none">
                        <RefreshCcw size={16} className={`inline-block transition-transform ${isFetching ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Listing */}
                <div className="space-y-4">
                    {accountsLoading ? (
                        <div className="p-4 text-sm text-center text-slate-300">
                            Loading Facebook accounts...
                        </div>
                    ) : uniqueAccounts.length === 0 ? (
                        <div className="p-4 text-sm border border-slate-700 rounded-lg text-center bg-slate-800/60 text-slate-300">
                            No connected Facebook accounts.
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-3">
                            {uniqueAccounts.map((account: any) => {
                                const adAccounts = parseMetaAccounts(account.meta_json);
                                const primaryAccount = adAccounts[0] ?? {};
                                const displayName = primaryAccount?.name ?? "Facebook Ads Account";
                                const businessName = primaryAccount?.business?.name;
                                const connectedAt = account.connected_at ?? account.created_at;
                                const accountStatus = primaryAccount?.account_status;

                                return (
                                    <div
                                        key={account.ulid}
                                        className="group flex flex-col justify-between rounded-xl border border-slate-700 bg-slate-800/60 p-4 transition hover:border-slate-500 hover:bg-slate-800/70 focus-within:ring-2 focus-within:ring-sky-500/40" >
                                        {/* Card Header */}
                                        <div className="flex items-start justify-between mb-3 gap-3">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={FacebookIcon}
                                                    alt="Facebook"
                                                    className="w-8 h-8 flex-shrink-0"
                                                />
                                                <div>
                                                    <div></div>
                                                    <div className="font-semibold text-slate-100">
                                                        {displayName}
                                                    </div>
                                                    <div className="text-xs text-slate-400">
                                                        {businessName && (
                                                            <div className="text-xs text-sky-300/80">
                                                                {businessName}
                                                            </div>
                                                        )}
                                                        <span>

                                                            Connected on
                                                        </span>
                                                        <span className="ml-1 font-bold text-slate-300">
                                                            <DateTimeDisplay value={connectedAt} />
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span
                                                className={`text-xs ${accountStatus === 1
                                                    ? "text-emerald-400 px-2 py-1 rounded-full bg-emerald-500/20"
                                                    : "text-yellow-400 px-2 py-1 rounded-full bg-yellow-500/20"
                                                    }`}
                                            >
                                                {accountStatus === 1 ? "Active" : "Restricted"}
                                            </span>
                                        </div>


                                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
                                            <div className="text-xs text-slate-400">
                                                {adAccounts.length} ad account{adAccounts.length === 1 ? "" : "s"}
                                            </div>
                                            <div className="flex shrink-0 gap-2">
                                                <button
                                                    onClick={() =>
                                                        navigate(`/settings/${account.ulid}/facebook-ads`)
                                                    }
                                                    className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 !outline-none"
                                                >
                                                    View Ads
                                                </button>
                                                <button
                                                    onClick={() => setDisconnectTarget(account)}
                                                    className="rounded-lg border border-rose-600 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 !outline-none"
                                                >
                                                    Disconnect
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Disconnect Confirmation Modal */}
            {disconnectTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-2">
                    <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-5 relative">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3 text-rose-400">
                                <span className="inline-flex items-center justify-center bg-rose-500/20 rounded-full p-2">
                                    <AlertTriangle size={22} />
                                </span>
                                <span className="font-bold text-lg">
                                    Disconnect Facebook Account
                                </span>
                            </div>
                            <button
                                onClick={() => setDisconnectTarget(null)}
                                className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-full"
                                aria-label="Close"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        <p className="text-base text-slate-200 mb-2">
                            Are you sure you want to disconnect this Facebook Ads account?
                        </p>
                        <p className="text-sm text-rose-400 mb-6">
                            This will remove all associated Facebook Ads data.
                        </p>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDisconnectTarget(null)}
                                className="rounded-lg border border-slate-600 px-5 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDisconnect}
                                className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition"
                            >
                                Disconnect
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FacebookAccounts;
