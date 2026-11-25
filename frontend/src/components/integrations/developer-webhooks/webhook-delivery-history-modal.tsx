import { useState, useEffect } from "react";
import { X, RefreshCcw, ChevronDown, ChevronRight, CheckCircle2, XCircle, FileJson, FileCode2, Maximize2, Copy, Table } from "lucide-react";
import { getDeveloperWebhookDeliveries } from "../../../services/developer-webhooks-service";
import type { DeveloperWebhook, WebhookDelivery } from "../../../types/developer-webhooks";
import DateTimeDisplay from "../../common/date-time-display";

import { getIntegrationDeliveries } from "../../../services/integrations-service";

interface Props {
    open: boolean;
    onClose: () => void;
    webhook?: DeveloperWebhook;
    integrationType?: string;
    integrationId?: string | number;
    title?: string;
    subtitle?: string;
}

const jsonToXml = (obj: any, rootName = 'payload') => {
    let xml = '';

    const convert = (data: any, name: string, indent: number) => {
        const spaces = '  '.repeat(indent);

        if (data === null || data === undefined) {
            xml += `${spaces}<${name}></${name}>\n`;
            return;
        }

        if (typeof data !== 'object') {
            const escapedStr = String(data).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            xml += `${spaces}<${name}>${escapedStr}</${name}>\n`;
            return;
        }

        if (Array.isArray(data)) {
            data.forEach(item => {
                convert(item, name, indent);
            });
            return;
        }

        xml += `${spaces}<${name}>\n`;
        for (const key in data) {
            // Basic sanitization for XML element names
            const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
            // Ensure safeKey doesn't start with a number
            const finalKey = /^[0-9]/.test(safeKey) ? `_${safeKey}` : safeKey;
            convert(data[key], finalKey, indent + 1);
        }
        xml += `${spaces}</${name}>\n`;
    };

    xml += `<?xml version="1.0" encoding="UTF-8"?>\n`;
    convert(obj, rootName, 0);
    return xml.trim();
};

const VisualPayloadRenderer = ({ data, level = 0 }: { data: any, level?: number }) => {
    if (typeof data !== 'object' || data === null) {
        return <span className="text-slate-200 text-xs break-all">{String(data)}</span>;
    }

    return (
        <div className={`flex flex-col ${level > 0 ? 'mt-1 pl-3 sm:pl-4 border-l border-slate-700/50' : ''}`}>
            {Object.entries(data).map(([key, value]) => {
                const isObject = typeof value === 'object' && value !== null;
                return (
                    <div key={key} className={`flex ${isObject ? 'flex-col' : 'flex-col sm:flex-row sm:items-start'} py-0.5 gap-1 sm:gap-2 border-b border-slate-800/30 last:border-0`}>
                        <span className={`text-slate-400 text-[11px] uppercase tracking-wide font-semibold shrink-0 pt-0.5 ${!isObject ? 'sm:w-28' : ''}`}>
                            {key.replace(/_/g, ' ')}
                        </span>
                        <div className="flex-1 min-w-0">
                            {isObject ? (
                                <VisualPayloadRenderer data={value} level={level + 1} />
                            ) : (
                                <span className="text-slate-200 text-[13px] break-all leading-tight">
                                    {String(value)}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export function WebhookDeliveryHistoryModal({ open, onClose, webhook, integrationType, integrationId, title, subtitle }: Props) {
    const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [payloadFormat, setPayloadFormat] = useState<'Visual' | 'JSON' | 'XML'>('Visual');

    const handleOpenRaw = (payload: any, format: 'Visual' | 'JSON' | 'XML') => {
        const targetFormat = format === 'Visual' ? 'JSON' : format;
        const content = targetFormat === 'XML' ? jsonToXml(payload) : JSON.stringify(payload, null, 2);
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write(`<html><head><title>Raw Payload (${format})</title></head><body style="background:#0f172a; color:#cbd5e1; font-family:monospace; padding:20px; white-space:pre-wrap;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>`);
            newWindow.document.close();
        }
    };

    const loadDeliveries = async (pageNum: number) => {
        try {
            setLoading(true);
            let response;
            
            if (integrationType && integrationId) {
                response = await getIntegrationDeliveries(integrationType, integrationId, pageNum);
            } else if (webhook) {
                response = await getDeveloperWebhookDeliveries(webhook.id, pageNum);
            } else {
                return;
            }

            if (pageNum === 1) {
                setDeliveries(response.data);
            } else {
                setDeliveries(prev => [...prev, ...response.data]);
            }
            setHasMore(response.current_page < response.last_page);
        } catch (error) {
            console.error("Failed to load deliveries", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            setPage(1);
            loadDeliveries(1);
        }
    }, [open, webhook?.id, integrationId]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        loadDeliveries(nextPage);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl animate-fade-in-up">
                <div className="flex items-center justify-between border-b border-slate-800 p-6 shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                            {title || 'Delivery History'}
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">{subtitle || (webhook ? `${webhook.name} • ${webhook.url}` : '')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setPage(1); loadDeliveries(1); }} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pb-12">
                    {deliveries.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <p>No delivery history found.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {deliveries.map(delivery => (
                                <div key={delivery.id} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                                    <div
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                                        onClick={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            {delivery.status === 'success' ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-rose-500" />
                                            )}

                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-200">{delivery.event_name}</span>
                                                <span className="text-xs text-slate-500">
                                                    <DateTimeDisplay value={delivery.created_at} />
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 text-sm">
                                            <div className="flex flex-col items-end">
                                                <span className={`font-mono font-medium ${delivery.http_status && delivery.http_status >= 200 && delivery.http_status < 300
                                                        ? 'text-emerald-400'
                                                        : 'text-rose-400'
                                                    }`}>
                                                    {delivery.http_status || 'ERR'}
                                                </span>
                                                <span className="text-xs text-slate-500">{delivery.duration_ms ?? 0}ms</span>
                                            </div>

                                            {expandedId === delivery.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                        </div>
                                    </div>

                                    {expandedId === delivery.id && (
                                        <div className="border-t border-slate-800 bg-slate-950/50 p-4 space-y-6">
                                            <div className="flex flex-col gap-6">
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Request Payload</h4>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center bg-slate-800 rounded-md p-0.5">
                                                                <button
                                                                    onClick={() => setPayloadFormat('Visual')}
                                                                    className={`px-2 py-1 text-[10px] font-medium rounded-sm flex items-center gap-1 transition-colors ${payloadFormat === 'Visual' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                                                                >
                                                                    <Table size={12} />
                                                                    Visual
                                                                </button>
                                                                <button
                                                                    onClick={() => setPayloadFormat('JSON')}
                                                                    className={`px-2 py-1 text-[10px] font-medium rounded-sm flex items-center gap-1 transition-colors ${payloadFormat === 'JSON' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                                                                >
                                                                    <FileJson size={12} />
                                                                    JSON
                                                                </button>
                                                                <button
                                                                    onClick={() => setPayloadFormat('XML')}
                                                                    className={`px-2 py-1 text-[10px] font-medium rounded-sm flex items-center gap-1 transition-colors ${payloadFormat === 'XML' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}
                                                                >
                                                                    <FileCode2 size={12} />
                                                                    XML
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={() => handleOpenRaw(delivery.request_payload, payloadFormat)}
                                                                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                                                                title={`Open raw ${payloadFormat} in new window`}
                                                            >
                                                                <Maximize2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {payloadFormat === 'Visual' ? (
                                                        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 overflow-x-auto">
                                                            <VisualPayloadRenderer data={delivery.request_payload} />
                                                        </div>
                                                    ) : (
                                                        <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono overflow-x-auto">
                                                            {payloadFormat === 'JSON'
                                                                ? JSON.stringify(delivery.request_payload, null, 2)
                                                                : jsonToXml(delivery.request_payload)
                                                            }
                                                        </pre>
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Response Body</h4>
                                                    <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto">
                                                        {delivery.response_body || 'No response body'}
                                                    </pre>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Response Headers</h4>
                                                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 overflow-x-auto">
                                                    {delivery.response_headers && typeof delivery.response_headers === 'object' ? (
                                                        <ul className="text-[11px] sm:text-xs space-y-1.5 text-slate-300 font-mono">
                                                            {Object.entries(delivery.response_headers).map(([key, value]) => (
                                                                <li key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 border-b border-slate-800/30 last:border-0 pb-1.5 last:pb-0">
                                                                    <span className="text-sky-300 font-semibold shrink-0 sm:w-48">{key}:</span>
                                                                    <span className="text-slate-300 break-all">{Array.isArray(value) ? value.join(', ') : String(value)}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <span className="text-xs text-slate-500 font-mono">No headers</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center justify-between">
                                                <span>Attempt {delivery.attempt} / 5</span>
                                                <span>Delivery ID: {delivery.id}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {hasMore && (
                                <div className="pt-4 text-center">
                                    <button
                                        onClick={handleLoadMore}
                                        disabled={loading}
                                        className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                                    >
                                        {loading ? 'Loading...' : 'Load More'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}