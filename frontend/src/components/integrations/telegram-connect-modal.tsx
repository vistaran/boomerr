import { AlertCircle, ExternalLink, MessageCircle } from "lucide-react";
import { createPortal } from "react-dom";
import type { DomainIntegration } from "../../types/domain-integrations";
import { useEffect, useState } from "react";
import { api } from "../../api";
import toast from "react-hot-toast";

export function TelegramConnectModal({
    onClose,
    onConnected,
    selectedProvider,
    domainId,
    reconnectingWebhook,
}: {
    onClose: () => void;
    onConnected: () => void;
    selectedProvider: DomainIntegration;
    domainId: string;
    reconnectingWebhook?: any;
}) {
    const [events, setEvents] = useState<string[]>(reconnectingWebhook?.events || ['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired']);
    const [step, setStep] = useState<"setup" | "connecting">("setup");
    const [loading, setLoading] = useState(false);
    const [connectionData, setConnectionData] = useState<{ url: string; token: string } | null>(null);

    // Escape key to close
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape" && step === "setup") {
                onClose();
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [onClose, step]);

    // Polling for connection status
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;

        if (step === "connecting" && connectionData?.token) {
            interval = setInterval(async () => {
                try {
                    const res = await api.get<any>(`/integrations/telegram/status/${connectionData.token}`);
                    if (res.status === 'connected') {
                        clearInterval(interval);
                        toast.success("Telegram connected successfully!");
                        onConnected();
                    } else if (res.status === 'expired') {
                        clearInterval(interval);
                        toast.error("Connection token expired. Please try again.");
                        setStep("setup");
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 3000);
        }

        return () => clearInterval(interval);
    }, [step, connectionData, onConnected]);

    const handleConnect = async () => {
        setLoading(true);
        try {
            const res = await api.post<any>(`/domains/${domainId}/integrations/telegram/connect`, {
                integration_ulid: selectedProvider.ulid ?? selectedProvider.id,
                events: events,
                reconnect_channel_ulid: reconnectingWebhook?.ulid ?? undefined,
            });

            setConnectionData(res);
            setStep("connecting");
        } catch (e: any) {
            toast.error(e.message || "Failed to generate connection link");
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 animate-fade-in mt-20 2xl:mt-40">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/90 animate-fade-in" onClick={() => step === "setup" && onClose()} />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-7 shadow-2xl animate-scale-in">
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="rounded-lg bg-gradient-to-br from-[#0088cc] to-sky-500 p-2 shadow-lg shadow-sky-500/20">
                            <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-50">
                            Connect Telegram
                        </h2>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        {step === "setup"
                            ? "Configure your alert preferences to connect Telegram."
                            : "Waiting for you to start the bot in Telegram."}
                    </p>
                </div>

                {step === "setup" ? (
                    <div className="space-y-5">
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
                                            checked={events.includes(eventName)}
                                            onChange={() => {
                                                if (events.includes(eventName)) {
                                                    setEvents(events.filter(e => e !== eventName));
                                                } else {
                                                    setEvents([...events, eventName]);
                                                }
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
                                className="rounded-lg border border-slate-700 bg-slate-800/50 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all duration-200"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleConnect}
                                disabled={loading || events.length === 0}
                                className="rounded-lg bg-gradient-to-r from-[#0088cc] to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:shadow-xl hover:shadow-sky-500/40 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                {loading ? "Generating..." : "Connect Telegram"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 text-center">
                        <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/10 text-left space-y-3">
                            <h3 className="font-semibold text-sky-400">Connection Instructions:</h3>
                            <ol className="list-decimal list-inside text-sm text-slate-300 space-y-2">
                                <li>Click the button below to open Telegram.</li>
                                <li>Select a chat or group and click <b>Start</b>.</li>
                                <li>Return to this page when finished.</li>
                            </ol>
                        </div>

                        <a
                            href={connectionData?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-[#0088cc] to-sky-500 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-sky-500/25 hover:shadow-xl hover:!text-white hover:shadow-sky-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                        >
                            Open in Telegram <ExternalLink className="w-4 h-4" />
                        </a>

                        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mt-4">
                            <svg className="animate-spin h-4 w-4 text-sky-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Waiting for connection...
                        </div>

                        <button
                            onClick={() => setStep("setup")}
                            className="text-md bg-slate-800 border border-slate-600 px-3 py-1 rounded-xl text-slate-300 hover:text-slate-300 hover:bg-slate-700 hover:border-slate-500 transition-colors mt-2"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
