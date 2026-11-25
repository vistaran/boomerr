import { useState, useEffect, type FormEvent } from "react";
import { ChevronsLeftIcon, Plus, } from "lucide-react";
import type { DomainIntegration } from "../../types/domain-integrations";
import type { IntegrationWebhook, NewWebhookFormState } from "../../types/integration-webhooks";
import { WebhookCard } from "./webhook-card";
import { AddWebhookModal } from "./add-webhook-modal";
import { FacebookAdsInlinePanel } from "./facebook-ads-inline-panel";
import { GoogleAdsInlinePanel } from "./google-ads-inline-panel";
import { SmsInlinePanel } from "./sms-inline-panel";
import { WhatsAppInlinePanel } from "./whatsapp-inline-panel";
import { ClickUpInlinePanel } from "./clickup-inline-panel";
import { WebhookDeliveryHistoryModal } from "./developer-webhooks/webhook-delivery-history-modal";
import { TelegramConnectModal } from "./telegram-connect-modal";

type IntegrationsPanelProps = {
    selectedProvider: DomainIntegration;
    webhooks: IntegrationWebhook[];
    setSelectedProvider: (provider: DomainIntegration | null) => void;
    newWebhook: NewWebhookFormState;
    setNewWebhook: (updater: (prev: NewWebhookFormState) => NewWebhookFormState) => void;
    addingWebhook: boolean;
    onAddWebhook: (e: FormEvent) => void;

    loading: boolean;
    canManage: boolean;
    showAddModal: boolean;
    setShowAddModal: (show: boolean) => void;
    setEditFormData: (data: any) => void;
    setEditingWebhook: (webhook: IntegrationWebhook | null) => void;
    setDeleteTarget: (webhook: IntegrationWebhook | null) => void;
    fetchWebhooks: () => Promise<void>;
    domainId: string | null;
    domainNumericId?: number | null;
    domainName?: string;
    domainStatus?: string;
};

export function IntegrationsPanel({
    selectedProvider,
    webhooks,
    setSelectedProvider,
    newWebhook,
    setNewWebhook,
    addingWebhook,
    onAddWebhook,
    loading,
    canManage,
    showAddModal,
    setShowAddModal,
    setEditFormData,
    setEditingWebhook,
    setDeleteTarget,
    fetchWebhooks,
    domainId,
    domainNumericId,
    domainName,
    domainStatus,
}: IntegrationsPanelProps) {

    // State to trigger re-render for time-ago display
    const [, setNow] = useState(0);
    const [historyWebhook, setHistoryWebhook] = useState<IntegrationWebhook | null>(null);
    const [historyIntegration, setHistoryIntegration] = useState<{ type: string, id: string | number, name: string } | null>(null);
    const [reconnectingWebhook, setReconnectingWebhook] = useState<IntegrationWebhook | null>(null);

    useEffect(() => {
        // If any Discord webhook is < 60s old, update every second, else every minute
        const needsSecondUpdate = webhooks.some(
            (wh) => Object.prototype.hasOwnProperty.call(wh, 'last_triggered_at') &&
                typeof (wh as any).last_triggered_at === 'string' &&
                (() => {
                    const dt = (wh as any).last_triggered_at;
                    const utcDate = new Date(dt + (dt.endsWith('Z') ? '' : 'Z'));
                    const diff = Math.floor((Date.now() - utcDate.getTime()) / 1000);
                    return diff < 60;
                })()
        );
        const intervalId = window.setInterval(() => setNow(Date.now()), needsSecondUpdate ? 10000 : 60000);
        return () => clearInterval(intervalId);
    }, [webhooks]);

    return (
        <section className="space-y-6 w-full max-w-full min-w-0">
            <div className="relative w-full max-w-full min-w-0">
                <div className={`${selectedProvider.integration.key !== "facebook-ads" && selectedProvider.integration.key !== "google-ads" && selectedProvider.integration.key !== "clickup" ? 'mb-6 flex flex-row justify-between items-center gap-3 sm:gap-4 w-full max-w-full min-w-0' : ''}`}>
                    {selectedProvider.integration.key !== "facebook-ads" && selectedProvider.integration.key !== "google-ads" && selectedProvider.integration.key !== "clickup" &&
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <button
                                onClick={() => setSelectedProvider(null)}
                                className="inline-flex items-center gap-1 text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition !outline-none flex-shrink-0"
                            >
                                <ChevronsLeftIcon className="w-4 h-4" />
                                Back to Integrations
                            </button>

                            <span className="text-slate-600 flex-shrink-0">/</span>

                            <h2 className="text-base sm:text-lg font-semibold text-slate-100 truncate">
                                {selectedProvider.integration.name}
                            </h2>
                        </div>
                    }

                    {/* Only show Add Webhook button for non-Facebook integrations */}
                    {selectedProvider.integration.key !== "facebook-ads" && selectedProvider.integration.key !== "google-ads" && selectedProvider.integration.key !== "sms" && selectedProvider.integration.key !== "whatsapp" && selectedProvider.integration.key !== "clickup" && (
                        <div className="flex-shrink-0">
                            {canManage ? (
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="group inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:shadow-xl hover:shadow-sky-500/40 hover:scale-105 transition-all duration-200">
                                    <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
                                    <span>Add Webhook</span>
                                </button>
                            ) : (
                                <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                                    Read-only
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Render Facebook Ads Panel for facebook-ads and google-ads integration */}
                {selectedProvider.integration.key == "facebook-ads" ? (
                    <FacebookAdsInlinePanel
                        domainId={domainId}
                        domainName={domainName || "Unknown Domain"}
                        domainStatus={domainStatus || "unknown"}
                        canManage={canManage}
                        setSelectedProvider={setSelectedProvider}
                    />
                ) : selectedProvider.integration.key == "google-ads" ? (
                    <GoogleAdsInlinePanel
                        setSelectedProvider={setSelectedProvider}
                        domainId={domainId}
                        domainName={domainName || "Unknown Domain"}
                        domainStatus={domainStatus || "unknown"}
                        canManage={canManage}
                    />
                ) : selectedProvider.integration.key == "sms" ? (
                    <SmsInlinePanel
                        canManage={canManage}
                        domainId={domainNumericId}
                        onHistory={(id, name) => setHistoryIntegration({ type: 'sms', id, name })}
                    />
                ) : selectedProvider.integration.key == "whatsapp" ? (
                    <WhatsAppInlinePanel
                        canManage={canManage}
                        domainId={domainNumericId}
                        onHistory={(id, name) => setHistoryIntegration({ type: 'whatsapp', id, name })}
                    />
                ) : selectedProvider.integration.key == "clickup" ? (
                    <div className="space-y-8">
                        <ClickUpInlinePanel
                            domainId={domainId}
                            domainName={domainName || "Unknown Domain"}
                            domainStatus={domainStatus || "unknown"}
                            canManage={canManage}
                            setSelectedProvider={setSelectedProvider}
                            integrationUlid={selectedProvider.ulid}
                            fetchWebhooks={fetchWebhooks}
                            webhooksCount={webhooks.length}
                        />
                        {webhooks.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-white border-b border-slate-700/50 pb-2">Configured ClickUp Tasks</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 2xl:grid-cols-3 gap-4">
                                    {webhooks.map((wh, index) => (
                                        <WebhookCard
                                            setEditingWebhook={setEditingWebhook}
                                            key={wh.id}
                                            webhook={wh}
                                            canManage={canManage}
                                            setEditFormData={setEditFormData}
                                            setDeleteTarget={setDeleteTarget}
                                            fetchWebhooks={fetchWebhooks}
                                            onHistory={() => setHistoryWebhook(wh)}
                                            onReconnect={() => {}}
                                            index={index} 
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {loading ? (
                            <div className="py-12 text-center">
                                <div className="inline-flex items-center gap-3 text-slate-300">
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span className="text-base font-medium">Loading webhooks…</span>
                                </div>
                            </div>
                        ) : webhooks.length === 0 ? (
                            <div className="rounded-xl border-2 border-dashed border-slate-700/50 bg-slate-900/40 p-8 text-center animate-fade-in">
                                <div className="mx-auto w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
                                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <p className="text-base font-medium text-slate-300 mb-1">No webhooks configured</p>
                                {canManage && (
                                    <p className="text-sm text-slate-400">Get started by adding your first webhook above.</p>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 2xl:grid-cols-3 gap-4">
                                {webhooks.map((wh, index) => (
                                    <WebhookCard
                                        setEditingWebhook={setEditingWebhook}
                                        key={wh.id}
                                        webhook={wh}
                                        canManage={canManage}
                                        setEditFormData={setEditFormData}
                                        setDeleteTarget={setDeleteTarget}
                                        fetchWebhooks={fetchWebhooks}
                                        onHistory={() => setHistoryWebhook(wh)}
                                        onReconnect={() => {
                                            setReconnectingWebhook(wh);
                                            setShowAddModal(true); // Open the connect modal
                                        }}
                                        index={index} />
                                ))}
                            </div>
                        )}
                    </>
                )
                }
            </div>

            {/* ================= Add New Webhook ================= */}
            {
                canManage && showAddModal && selectedProvider.integration.key !== "facebook-ads" && selectedProvider.integration.key !== "google-ads" && selectedProvider.integration.key !== "sms" && selectedProvider.integration.key !== "whatsapp" && selectedProvider.integration.key !== "clickup" && selectedProvider.integration.key !== "telegram" && (
                    <AddWebhookModal
                        onClose={() => setShowAddModal(false)}
                        onAddWebhook={onAddWebhook}
                        selectedProvider={selectedProvider}
                        newWebhook={newWebhook}
                        setNewWebhook={setNewWebhook}
                        addingWebhook={addingWebhook}
                    />
                )
            }

            {
                canManage && showAddModal && selectedProvider.integration.key === "telegram" && (
                    <TelegramConnectModal
                        onClose={() => {
                            setShowAddModal(false);
                            setReconnectingWebhook(null);
                        }}
                        onConnected={() => {
                            setShowAddModal(false);
                            setReconnectingWebhook(null);
                            fetchWebhooks();
                        }}
                        selectedProvider={selectedProvider}
                        domainId={domainId || ""}
                        reconnectingWebhook={reconnectingWebhook}
                    />
                )
            }

            {historyWebhook && (
                <WebhookDeliveryHistoryModal
                    open={Boolean(historyWebhook)}
                    onClose={() => setHistoryWebhook(null)}
                    integrationType="notification_channel"
                    integrationId={historyWebhook.ulid}
                    title={historyWebhook.type === 'clickup' ? "Created Tasks" : "Delivery History"}
                    subtitle={`${historyWebhook.name} • ${historyWebhook.url}`}
                />
            )}

            {historyIntegration && (
                <WebhookDeliveryHistoryModal
                    open={Boolean(historyIntegration)}
                    onClose={() => setHistoryIntegration(null)}
                    integrationType={historyIntegration.type}
                    integrationId={historyIntegration.id}
                    title="Delivery History"
                    subtitle={`${historyIntegration.name}`}
                />
            )}
        </section >
    );
}
