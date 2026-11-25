import { api } from '../api/api-client';

type NotificationChannelSummary = {
  id: number;
  name: string | null;
  type: string | null;
  url: string | null;
  is_active: boolean;
  last_trigger_status: string | null;
};

export type SystemLogActor = {
  id: number | null;
  type: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
  department: string | null;
  snapshot: Record<string, unknown> | null;
};

export type SystemLogRecipient = {
  type: string;
  to?: string | null;
  message_preview?: string | null;
  duration?: string | null;
  subject?: string | null;
  webhook_name?: string | null;
  channel?: string | null;
  task_name?: string | null;
  list_name?: string | null;
  task_id?: string | null;
  url?: string | null;
} | null;

export type SystemLogLifecycle = {
  triggered_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  execution_status: string | null;
};

export type SystemLogChild = {
  id: number;
  log_type: string;
  integration_key: string | null;
  event_type: string;
  source: string | null;
  trigger_source: string | null;
  status: string;
  execution_status: string;
  message: string | null;
  response_time_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  integration_metadata: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  lifecycle: SystemLogLifecycle;
  triggered_at: string | null;
  completed_at: string | null;
  occurred_at: string | null;
  notification_channel: {
    id: number;
    name: string | null;
    type: string | null;
  } | null;
  integration: {
    id: number | null;
    name: string | null;
    key: string | null;
  } | null;
  actor: {
    name: string | null;
    email: string | null;
  } | null;
  recipient: SystemLogRecipient;
};

export type SystemLogChildrenSummary = {
  total: number;
  success: number;
  failure: number;
  skipped: number;
  pending: number;
  by_integration?: Record<string, {
    total: number;
    success: number;
    failure: number;
  }>;
} | null;

export type SystemLogEntry = {
  id: number;
  parent_id: number | null;
  log_type: string;
  workspace_id: number;
  domain_id: number | null;
  workspace?: {
    id: number;
    name: string | null;
  } | null;
  domain?: {
    id: number;
    name: string;
    url: string | null;
  } | null;
  domain_notification_channels?: {
    by_type: Record<string, NotificationChannelSummary[]>;
    counts: Record<string, number>;
    channels?: NotificationChannelSummary[];
  } | null;
  notification_channel?: {
    id: number;
    name: string | null;
    type: string | null;
    url?: string | null;
    is_active?: boolean;
    last_trigger_status?: string | null;
  } | null;
  integration?: {
    id: number | null;
    name: string | null;
    key: string | null;
    is_launched?: boolean | null;
  } | null;
  // Resolved integration key for easier grouping
  integration_key: string | null;
  integration_name: string | null;
  event_type: string;
  source: string | null;
  trigger_source?: string | null;
  category: string | null;
  status: string;
  execution_status: string;
  severity: string;
  message: string | null;
  response_time_ms: number | null;
  latest_response_time_ms?: number | null;
  error_code: string | null;
  error_message: string | null;
  payload: Record<string, unknown> | null;
  integration_metadata: Record<string, unknown> | null;
  has_sensitive_payload: boolean;
  occurred_at: string;
  triggered_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  lifecycle: SystemLogLifecycle;
  actor: SystemLogActor;
  // Recipient info for personal integrations
  recipient: SystemLogRecipient;
  correlation_id: string | null;
  children?: SystemLogChild[];
  children_summary?: SystemLogChildrenSummary;
  domain_integration?: {
    id: number;
    enabled: boolean;
    integration?: {
      id: number | null;
      name: string | null;
      key: string | null;
      is_launched?: boolean | null;
    } | null;
    channels?: Array<{
      id: number;
      name: string | null;
      type: string | null;
      url: string | null;
      is_active: boolean;
      last_trigger_status: string | null;
    }>;
    channel_counts?: Record<string, number> | null;
    primary_channel?: {
      id: number;
      name: string | null;
      type: string | null;
      url: string | null;
      is_active: boolean;
      last_trigger_status: string | null;
    } | null;
  } | null;
  domain_integrations?: Array<{
    id: number;
    enabled: boolean;
    integration?: {
      id: number | null;
      name: string | null;
      key: string | null;
      is_launched?: boolean | null;
    } | null;
    channels?: Array<{
      id: number;
      name: string | null;
      type: string | null;
      url: string | null;
      is_active: boolean;
      last_trigger_status: string | null;
    }>;
    channel_counts?: Record<string, number> | null;
    primary_channel?: {
      id: number;
      name: string | null;
      type: string | null;
      url: string | null;
      is_active: boolean;
      last_trigger_status: string | null;
    } | null;
  }>;
};

export type SystemLogFilters = {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string | string[];
  executionStatus?: string | string[];
  eventType?: string | string[];
  logType?: string | string[];
  integrationKey?: string;
  domainId?: number;
  channelId?: number;
  from?: string;
  to?: string;
  includeChildren?: boolean;
};

export type PaginatedLinks = {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
};

export type PaginatedMeta = {
  current_page: number;
  from: number | null;
  last_page: number;
  links: Array<{ url: string | null; label: string; active: boolean }>;
  path: string;
  per_page: number;
  to: number | null;
  total: number;
};

export type SystemLogPaginatedResponse = {
  data: SystemLogEntry[];
  links: PaginatedLinks;
  meta: PaginatedMeta;
};

export async function fetchSystemLogs(filters: SystemLogFilters = {}): Promise<SystemLogPaginatedResponse> {
  const query = buildQueryString(filters);
  return api.get<SystemLogPaginatedResponse>(`/logs/system${query}`);
}

function buildQueryString(filters: SystemLogFilters): string {
  const params = new URLSearchParams();

  if (filters.page) params.set('page', String(filters.page));
  if (filters.perPage) params.set('per_page', String(filters.perPage));
  if (filters.domainId) params.set('domain_id', String(filters.domainId));
  if (filters.channelId) params.set('notification_channel_id', String(filters.channelId));
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

  const executionStatuses = normalizeArray(filters.executionStatus ?? filters.status);
  executionStatuses.forEach((status) => params.append('execution_status[]', status));

  const events = normalizeArray(filters.eventType);
  events.forEach((event) => params.append('event_type[]', event));

  const logTypes = normalizeArray(filters.logType);
  logTypes.forEach((type) => params.append('log_type[]', type));

  if (filters.integrationKey) {
    params.set('integration_key', filters.integrationKey);
  }

  if (filters.includeChildren) {
    params.set('include_children', '1');
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

function normalizeArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}
