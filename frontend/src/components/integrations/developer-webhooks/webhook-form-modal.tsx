import { useState, useEffect } from "react";
import { X, Save, AlertCircle } from "lucide-react";
import { createDeveloperWebhook, updateDeveloperWebhook } from "../../../services/developer-webhooks-service";
import type { DeveloperWebhook } from "../../../types/developer-webhooks";
import { WEBHOOK_AVAILABLE_EVENTS } from "../../../types/developer-webhooks";
import { ToggleSwitch } from "../../common/toggle";
import toast from "react-hot-toast";

interface Props {
    open: boolean;
    onClose: () => void;
    webhook: DeveloperWebhook | null;
    onSuccess: () => void;
}

export function WebhookFormModal({ open, onClose, webhook, onSuccess }: Props) {
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [enabled, setEnabled] = useState(true);
    const [retryEnabled, setRetryEnabled] = useState(true);
    const [timeout, setTimeoutVal] = useState(10);
    const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (webhook) {
            setName(webhook.name);
            setUrl(webhook.url);
            setEnabled(webhook.enabled);
            setRetryEnabled(webhook.retry_enabled);
            setTimeoutVal(webhook.timeout);
            setSelectedEvents(webhook.events?.map(e => e.event_name) || []);
        } else {
            setName("");
            setUrl("");
            setEnabled(true);
            setRetryEnabled(true);
            setTimeoutVal(10);
            setSelectedEvents([]);
        }
        setErrors({});
    }, [webhook, open]);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Manual validation
        const newErrors: Record<string, string> = {};
        
        if (!name.trim()) {
            newErrors.name = "Please enter a webhook name.";
        }
        
        if (!url.trim()) {
            newErrors.url = "Please enter an endpoint URL.";
        } else {
            try {
                new URL(url);
            } catch {
                newErrors.url = "Please enter a valid URL (e.g., https://example.com).";
            }
        }
        
        if (!timeout || timeout < 1 || timeout > 30) {
            newErrors.timeout = "Timeout must be between 1 and 30 seconds.";
        }
        
        if (selectedEvents.length === 0) {
            newErrors.events = "Please select at least one event.";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        setSubmitting(true);
        try {
            const data = {
                name,
                url,
                enabled,
                retry_enabled: retryEnabled,
                timeout,
                events: selectedEvents
            };

            if (webhook) {
                await updateDeveloperWebhook(webhook.id, data);
                toast.success("Webhook updated successfully");
            } else {
                await createDeveloperWebhook(data);
                toast.success("Webhook created successfully");
            }
            onSuccess();
            onClose();
        } catch (error) {
            toast.error("An error occurred while saving the webhook");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleEvent = (eventName: string) => {
        setSelectedEvents(prev => {
            const newEvents = prev.includes(eventName) 
                ? prev.filter(e => e !== eventName) 
                : [...prev, eventName];
                
            if (newEvents.length > 0 && errors.events) {
                setErrors(prevErrors => ({ ...prevErrors, events: "" }));
            }
            return newEvents;
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <form onSubmit={handleSubmit} noValidate className="relative w-full max-w-2xl max-h-full flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl animate-fade-in-up overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 p-5 sm:p-6 flex-shrink-0 bg-slate-900">
                    <h3 className="text-xl font-bold text-slate-100">
                        {webhook ? "Edit Webhook" : "Create Webhook"}
                    </h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Webhook Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => {
                                    setName(e.target.value);
                                    if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
                                }}
                                className={`w-full rounded-xl border ${errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-sky-500 focus:ring-sky-500'} bg-slate-800/50 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors`}
                                placeholder="e.g., Production Alerts"
                            />
                            {errors.name && <p className="mt-1.5 text-sm text-red-500">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Endpoint URL</label>
                            <input
                                type="text"
                                value={url}
                                onChange={e => {
                                    setUrl(e.target.value);
                                    if (errors.url) setErrors(prev => ({ ...prev, url: "" }));
                                }}
                                className={`w-full rounded-xl border ${errors.url ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-sky-500 focus:ring-sky-500'} bg-slate-800/50 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors`}
                                placeholder="https://api.yourdomain.com/webhooks"
                            />
                            {errors.url && <p className="mt-1.5 text-sm text-red-500">{errors.url}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Timeout (seconds)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={timeout}
                                    onChange={e => {
                                        setTimeoutVal(parseInt(e.target.value) || 0);
                                        if (errors.timeout) setErrors(prev => ({ ...prev, timeout: "" }));
                                    }}
                                    className={`w-full rounded-xl border ${errors.timeout ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-sky-500 focus:ring-sky-500'} bg-slate-800/50 px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 transition-colors`}
                                />
                                {errors.timeout && <p className="mt-1.5 text-sm text-red-500">{errors.timeout}</p>}
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50">
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="text-sm font-medium text-slate-200">Enable Webhook</span>
                                    <p className="text-xs text-slate-400">Receive events at this endpoint</p>
                                </div>
                                <ToggleSwitch checked={enabled} onChange={setEnabled} />
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                                <div>
                                    <span className="text-sm font-medium text-slate-200">Retry Failed Deliveries</span>
                                    <p className="text-xs text-slate-400">Automatically retry using exponential backoff</p>
                                </div>
                                <ToggleSwitch checked={retryEnabled} onChange={setRetryEnabled} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                                Event Selection
                                <AlertCircle className="w-4 h-4 text-slate-500" />
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {WEBHOOK_AVAILABLE_EVENTS.map(eventName => (
                                    <label key={eventName} className={`flex items-center gap-3 p-3 rounded-lg border ${errors.events && selectedEvents.length === 0 ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800 bg-slate-800/30 hover:border-slate-700'} cursor-pointer transition-colors`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedEvents.includes(eventName)}
                                            onChange={() => toggleEvent(eventName)}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
                                        />
                                        <span className="text-sm text-slate-300">{eventName}</span>
                                    </label>
                                ))}
                            </div>
                            {errors.events && <p className="mt-1.5 text-sm text-red-500">{errors.events}</p>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 sm:px-6 sm:py-4 border-t border-slate-800 bg-slate-900 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:shadow-xl hover:shadow-sky-500/40 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        <span>Save Webhook</span>
                    </button>
                </div>
            </form>
        </div>
    );
}