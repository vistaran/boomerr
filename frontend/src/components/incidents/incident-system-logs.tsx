import { useMemo, useState } from "react";
import { TreeViewContent } from "../system-logs/tree-view-content";
import { useSystemLogs, type SystemLogEntry } from "../../hooks";
import { LogTreeItem } from "../system-logs/common";

export function IncidentSystemLogs({ logs }: {
    logs: any[];
    incidentUlid: string;
    STATUS_STYLES: Record<string, any>;
}) {
    const page = 1;
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

    const filters = useMemo(
        () => ({
            page,
            perPage: 25,
            search: undefined,
            executionStatus: 'all',
            integrationKey: 'all',
            from: undefined,
            to: undefined,
            includeChildren: true,
        }),
        [page]
    );

    const { isLoading, isFetching } = useSystemLogs(filters) as {
        data?: { data: SystemLogEntry[]; meta: any };
        isLoading: boolean;
        isFetching: boolean;
    };

    const busy = isLoading || isFetching;

    const toggleLog = (logId: number) => {
        setExpandedLogId(prev => prev === logId ? null : logId);
    };

    return (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm overflow-hidden">
            <TreeViewContent
                busy={busy}
                logs={logs}
                meta={null}
                page={page}
                totalPages={1}
                expandedLogId={expandedLogId}
                toggleLog={toggleLog}
                setPage={() => { }}
                LogTreeItem={LogTreeItem}
            />
        </div>
    );
}
