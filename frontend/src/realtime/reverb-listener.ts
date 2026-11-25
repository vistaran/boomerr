import type { QueryClient } from '@tanstack/react-query';
import { createEcho } from '../reverb-echo';
import { REVERB_EVENTS } from './event-types';
import type {
  DomainStatusUpdatedPayload,
  DomainCreatedPayload,
  DomainUpdatedPayload,
  DomainDeletedPayload,
  WebhookCreatedPayload,
  WebhookUpdatedPayload,
  WebhookDeletedPayload,
  TeamMemberAddedPayload,
  TeamMemberUpdatedPayload,
  TeamMemberRemovedPayload,
  InvitationCreatedPayload,
  InvitationAcceptedPayload,
  BillingStatusUpdatedPayload,
} from './event-types';
import {
  updateDomainInCache,
  addDomainToCache,
  removeDomainFromCache,
  addWebhookToCache,
  updateWebhookInCache,
  removeWebhookFromCache,
  addTeamMemberToCache,
  updateTeamMemberInCache,
  removeTeamMemberFromCache,
  addInvitationToCache,
  removeInvitationFromCache,
} from './cache-handlers';

import { queryKeys } from '../api/query-keys';
import type { AppNotification, NotificationPayload } from '../services/notification-service';

// Use ReturnType to infer Echo type from createEcho function
type EchoInstance = ReturnType<typeof createEcho>;

type ReverbConnectionState = {
  echo: EchoInstance | null;
  workspaceId: string | number | null;
  userId: number | null;
  isConnected: boolean;
};

type ReverbListenerOptions = {
  token: string;
  workspaceId: string | number;
  userId?: number | null;
  queryClient: QueryClient;
  onConnectionError?: (error: unknown) => void;
};

let state: ReverbConnectionState = {
  echo: null,
  workspaceId: null,
  userId: null,
  isConnected: false,
};

function extractNotificationPayload(source: any): NotificationPayload {
  if (source && typeof source === 'object') {
    if (source.data && typeof source.data === 'object') {
      return source.data as NotificationPayload;
    }

    const clone: Record<string, unknown> = { ...source };
    delete clone.id;
    delete clone.type;
    delete clone.notifiable_id;
    delete clone.notifiable_type;
    delete clone.read_at;
    delete clone.created_at;
    delete clone.updated_at;
    delete clone.notification;

    return clone as NotificationPayload;
  }

  return {};
}

function normalizeNotificationEnvelope(raw: any): AppNotification {
  const payload = extractNotificationPayload(raw);
  const action = raw?.action ?? payload.action;
  const domain = raw?.domain ?? payload.domain;
  const lastResponse = raw?.last_response_time_ms ?? payload.last_response_time_ms ?? null;
  const changes = raw?.changes ?? payload.changes ?? [];
  const actor = raw?.actor ?? payload.actor ?? null;
  const createdAt = typeof raw?.created_at === 'string'
    ? raw.created_at
    : payload.timestamp ?? new Date().toISOString();
  const workspace_id = typeof raw?.workspace_id === 'number'
    ? raw.workspace_id
    : typeof payload.workspace_id === 'number'
      ? payload.workspace_id
      : typeof domain?.workspace_id === 'number'
        ? domain.workspace_id
        : null;

  const workspace_ulid = typeof raw?.workspace_ulid === 'string'
    ? raw.workspace_ulid
    : typeof payload.workspace_ulid === 'string'
      ? payload.workspace_ulid
      : typeof domain?.workspace_ulid === 'string'
        ? domain.workspace_ulid
        : null;
  const safeId = raw?.id
    ?? (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`);

  return {
    id: String(safeId),
    type: raw?.type ?? 'Notification',
    action,
    domain,
    last_response_time_ms: lastResponse,
    changes,
    actor,
    data: payload,
    workspace_id: workspace_id,
    // include ULID when available
    ...(workspace_ulid ? { workspace_ulid } : {}),
    read_at: raw?.read_at ?? null,
    created_at: createdAt,
  };
}

function createEventHandlers(queryClient: QueryClient) {
  return {
    // Domain events
    handleDomainStatusUpdated: (payload: DomainStatusUpdatedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] DomainStatusUpdated:', payload);
      }
      updateDomainInCache(queryClient, payload.domain);
    },

    handleDomainCreated: (payload: DomainCreatedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] DomainCreated:', payload);
      }
      addDomainToCache(queryClient, payload.domain);
    },

    handleDomainUpdated: (payload: DomainUpdatedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] DomainUpdated:', payload);
      }
      updateDomainInCache(queryClient, payload.domain);
    },

    handleDomainDeleted: (payload: DomainDeletedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] DomainDeleted:', payload);
      }
      // Prefer ULID when available, fall back to numeric id
      const idOrUlid = payload.domain_ulid ?? (payload.domain_id ? String(payload.domain_id) : '');
      if (idOrUlid) removeDomainFromCache(queryClient, idOrUlid);
    },

    // Integration events
    handleWebhookCreated: (payload: WebhookCreatedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] WebhookCreated:', payload);
      }
      addWebhookToCache(queryClient, payload.webhook, payload.type);
    },

    handleWebhookUpdated: (payload: WebhookUpdatedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] WebhookUpdated:', payload);
      }
      updateWebhookInCache(queryClient, payload.webhook, payload.type);
    },

    handleWebhookDeleted: (payload: WebhookDeletedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] WebhookDeleted:', payload);
      }
      removeWebhookFromCache(queryClient, payload.webhook_id, payload.type);
    },

    // Team events
    handleTeamMemberAdded: (payload: TeamMemberAddedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] TeamMemberAdded:', payload);
      }
      addTeamMemberToCache(queryClient, payload.member);
    },

    handleTeamMemberUpdated: (payload: TeamMemberUpdatedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] TeamMemberUpdated:', payload);
      }
      updateTeamMemberInCache(queryClient, payload.member);
    },

    handleTeamMemberRemoved: (payload: TeamMemberRemovedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] TeamMemberRemoved:', payload);
      }
      removeTeamMemberFromCache(queryClient, payload.member_id);
    },

    handleInvitationCreated: (payload: InvitationCreatedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] InvitationCreated:', payload);
      }
      addInvitationToCache(queryClient, payload.invitation);
    },

    handleInvitationAccepted: (payload: InvitationAcceptedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] InvitationAccepted:', payload);
      }
      removeInvitationFromCache(queryClient, String(payload.invitation_id));
      addTeamMemberToCache(queryClient, payload.member);
    },

    handleBillingStatusUpdated: (payload: BillingStatusUpdatedPayload) => {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] BillingStatusUpdated:', payload);
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.billing.plans() });
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.planInfo() });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('billing:status-updated', { detail: payload }));
      }
    },
  };
}

function subscribeToCompanyChannel(
  echo: EchoInstance,
  workspaceId: string | number,
  handlers: ReturnType<typeof createEventHandlers>
) {
  const channelName = `company.${workspaceId}`;

  if (import.meta.env.DEV) {
    // console.log('[Reverb] Subscribing to channel:', channelName);
  }

  return echo
    .private(channelName)
    // Domain events
    .listen(REVERB_EVENTS.DOMAIN_STATUS_UPDATED, handlers.handleDomainStatusUpdated)
    .listen(REVERB_EVENTS.DOMAIN_CREATED, handlers.handleDomainCreated)
    .listen(REVERB_EVENTS.DOMAIN_UPDATED, handlers.handleDomainUpdated)
    .listen(REVERB_EVENTS.DOMAIN_DELETED, handlers.handleDomainDeleted)
    // Integration events
    .listen(REVERB_EVENTS.WEBHOOK_CREATED, handlers.handleWebhookCreated)
    .listen(REVERB_EVENTS.WEBHOOK_UPDATED, handlers.handleWebhookUpdated)
    .listen(REVERB_EVENTS.WEBHOOK_DELETED, handlers.handleWebhookDeleted)
    // Team events
    .listen(REVERB_EVENTS.TEAM_MEMBER_ADDED, handlers.handleTeamMemberAdded)
    .listen(REVERB_EVENTS.TEAM_MEMBER_UPDATED, handlers.handleTeamMemberUpdated)
    .listen(REVERB_EVENTS.TEAM_MEMBER_REMOVED, handlers.handleTeamMemberRemoved)
    .listen(REVERB_EVENTS.INVITATION_CREATED, handlers.handleInvitationCreated)
    .listen(REVERB_EVENTS.INVITATION_ACCEPTED, handlers.handleInvitationAccepted)
    .listen(REVERB_EVENTS.BILLING_STATUS_UPDATED, handlers.handleBillingStatusUpdated);
}

export function initializeReverbListeners(options: ReverbListenerOptions): void {
  const { token, workspaceId, userId, queryClient, onConnectionError } = options;

  // Avoid re-initialization if already connected to the same company
  if (state.isConnected && state.workspaceId === workspaceId) {
    if (import.meta.env.DEV) {
      console.log('[Reverb] Already connected to company:', workspaceId);
    }
    return;
  }

  // Disconnect existing connection if company changed
  if (state.echo) {
    disconnectReverb();
  }

  try {
    const echo = createEcho(token);
    const handlers = createEventHandlers(queryClient);

    subscribeToCompanyChannel(echo, workspaceId, handlers);
    // Subscribe to per-user notification channel for realtime bell updates
    if (userId) {
      subscribeToUserNotifications(echo, userId, queryClient);
    }

    state = {
      echo,
      workspaceId,
      userId: userId ?? null,
      isConnected: true,
    };

    if (import.meta.env.DEV) {
      // console.log('[Reverb] Connection initialized for company:', workspaceId);
    }

    // Basic connection diagnostics in dev to aid troubleshooting
    try {
      const conn = echo.connector?.pusher?.connection;
      conn?.bind('state_change', (stateChange: any) => {
        // console.log('[Reverb] state_change:', stateChange);
      });
      conn?.bind('error', (err: any) => {
        console.error('[Reverb] connection error:', err);
      });
    } catch (error) {
      console.error('[Reverb] Failed to bind connection diagnostics:', error);
    }
  } catch (error) {
    console.error('[Reverb] Failed to initialize connection:', error);
    onConnectionError?.(error);
  }
}

// Disconnect from Reverb and clean up all subscriptions.
export function disconnectReverb(): void {
  if (state.echo && state.workspaceId) {
    const channelName = `company.${state.workspaceId}`;

    if (import.meta.env.DEV) {
      // console.log('[Reverb] Disconnecting from channel:', channelName);
    }

    // Stop listening to all events
    state.echo.leave(channelName);
  }

  // Also leave the per-user notifications channel if subscribed
  if (state.echo && state.userId) {
    const userChannel = `App.Models.User.${state.userId}`;
    if (import.meta.env.DEV) {
      // console.log('[Reverb] Leaving user notifications channel:', userChannel);
    }
    state.echo.leave(userChannel);
  }

  state = {
    echo: null,
    workspaceId: null,
    userId: null,
    isConnected: false,
  };
}

//Check if Reverb is currently connected.
export function isReverbConnected(): boolean {
  return state.isConnected;
}


// Get the current company ID that Reverb is connected to.
export function getConnectedworkspaceId(): string | number | null {
  return state.workspaceId;
}


export function subscribeToUserNotifications(
  echo: EchoInstance,
  userId: number,
  queryClient: QueryClient
) {
  const channel = `App.Models.User.${userId}`;

  if (import.meta.env.DEV) {
    // console.log('[Reverb] Subscribing to notifications:', channel);
  }

  const handleIncoming = (payload: any, source: 'notification' | 'event') => {
    if (import.meta.env.DEV) {
      // console.log('[Reverb] Received notification', { source, payload });
    }

    const normalized = payload?.notification ?? payload;

    if (!normalized || !normalized.id) {
      if (import.meta.env.DEV) {
        console.warn('[Reverb] Ignoring malformed notification payload', payload);
      }
      return;
    }

    const next = normalizeNotificationEnvelope(normalized);
    const activeWorkspaceId = state.workspaceId ?? null;
    const workspaceKey = activeWorkspaceId ?? 'global';

    const incomingWorkspaceIdentifier =
      next.workspace_ulid ??
      (typeof next.workspace_id === 'number' ? String(next.workspace_id) :
        (typeof next.domain?.workspace_ulid === 'string' ? next.domain.workspace_ulid :
          (typeof next.domain?.workspace_id === 'number' ? String(next.domain.workspace_id) : null)));

    if (activeWorkspaceId && incomingWorkspaceIdentifier && String(activeWorkspaceId) !== String(incomingWorkspaceIdentifier)) {
      if (import.meta.env.DEV) {
        // console.log('[Reverb] Ignoring notification from workspace', incomingWorkspaceIdentifier);
      }
      return;
    }

    const bumpTotal = (meta: any, fallbackLength: number) => {
      if (!meta) {
        return meta;
      }

      const incoming = typeof meta.total === 'number' ? meta.total + 1 : fallbackLength + 1;
      const perPage = typeof meta.per_page === 'number' ? meta.per_page : null;
      const nextLastPage = perPage ? Math.max(1, Math.ceil(incoming / perPage)) : meta.last_page;

      return {
        ...meta,
        total: incoming,
        last_page: nextLastPage ?? meta.last_page,
      };
    };

    const prependIfNew = (list: AppNotification[], perPage?: number) => {
      if (list.some((n) => n.id === next.id)) {
        return list;
      }
      const updated = [next, ...list];
      return typeof perPage === 'number' ? updated.slice(0, perPage) : updated;
    };

    // Update the non-paginated notifications list cache
    const listKey = queryKeys.notifications.list(activeWorkspaceId ?? undefined);
    queryClient.setQueryData(listKey, (prev: any) => {
      const prevList: AppNotification[] = Array.isArray(prev?.data) ? prev.data : [];
      const prevUnread: number = typeof prev?.unread_count === 'number' ? prev.unread_count : 0;
      const perPage = typeof prev?.meta?.per_page === 'number' ? prev.meta.per_page : undefined;
      const nextList = prependIfNew(prevList, perPage);
      if (nextList === prevList) {
        return prev;
      }

      return {
        ...(prev ?? {}),
        data: nextList,
        unread_count: prevUnread + 1,
        meta: bumpTotal(prev?.meta ?? null, prevList.length),
      };
    });

    // Update all paginated notification caches
    const queries = queryClient.getQueryCache().findAll({
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || key.length < 5) {
          return false;
        }

        const [resource, scope, keyWorkspace] = key;
        if (resource !== 'notifications' || scope !== 'list') {
          return false;
        }

        if (keyWorkspace !== workspaceKey) {
          return false;
        }

        const page = key[key.length - 2];
        const perPage = key[key.length - 1];

        return typeof page === 'number' && typeof perPage === 'number';
      }
    });

    queries.forEach((query) => {
      queryClient.setQueryData(query.queryKey, (prev: any) => {
        if (!prev || !Array.isArray(prev.data)) {
          return prev;
        }

        const prevList: AppNotification[] = prev.data;
        const meta = prev.meta ?? null;
        const perPage = typeof meta?.per_page === 'number' ? meta.per_page : prevList.length;
        const isFirstPage = (meta?.current_page ?? 1) === 1;
        const prevUnread: number = typeof prev.unread_count === 'number' ? prev.unread_count : 0;

        if (!isFirstPage && prevList.some((n) => n.id === next.id)) {
          return prev;
        }

        const nextList = isFirstPage
          ? prependIfNew(prevList, perPage)
          : prevList;

        if (nextList === prevList) {
          return prev;
        }

        return {
          ...prev,
          data: nextList,
          unread_count: prevUnread + 1,
          meta: bumpTotal(meta, prevList.length),
        };
      });
    });

    // Update standalone unread count
    queryClient.setQueryData(queryKeys.notifications.unreadCount(activeWorkspaceId ?? undefined), (prev: any) => {
      const n = typeof prev === 'number' ? prev : 0;
      return n + 1;
    });
  };

  const privateChannel = echo.private(channel);

  privateChannel.notification((notification: any) => handleIncoming(notification, 'notification'));
  privateChannel.listen(
    '.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated',
    (event: any) => handleIncoming(event, 'event'),
  );
  privateChannel.listen('.notifications.created', (event: any) => handleIncoming(event, 'event'));

  return privateChannel;
}