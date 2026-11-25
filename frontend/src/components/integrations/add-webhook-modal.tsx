import { PlusIcon, AlertCircle } from "lucide-react";
import { createPortal } from "react-dom";
import type { NewWebhookFormState } from "../../types/integration-webhooks";
import type { DomainIntegration } from "../../types/domain-integrations";
import { useEffect, useState, type FormEvent } from "react";

export function AddWebhookModal({ onClose, onAddWebhook, selectedProvider, newWebhook, setNewWebhook, addingWebhook }:
    {
        onClose: () => void;
        onAddWebhook: (e: FormEvent) => void;
        selectedProvider: DomainIntegration;
        newWebhook: NewWebhookFormState;
        setNewWebhook: (updater: (prev: NewWebhookFormState) => NewWebhookFormState) => void; addingWebhook: boolean;
    }) {
    const [errors, setErrors] = useState<Record<string, string>>({});

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
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 animate-fade-in mt-20 2xl:mt-40">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/90 animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-7 shadow-2xl animate-scale-in">
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 p-2 shadow-lg shadow-sky-500/20">
                            <PlusIcon className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-50">
                            Add {selectedProvider.integration.name} Webhook
                        </h2>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Configure a new notification channel to receive real-time alerts.
                    </p>
                </div>

                <form
                    className="space-y-5" noValidate
                    onSubmit={(e) => {
                        e.preventDefault();
                        const newErrors: Record<string, string> = {};
                        if (!newWebhook.name.trim()) newErrors.name = "Webhook Name is required";
                        if (!newWebhook.url.trim()) newErrors.url = "Webhook URL is required";
                        else if (!/^(https?:\/\/)/.test(newWebhook.url)) newErrors.url = "Valid URL is required (http/https)";
                        
                        setErrors(newErrors);
                        
                        if (Object.keys(newErrors).length === 0) {
                            onAddWebhook(e);
                        }
                    }}>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300">
                            Webhook Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., Infra Alerts, On-call Team"
                            value={newWebhook.name}
                            onChange={(e) => {
                                setNewWebhook((f) => ({ ...f, name: e.target.value }));
                                if (errors.name) setErrors({...errors, name: ''});
                            }}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all duration-200"
                            autoFocus
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300">
                            Webhook URL <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="url"
                            placeholder={"Enter Webhook URL"}
                            value={newWebhook.url}
                            onChange={(e) => {
                                setNewWebhook((f) => ({ ...f, url: e.target.value }));
                                if (errors.url) setErrors({...errors, url: ''});
                            }}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all duration-200"
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
                                        checked={newWebhook.events?.includes(eventName)}
                                        onChange={() => {
                                            setNewWebhook((prev) => {
                                                const events = prev.events || [];
                                                if (events.includes(eventName)) {
                                                    return { ...prev, events: events.filter(e => e !== eventName) };
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

                    <div className="flex justify-end gap-3 pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-slate-700 bg-slate-800/50 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 hover:scale-105 active:scale-95"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={addingWebhook}
                            className="rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:shadow-xl hover:shadow-sky-500/40 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
                        >
                            {addingWebhook ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Adding…
                                </span>
                            ) : "Add Webhook"}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
