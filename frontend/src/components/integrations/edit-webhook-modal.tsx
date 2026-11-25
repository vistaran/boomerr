import { useEffect, useState, useRef, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import type { DomainIntegration } from "../../types/domain-integrations";
import { createPortal } from "react-dom";

type EditWebhookModalProps = {
    open: boolean;
    provider: DomainIntegration;
    webhook: {
        id: number;
        name: string;
        url: string;
        is_active: boolean;
    } | null;
    saving: boolean;
    onClose: () => void;
    onSubmit: (e: FormEvent) => void;
    formData: {
        name: string;
        url: string;
        events: string[];
    };
    setFormData: (updater: (prev: any) => any) => void;
};

export function EditWebhookModal({
    open,
    provider,
    webhook,
    saving,
    onClose,
    onSubmit,
    formData,
    setFormData,
}: EditWebhookModalProps) {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [fetching, setFetching] = useState(false);
    const fetchedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!open || !webhook) {
            fetchedRef.current = null;
            return;
        }
        
        const webhookId = String((webhook as any).ulid ?? webhook.id);
        if (fetchedRef.current === webhookId) return;
        
        fetchedRef.current = webhookId;
        
        let isMounted = true;
        setFetching(true);
        
        import("../../services/integrations-service").then(({ getNotificationChannel }) => {
            getNotificationChannel(webhookId)
                .then((freshWebhook) => {
                    if (isMounted) {
                        setFormData((f: any) => ({
                            ...f,
                            name: freshWebhook.name,
                            url: freshWebhook.url,
                            events: freshWebhook.events || [],
                        }));
                    }
                })
                .catch(console.error)
                .finally(() => {
                    if (isMounted) setFetching(false);
                });
        });

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => {
            isMounted = false;
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose, open, webhook, setFormData]);

    if (!open || !webhook) return null;

    const urlPlaceholder =
        provider.integration.key === "discord"
            ? "https://discord.com/api/webhooks/..."
            : provider.integration.key === "telegram"
            ? "e.g. 1387581827 or -10012345678"
            : "https://hooks.slack.com/services/...";

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90"
                onClick={() => !saving && onClose()}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                <div className="mb-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-100">
                            Edit {provider.integration.name} Webhook
                        </h2>
                        {fetching && (
                            <svg className="animate-spin h-5 w-5 text-sky-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-slate-300">
                        Update webhook configuration
                    </p>
                </div>

                <form className="space-y-4" onSubmit={(e) => {
                    e.preventDefault();
                    const newErrors: Record<string, string> = {};
                    if (!formData.name.trim()) newErrors.name = "Webhook Name is required";
                    if (!formData.url.trim()) newErrors.url = provider.integration.key === "telegram" ? "Chat ID is required" : "Webhook URL is required";
                    else if (provider.integration.key !== "telegram" && !/^(https?:\/\/)/.test(formData.url)) newErrors.url = "Valid URL is required (http/https)";
                    
                    setErrors(newErrors);
                    
                    if (Object.keys(newErrors).length === 0) {
                        onSubmit(e);
                    }
                }}>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-300">
                            Webhook Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Infra Alerts / On-call / Marketing"
                            value={formData.name}
                            onChange={(e) => {
                                setFormData((f: any) => ({ ...f, name: e.target.value }));
                                if (errors.name) setErrors({...errors, name: ''});
                            }}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            autoFocus
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-300">
                            {provider.integration.key === "telegram" ? "Chat ID" : "Webhook URL"} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type={provider.integration.key === "telegram" ? "text" : "url"}
                            placeholder={urlPlaceholder}
                            value={formData.url}
                            onChange={(e) => {
                                setFormData((f: any) => ({ ...f, url: e.target.value }));
                                if (errors.url) setErrors({...errors, url: ''});
                            }}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        />
                        {errors.url && <p className="text-red-500 text-xs mt-1">{errors.url}</p>}
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300 flex items-center gap-2">
                            Event Selection
                            <AlertCircle className="w-4 h-4 text-slate-500" />
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'].map(eventName => (
                                <label key={eventName} className="flex items-center gap-3 p-3 rounded-lg border border-slate-700/50 bg-slate-900/50 hover:bg-slate-800/50 hover:border-slate-600 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.events?.includes(eventName)}
                                        onChange={() => {
                                            setFormData((prev: any) => {
                                                const events = prev.events || [];
                                                if (events.includes(eventName)) {
                                                    return { ...prev, events: events.filter((e: string) => e !== eventName) };
                                                } else {
                                                    return { ...prev, events: [...events, eventName] };
                                                }
                                            });
                                        }}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
                                    />
                                    <span className="text-sm text-slate-300">{eventName}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={formData.is_active}
                            onChange={(e) =>
                                setFormData((f: any) => ({ ...f, is_active: e.target.checked }))
                            }
                            className="h-4 w-4 rounded border-slate-700 bg-slate-950/70 text-sky-500 focus:ring-sky-500"
                        />
                        <label htmlFor="is_active" className="text-sm text-slate-300">
                            Active
                        </label>
                    </div> */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
                        >
                            {saving ? "Saving…" : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
