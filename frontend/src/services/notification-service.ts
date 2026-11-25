import { apiFetch } from './api-service';

export type NotificationAction = 'up' | 'down' | 'created' | 'updated' | 'deleted';

export type NotificationDomain = {
    id: number;
    name: string;
    url: string;
    environment?: string | null;
    workspace_id?: number | null;
    workspace_ulid?: string | null;
};

export type NotificationChange = { field: string; before: unknown; after: unknown };

export type NotificationActor = { id: number; name: string | null; email: string | null } | null;

export type NotificationPayload = {
    action?: NotificationAction;
    domain?: NotificationDomain;
    last_response_time_ms?: number | null;
    workspace_id?: number | null;
    workspace_ulid?: string | null;
    changes?: NotificationChange[];
    actor?: NotificationActor;
    timestamp?: string;
};

export type AppNotification = {
    id: string;
    type: string;
    action?: NotificationAction;
    domain?: NotificationDomain;
    last_response_time_ms?: number | null;
    changes?: NotificationChange[];
    actor?: NotificationActor;
    data?: NotificationPayload;
    workspace_id?: number | null;
    workspace_ulid?: string | null;
    read_at: string | null;
    created_at: string;
};

export type NotificationsResponse = {
    data: AppNotification[];
    meta?: { current_page: number; per_page: number; last_page: number; total: number };
    unread_count: number;
};

export async function getNotifications(page?: number, perPage?: number, workspaceId?: string | number | null): Promise<NotificationsResponse> {
    const params = new URLSearchParams();

    if (page) params.set('page', String(page));
    if (perPage) params.set('per_page', String(perPage));
    if (typeof workspaceId === 'number') {
        params.set('workspace_id', String(workspaceId));
    } else if (typeof workspaceId === 'string') {
        params.set('workspace_ulid', workspaceId);
    }
    const qs = params.toString();
    const url = qs ? `/notifications?${qs}` : '/notifications';
    return apiFetch(url, { method: 'GET' });
}

export async function markNotificationRead(id: string): Promise<void> {
    await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(workspaceId?: string | number | null): Promise<void> {
    let qs = '';
    if (typeof workspaceId === 'number') qs = `?workspace_id=${workspaceId}`;
    else if (typeof workspaceId === 'string') qs = `?workspace_ulid=${workspaceId}`;
    await apiFetch(`/notifications/read-all${qs}`, { method: 'PATCH' });
}