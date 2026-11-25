import { Info, ChevronDown } from "lucide-react";
import type { Incident } from "../../types/incidents";
import { InfoTooltip } from "../common/info-tooltip";

const IMPORTANT_KEYS = new Set([
    "content-type",
    "content-length",
    "cache-control",
    "set-cookie",
    "authorization",
    "strict-transport-security",
    "x-frame-options",
    "x-content-type-options",
    "x-xss-protection",
    "location",
    "server",
    "date",
    "retry-after",
]);

const NOT_IMPORTANT_KEYS = new Set([
    "etag",
    "expires",
    "pragma",
    "vary",
    "connection",
    "keep-alive",
    "accept-ranges",
    "transfer-encoding",
    "cf-cache-status",
    "alt-svc",
]);

function hasEntries(val?: Record<string, any> | any[]): boolean {
    if (!val || typeof val !== "object") return false;
    return Object.keys(val).length > 0;
}

function categorizeRawHeaders(rawHeaders?: Record<string, any>) {
    const important: Record<string, any> = {};
    const notImportant: Record<string, any> = {};
    const extra: Record<string, any> = {};

    if (!rawHeaders || typeof rawHeaders !== "object") {
        return { important, notImportant, extra };
    }

    for (const [key, value] of Object.entries(rawHeaders)) {
        const normalized = key.toLowerCase().trim();
        if (IMPORTANT_KEYS.has(normalized)) {
            important[key] = value;
        } else if (NOT_IMPORTANT_KEYS.has(normalized)) {
            notImportant[key] = value;
        } else {
            extra[key] = value;
        }
    }

    return { important, notImportant, extra };
}

export function IncidentHeaders({ incident }: { incident: Incident }) {
    let important = incident.extra_headers?.categorized_headers?.important;
    let notImportant = incident.extra_headers?.categorized_headers?.not_important;
    let extra = incident.extra_headers?.categorized_headers?.extra;

    const hasCategorized = hasEntries(important) || hasEntries(notImportant) || hasEntries(extra);

    // If categorized_headers is missing or empty, fall back to raw response_headers
    if (!hasCategorized) {
        const rawHeaders = incident.extra_headers?.response_headers || incident.response_headers;
        if (hasEntries(rawHeaders)) {
            const categorized = categorizeRawHeaders(rawHeaders);
            important = categorized.important;
            notImportant = categorized.notImportant;
            extra = categorized.extra;
        }
    }

    const hasAny = hasEntries(important) || hasEntries(notImportant) || hasEntries(extra);
    const failureReason = incident.exception || incident.extra_headers?.exception;

    return (
        <details open className="group rounded-xl border border-slate-800 bg-slate-900 p-5 transition-all">
            <summary className="cursor-pointer text-sm font-semibold text-slate-300 select-none flex items-center justify-between list-none">
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>Response headers</span>
                    <InfoTooltip text="These are the HTTP response headers returned by the server. Key headers may affect how browsers and monitoring tools interpret the response.">
                        <Info className="w-4 h-4 text-slate-400 cursor-pointer" />
                    </InfoTooltip>
                    <span className="text-xs text-slate-500 font-normal">(debug information)</span>
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
            </summary>

            <div className="mt-4 grid grid-cols-1 gap-4">
                <RenderHeaders
                    headers={important}
                    label="Key headers"
                    icon={<span>⚡</span>}
                />

                <RenderHeaders
                    headers={notImportant}
                    label="Standard headers"
                    icon={<span>📋</span>}
                />
                <RenderHeaders
                    headers={extra}
                    label="Extra headers"
                    icon={<span>📦</span>}
                />
                {!hasAny && (
                    <div className="text-xs text-slate-400 py-2 px-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                        {failureReason ? (
                            <span>
                                No response headers captured (detection failed with: <code className="text-amber-300 font-mono">{failureReason.trim()}</code>)
                            </span>
                        ) : (
                            <span>No response headers recorded for this incident.</span>
                        )}
                    </div>
                )}
            </div>
        </details>
    );
}

// Helper to render categorized headers
function RenderHeaders({ headers, label, icon }: { headers?: Record<string, any>, label: string, icon: React.ReactNode }) {
    if (!hasEntries(headers)) return null;
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 max-h-56 overflow-auto">
            <div className="mb-2 text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <span>{icon}</span>
                {label}
            </div>
            <div className="space-y-1 text-xs">
                {Object.entries(headers!).map(([k, v]) => (
                    <div key={k} className="flex gap-2 py-0.5">
                        <span className="w-32 sm:w-36 shrink-0 text-sky-400 font-medium">{k}</span>
                        <span className="text-slate-300 break-all whitespace-pre-wrap flex-1">{Array.isArray(v) ? v.join(", ") : String(v)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
