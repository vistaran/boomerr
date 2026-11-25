import React, { useEffect, useMemo, useState } from 'react';
import {
    RefreshCcw,
} from 'lucide-react';
import { useSystemLogs, type SystemLogEntry } from '../hooks/use-system-logs';
import { TreeViewContent } from '../components/system-logs/tree-view-content';
import { LogTreeItem } from '../components/system-logs/common';

// Status filter options
const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'success', label: 'Success' },
    { value: 'failure', label: 'Failed' },
    { value: 'skipped', label: 'Skipped' },
    { value: 'pending', label: 'Pending' },
];

const INTEGRATION_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'discord', label: 'Discord' },
    { value: 'slack', label: 'Slack' },
    { value: 'telegram', label: 'Telegram' },
    { value: 'clickup', label: 'ClickUp' },
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'call', label: 'Call' },
    { value: 'webhook', label: 'Webhook' },
];

const NotificationLogs = () => {
    const [integrationFilter, setIntegrationFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

    useEffect(() => {
        const id = setTimeout(() => {
            setSearchTerm(searchInput);
            setPage(1);
        }, 350);
        return () => clearTimeout(id);
    }, [searchInput]);

    const filters = useMemo(
        () => ({
            page,
            perPage: 25,
            search: searchTerm || undefined,
            executionStatus: statusFilter !== 'all' ? statusFilter : undefined,
            integrationKey: integrationFilter !== 'all' ? integrationFilter : undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
            includeChildren: true,
        }),
        [page, searchTerm, integrationFilter, statusFilter, fromDate, toDate]
    );

    const { data, isLoading, isFetching, refetch } = useSystemLogs(filters) as {
        data?: { data: SystemLogEntry[]; meta: any };
        isLoading: boolean;
        isFetching: boolean;
        refetch: () => void;
    };

    const handleRefresh = () => {
        refetch();
        setPage(1);
    };

    const logs = useMemo(() => {
        const allLogs = data?.data ?? [];
        if (integrationFilter === 'all') {
            return allLogs;
        }
        return allLogs.filter((log) => {
            const parentKey = resolveIntegrationKey(log);
            if (parentKey === integrationFilter) {
                return true;
            }
            return (log.children ?? []).some(
                (child) => child.integration_key?.toLowerCase() === integrationFilter
            );
        });
    }, [data, integrationFilter]);

    const meta = data?.meta;
    const totalPages = meta?.last_page ?? 1;
    const busy = isLoading || isFetching;

    const toggleLog = (logId: number) => {
        setExpandedLogId(prev => prev === logId ? null : logId);
    };

    return (
        <div className="space-y-3 mb-2">
            {/* Compact Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
                <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search logs..."
                    className="flex-1 min-w-[200px] rounded-lg border border-slate-700 bg-slate-950/40 py-1.5 px-3 text-xs text-slate-200 placeholder:text-slate-400 focus:border-sky-500/50 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500/20"
                />
                <select
                    value={integrationFilter}
                    onChange={(e) => setIntegrationFilter(e.target.value)}
                    className="w-[120px] rounded-lg border border-slate-700/50 bg-slate-950/40 px-2 py-1.5 text-xs text-slate-200 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/20"
                >
                    {INTEGRATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} style={{ backgroundColor: '#0f172a' }}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                    }}
                    className="w-[120px] rounded-lg border border-slate-700/50 bg-slate-950/40 px-2 py-1.5 text-xs text-slate-200 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/20"
                >
                    {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} style={{ backgroundColor: '#0f172a' }}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                        setFromDate(e.target.value);
                        setPage(1);
                    }}
                    className="rounded-lg border border-slate-700/50 bg-slate-950/40 px-3 py-1.5 text-xs text-slate-200 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/20"
                />
                <input
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                        setToDate(e.target.value);
                        setPage(1);
                    }}
                    className="rounded-lg border border-slate-700/50 bg-slate-950/40 px-3 py-1.5 text-xs text-slate-200 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/20"
                />
                <button onClick={handleRefresh} className='!outline-none'>
                    <RefreshCcw className={`h-5 w-5 text-slate-400 hover:text-sky-500 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Tree View Content */}
            <TreeViewContent
                busy={busy}
                logs={logs}
                meta={meta}
                page={page}
                totalPages={totalPages}
                expandedLogId={expandedLogId}
                toggleLog={toggleLog}
                setPage={setPage}
                LogTreeItem={LogTreeItem}
            />
        </div>
    );
};

function resolveIntegrationKey(log: SystemLogEntry): string {
    const payloadIntegrationKey = log.payload && typeof (log.payload as any).integration_key === 'string'
        ? (log.payload as any).integration_key as string
        : undefined;

    const channelType = typeof log.notification_channel?.type === 'string'
        ? log.notification_channel.type
        : undefined;

    const childKey = log.children?.find((child) => child.integration_key)?.integration_key;

    const candidate = log.integration_key
        ?? childKey
        ?? log.integration?.key
        ?? payloadIntegrationKey
        ?? channelType
        ?? log.recipient?.type
        ?? 'unknown';

    const normalized = typeof candidate === 'string' ? candidate : 'unknown';
    return normalized.toLowerCase();
}

export default NotificationLogs;
