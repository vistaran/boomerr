import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
    getGoogleAdsStatus,
    getGoogleAdsHierarchy,
    syncGoogleAds,
    disconnectGoogleAds,
    connectGoogleAds,
    type GoogleAdsIntegrationStatus,
    type GoogleAdsAccountWithCampaigns,
} from "../../services/integrations-service";
import { ChevronDown, ChevronRight, RefreshCw, Unlink, Link2, Building2, Target, Megaphone } from "lucide-react";
import { usePlanLimits } from "../../hooks/use-plan-limits";

const StatusBadge = ({ status }: { status: string | null }) => {
    const color = status === "ENABLED" || status === "ACTIVE"
        ? "bg-green-900/50 text-green-400"
        : status === "PAUSED"
            ? "bg-yellow-900/50 text-yellow-400"
            : "bg-slate-700 text-slate-400";

    return (
        <span className={`text-xs px-2 py-0.5 rounded ${color}`}>
            {status || "Unknown"}
        </span>
    );
};

export default function GoogleAccounts() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<GoogleAdsIntegrationStatus | null>(null);
    const [hierarchy, setHierarchy] = useState<GoogleAdsAccountWithCampaigns[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set());
    const [expandedCampaigns, setExpandedCampaigns] = useState<Set<number>>(new Set());
    const [oauthStatus, setOauthStatus] = useState<string | null>(searchParams.get("status"));

    useEffect(() => {
        // Handle OAuth callback status
        const reason = searchParams.get("reason");
        setOauthStatus(searchParams.get("status"));
        if (oauthStatus === "success") {
            setOauthStatus(null)
            toast.success("Google Ads connected successfully!");
        } else if (oauthStatus === "error") {
            const messages: Record<string, string> = {
                permission_denied: "Permission was denied. Please try again and grant the required permissions.",
                oauth_failed: "OAuth connection failed. Please try again.",
                missing_params: "Invalid OAuth response. Please try again.",
                invalid_state: "Security check failed. Please try again.",
                no_refresh_token: "Could not get refresh token. Please try again.",
                token_error: "Token exchange failed. Please try again.",
                invalid_grant: "Invalid or expired authorization. Please try again.",
            };
            toast.error(messages[reason || ""] || "Failed to connect Google Ads.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statusData, hierarchyData] = await Promise.all([
                getGoogleAdsStatus(),
                getGoogleAdsHierarchy(),
            ]);
            setStatus(statusData);
            setHierarchy(hierarchyData);
        } catch (error) {
            console.error("Failed to fetch Google Ads data:", error);
            toast.error("Failed to load Google Ads data");
        } finally {
            setLoading(false);
        }
    };

    const { hasIntegration } = usePlanLimits();

    useEffect(() => {
        fetchData();
    }, []);

    const handleConnect = async () => {
        if (!hasIntegration("google_ads")) {
            toast.error("Your current plan does not support Google Ads integration. Please upgrade.");
            return;
        }

        try {
            const response = await connectGoogleAds();
            if (response?.oauthUrl) {
                window.open(response.oauthUrl, "_blank", "noopener,noreferrer");
            }
        } catch (error) {
            console.error("Failed to initiate Google Ads connection:", error);
            toast.error("Failed to initiate Google Ads connection");
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const result = await syncGoogleAds();
            toast.success(`Synced ${result.data.accounts} accounts, ${result.data.campaigns} campaigns, ${result.data.ads} ads`);
            await fetchData();
        } catch (error) {
            console.error("Failed to sync Google Ads:", error);
            toast.error("Failed to sync Google Ads data");
        } finally {
            setSyncing(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect Google Ads? This will remove all synced data.")) {
            return;
        }

        setDisconnecting(true);
        try {
            await disconnectGoogleAds();
            toast.success("Google Ads disconnected successfully");
            setStatus({ isConnected: false });
            setHierarchy([]);
        } catch (error) {
            console.error("Failed to disconnect Google Ads:", error);
            toast.error("Failed to disconnect Google Ads");
        } finally {
            setDisconnecting(false);
        }
    };

    const toggleAccount = (accountId: number) => {
        setExpandedAccounts(prev => {
            const next = new Set(prev);
            if (next.has(accountId)) {
                next.delete(accountId);
            } else {
                next.add(accountId);
            }
            return next;
        });
    };

    const toggleCampaign = (campaignId: number) => {
        setExpandedCampaigns(prev => {
            const next = new Set(prev);
            if (next.has(campaignId)) {
                next.delete(campaignId);
            } else {
                next.add(campaignId);
            }
            return next;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading Google Ads data…
            </div>
        );
    }

    return (
        <section className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4">
            <div className="space-y-6">
                {/* Header */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-100">Google Ads Integration</h2>
                            <p className="text-sm text-slate-400 mt-1">
                                {status?.isConnected
                                    ? `Connected as ${status.integration?.email || "Unknown"}`
                                    : "Connect your Google Ads account to manage campaigns"}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {status?.isConnected ? (
                                <>
                                    <button
                                        onClick={handleSync}
                                        disabled={syncing}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-sky-400 bg-sky-900/30 rounded-lg hover:bg-sky-900/50 disabled:opacity-50 transition-colors"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                                        {syncing ? "Syncing…" : "Sync"}
                                    </button>
                                    <button
                                        onClick={handleDisconnect}
                                        disabled={disconnecting}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-900/30 rounded-lg hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                                    >
                                        <Unlink className="w-4 h-4" />
                                        {disconnecting ? "Disconnecting…" : "Disconnect"}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={handleConnect}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-sky-400 bg-sky-900/30 rounded-lg hover:bg-sky-900/50 transition-colors"
                                >
                                    <Link2 className="w-4 h-4" />
                                    Connect Google Ads
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Accounts & Campaigns Hierarchy */}
                {status?.isConnected && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                        <h3 className="text-md font-semibold text-slate-100 mb-4">Accounts & Campaigns</h3>

                        {hierarchy.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No accounts found. Click "Sync" to fetch your Google Ads data.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {hierarchy.map(account => (
                                    <div key={account.id} className="border border-slate-700 rounded-lg overflow-hidden">
                                        {/* Account Header */}
                                        <button
                                            onClick={() => toggleAccount(account.id)}
                                            className="w-full flex items-center gap-3 p-4 transition-colors text-left !outline-none"
                                        >
                                            {expandedAccounts.has(account.id) ? (
                                                <ChevronDown className="w-4 h-4 text-slate-400" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                            )}
                                            <Building2 className="w-5 h-5 text-sky-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-200 truncate">
                                                    {account.name || `Account ${account.customer_id}`}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    ID: {account.customer_id} • {account.currency || "N/A"} • {account.timezone || "N/A"}
                                                </p>
                                            </div>
                                            {account.is_manager && (
                                                <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-400">
                                                    Manager
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-500">
                                                {account.campaigns.length} campaigns
                                            </span>
                                        </button>

                                        {/* Campaigns */}
                                        {expandedAccounts.has(account.id) && account.campaigns.length > 0 && (
                                            <div className="border-t border-slate-700 bg-slate-900/50">
                                                {account.campaigns.map(campaign => (
                                                    <div key={campaign.id}>
                                                        {/* Campaign Header */}
                                                        <button
                                                            onClick={() => toggleCampaign(campaign.id)}
                                                            className="w-full flex items-center gap-3 p-3 pl-12 hover:bg-slate-800/30 transition-colors text-left !outline-none"
                                                        >
                                                            {expandedCampaigns.has(campaign.id) ? (
                                                                <ChevronDown className="w-4 h-4 text-slate-400" />
                                                            ) : (
                                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                                            )}
                                                            <Target className="w-4 h-4 text-amber-400" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-slate-300 truncate">
                                                                    {campaign.name}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    {campaign.channel_type || "Unknown"} • ID: {campaign.campaign_id}
                                                                </p>
                                                            </div>
                                                            <StatusBadge status={campaign.status} />
                                                            <span className="text-xs text-slate-500">
                                                                {campaign.ads.length} ads
                                                            </span>
                                                        </button>

                                                        {/* Ads */}
                                                        {expandedCampaigns.has(campaign.id) && campaign.ads.length > 0 && (
                                                            <div className="border-t border-slate-800 bg-slate-950/50">
                                                                {campaign.ads.map(ad => (
                                                                    <div
                                                                        key={ad.id}
                                                                        className="flex items-center gap-3 p-3 pl-20 hover:bg-slate-800/20 transition-colors"
                                                                    >
                                                                        <Megaphone className="w-4 h-4 text-green-400" />
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm text-slate-400 truncate">
                                                                                {ad.name || `Ad ${ad.ad_id}`}
                                                                            </p>
                                                                            <p className="text-xs text-slate-600">
                                                                                {ad.type || "Unknown type"} • ID: {ad.ad_id}
                                                                            </p>
                                                                        </div>
                                                                        <StatusBadge status={ad.status} />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Empty campaigns state */}
                                        {expandedAccounts.has(account.id) && account.campaigns.length === 0 && (
                                            <div className="border-t border-slate-700 p-4 text-center text-slate-500 text-sm">
                                                No campaigns found in this account
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
