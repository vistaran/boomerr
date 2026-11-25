export const queryKeys = {
  domains: {
    all: ['domains'] as const,
    lists: () => [...queryKeys.domains.all, 'list'] as const,
    latest: () => [...queryKeys.domains.lists(), 'latest'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.domains.lists(), filters] as const,
    details: () => [...queryKeys.domains.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.domains.details(), id] as const,
  },

  integrations: {
    all: ['integrations'] as const,
    lists: () => [...queryKeys.integrations.all, 'list'] as const,
    latest: () => [...queryKeys.integrations.lists(), 'latest'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.integrations.lists(), filters] as const,
    company: () => [...queryKeys.integrations.all, 'company'] as const,
    available: (domainId: number | null) => [...queryKeys.integrations.all, 'available', domainId] as const,
    channels: () => [...queryKeys.integrations.all, 'channels'] as const,
    channel: (id: number) => [...queryKeys.integrations.channels(), id] as const,
    domain: (domainId: number | null) => [...queryKeys.integrations.all, 'domain', domainId] as const,
  },

  team: {
    all: ['team'] as const,
    members: () => [...queryKeys.team.all, 'members'] as const,
    member: (id: number) => [...queryKeys.team.members(), id] as const,
    invitations: {
      all: () => [...queryKeys.team.all, 'invitations'] as const,
      pending: () => [...queryKeys.team.invitations.all(), 'pending'] as const,
      detail: (token: string) => [...queryKeys.team.invitations.all(), token] as const,
    },
  },

  user: {
    all: ['user'] as const,
    current: () => [...queryKeys.user.all, 'current'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
  },

  // departments: {
  //   all: ['departments'] as const,
  //   departmentUsers: (departmentId: number) =>
  //     [...queryKeys.departments.all, 'department-users', departmentId] as const,
  // },

  notifications: {
    all: ['notifications'] as const,
    list: (workspaceId?: string | number | null) => ['notifications', 'list', workspaceId ?? 'global'] as const,
    unreadCount: (workspaceId?: string | number | null) => ['notifications', 'unread-count', workspaceId ?? 'global'] as const,
  },

  systemLogs: {
    all: ['system-logs'] as const,
    list: (filters?: Record<string, unknown>) => ['system-logs', 'list', filters ?? {}] as const,
  },

  billing: {
    all: ['billing'] as const,
    plans: () => [...queryKeys.billing.all, 'plans'] as const,
    planInfo: () => [...queryKeys.billing.all, 'plan-info'] as const,
  },

  auditLogs: {
    all: ['audit-logs'] as const,
    list: (filters?: Record<string, unknown>) => ['audit-logs', 'list', filters ?? {}] as const,
  },

} as const;



// Type helper for extracting query key types
export type QueryKeys = typeof queryKeys;
