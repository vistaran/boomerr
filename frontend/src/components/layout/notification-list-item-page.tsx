import React, { useState } from 'react';
import type { AppNotification } from '../../services/notification-service';
import DateTimeDisplay from '../common/date-time-display';

type NotificationListItemPageProps = {
  n: AppNotification;
  onMarkRead: () => void;
};

const NotificationListItemPage = ({ n, onMarkRead }: NotificationListItemPageProps) => {
  const [expanded, setExpanded] = useState(false);
  const isUnread = !n.read_at;

  const action = (n.action ?? n.data?.action) as string;
  const domain = n.domain ?? n.data?.domain;
  const responseTime = n.last_response_time_ms ?? n.data?.last_response_time_ms ?? null;
  const changes = n.changes ?? n.data?.changes ?? [];
  const actor = n.actor ?? n.data?.actor ?? null;

  const isStatusAction = action === 'up' || action === 'down';
  const isDomainChangeAction = action === 'created' || action === 'updated' || action === 'deleted';
  const isNewIncidentAction = action === 'new_incident';

  const actionIcon = (() => {
    if (isStatusAction) {
      return action === 'up' ? (
        <span title="Up" className="inline-block mt-2 text-green-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="align-middle"><path d="M10 16V4M10 4L4 10M10 4L16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      ) : (
        <span title="Down" className="inline-block mt-2 text-red-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="align-middle"><path d="M10 4v12M10 16l6-6M10 16l-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      );
    }
    if (action === 'created') {
      return (
        <span title="Created" className="inline-block mt-2 text-blue-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="align-middle"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      );
    }
    if (action === 'updated') {
      return (
        <span title="Updated" className="inline-block mt-2 text-yellow-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="align-middle"><path d="M4 13.5V16h2.5l7.1-7.1a1.77 1.77 0 0 0-2.5-2.5L4 13.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12.5 6.5l1 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      );
    }
    if (action === 'deleted') {
      return (
        <span title="Deleted" className="inline-block mt-2 text-pink-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="align-middle"><path d="M6 7v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 10v4M11 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 7V5a2 2 0 0 1 4 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      );
    }
    if (action === 'new_incident') {
      return (
        <span title="New Incident" className={`inline-block mt-2 text-orange-400 ${isUnread ? 'mr-0' : 'ml-2'}`}>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" className="align-middle"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      );
    }
    return null;
  })();

  const title = (() => {
    if (isStatusAction) {
      const label = action === 'up' ? 'Domain Up' : 'Domain Down';
      return `${label}: ${domain?.name ?? 'Domain'}`;
    }
    if (isNewIncidentAction) {
      return `New Incident: ${domain?.name ?? 'Domain'}`;
    }
    if (isDomainChangeAction) {
      return `Domain ${action}: ${domain?.name ?? 'Domain'}`;
    }
    return n.type?.split('\\').pop() ?? 'Notification';
  })();

  return (
    <button
      className={`w-full text-left px-3 py-3 rounded-xl mt-1 border border-slate-800/70 transition-colors ${isUnread ? 'bg-slate-800/50' : 'hover:bg-slate-800/40'}`}
      style={{ outline: 'none' }}
      onClick={() => {
        setExpanded((e) => !e);
        if (isUnread) onMarkRead();
      }}
    >
      <div className="flex items-start gap-2">
        {isUnread && <span className='mt-3.5 inline-block h-2 w-2 rounded-full bg-sky-400' />}
        {actionIcon}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-100">{title}</span>
            {n.created_at ? (
              <span className="text-[11px] text-slate-300 px-1.5 py-0.5 rounded-xl bg-slate-700 ml-1">
                <DateTimeDisplay value={n.created_at} />
              </span>
            ) : null}
          </div>
          {!expanded ? (
            <div className="text-xs text-slate-300">
              {isStatusAction ? (
                <>
                  URL: {domain?.url ?? 'N/A'}
                  {responseTime ? ` • ${responseTime} ms` : ''}
                </>
              ) : isNewIncidentAction ? (
                <>
                  New incident reported{actor?.name ? ` by ${actor.name}` : ''}.
                </>
              ) : (
                <div className='flex gap-2'>Action: {action ?? 'unknown'}
                  {actor?.email && (
                    <div>(Actor: {actor.name ?? 'User'})</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-300 space-y-1">
              <div>URL: {domain?.url ?? 'N/A'}</div>
              <div>Environment: {domain?.environment ?? 'production'}</div>
              {actor && (
                <div>Actor: {actor?.name ?? 'System'} <b>{(actor?.email) ?? ''}</b></div>
              )}
              {isStatusAction ? (
                responseTime ? <div>Response: {responseTime} ms</div> : null
              ) : (
                <>
                  {Array.isArray(changes) && changes.length > 0 && (
                    <div className="mt-1">
                      <div className="text-[11px] text-slate-400">Changes:</div>
                      {changes.map((c, i) => (
                        <div key={i}>• {c.field}: {String(c.before)} → {String(c.after)}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default NotificationListItemPage;