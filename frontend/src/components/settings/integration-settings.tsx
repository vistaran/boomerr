import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../../context/auth-context";
import type { WorkspaceIntegration } from "../../types/workspace-integrations";
import {
    checkFacebookAdsStatus,
    connectGoogleAds,
    getGoogleAdsStatus,
    getWorkspaceIntegrations,
    updateWorkspaceIntegration,
    type GoogleAdsIntegrationStatus,
} from "../../services/integrations-service";
import { toast } from "react-hot-toast";
import { getProviderMeta } from "../integrations/integration-providers";
import { useNavigate, } from "react-router-dom";
import CommonLoader from "../common/common-loader";
import { usePlanLimits } from "../../hooks";
import type { PlanIntegrations } from "../../types/plan";
import IntegrationCard from "./integration-card";
import { DeveloperWebhooksPanel } from "../integrations/developer-webhooks/developer-webhooks-panel";
import { toggleWorkspaceWebhooksEnabled } from "../../services/developer-webhooks-service";
import { Webhook, ChevronRight } from "lucide-react";
import { ToggleSwitch } from "../common/toggle";

const FACEBOOK_DIALOG_URL = "https://www.facebook.com/v17.0/dialog/oauth";
const FACEBOOK_OAUTH_SCOPES = [
    "ads_read",
    "ads_management",
    "business_management",
    "pages_read_engagement",
];
const ROUTES = {
    facebook: "/settings/facebook-accounts",
    google: "/settings/google-accounts",
} as const;
const FACEBOOK_INTEGRATION_KEY = "facebook-ads";
const GOOGLE_INTEGRATION_KEY = "google-ads";
const SMS_INTEGRATION_KEY = "sms";
const WHATSAPP_INTEGRATION_KEY = "whatsapp";

type ToggleLoadingState = Record<number, boolean>;
export type IntegrationActionVariant = "info" | "success";

export type IntegrationCardAction = {
    label: string;
    variant: IntegrationActionVariant;
    onClick: () => void;
};


const sortIntegrationsByLaunch = (list: WorkspaceIntegration[]) =>
    [...list].sort((a, b) => Number(Boolean(b.integration.is_launched)) - Number(Boolean(a.integration.is_launched)));
function useIntegrationSettingsState(workspaceUlid: string | null) {
    const [integrations, setIntegrations] = useState<WorkspaceIntegration[]>([]);
    const [isFacebookAdsConnected, setIsFacebookAdsConnected] = useState(false);
    const [googleStatus, setGoogleStatus] = useState<GoogleAdsIntegrationStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchIntegrations = useCallback(async () => {
        try {
            const data = await getWorkspaceIntegrations();
            setIntegrations(sortIntegrationsByLaunch(data));
        } catch (error) {
            console.error("Failed to load integrations:", error);
            toast.error("Failed to load integrations");
        }
    }, []);

    const fetchFacebookStatus = useCallback(async () => {
        if (!workspaceUlid) {
            setIsFacebookAdsConnected(false);
            return;
        }
        try {
            const response = await checkFacebookAdsStatus(workspaceUlid) as { isConnected?: boolean };
            setIsFacebookAdsConnected(Boolean(response?.isConnected));
        } catch (error) {
            console.error("Failed to check Facebook Ads status:", error);
            toast.error("Failed to check Facebook Ads status");
        }
    }, [workspaceUlid]);

    const fetchGoogleStatus = useCallback(async () => {
        try {
            const statusData = await getGoogleAdsStatus();
            setGoogleStatus(statusData);
        } catch (error) {
            console.error("Failed to load Google Ads data:", error);
            toast.error("Failed to load Google Ads data");
        }
    }, []);

    const hydrate = useCallback(async () => {
        setLoading(true);
        await Promise.allSettled([
            fetchIntegrations(),
            fetchFacebookStatus(),
            fetchGoogleStatus(),
        ]);
        setLoading(false);
    }, [fetchIntegrations, fetchFacebookStatus, fetchGoogleStatus]);

    useEffect(() => {
        const run = async () => {
            await hydrate();
        };
        run();
    }, [hydrate]);

    return {
        integrations,
        setIntegrations,
        loading,
        isFacebookAdsConnected,
        googleStatus,
    };
}





type BuildActionsArgs = {
    integration: WorkspaceIntegration;
    isFacebookAdsConnected: boolean;
    googleStatus: GoogleAdsIntegrationStatus | null;
    onConnect: (integrationKey: string) => void;
    onFacebookView: () => void;
    onGoogleView: () => void;
};

const buildIntegrationActions = ({
    integration,
    isFacebookAdsConnected,
    googleStatus,
    onConnect,
    onFacebookView,
    onGoogleView,
}: BuildActionsArgs): IntegrationCardAction[] => {
    const key = integration.integration?.key;
    const requiresConfiguration = integration.integration?.is_configuration_needed === 1;
    const launched = Boolean(integration.integration?.is_launched);
    const actions: IntegrationCardAction[] = [];

    if (!key) {
        return actions;
    }

    if (key === GOOGLE_INTEGRATION_KEY && googleStatus?.isConnected) {
        actions.push({ label: "View", variant: "success", onClick: onGoogleView });
    }

    if (!requiresConfiguration) {
        return actions;
    }

    if (key === FACEBOOK_INTEGRATION_KEY) {
        actions.push(
            isFacebookAdsConnected
                ? { label: "View", variant: "success", onClick: onFacebookView }
                : { label: "Connect", variant: "info", onClick: () => onConnect(key) }
        );
        return actions;
    }

    if (key === GOOGLE_INTEGRATION_KEY && launched && !googleStatus?.isConnected) {
        actions.push({ label: "Connect", variant: "info", onClick: () => onConnect(key) });
    }

    return actions;
};

export default function IntegrationSettings({ canManage }: { canManage: boolean }) {
    const { user } = useAuth();
    // const workspaceId = user?.workspace_id ?? null;
    const navigate = useNavigate();
    const { integrations, setIntegrations, loading, isFacebookAdsConnected, googleStatus: status } =
        useIntegrationSettingsState(user?.workspace_ulid ?? null);
    const [toggleLoading, setToggleLoading] = useState<ToggleLoadingState>({});
    const { hasIntegration } = usePlanLimits();
    const [showDeveloperWebhooks, setShowDeveloperWebhooks] = useState(false);
    const { token, user: authUser, workspaces, persistAuth } = useAuth();
    
    // Find current workspace to get webhooks enabled status
    const currentWorkspace = workspaces.find(w => w.ulid === authUser?.workspace_ulid) || workspaces.find(w => w.is_current);
    const [webhooksEnabled, setWebhooksEnabled] = useState(
        currentWorkspace?.developer_webhooks_enabled !== undefined
            ? Boolean(currentWorkspace.developer_webhooks_enabled)
            : true
    );
    const [webhooksToggleLoading, setWebhooksToggleLoading] = useState(false);

    useEffect(() => {
        setWebhooksEnabled(
            currentWorkspace?.developer_webhooks_enabled !== undefined
                ? Boolean(currentWorkspace.developer_webhooks_enabled)
                : true
        );
    }, [currentWorkspace?.developer_webhooks_enabled]);

    const handleWebhooksToggle = async (checked: boolean) => {
        if (!canManage) return;
        setWebhooksToggleLoading(true);
        try {
            const res = await toggleWorkspaceWebhooksEnabled(checked);
            toast.success(res.message);
            setWebhooksEnabled(checked);
            
            // Update auth context so the state persists across components
            if (currentWorkspace && token && authUser) {
                const updatedWorkspaces = workspaces.map(w => 
                    w.ulid === currentWorkspace.ulid 
                        ? { ...w, developer_webhooks_enabled: checked } 
                        : w
                );
                persistAuth(token, authUser, updatedWorkspaces);
            }
        } catch {
            toast.error('Failed to update workspace webhooks setting');
        } finally {
            setWebhooksToggleLoading(false);
        }
    };

    const handleFacebookAdsView = useCallback(() => {
        navigate(ROUTES.facebook);
    }, [navigate]);

    const handleGoogleAdsView = useCallback(() => {
        navigate(ROUTES.google);
    }, [navigate]);

    const handleFacebookConnect = useCallback(() => {
        const clientId = import.meta.env.VITE_FACEBOOK_APP_ID;
        const redirectUri = import.meta.env.VITE_FACEBOOK_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            toast.error("Facebook OAuth not configured");
            return;
        }

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: FACEBOOK_OAUTH_SCOPES.join(","),
            state: String(user?.ulid ?? "0"),
        });

        window.open(`${FACEBOOK_DIALOG_URL}?${params.toString()}`, "_blank", "noopener,noreferrer");
    }, [user?.ulid]);

    const handleGoogleConnect = useCallback(async () => {
        try {
            const response = await connectGoogleAds();
            window.open(response.oauthUrl, "_blank", "noopener,noreferrer");
        } catch (error) {
            console.error("Failed to initiate Google Ads connection:", error);
            toast.error("Failed to initiate Google Ads connection");
        }
    }, []);

    const handleConnect = useCallback((integrationKey: string) => {
        if (integrationKey === FACEBOOK_INTEGRATION_KEY) {
            handleFacebookConnect();
            return;
        }

        if (integrationKey === GOOGLE_INTEGRATION_KEY) {
            handleGoogleConnect();
        }
    }, [handleFacebookConnect, handleGoogleConnect]);

    const handleToggle = useCallback(async (integration: WorkspaceIntegration, checked: boolean) => {
        setToggleLoading(prev => ({ ...prev, [integration.ulid]: true }));
        try {
            await updateWorkspaceIntegration(integration.ulid, { enabled: checked });
            toast.success(`Integration ${checked ? "enabled" : "disabled"}`);
            setIntegrations(prev => prev.map(item =>
                item.ulid === integration.ulid ? { ...item, enabled: checked } : item
            ));
        } catch (error) {
            console.error("Failed to update integration:", error);
            toast.error("Failed to update integration");
        } finally {
            setToggleLoading(prev => ({ ...prev, [integration.ulid]: false }));
        }
    }, [setIntegrations]);

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
                <CommonLoader />
                Loading integrations…
            </div>
        );
    }

    const getBillingIntegrationKey = (integrationKey: string): keyof PlanIntegrations | null => {
        const map: Record<string, keyof PlanIntegrations> = {
            discord: 'discord',
            slack: 'slack',
            whatsapp: 'whatsapp',
            sms: 'sms',
            email: 'email',
            call: 'calls',
            'facebook-ads': 'facebook_ads',
            'google-ads': 'google_ads',
            telegram: 'telegram',
        };
        return map[integrationKey] ?? null;
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-fade-in">
            {showDeveloperWebhooks ? (
                <DeveloperWebhooksPanel setSelectedProvider={() => setShowDeveloperWebhooks(false)} />
            ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 flex flex-col gap-4 md:flex-row items-center justify-between">
                    <section className="space-y-6 w-full">
                <div>
                    <h2 className="text-lg font-semibold text-slate-100">
                        Integrations
                    </h2>
                    <p className="text-sm text-slate-400">
                        Enable or disable integrations for this workspace.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                    {integrations.map(integration => {
                        const launched = Boolean(integration.integration?.is_launched);
                        const meta = getProviderMeta(integration.integration?.key);
                        const actions = buildIntegrationActions({
                            integration,
                            isFacebookAdsConnected,
                            googleStatus: status,
                            onConnect: handleConnect,
                            onFacebookView: handleFacebookAdsView,
                            onGoogleView: handleGoogleAdsView,
                        });
                        const showToggle = launched && (
                            integration.integration?.is_configuration_needed === 0 ||
                            integration.integration?.key === SMS_INTEGRATION_KEY ||
                            integration.integration?.key === WHATSAPP_INTEGRATION_KEY
                        );

                        const planKey = getBillingIntegrationKey(integration.integration?.key ?? "");
                        const isPlanAllowed = planKey ? hasIntegration(planKey) : true;
                        const planLocked = !isPlanAllowed;

                        return (
                            <IntegrationCard
                                key={integration.ulid}
                                integration={integration}
                                metaIcon={meta?.icon}
                                launched={launched}
                                actions={actions}
                                showToggle={Boolean(showToggle)}
                                toggleChecked={Boolean(integration.enabled)}
                                toggleDisabled={toggleLoading[integration.ulid] || !canManage}
                                onToggle={(checked) => handleToggle(integration, checked)}
                                planLocked={planLocked}
                            />
                        );
                    })}
                    
                    {/* Developer Webhooks Card */}
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-3 sm:py-4 rounded-[12px] sm:rounded-2xl border justify-between group w-full border-slate-700 bg-slate-900/60 glare-hover">
                        <button
                            onClick={() => setShowDeveloperWebhooks(true)}
                            className="flex items-center gap-1 focus:outline-none group flex-1 min-w-0 !outline-none"
                        >
                            <span className="mr-1 sm:mr-3 flex-shrink-0">
                                <Webhook size={20} className="text-slate-400" />
                            </span>
                            <div className="flex flex-col text-left">
                                <span className="text-sm font-semibold text-slate-200">Webhooks</span>
                            </div>
                        </button>
                        
                        <div className="flex items-center gap-1.5 ml-1 mt-1">
                            <ToggleSwitch
                                checked={webhooksEnabled}
                                onChange={handleWebhooksToggle}
                                disabled={webhooksToggleLoading || !canManage}
                            />
                        </div>
                    </div>
                </div>
            </section>
                </div>
            )}
        </div>
    );
}
