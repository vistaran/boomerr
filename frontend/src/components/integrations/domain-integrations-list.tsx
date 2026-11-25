import { useEffect, useState } from "react";
import { ToggleSwitch } from "../common/toggle";
import { DomainIntegrationsPanel } from "./domain-integrations-panel";
import { DeveloperWebhooksPanel } from "./developer-webhooks/developer-webhooks-panel";
import { toggleWorkspaceWebhooksEnabled } from "../../services/developer-webhooks-service";
import { getAvailableIntegrations, updateDomainIntegration } from "../../services/integrations-service";
import { useAuth } from "../../context/auth-context";
// ...removed local ToggleSwitch, now using reusable ToggleSwitch...
import type { DomainIntegration } from "../../types/domain-integrations";
import { getProviderMeta } from "./integration-providers";
import { ChevronRight, Lock, Webhook } from "lucide-react";
import toast from "react-hot-toast";
import CommonLoader from "../common/common-loader";
import { usePlanLimits } from "../../hooks/use-plan-limits";
import type { PlanIntegrations } from "../../types/plan";
import { Link } from "react-router-dom";

/** Maps the integration provider key used in the DB to the billing plan integration key */
function getBillingIntegrationKey(integrationKey: string): keyof PlanIntegrations | null {
    const map: Record<string, keyof PlanIntegrations> = {
        discord: 'discord',
        slack: 'slack',
        whatsapp: 'whatsapp',
        sms: 'sms',
        email: 'email',
        call: 'calls',
        'facebook-ads': 'facebook_ads',
        'google-ads': 'google_ads',
    };
    return map[integrationKey] ?? null;
}

export default function DomainIntegrationsTab({
    canManage,
    domainId,
    domainNumericId,
    domainName,
    domainStatus,
}: {
    canManage: boolean;
    domainId: string | null;
    domainNumericId?: number | null;
    domainName?: string;
    domainStatus?: string;
}) {
    const [availableIntegrations, setAvailableIntegrations] = useState<DomainIntegration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [integrationPanelProvider, setIntegrationPanelProvider] = useState<DomainIntegration | null>(null);
    const [showDeveloperWebhooks, setShowDeveloperWebhooks] = useState(false);
    const [toggleLoading, setToggleLoading] = useState<{ [id: string]: boolean }>({});
    const { user, workspaces, persistAuth, token } = useAuth();

    // Find current workspace to get webhooks enabled status
    const currentWorkspace = workspaces.find(w => w.ulid === user?.workspace_ulid) || workspaces.find(w => w.is_current);
    const [webhooksEnabled, setWebhooksEnabled] = useState<boolean>(() => {
        const saved = localStorage.getItem(`domain_${domainId}_webhooks_enabled`);
        if (saved !== null) {
            try {
                return JSON.parse(saved);
            } catch {
                return true;
            }
        }
        return currentWorkspace?.developer_webhooks_enabled !== undefined
            ? Boolean(currentWorkspace.developer_webhooks_enabled)
            : true;
    });
    const [webhooksToggleLoading, setWebhooksToggleLoading] = useState(false);
    const { hasIntegration } = usePlanLimits();

    useEffect(() => {
        const saved = localStorage.getItem(`domain_${domainId}_webhooks_enabled`);
        if (saved !== null) {
            try {
                setWebhooksEnabled(JSON.parse(saved));
            } catch {
                setWebhooksEnabled(true);
            }
        } else {
            setWebhooksEnabled(
                currentWorkspace?.developer_webhooks_enabled !== undefined
                    ? Boolean(currentWorkspace.developer_webhooks_enabled)
                    : true
            );
        }
    }, [domainId, currentWorkspace?.developer_webhooks_enabled]);

    useEffect(() => {
        if (domainId) {
            // Fetch available integrations for the domain
            const fetchIntegrations = async () => {
                setIsLoading(true);
                const integrations = await getAvailableIntegrations(domainId);
                // sort integrations to only those that which have is_launched enabled
                const filteredData = integrations.sort((a, b) => (a.integration.is_launched === b.integration.is_launched) ? 0 : a.integration.is_launched ? -1 : 1);
                setAvailableIntegrations(filteredData);
                setIsLoading(false);
            };
            fetchIntegrations();
            setIntegrationPanelProvider(null); // Reset selected provider when domain changes
            setShowDeveloperWebhooks(false);
        }
    }, [domainId]);

    const handleIntegrationClick = (provider: any) => {
        setIntegrationPanelProvider(provider);
    };

    const handleToggle = async (integration: DomainIntegration, checked: boolean) => {
        if (!canManage) return;
        const key = integration.ulid ?? String(integration.id);
        setToggleLoading(prev => ({ ...prev, [key]: true }));
        try {
            await updateDomainIntegration(integration.ulid ?? integration.id, {
                enabled: checked,
            });

            toast.success(`Webhook ${checked ? 'enabled' : 'disabled'}`);
            setAvailableIntegrations(prev => prev.map(p => (p.ulid ?? String(p.id)) === (integration.ulid ?? String(integration.id)) ? { ...p, enabled: checked } : p));
            // await fetchWebhooks(false);
        } catch {
            // setLocalActive(!checked); // Revert on error
            toast.error('Failed to update webhook');
        } finally {
            const key = integration.ulid ?? String(integration.id);
            setToggleLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleWebhooksToggle = async (checked: boolean) => {
        if (!canManage) return;
        setWebhooksToggleLoading(true);
        try {
            const res = await toggleWorkspaceWebhooksEnabled(checked);
            if (currentWorkspace && token && user) {
                const updatedWorkspaces = workspaces.map(w =>
                    w.ulid === currentWorkspace.ulid
                        ? { ...w, developer_webhooks_enabled: checked }
                        : w
                );
                persistAuth(token, user, updatedWorkspaces);
            }
            setWebhooksEnabled(checked);
            localStorage.setItem(`domain_${domainId}_webhooks_enabled`, JSON.stringify(checked));
            toast.success(res?.message || `Webhook ${checked ? 'enabled' : 'disabled'}`);
        } catch {
            toast.error('Failed to update webhook setting');
        } finally {
            setWebhooksToggleLoading(false);
        }
    };

    if (isLoading) return <div className="py-12 text-center">
        <div className="inline-flex items-center gap-3 text-slate-300">
            <CommonLoader />
            <span className="text-base font-medium">Loading integrations…</span>
        </div>
    </div>;

    return (
        <section className="w-full h-full">
            <div className="flex flex-col animate-fade-in">
                {integrationPanelProvider ? (
                    <DomainIntegrationsPanel
                        canManage={canManage}
                        selectedProvider={integrationPanelProvider}
                        setSelectedProvider={setIntegrationPanelProvider}
                        domainId={domainId}
                        domainNumericId={domainNumericId}
                        domainName={domainName}
                        domainStatus={domainStatus}
                    />
                ) : showDeveloperWebhooks ? (
                    <DeveloperWebhooksPanel setSelectedProvider={(p) => setShowDeveloperWebhooks(false)} />
                ) : (
                    <div className="transition-all duration-300 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 mb-6">
                            {availableIntegrations.map(p => {
                                const disabled = !p?.integration.is_launched;
                                const billingKey = getBillingIntegrationKey(p.integration.key);
                                const planLocked = billingKey ? !hasIntegration(billingKey) : false;
                                const isDisabled = disabled || planLocked;

                                const cardClass = [
                                    "inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border justify-between group w-full",
                                    planLocked
                                        ? "opacity-70 cursor-not-allowed border-amber-500/30 bg-amber-500/5"
                                        : disabled
                                            ? "opacity-50 cursor-not-allowed border-slate-800"
                                            : "border-slate-700 bg-slate-900/60 glare-hover"
                                ].join(" ");

                                return (
                                    <div key={p.id} className={cardClass}>
                                        <button
                                            onClick={() => !isDisabled && p.integration.name != "Email" && handleIntegrationClick(p)}
                                            disabled={isDisabled}
                                            className={`flex items-center gap-1 focus:outline-none group flex-1 min-w-0 !outline-none ${p.integration.name == "Email" ? "!cursor-default" : ""}`}
                                        >
                                            {getProviderMeta(p.integration.key)?.icon && (
                                                <span className="mr-1 flex-shrink-0" {...(p.integration.key === "clickup" ? { className: "mr-0" } : {})}>
                                                    {getProviderMeta(p.integration.key)?.icon}
                                                </span>
                                            )}

                                            <span className="text-xs sm:text-sm font-medium text-slate-200 flex items-center min-w-0 truncate">
                                                {p.integration.name}

                                                {!planLocked && p.integration.is_launched === 1 && p.integration.name != "Email" && (
                                                    <span className="ml-1 transition-all duration-200 group-hover:translate-x-1 -mb-1 flex-shrink-0 hidden sm:inline">
                                                        <ChevronRight size={16} className="text-slate-400" />
                                                    </span>
                                                )}
                                            </span>

                                            {!p.integration.is_launched && !planLocked && (
                                                <span className="ml-1 text-[10px] uppercase text-slate-400 flex-shrink-0">
                                                    Coming Soon
                                                </span>
                                            )}
                                        </button>

                                        {planLocked ? (
                                            <Link
                                                to="/billing"
                                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors flex-shrink-0 whitespace-nowrap"
                                                title="Upgrade your plan to access this integration"
                                            >
                                                <Lock size={9} />
                                                <span className="hidden sm:inline">Upgrade</span>
                                            </Link>
                                        ) : (
                                            (p.integration.is_launched === 1 && (p.integration.is_configuration_needed === 0 || p.integration.key === 'sms' || p.integration.key === 'whatsapp')) && (
                                                <ToggleSwitch
                                                    checked={p.enabled}
                                                    onChange={checked => handleToggle(p, checked)}
                                                    disabled={toggleLoading[p.ulid ?? String(p.id)] || !canManage}
                                                />
                                            )
                                        )}
                                    </div>
                                );
                            })}

                            {/* Workspace Webhooks Card */}
                            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border justify-between group w-full border-slate-700 bg-slate-900/60 glare-hover">
                                <button
                                    onClick={() => setShowDeveloperWebhooks(true)}
                                    className="flex items-center gap-1 focus:outline-none group flex-1 min-w-0 !outline-none"
                                >
                                    <span className="mr-1 flex-shrink-0">
                                        <Webhook size={18} className="text-slate-400" />
                                    </span>
                                    <span className="text-xs sm:text-sm font-medium text-slate-200 flex items-center min-w-0 truncate">
                                        Webhooks
                                        <span className="ml-1 transition-all duration-200 group-hover:translate-x-1 -mb-1 flex-shrink-0 hidden sm:inline">
                                            <ChevronRight size={16} className="text-slate-400" />
                                        </span>
                                    </span>
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
                    </div>
                )}
            </div>
        </section>
    );
}
