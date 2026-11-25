import React from 'react'
import { useState } from 'react';
import type { AppNotification } from '../../services/notification-service';
type NotificationListItemProps = {
    n: AppNotification;
    onMarkRead: () => void;
};

const NotificationListItem = ({ n, onMarkRead }: NotificationListItemProps) => {
    const [expanded, setExpanded] = useState(false);
    const isUnread = !n.read_at;

    const action: string = n.action ?? n.data?.action;
    const domain = n.domain ?? n.data?.domain;
    const responseTime = n.last_response_time_ms ?? n.data?.last_response_time_ms ?? null;
    const changes = n.changes ?? n.data?.changes ?? [];
    const actor = n.actor ?? n.data?.actor ?? null;

    const isStatusAction = action === 'up' || action === 'down';
    const isDomainChangeAction = action === 'created' || action === 'updated' || action === 'deleted';

    // Icon mapping for actions
    const actionIcon = (() => {
        if (isStatusAction) {
            return action === 'up' ? (
                <span title="Up" className={`inline-block mt-2 text-green-400 ${isUnread ? 'mr-0' : 'ml-2'}`}>
                    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" className="align-middle"><path d="M10 16V4M10 4L4 10M10 4L16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
            ) : (
                <span title="Down" className={`inline-block mt-2 text-red-400 ${isUnread ? 'mr-0' : 'ml-2'}`}>
                    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" className="align-middle"><path d="M10 4v12M10 16l6-6M10 16l-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
            );
        }
        if (action === 'created') {
            return (
                <span title="Created" className={`inline-block mt-2 text-blue-400 ${isUnread ? 'mr-0' : 'ml-2'}`}>
                    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" className="align-middle"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
            );
        }
        if (action === 'updated') {
            return (
                <span title="Updated" className={`inline-block mt-2 text-yellow-400 ${isUnread ? 'mr-0' : 'ml-2'}`}>
                    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" className="align-middle"><path d="M4 13.5V16h2.5l7.1-7.1a1.77 1.77 0 0 0-2.5-2.5L4 13.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12.5 6.5l1 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
            );
        }
        if (action === 'deleted') {
            return (
                <span title="Deleted" className={`inline-block mt-2 text-pink-400 ${isUnread ? 'mr-0' : 'ml-2'}`}>
                    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" className="align-middle"><path d="M6 7v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 10v4M11 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 7V5a2 2 0 0 1 4 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
            const label = action === 'up' ? 'Domain Up' : action === 'down' ? 'Domain Down' : 'Notification';
            return `${label}: ${domain?.name ?? 'Domain'}`;
        }

        if (action === 'new_incident') {
            return `New Incident: ${domain?.name ?? 'Domain'}`;
        }

        if (isDomainChangeAction) {
            return `Domain ${action}: ${domain?.name ?? 'Domain'}`;
        }

        return n.type?.split('\\').pop() ?? 'Notification';
    })();

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (secondsAgo < 60) return `${secondsAgo} s`;
        const minutesAgo = Math.floor(secondsAgo / 60);
        if (minutesAgo < 60) return `${minutesAgo} m`;
        const hoursAgo = Math.floor(minutesAgo / 60);
        if (hoursAgo < 24) return `${hoursAgo} h`;
        const daysAgo = Math.floor(hoursAgo / 24);
        if (daysAgo === 1) return `1d`;
        return `${daysAgo}d`;
    };

    return (
        <button
            className={`w-full text-left ps-0 pr-0 py-3 border border-slate-800/60 hover:bg-slate-700/60 transition-colors ${isUnread
                ? 'bg-sky-950/50'
                : expanded
                    ? 'bg-slate-800/80'
                    : 'bg-slate-900/70'
                }`}
            style={{ outline: 'none' }}
            onClick={() => {
                setExpanded((e) => !e);
                if (isUnread) onMarkRead();
            }}
        >
            <div className="flex items-start gap-2">
                {/* unread indicator */}
                {isUnread && <span className='mt-3.5 ml-2 inline-block h-2 w-2 rounded-full bg-sky-400' />}
                {/* Icon for action */}
                {actionIcon}
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-100">{title}</span>
                        {n.created_at ? (
                            <span className="mr-1 min-w-[40px] text-center px-1 py-0.5 rounded-full bg-slate-700 text-[10px] text-slate-200 font-semibold ml-2  -top-5 right-0">
                                {formatTimeAgo(n.created_at)}
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
                            ) : action === 'new_incident' ? (
                                <div>
                                    New incident reported{actor?.name ? ` by ${actor.name}` : ''}.
                                </div>
                            ) : (
                                <div className='flex gap-2'>
                                    Action: {action ?? 'unknown'}
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
                                <div>Actor: {actor?.name ?? 'System'} {actor.email ? `(${actor?.email})` : ''}</div>
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

export default NotificationListItem