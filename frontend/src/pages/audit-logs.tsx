import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Shield,
  LogIn,
  LogOut,
  Pencil,
  Trash2,
  Plus,
  Settings,
  Globe,
  Users,
  Key,
  RotateCw,
  UserMinus,
  ToggleLeft,
  ToggleRight,
  Link2,
  Unlink2,
  UserCheck,
  Building2,
} from 'lucide-react';
import { useAuditLogs } from '../hooks/use-audit-logs';
import type { AuditLogEntry } from '../services/audit-logs-service';
import type { AuditAction } from '../services/audit-logs-service';
import CommonLoader from '../components/common/common-loader';

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  AuditAction,
  { label: string; color: string; bg: string; border: string; Icon: React.ElementType }
> = {
  create: { label: 'Create', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', Icon: Plus },
  update: { label: 'Update', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', Icon: Pencil },
  delete: { label: 'Delete', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', Icon: Trash2 },
  login: { label: 'Login', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', Icon: LogIn },
  logout: { label: 'Logout', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', Icon: LogOut },
  invite: { label: 'Invite', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', Icon: Users },
  invite_accepted: { label: 'Accepted', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', Icon: UserCheck },
  remove: { label: 'Remove', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', Icon: UserMinus },
  enable: { label: 'Enable', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', Icon: ToggleRight },
  disable: { label: 'Disable', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', Icon: ToggleLeft },
  assign: { label: 'Assign', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', Icon: Link2 },
  unassign: { label: 'Unassign', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', Icon: Unlink2 },
};

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  Domain: Globe,
  Workspace: Building2,
  Integration: Shield,
  DomainIntegration: Settings,
  WorkspaceIntegration: Settings,
  Auth: Key,
  Team: Users,
  Department: Users,
  GoogleAds: Globe,
  FacebookAds: Globe,
};

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'invite', label: 'Invite' },
  { value: 'remove', label: 'Remove' },
  { value: 'enable', label: 'Integration Enable' },
  { value: 'disable', label: 'Integration Disable' },
  { value: 'assign', label: 'Ad Assign' },
  { value: 'unassign', label: 'Ad Unassign' },
  { value: 'resolved', label: 'Incident Resolved' },
  { value: 'resend', label: 'Resend Invite' },
  { value: 'cancel', label: 'Cancel Invite' },
  { value: 'add', label: 'Add User' },
  { value: 'removeUser', label: 'Remove User' },
];

// Map custom action filter values to their corresponding event types
const CUSTOM_ACTION_TO_EVENT: Record<string, string> = {
  resolved: 'incident.resolved',
  resend: 'team.invite_resent',
  cancel: 'team.invite_canceled',
  add: 'department.user_added',
  removeUser: 'department.user_removed',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a snake_case or camelCase key to human-readable label
 * Examples: integration_key → Integration Key, domainUrl → Domain URL
 */
function formatKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase to spaces
    .replace(/_/g, ' ') // snake_case to spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}


/**
 * Format a value for display, masking URLs if needed
 */
function formatValue(key: string, value: unknown): string {
  const str = String(value);
  return str;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatFull(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Get dynamic label based on event type for better context
 */
function getActionLabel(action: AuditAction, eventType: string): string {
  // Special case: incident resolved should show "Resolved" instead of "Update"
  if (eventType === 'incident.resolved') {
    return 'Resolved';
  }

  // Special case: resend invite should show "Resend" instead of "Update"
  if (eventType === 'team.invite_resent') {
    return 'Resend';
  }


  // Special case: cancel invite should show "Cancel" instead of "Remove"
  if (eventType === 'team.invite_canceled') {
    return 'Cancel';
  }
  // Special case: department user add/remove should show "Add"/"Remove" instead of "Assign"/"Unassign"
  if (eventType === 'department.user_added') {
    return 'Add';
  }
  if (eventType === 'department.user_removed') {
    return 'Remove';
  }

  // Default to config label
  return ACTION_CONFIG[action]?.label ?? 'Action';
}

const ActionBadge = ({ action, eventType }: { action: AuditAction; eventType: string }) => {
  const cfg = ACTION_CONFIG[action] ?? ACTION_CONFIG.create;
  const label = getActionLabel(action, eventType);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide
                ${cfg.color} ${cfg.bg} ${cfg.border}`}
    >
      <cfg.Icon size={14} />
      {label}
    </span>
  );
};

const UserAvatar = ({ initials, name }: { initials: string; name: string }) => (
  <div
    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/25 to-violet-500/25 ring-1 ring-sky-500/30 text-[11px] font-bold text-sky-300 transition-all duration-200 group-hover:ring-sky-500/50 group-hover:from-sky-500/35 group-hover:to-violet-500/35"
    title={name}
  >
    {initials}
  </div>
);

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  owner: { label: 'Owner', color: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/25' },
  admin: { label: 'Admin', color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
  member: { label: 'Member', color: 'text-sky-300', bg: 'bg-sky-500/10', border: 'border-sky-500/25' },
};

const RoleBadge = ({ role }: { role: string | null }) => {
  if (!role) return <span className="text-[11px] text-slate-400">-</span>;
  const cfg = ROLE_CONFIG[role.toLowerCase()];
  if (!cfg) return <span className="text-[11px] text-slate-400 capitalize">{role}</span>;
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
};

const AuditRow = ({
  log,
  isExpanded,
  onToggle,
}: {
  log: AuditLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const ResourceIcon = RESOURCE_ICONS[log.entity_type ?? ''] ?? Shield;
  const hasDetail = !!(
    (log.changes && log.changes.length > 0) ||
    (log.metadata && Object.keys(log.metadata).length > 0) ||
    log.description ||
    log.ip ||
    log.user_agent
  );

  return (
    <div className={`group border-b border-slate-700/30 last:border-0 transition-colors duration-150 ${isExpanded ? 'bg-slate-800/25' : 'hover:bg-slate-800/15'}`}>
      {/* Main row */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${hasDetail ? 'cursor-pointer select-none' : ''}`}
        onClick={hasDetail ? onToggle : undefined}
      >
        {/* Expand toggle */}
        <div className="w-4 flex-shrink-0">
          {hasDetail ? (
            <ChevronRight
              size={14}
              className={`text-slate-400 transition-transform duration-150 ease-out ${isExpanded ? 'rotate-90 text-sky-400' : 'group-hover:text-slate-300'
                }`}
            />
          ) : null}
        </div>

        {/* User avatar */}
        <UserAvatar initials={log.actor.avatar} name={log.actor.name ?? 'Unknown'} />

        {/* User info */}
        <div className="min-w-0 w-40 flex-shrink-0">
          <p className="text-xs font-medium text-slate-200 truncate">{log.actor.name ?? 'System'}</p>
          <p className="text-[11px] text-slate-400 truncate">{log.actor.email ?? '-'}</p>
        </div>

        {/* Action badge */}
        <div className="w-28 flex-shrink-0">
          <ActionBadge action={log.action} eventType={log.event_type} />
        </div>

        {/* Resource */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ResourceIcon size={13} className="flex-shrink-0 text-slate-400 group-hover:text-slate-300 transition-colors duration-150" />
          <div className="min-w-0">
            <p className="text-xs text-slate-300 truncate font-medium">{log.entity_type ?? '-'}</p>
            <p className="text-[11px] text-slate-400 truncate font-mono">{log.entity_name ?? log.entity_id ?? '-'}</p>
          </div>
        </div>

        {/* Role */}
        <div className="hidden lg:block w-32 flex-shrink-0">
          <RoleBadge role={log.actor.role} />
        </div>

        {/* IP */}
        <div className="hidden lg:block w-32 flex-shrink-0">
          <p className="text-[11px] text-slate-400 font-mono">{log.ip ?? '-'}</p>
        </div>

        {/* Timestamp */}
        <div className="w-20 flex-shrink-0 text-right">
          <p className="text-[11px] text-slate-400" title={formatFull(log.occurred_at)}>
            {formatRelative(log.occurred_at)}
          </p>
        </div>
      </div>

      {/* Expanded detail panel - animated via CSS grid trick */}
      <div className={`grid transition-all duration-200 ease-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}>
        <div className="overflow-hidden">
          <div className="mx-4 mb-3 ml-11 space-y-2.5 pt-0.5">
            {/* Grid for Description, Metadata, and Changes */}
            {(log.description || (log.metadata && Object.keys(log.metadata).filter(k => !k.endsWith('_id') && k !== 'integration_id').length > 0) || (log.changes && log.changes.length > 0)) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {/* Description Card */}
                {log.description && (
                  <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-4 py-3">
                    <p className="mb-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Description</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{log.description}</p>
                  </div>
                )}

                {/* Metadata Card */}
                {log.metadata && Object.keys(log.metadata).filter(k => !k.endsWith('_id') && k !== 'integration_id').length > 0 && (
                  <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-4 py-3">
                    <p className="mb-2 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Metadata</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(log.metadata)
                        .filter(([k]) => !k.endsWith('_id') && k !== 'integration_id')
                        .map(([k, v]) => (
                          <div key={k} className="flex items-center gap-1.5 rounded-md bg-slate-800/60 border border-slate-700/40 px-2.5 py-1.5 text-[11px]">
                            <span className="text-slate-400 font-medium">{formatKey(k)}:</span>
                            <span className="text-slate-200 font-medium">{formatValue(k, v)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Changes Card */}
                {log.changes && log.changes.length > 0 && (
                  <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-4 py-3">
                    <p className="mb-2.5 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Changes</p>
                    <div className="space-y-2">
                      {log.changes.map((c) => (
                        <div
                          key={c.field}
                          className="flex flex-wrap md:flex-nowrap items-center text-[11px] gap-2 md:gap-0 overflow-x-auto"
                          style={{ wordBreak: 'break-word' }}
                        >
                          <span className="min-w-[100px] font-mono text-slate-400 font-medium break-words">{formatKey(c.field)}</span>
                          <span className="rounded-md bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-rose-400 font-mono line-through break-all max-w-full">{c.from ? formatValue(c.field, c.from) : '-'}</span>
                          <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />
                          <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-emerald-400 font-mono break-all max-w-full">{c.to ? formatValue(c.field, c.to) : '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Context Info Card */}
            <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-4 py-3">
              <p className="mb-2.5 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Context</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium min-w-[70px]">IP Address:</span>
                  <span className="text-slate-300 font-mono break-all">{log.ip ?? 'Not recorded'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium min-w-[70px]">User Agent:</span>
                  <span className="text-slate-300 break-all">{log.user_agent ?? 'Not recorded'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium min-w-[70px]">Timestamp:</span>
                  <span className="text-slate-300">{formatFull(log.occurred_at)}</span>
                </div>
                {log.actor.role && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium min-w-[70px]">Role:</span>
                    <RoleBadge role={log.actor.role} />
                  </div>
                )}
                {log.event_type && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium min-w-[70px]">Event Type:</span>
                    <span className="text-slate-300 text-[11px] font-mono">{log.event_type}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const AuditLogs = () => {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchTerm(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const filters = useMemo(
    () => {
      // Check if this is a custom action filter
      const isCustomAction = actionFilter !== 'all' && CUSTOM_ACTION_TO_EVENT[actionFilter];

      return {
        page,
        perPage: 25,
        search: searchTerm || undefined,
        // For custom actions, filter by event_type. For regular actions, filter by action
        eventType: isCustomAction ? CUSTOM_ACTION_TO_EVENT[actionFilter] : undefined,
        action: !isCustomAction && actionFilter !== 'all' ? actionFilter : undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      };
    },
    [page, searchTerm, actionFilter, fromDate, toDate],
  );

  const { data, isLoading, isFetching, refetch } = useAuditLogs(filters);

  const logs = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.last_page ?? 1;
  const busy = isLoading || isFetching;

  const handleRefresh = () => {
    refetch();
    setPage(1);
  };

  const toggleRow = (id: number) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-4 mb-2">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search user, resource, IP…"
          className="flex-1 min-w-[200px] rounded-lg border border-slate-700 bg-slate-950/40 py-1.5 px-3 text-xs text-slate-200 placeholder:text-slate-400 focus:border-sky-500/50 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500/20"
        />
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="w-[160px] rounded-lg border !border-slate-700/50 bg-slate-950/40 px-2 py-1.5 text-xs text-slate-200 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/20"

        >
          {ACTION_OPTIONS.map((o) => <option style={{ backgroundColor: '#0f172a' }} key={o.value} value={o.value}>{o.label}</option>)}
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
        <button onClick={handleRefresh} className="!outline-none">
          <RotateCw className={`h-5 w-5 text-slate-400 hover:text-sky-500 transition-colors ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Log table */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <div className="hidden md:flex items-center gap-3 px-4 py-2.5 border-b border-slate-700/50 bg-slate-950/30">
          <div className="w-4" />
          <div className="w-7" />
          <div className="w-40 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">User</div>
          <div className="w-24 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Action</div>
          <div className="flex-1 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Resource</div>
          <div className="hidden lg:block w-32 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Role</div>
          <div className="hidden lg:block w-32 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">IP Address</div>
          <div className="w-20 text-right text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Time</div>
        </div>

        {/* Loading state */}
        {busy && logs.length === 0 && (
          <div className="px-6 py-12 flex justify-center text-center items-center gap-3">
            <CommonLoader />
            <p className="text-md text-slate-400">Loading audit logs...</p>
          </div>
        )}

        {/* Empty state */}
        {!busy && logs.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Shield className="mx-auto mb-2 text-slate-200" size={24} />
            <p className="text-xs text-slate-400">No audit events match your filters</p>
          </div>
        )}

        {/* Rows */}
        {logs.length > 0 && logs.map((log) => (
          <AuditRow
            key={log.id}
            log={log}
            isExpanded={expandedId === log.id}
            onToggle={() => toggleRow(log.id)}
          />
        ))}

        {/* Pagination */}
        {meta && (
          <div className="flex items-center justify-between border-t border-slate-700/30 px-4 py-2.5 text-xs">
            <span className="text-slate-400">
              {meta.from ?? 0}-{meta.to ?? 0} of {meta.total}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-slate-700/50 px-3 py-1 text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800/50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-slate-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md border border-slate-700/50 px-3 py-1 text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800/50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;