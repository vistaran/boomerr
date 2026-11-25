import { useState } from 'react';
import Pagination from '../components/common/pagination';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/query-keys';
import NotificationListItemPage from '../components/layout/notification-list-item-page';
import { getNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification, type NotificationsResponse } from '../services/notification-service';
import { BellRing } from 'lucide-react';
import { useAuth } from '../context/auth-context';

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const perPage = 10;
  const { user, workspaces } = useAuth();
  const currentWorkspace = workspaces.find((ws) => ws.is_current);
  const workspaceId = currentWorkspace?.ulid ?? user?.workspace_ulid ?? currentWorkspace?.id ?? user?.workspace_id ?? null;
  const listKey = queryKeys.notifications.list(workspaceId ?? undefined);
  const unreadKey = queryKeys.notifications.unreadCount(workspaceId ?? undefined);

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: [...listKey, page, perPage],
    queryFn: () => getNotifications(page, perPage, workspaceId ?? undefined),
  });

  const notifications = data?.data ?? [];
  const meta = data?.meta ?? { current_page: page, last_page: page, per_page: perPage, total: notifications.length };

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    // Update current paginated list
    queryClient.setQueryData([...listKey, page, perPage], (prev: any) => {
      const list = (prev?.data ?? []) as AppNotification[];
      const unread = Math.max(0, (prev?.unread_count ?? 1) - 1);
      return {
        ...prev,
        data: list.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
        unread_count: unread,
      };
    });

    // Mirror changes to the non-paginated header cache
    queryClient.setQueryData(listKey, (prev: any) => {
      const list = (prev?.data ?? []) as AppNotification[];
      const unread = Math.max(0, (prev?.unread_count ?? 1) - 1);
      return {
        ...prev,
        data: list.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
        unread_count: unread,
      };
    });

    // Keep the standalone unread count in sync
    queryClient.setQueryData(unreadKey, (prev: any) => {
      const n = typeof prev === 'number' ? prev : 0;
      return Math.max(0, n - 1);
    });
  };

  const markAllRead = async () => {
    await markAllNotificationsRead(workspaceId ?? undefined);
    // Update current paginated list
    queryClient.setQueryData([...listKey, page, perPage], (prev: any) => {
      const list = (prev?.data ?? []) as AppNotification[];
      return {
        ...prev,
        data: list.map((n) => ({ ...n, read_at: new Date().toISOString() })),
        unread_count: 0,
      };
    });

    queryClient.setQueryData(listKey, (prev: any) => {
      const list = (prev?.data ?? []) as AppNotification[];
      return {
        ...prev,
        data: list.map((n) => ({ ...n, read_at: new Date().toISOString() })),
        unread_count: 0,
      };
    });

    // Reset unread count cache
    queryClient.setQueryData(unreadKey, 0);

    // Invalidate any notifications queries for freshness
    queryClient.invalidateQueries({ queryKey: listKey });
  };

  return (
    <section className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4 bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap gap-2 items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">
              {
                <BellRing className="inline-block mr-3 h-8 w-8 text-slate-400" />
              }
              Notifications</h1>
            <p className="mt-1 text-sm text-slate-300">Stay up-to-date with domain status and changes.</p>
          </div>
          <button
            className="text-sm rounded-xl bg-slate-800/80 px-4 py-2 text-slate-200 border border-slate-700 hover:bg-slate-700/60 shadow-sm"
            onClick={markAllRead}
          >
            Mark all as read
          </button>
        </div>

        <div className="rounded-xl shadow-xl">
          {isLoading ? (
            <div className="px-4 py-8 text-sm text-slate-400">Loading your notifications…</div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-slate-800/70 mb-3" />
              <div className="text-sm text-slate-400">You’re all caught up. No notifications yet.</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 text-sm">
              {notifications.map((n) => (
                <NotificationListItemPage key={n.id} n={n} onMarkRead={() => markRead(n.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <Pagination
            currentPage={meta.current_page}
            lastPage={meta.last_page}
            total={meta.total}
            onPageChange={setPage}
          />
        </div>
      </div>
    </section>
  );
}

export default NotificationsPage;
