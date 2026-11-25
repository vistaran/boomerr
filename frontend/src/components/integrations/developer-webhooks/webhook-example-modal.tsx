import { X, Webhook, Copy, Check } from "lucide-react";
import { useEffect, useState } from "react";

export function WebhookExampleModal({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (open) window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    const [activeTab, setActiveTab] = useState<'DOMAIN_DOWN' | 'DOMAIN_UP' | 'SSL_EXPIRING' | 'SSL_EXPIRED' | 'TEST'>('DOMAIN_DOWN');
    const [copied, setCopied] = useState(false);

    if (!open) return null;

    const basePayload = {
        event_id: "evt_01h5x2mqp7k9zw8rf4yv3t5q6j",
        timestamp: new Date().toISOString(),
        workspace: {
            ulid: "01h45y9zqw2x8f1t7k6p3m5n9r",
            name: "Acme Corp"
        },
        monitor: {
            ulid: "mon_01h6t4k8z9r2p7m5n3x1w8f2q5",
            name: "Production API",
            url: "https://api.acme.com",
            environment: "production"
        }
    };

    const payloads: Record<string, any> = {
        DOMAIN_DOWN: {
            ...basePayload,
            event: "DOMAIN_DOWN",
            incident: {
                ulid: "inc_01h7v2p5x8m3n9k4r6t1w5q8j2",
                status: "open",
                started_at: new Date().toISOString(),
            },
            response: {
                status_code: 503,
                status_text: "Service Unavailable",
                response_time_ms: 1250
            }
        },
        DOMAIN_UP: {
            ...basePayload,
            event: "DOMAIN_UP",
            incident: {
                ulid: "inc_01h7v2p5x8m3n9k4r6t1w5q8j2",
                status: "resolved",
                started_at: new Date(Date.now() - 3600000).toISOString(),
                resolved_at: new Date().toISOString(),
                duration_seconds: 3600
            },
            response: {
                status_code: 200,
                status_text: "OK",
                response_time_ms: 145
            }
        },
        SSL_EXPIRING: {
            ...basePayload,
            event: "SSL_EXPIRING",
            ssl: {
                issuer: "Let's Encrypt",
                valid_from: new Date(Date.now() - 7776000000).toISOString(),
                valid_to: new Date(Date.now() + 604800000).toISOString(),
                days_remaining: 7
            }
        },
        SSL_EXPIRED: {
            ...basePayload,
            event: "SSL_EXPIRED",
            ssl: {
                issuer: "Let's Encrypt",
                valid_from: new Date(Date.now() - 7776000000).toISOString(),
                valid_to: new Date(Date.now() - 86400000).toISOString(),
                days_remaining: 0
            }
        },
        TEST: {
            event: "TEST",
            timestamp: new Date().toISOString(),
            message: "This is a test webhook from Boomerr Monitoring."
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(payloads[activeTab], null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Very simple JSON colorizer
    const colorizeJson = (jsonObj: any) => {
        const jsonStr = JSON.stringify(jsonObj, null, 2);
        const lines = jsonStr.split('\n');
        return lines.map((line, i) => {
            // Basic regex for JSON highlighting
            const match = line.match(/^(\s*)(".*":\s*)(.*)(,?)$/);
            if (match) {
                const [, indent, keyPart, valPart, comma] = match;
                
                let valueColor = "text-sky-300"; // strings
                if (valPart.trim() === "{" || valPart.trim() === "[") {
                    valueColor = "text-slate-300";
                } else if (!valPart.startsWith('"')) {
                    valueColor = "text-sky-400"; // numbers/booleans
                }

                return (
                    <div key={i} className="flex hover:bg-slate-800/50 px-4">
                        <div className="w-8 flex-shrink-0 text-slate-600 select-none text-right pr-4 border-r border-slate-700/50 mr-4">
                            {i + 1}
                        </div>
                        <div className="whitespace-pre">
                            {indent}
                            <span className="text-emerald-400">{keyPart}</span>
                            <span className={valueColor}>{valPart}</span>
                            <span className="text-slate-400">{comma}</span>
                        </div>
                    </div>
                );
            }
            return (
                <div key={i} className="flex hover:bg-slate-800/50 px-4">
                    <div className="w-8 flex-shrink-0 text-slate-600 select-none text-right pr-4 border-r border-slate-700/50 mr-4">
                        {i + 1}
                    </div>
                    <div className="whitespace-pre text-slate-300">{line}</div>
                </div>
            );
        });
    };

    const tabs = [
        { id: 'DOMAIN_DOWN', label: 'Domain Down' },
        { id: 'DOMAIN_UP', label: 'Domain Up' },
        { id: 'SSL_EXPIRING', label: 'SSL Expiring' },
        { id: 'SSL_EXPIRED', label: 'SSL Expired' },
        { id: 'TEST', label: 'Test Event' },
    ] as const;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto" onClick={onClose}>
            <div className="min-h-full flex items-center justify-center p-4 sm:p-6 py-12">
                <div
                    className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col relative animate-fade-in-up"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/50 rounded-t-2xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400 shadow-inner">
                                <Webhook size={20} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-100 tracking-tight">Webhook Payload Reference</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-8">
                        
                        {/* HTTP Request Section */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                                HTTP Request
                            </h4>
                            <div className="bg-[#0d1117] rounded-xl border border-slate-800 p-5 font-mono text-sm shadow-inner relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
                                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-800/60">
                                    <span className="text-emerald-400 font-bold">POST</span>
                                    <span className="text-slate-300">/your-webhook-endpoint</span>
                                </div>
                                <ul className="space-y-1.5 text-slate-400">
                                    <li><span className="text-sky-300 font-medium">Content-Type:</span> application/json</li>
                                    <li><span className="text-sky-300 font-medium">User-Agent:</span> Boomerr-Webhooks/1.0</li>
                                    <li><span className="text-sky-300 font-medium">X-Webhook-Event:</span> {activeTab}</li>
                                    <li><span className="text-sky-300 font-medium">X-Webhook-Signature:</span> &lt;hmac_sha256_signature&gt;</li>
                                </ul>
                            </div>
                        </div>

                        {/* Event Selector */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-200">Event Payload</h4>
                            <div className="flex flex-wrap gap-2">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                                            activeTab === tab.id 
                                                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 border-transparent' 
                                                : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* JSON Viewer */}
                        <div className="bg-[#0d1117] rounded-xl border border-slate-800 overflow-hidden relative group shadow-inner">
                            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-900/50">
                                <div className="text-xs text-slate-500 font-mono font-medium tracking-wider">
                                    JSON
                                </div>
                                <button 
                                    onClick={handleCopy}
                                    className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded-md flex items-center gap-2 text-xs font-medium"
                                >
                                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <div className="py-4 text-[13px] font-mono leading-relaxed overflow-x-auto">
                                {colorizeJson(payloads[activeTab])}
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 rounded-b-2xl flex-shrink-0">
                        <p className="text-xs text-slate-400 text-center leading-relaxed">
                            Boomerr sends webhook requests via HTTP POST. Failed deliveries are automatically retried using exponential backoff.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
