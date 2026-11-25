import { useState, useEffect } from "react";
import { ChevronsLeftIcon, Plus, Check, Edit3, Trash2, Zap, AlertCircle, Copy, History, Code } from "lucide-react";
import { 
    getDeveloperWebhooks, 
    deleteDeveloperWebhook, 
    testDeveloperWebhook,
    updateDeveloperWebhook
} from "../../../services/developer-webhooks-service";
import type { DeveloperWebhook } from "../../../types/developer-webhooks";
import { WebhookFormModal } from "./webhook-form-modal";
import { WebhookDeliveryHistoryModal } from "./webhook-delivery-history-modal";
import { WebhookExampleModal } from "./webhook-example-modal";
import toast from "react-hot-toast";
import { WebhookCard } from "../webhook-card";

export function DeveloperWebhooksPanel({ setSelectedProvider }: { setSelectedProvider: (p: any) => void }) {
    const [webhooks, setWebhooks] = useState<DeveloperWebhook[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showExampleModal, setShowExampleModal] = useState(false);
    const [editingWebhook, setEditingWebhook] = useState<DeveloperWebhook | null>(null);
    const [historyWebhook, setHistoryWebhook] = useState<DeveloperWebhook | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [testingId, setTestingId] = useState<number | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);

    const fetchWebhooks = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const data = await getDeveloperWebhooks();
            setWebhooks(data || []);
        } catch (error) {
            toast.error("Failed to load webhooks");
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    useEffect(() => {
        fetchWebhooks();
    }, []);

    const handleCopyUrl = (id: number, url: string) => {
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure you want to delete this webhook?")) return;
        setDeletingId(id);
        try {
            await deleteDeveloperWebhook(id);
            toast.success("Webhook deleted");
            fetchWebhooks();
        } catch (error) {
            toast.error("Failed to delete webhook");
        } finally {
            setDeletingId(null);
        }
    };

    const handleTest = async (id: number) => {
        setTestingId(id);
        try {
            await testDeveloperWebhook(id);
            toast.success("Test payload delivered successfully!");
            fetchWebhooks(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to send test payload");
            // Fetch webhooks immediately to update toggle if it was disabled
            fetchWebhooks(false);
        } finally {
            setTestingId(null);
        }
    };

    const handleToggle = async (webhook: DeveloperWebhook, enabled: boolean) => {
        try {
            // Optimistic update
            setWebhooks(prev => prev.map(w => w.id === webhook.id ? { ...w, enabled } : w));
            await updateDeveloperWebhook(webhook.id, { enabled });
            toast.success(`Webhook ${enabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            // Revert
            setWebhooks(prev => prev.map(w => w.id === webhook.id ? { ...w, enabled: !enabled } : w));
            toast.error("Failed to update status");
        }
    };

    return (
        <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    {setSelectedProvider && (
                        <>
                            <button
                                onClick={() => setSelectedProvider(null)}
                                className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition !outline-none"
                            >
                                <ChevronsLeftIcon className="w-4 h-4" />
                                Back to Integrations
                            </button>
                            <span className="text-slate-600">/</span>
                        </>
                    )}
                    <h2 className="text-lg font-semibold text-slate-100">
                        Developer Webhooks
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowExampleModal(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 hover:border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all duration-200"
                    >
                        <Code className="w-4 h-4 text-slate-400" />
                        <span className="hidden sm:inline">Payload Format</span>
                        <span className="sm:hidden">Format</span>
                    </button>
                    
                    <button
                        onClick={() => {
                            setEditingWebhook(null);
                            setShowFormModal(true);
                        }}
                        className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:shadow-xl hover:shadow-sky-500/40 hover:scale-105 transition-all duration-200"
                    >
                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
                        <span>Create Webhook</span>
                    </button>
                </div>
            </div>

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
                    <p className="text-sm text-slate-400">Create a webhook to receive event payloads on your own servers.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 2xl:grid-cols-3 gap-4">
                    {webhooks.map((wh, index) => (
                        <WebhookCard
                            key={wh.id}
                            webhook={wh}
                            index={index}
                            canManage={true}
                            onTest={handleTest}
                            onToggle={(c: boolean) => handleToggle(wh, c)}
                            onEdit={() => { setEditingWebhook(wh); setShowFormModal(true); }}
                            onDelete={() => handleDelete(wh.id)}
                            onHistory={() => setHistoryWebhook(wh)}
                        />
                    ))}
                </div>
            )}

            {showFormModal && (
                <WebhookFormModal 
                    open={showFormModal} 
                    onClose={() => setShowFormModal(false)} 
                    webhook={editingWebhook}
                    onSuccess={fetchWebhooks}
                />
            )}

            {historyWebhook && (
                <WebhookDeliveryHistoryModal 
                    open={Boolean(historyWebhook)}
                    onClose={() => setHistoryWebhook(null)}
                    webhook={historyWebhook}
                />
            )}

            <WebhookExampleModal 
                open={showExampleModal}
                onClose={() => setShowExampleModal(false)}
            />
        </section>
    );
}