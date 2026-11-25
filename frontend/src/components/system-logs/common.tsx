import { AlertCircle, AlertTriangle, ChevronRight, Globe, Info, MessageCircle, RefreshCcw, Zap } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { SystemLogEntry } from "../../hooks";
import { INTEGRATION_CONFIG } from "./config/integration-config";
import { UnknownIntegrationIcon } from "./icons/integration-icons";
import { STATUS_STYLES } from "./config/status-styles";
import { InfoTooltip } from "../common/info-tooltip";


type LogTreeItemProps = {
    log: SystemLogEntry;
    isExpanded: boolean;
    onToggle: () => void;
};


type IntegrationBadgeDescriptor = {
    key: string;
    count?: number;
};


function buildIntegrationBadges(log: SystemLogEntry): IntegrationBadgeDescriptor[] {
    const entries = new Map<string, IntegrationBadgeDescriptor>();

    if (Array.isArray(log.children) && log.children.length > 0) {
        log.children.forEach((child) => {
            if (child.integration_key) {
                const normalized = child.integration_key.trim().toLowerCase();
                if (!entries.has(normalized)) {
                    entries.set(normalized, { key: normalized });
                }
            }
        });
    }

    if (!entries.size) {
        const key = log.integration_key ?? log.notification_channel?.type;
        if (key) {
            const normalized = key.trim().toLowerCase();
            entries.set(normalized, { key: normalized });
        }
    }

    return Array.from(entries.values());
}

function formatRelative(value: string): string {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return value;
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 1) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export const ChildExecutionCard = ({ child }: { child: NonNullable<SystemLogEntry['children']>[number] }) => {
    const statusStyle = STATUS_STYLES[child.execution_status] ?? STATUS_STYLES.info;
    const normalizedKey = child.integration_key?.toLowerCase() ?? 'unknown';
    const cfg = INTEGRATION_CONFIG[normalizedKey];
    const lifecycle = child.lifecycle ?? {
        triggered_at: null,
        completed_at: null,
        duration_ms: null,
        execution_status: child.execution_status,
    };

    return (
        <div className="rounded-lg border border-slate-800/70 bg-slate-900/50 py-3 px-4">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    {cfg ? (
                        <cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    ) : (
                        <MessageCircle className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <div>
                        <p className="text-sm text-slate-100 font-medium">
                            {cfg?.label ?? (child.integration_key ?? 'Integration')}
                        </p>
                        <p className="text-[11px] text-slate-400">{child.event_type}</p>
                    </div>
                </div>
                <span className={`text-[11px] uppercase font-semibold ${statusStyle.color}`}>
                    {child.execution_status}
                </span>
            </div>

            {child.message && (
                <p className="mt-2 text-xs text-slate-300">{child.message}</p>
            )}

            <div className="mt-2 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
                {child.recipient?.to && (
                    <div>
                        <span className="text-slate-400">Recipient:</span>{' '}
                        <span className="text-slate-200">{child.recipient.to}</span>
                    </div>
                )}
                {(child.recipient?.webhook_name || child.notification_channel?.name) && !child.recipient?.to && (
                    <div>
                        <span className="text-slate-400">Target:</span>{' '}
                        <span className="text-slate-200">{child.recipient?.webhook_name ?? child.notification_channel?.name}</span>
                    </div>
                )}
                {child.recipient?.task_name && (
                    <div>
                        <span className="text-slate-400">Task:</span>{' '}
                        <span className="text-slate-200">{child.recipient.task_name}</span>
                    </div>
                )}
                {child.response_time_ms !== null && (
                    <div>
                        <span className="text-slate-400">Response:</span>{' '}
                        <span className="text-slate-200">{child.response_time_ms}ms</span>
                    </div>
                )}
                {lifecycle.triggered_at && (
                    <div>
                        <span className="text-slate-400">Triggered:</span>{' '}
                        <span className="text-slate-200">{formatDateTime(lifecycle.triggered_at) ?? '-'}</span>
                    </div>
                )}
                {lifecycle.completed_at && (
                    <div>
                        <span className="text-slate-400">Completed:</span>{' '}
                        <span className="text-slate-200">{formatDateTime(lifecycle.completed_at) ?? '-'}</span>
                    </div>
                )}
            </div>

            {(child.error_code || child.error_message) && (
                <div className="mt-2 rounded border border-rose-500/40 bg-rose-950/20 p-2 text-[11px] text-rose-200">
                    {child.error_code && (
                        <div className="font-semibold">Error code: {child.error_code}</div>
                    )}
                    {child.error_message && <div>{child.error_message}</div>}
                </div>
            )}
        </div>
    );
};


export const LogTreeItem = ({ log, isExpanded, onToggle }: LogTreeItemProps) => {
    const statusStyle = STATUS_STYLES[log.execution_status] ?? STATUS_STYLES.info;
    const integrationIcons = useMemo(() => {
        const keys = new Set<string>();
        (log.children ?? []).forEach((child) => {
            if (child.integration_key) {
                keys.add(child.integration_key.toLowerCase());
            }
        });
        if (!keys.size && log.integration_key) {
            keys.add(log.integration_key.toLowerCase());
        }
        return Array.from(keys);
    }, [log.children, log.integration_key]);

    const eventLabel = log.event_type
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' → ');

    const summary = log.children_summary;
    const children = log.children ?? [];
    const domainChannels = log.domain_notification_channels;
    const domainChannelTypes = Object.entries(domainChannels?.by_type ?? {});

    const integrationBadges = useMemo(
        () => buildIntegrationBadges(log),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [log, integrationIcons]
    );

    return (
        <div className="group hover:bg-slate-800/70 border-b border-slate-700 transition-colors">
            <button
                onClick={onToggle}
                className="w-full text-left p-2.5 !outline-none"
            >
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <ChevronRight
                                size={14}
                                className={`flex-shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            />
                            <span className={`flex-shrink-0 ${statusStyle.color}`}>
                                {statusStyle.icon}
                            </span>
                            <span className="flex text-sm font-medium text-slate-200 truncate">
                                {eventLabel}
                            </span>
                            {integrationBadges.length > 0 && (
                                <IntegrationBadgeGroup badges={integrationBadges} />
                            )}
                            {summary && (
                                <span className="text-[11px] text-slate-400 font-medium">
                                    {summary.total} integrations
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>{formatRelative(log.occurred_at)}</span>
                        </div>
                    </div>
                    <div className="pl-6 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        {log.domain && (
                            <span className="flex items-center gap-1 text-slate-300">
                                <Globe size={10} className="text-slate-600" />
                                {log.domain.url ?? log.domain.name}
                            </span>
                        )}
                        <span>Occurred: {formatDateTime(log.occurred_at) ?? '-'}</span>
                        {log.correlation_id && (
                            <span>Correlation: <span className="font-mono text-[10px] text-slate-400">{log.correlation_id}</span></span>
                        )}
                        {log.notification_channel && (
                            <span className="flex items-center gap-1 text-slate-400">
                                <Zap size={10} className="text-emerald-400" />
                                {log.notification_channel.name ?? log.notification_channel.type ?? 'Channel'}
                            </span>
                        )}
                    </div>
                </div>
            </button>

            {isExpanded && (
                <div className="ml-4 pb-4 pl-4 bg-slate-900/20 rounded-lg">
                    <div className="grid gap-3 lg:grid-cols-2 mr-4">
                        {summary && (
                            <SectionBlock
                                title="INTEGRATION EXECUTION SUMMARY"
                                icon={<AlertTriangle size={12} />}
                                color="text-sky-400"
                                tooltipText="Summary of all notification integrations triggered for this event, including success, failure, skipped, and pending executions."
                            >
                                <div className="flex flex-wrap gap-3 text-[11px] text-slate-300">
                                    <span>Total: {summary.total}</span>
                                    <span className="text-emerald-300">Success: {summary.success}</span>
                                    <span className="text-rose-300">Failure: {summary.failure}</span>
                                    <span className="text-slate-300">Skipped: {summary.skipped}</span>
                                    <span className="text-amber-300">Pending: {summary.pending}</span>
                                </div>
                                {summary.by_integration && Object.keys(summary.by_integration).length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                                        {Object.entries(summary.by_integration).map(([key, breakdown]) => {
                                            const normalized = (key ?? 'unknown').trim().toLowerCase();
                                            const cfg = INTEGRATION_CONFIG[normalized];
                                            const Icon = cfg?.icon ?? UnknownIntegrationIcon;
                                            return (
                                                <span
                                                    key={key}
                                                    className="flex items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5"
                                                >
                                                    <Icon className={`w-3 h-3 ${cfg?.color ?? 'text-slate-400'}`} />
                                                    <span className="text-slate-200 capitalize">{cfg?.label ?? key ?? 'Unknown'}</span>
                                                    <span className="text-emerald-300">{breakdown.success}</span>
                                                    /
                                                    <span className="text-rose-300">{breakdown.failure}</span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </SectionBlock>
                        )}

                        <SectionBlock
                            title="Lifecycle"
                            icon={<RefreshCcw size={12} />}
                            color="text-slate-400"
                            tooltipText="Timeline of this event execution, including when it started, completed, and how long it took."
                        >
                            <TreeLeaf>
                                <span className="text-slate-400 text-xs">Triggered:</span>
                                <span className="text-slate-300 text-xs">{formatDateTime(log.lifecycle?.triggered_at) ?? '-'}</span>
                            </TreeLeaf>
                            <TreeLeaf>
                                <span className="text-slate-400 text-xs">Completed:</span>
                                <span className="text-slate-300 text-xs">{formatDateTime(log.lifecycle?.completed_at) ?? '-'}</span>
                            </TreeLeaf>
                            <TreeLeaf>
                                <span className="text-slate-400 text-xs">Duration:</span>
                                <span className="text-slate-300 text-xs">{log.lifecycle?.duration_ms ?? '-'} ms</span>
                            </TreeLeaf>
                            <TreeLeaf>
                                <span className="text-slate-400 text-xs">Execution status:</span>
                                <span className={`text-xs font-semibold uppercase ${statusStyle.color}`}>
                                    {log.execution_status}
                                </span>
                            </TreeLeaf>
                        </SectionBlock>

                        <SectionBlock
                            title="Integration Executions"
                            icon={<Zap size={12} />}
                            color="text-emerald-400"
                            className="lg:col-span-2"
                            tooltipText="Detailed execution status for each notification integration triggered by this event."
                        >
                            {children.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {children.map((child) => (
                                            <ChildExecutionCard key={child.id} child={child} />
                                        ))}
                                    </div>
                                </div>
                            ) : (log.integration_key || log.notification_channel || log.event_type === 'webhook.dispatch') ? (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <ChildExecutionCard
                                            child={{
                                                id: log.id,
                                                log_type: log.log_type,
                                                integration_key: log.integration_key ?? log.notification_channel?.type ?? 'webhook',
                                                event_type: log.event_type,
                                                source: log.source,
                                                trigger_source: log.trigger_source ?? null,
                                                status: log.status,
                                                execution_status: log.execution_status,
                                                message: log.message,
                                                response_time_ms: log.response_time_ms,
                                                error_code: log.error_code,
                                                error_message: log.error_message,
                                                integration_metadata: log.integration_metadata,
                                                payload: log.payload,
                                                lifecycle: log.lifecycle,
                                                triggered_at: log.triggered_at,
                                                completed_at: log.completed_at,
                                                occurred_at: log.occurred_at,
                                                notification_channel: log.notification_channel ?? null,
                                                integration: log.integration ?? null,
                                                actor: log.actor ? { name: log.actor.name, email: log.actor.email } : null,
                                                recipient: log.recipient,
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <TreeLeaf>
                                    <span className="text-xs text-slate-400">
                                        No integration executions recorded for this event.
                                    </span>
                                </TreeLeaf>
                            )}
                        </SectionBlock>

                        <SectionBlock
                            title="Context"
                            tooltipText="Additional context related to this event, such as domain details, timestamps, source, and actor information."
                            icon={<Globe size={12} />}
                            color="text-amber-400"
                            className="lg:col-span-2"
                        >
                            {log.message && (
                                <TreeLeaf>
                                    <span className="text-slate-400 text-xs">Message:</span>
                                    <span className="text-slate-300 text-xs">{log.message}</span>
                                </TreeLeaf>
                            )}
                            {log.domain && (
                                <TreeLeaf>
                                    <span className="text-slate-400 text-xs">Domain:</span>
                                    <span className="text-slate-300 text-xs">{log.domain.name}</span>
                                </TreeLeaf>
                            )}
                            <TreeLeaf>
                                <span className="text-slate-400 text-xs">Occurred:</span>
                                <span className="text-slate-300 text-xs">{formatDateTime(log.occurred_at) ?? '-'}</span>
                            </TreeLeaf>
                            {log.source && (
                                <TreeLeaf>
                                    <span className="text-slate-400 text-xs">Source:</span>
                                    <span className="text-slate-300 text-xs">{log.source}</span>
                                </TreeLeaf>
                            )}
                            {log.category && (
                                <TreeLeaf>
                                    <span className="text-slate-400 text-xs">Category:</span>
                                    <span className="text-slate-300 text-xs">{log.category}</span>
                                </TreeLeaf>
                            )}
                            <TreeLeaf>
                                <span className="text-slate-400 text-xs">Correlation:</span>
                                <span className="text-slate-300 text-xs">{log.correlation_id ?? '-'}</span>
                            </TreeLeaf>
                            {log.actor?.name && (
                                <TreeLeaf>
                                    <span className="text-slate-400 text-xs">Actor:</span>
                                    <span className="text-slate-300 text-xs">{log.actor.name}</span>
                                </TreeLeaf>
                            )}
                            {log.actor?.email && (
                                <TreeLeaf>
                                    <span className="text-slate-400 text-xs">Email:</span>
                                    <span className="text-slate-300 text-xs">{log.actor.email}</span>
                                </TreeLeaf>
                            )}
                        </SectionBlock>

                        {log.error_message && (
                            <SectionBlock
                                title="Parent Error"
                                icon={<AlertCircle size={12} />}
                                color="text-rose-400"
                                collapsible
                                defaultOpen={false}
                                className="lg:col-span-2"
                                tooltipText="Error details from the parent event that caused one or more integration executions to fail."
                            >
                                <div className="rounded border border-rose-600/40 bg-rose-950/40 p-2 text-xs text-rose-200 break-words">{log.error_message}</div>
                            </SectionBlock>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const IntegrationBadgeGroup = ({ badges }: { badges: IntegrationBadgeDescriptor[] }) => {
    if (!badges.length) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-1">
            {badges.map(({ key, count }) => {
                const cfg = INTEGRATION_CONFIG[key];
                const Icon = cfg?.icon ?? UnknownIntegrationIcon;
                return (
                    <span
                        key={key}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-900/40 px-2 py-1"
                    >
                        <Icon className={`w-4 h-4 ${cfg?.color ?? 'text-slate-400'}`} />
                        {typeof count === 'number' && count > 1 && (
                            <span className="text-[10px] text-slate-400 font-semibold">×{count}</span>
                        )}
                    </span>
                );
            })}
        </div>
    );
};

const SectionBlock = ({
    title,
    icon,
    color,
    children,
    collapsible = false,
    defaultOpen = true,
    className,
    tooltipText
}: {
    title: string;
    icon: ReactNode;
    color: string;
    children: ReactNode;
    collapsible?: boolean;
    defaultOpen?: boolean;
    className?: string;
    tooltipText: string;
}) => {
    const [open, setOpen] = useState(defaultOpen);
    const Wrapper = collapsible ? 'button' : 'div';

    return (
        <div className={`border border-slate-700/70 rounded-md p-2 bg-slate-950/60 ${className ?? ''}`}>
            <Wrapper
                type={collapsible ? 'button' : undefined}
                className={`flex items-center gap-2 w-full text-left !outline-none ${collapsible ? 'hover:text-slate-100 transition-colors' : ''}`}
                onClick={collapsible ? () => setOpen((prev) => !prev) : undefined}
            >
                {collapsible && (
                    <ChevronRight
                        size={12}
                        className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
                    />
                )}
                <span className={`${color}`}>{icon}</span>
                <span className="text-sm uppercase tracking-wide text-slate-300 font-bold">{title}</span>
                <InfoTooltip text={tooltipText}>
                    <Info className="w-3 h-3 ml-1 text-slate-400 cursor-pointer" />
                </InfoTooltip>
            </Wrapper>
            {(!collapsible || open) && <div className="space-y-1 mt-1">{children}</div>}
        </div>
    );
};
const TreeLeaf = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-start gap-1 text-sm">
        <span className="text-slate-600 pointer-events-none cursor-default select-none">└─</span>
        <div className="flex gap-1.5 flex-wrap items-center">
            {children}
        </div>
    </div>
);

function formatDateTime(value?: string | null): string | null {
    if (!value) {
        return null;
    }
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        return null;
    }
    const localTime = new Date(timestamp).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const utcTime = new Date(timestamp).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'UTC',
    });
    return localTime;
}