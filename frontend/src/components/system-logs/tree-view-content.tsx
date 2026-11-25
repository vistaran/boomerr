import { AlertTriangle } from 'lucide-react';
import React from 'react';
import CommonLoader from '../common/common-loader';
import Pagination from '../common/pagination';

interface PaginationMeta {
  from?: number;
  to?: number;
  total?: number;
}

interface TreeViewContentProps {
  busy: boolean;
  logs: any[];
  meta?: PaginationMeta;
  page: number;
  totalPages: number;
  expandedLogId: number | null;
  toggleLog: (logId: number) => void;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  LogTreeItem: React.ComponentType<any>;
}

export function TreeViewContent({
  busy,
  logs,
  meta,
  page,
  totalPages,
  expandedLogId,
  toggleLog,
  setPage,
  LogTreeItem,
}: TreeViewContentProps) {

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm">
      {busy && logs.length === 0 && (
        <div className="px-6 py-12 flex justify-center text-center items-center gap-3">
          <CommonLoader />
          <p className="text-md text-slate-500">Loading logs...</p>
        </div>
      )}
      {!busy && logs.length === 0 && (
        <div className="px-6 py-12 text-center">
          <AlertTriangle className="mx-auto mb-2 text-amber-400" size={24} />
          <p className="text-xs text-slate-500">No logs found</p>
        </div>
      )}
      {logs.length > 0 && (
        <div>
          {logs.map((log) => (
            <LogTreeItem
              key={log.id}
              log={log}
              isExpanded={expandedLogId === log.id}
              onToggle={() => toggleLog(log.id)}
            />
          ))}
        </div>
      )}
      {/* Compact Pagination */}
      {meta && (
        <Pagination
          currentPage={page}
          lastPage={totalPages}
          total={meta.total}
          onPageChange={(p) => setPage(p)}
          rangeFrom={meta.from ?? 0}
          rangeTo={meta.to ?? 0}
        />
      )}
    </div>
  );
}
