import { api } from '../api/api-client';
import type { PaginatedLinks, PaginatedMeta } from './logs-service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditAction =
    | 'create'
    | 'update'
    | 'delete'
    | 'login'
    | 'logout'
    | 'invite'
    | 'invite_accepted'
    | 'remove'
    | 'enable'
    | 'disable'
    | 'assign'
    | 'unassign';

export type AuditLogActor = {
    id: number | null;
    name: string | null;
    email: string | null;
    role: string | null;
    avatar: string;
};

export type AuditLogChange = {
    field: string;
    from: string | null;
    to: string | null;
};

export type AuditLogEntry = {
    id: number;
    workspace_id: number;
    event_type: string;
    action: AuditAction;
    actor: AuditLogActor;
    ip: string | null;
    user_agent: string | null;
    entity_type: string | null;
    entity_id: string | null;
    entity_name: string | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    changes: AuditLogChange[] | null;
    occurred_at: string;
    created_at: string;
};

export type AuditLogFilters = {
    page?: number;
    perPage?: number;
    search?: string;
    action?: string;
    eventType?: string;
    entityType?: string;
    actorId?: number;
    from?: string;
    to?: string;
};

export type AuditLogPaginatedResponse = {
    data: AuditLogEntry[];
    links: PaginatedLinks;
    meta: PaginatedMeta;
};

// ─── API ──────────────────────────────────────────────────────────────────────

export async function fetchAuditLogs(
    filters: AuditLogFilters = {},
): Promise<AuditLogPaginatedResponse> {
    const query = buildQueryString(filters);
    return api.get<AuditLogPaginatedResponse>(`/logs/audit${query}`);
}

function buildQueryString(filters: AuditLogFilters): string {
    const params = new URLSearchParams();

    if (filters.page) params.set('page', String(filters.page));
    if (filters.perPage) params.set('per_page', String(filters.perPage));
    if (filters.search?.trim()) params.set('search', filters.search.trim());
    if (filters.action) params.set('action', filters.action);
    if (filters.eventType) params.set('event_type', filters.eventType);
    if (filters.entityType) params.set('entity_type', filters.entityType);
    if (filters.actorId) params.set('actor_id', String(filters.actorId));
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);

    const query = params.toString();
    return query ? `?${query}` : '';
}
