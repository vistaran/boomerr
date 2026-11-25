import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/query-keys';
import { dedupeDomains, domainListQueryKey } from '../hooks/use-domains';
import type {
  CompanyIntegrations,
  DiscordWebhookChannel,
  SlackWebhookChannel
} from '../hooks/use-integrations';
import type { TeamMember, PendingInvitation } from '../hooks/use-team';
import type { Domain } from '../types/domains';

const domainListPrefix = queryKeys.domains.lists();

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeDomainPayload(domain: Domain): Domain {
  return {
    ...domain,
    id: toNumber(domain.id),
    workspace_id: toNumber(domain.workspace_id),
    is_active: Boolean(domain.is_active),
    last_response_time_ms: toNullableNumber(domain.last_response_time_ms),
    ssl_days_remaining: toNullableNumber(domain.ssl_days_remaining),
  };
}

function updateDomainLists(
  queryClient: QueryClient,
  mutator: (domains: Domain[]) => Domain[]
): void {
  const applyMutation = (input: Domain[] | undefined) => {
    const baseline = Array.isArray(input) ? input : [];
    const workingCopy = [...baseline];
    const mutated = mutator(workingCopy);
    return dedupeDomains(mutated);
  };

  queryClient.setQueriesData<Domain[]>(
    { queryKey: domainListPrefix, type: 'all' },
    (existing) => applyMutation(existing)
  );

  queryClient.setQueryData<Domain[]>(domainListQueryKey, (existing) => applyMutation(existing));
}

// Update or add a domain in the cache.
export function updateDomainInCache(
  queryClient: QueryClient,
  domain: Domain
): void {
  if (import.meta.env.DEV) {
    // console.log('[Cache] Updating domain in cache:', domain);
  }

  const normalized = normalizeDomainPayload(domain);

  updateDomainLists(queryClient, (domains) => {
    const index = domains.findIndex((d) => (normalized.ulid && d.ulid === normalized.ulid) || (normalized.id && d.id === normalized.id));

    if (index === -1) {
      return [normalized, ...domains];
    }

    const next = [...domains];
    next[index] = { ...next[index], ...normalized };
    return next;
  });

  // Also update individual domain cache if it exists
  if (normalized.ulid) {
    queryClient.setQueryData(queryKeys.domains.detail(normalized.ulid), (old: any) => old ? { ...old, ...normalized } : normalized);
  }
  if (normalized.id) {
    queryClient.setQueryData(queryKeys.domains.detail(String(normalized.id)), (old: any) => old ? { ...old, ...normalized } : normalized);
  }

  // Invalidate stats to refresh dashboard charts & regional telemetry
  queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  if (normalized.ulid) {
    queryClient.invalidateQueries({ queryKey: ['domain-stats', normalized.ulid] });
    queryClient.invalidateQueries({ queryKey: ['domain-regional-status', normalized.ulid] });
    queryClient.invalidateQueries({ queryKey: ['domain-response-stats', normalized.ulid] });
  }

  if (import.meta.env.DEV) {
    // console.log('[Cache] Domain cache update complete');
  }
}

// Add a new domain to the cache.
export function addDomainToCache(
  queryClient: QueryClient,
  domain: Domain
): void {
  if (import.meta.env.DEV) {
    // console.log('[Cache] Adding new domain to cache:', domain.id, domain.name);
  }

  const normalized = normalizeDomainPayload(domain);

  updateDomainLists(queryClient, (domains) => [normalized, ...domains]);

  queryClient.setQueryData(queryKeys.domains.detail(normalized.ulid), normalized);
}

// Remove a domain from the cache.
export function removeDomainFromCache(
  queryClient: QueryClient,
  domainUlid: string
): void {
  if (import.meta.env.DEV) {
    // console.log('[Cache] Removing domain from cache:', domainId);
  }

  updateDomainLists(queryClient, (domains) => domains.filter((d) => d.ulid !== domainUlid));

  // Remove individual domain cache
  queryClient.removeQueries({ queryKey: queryKeys.domains.detail(domainUlid), exact: true });
}

// Add a webhook to the integrations cache.
export function addWebhookToCache(
  queryClient: QueryClient,
  webhook: DiscordWebhookChannel | SlackWebhookChannel,
  type: 'discord' | 'slack'
): void {
  queryClient.setQueryData<CompanyIntegrations>(
    queryKeys.integrations.company(),
    (oldData) => {
      if (!oldData) return oldData;

      if (type === 'discord') {
        // Check for duplicates
        if (oldData.discord_webhooks.some((w) => w.id === webhook.id)) {
          return oldData;
        }
        return {
          ...oldData,
          discord_webhooks: [...oldData.discord_webhooks, webhook as DiscordWebhookChannel],
        };
      } else {
        if (oldData.slack_webhooks.some((w) => w.id === webhook.id)) {
          return oldData;
        }
        return {
          ...oldData,
          slack_webhooks: [...oldData.slack_webhooks, webhook as SlackWebhookChannel],
        };
      }
    }
  );
}

//Update a webhook in the integrations cache.
export function updateWebhookInCache(
  queryClient: QueryClient,
  webhook: DiscordWebhookChannel | SlackWebhookChannel,
  type: 'discord' | 'slack'
): void {
  queryClient.setQueryData<CompanyIntegrations>(
    queryKeys.integrations.company(),
    (oldData) => {
      if (!oldData) return oldData;

      if (type === 'discord') {
        return {
          ...oldData,
          discord_webhooks: oldData.discord_webhooks.map((w) =>
            w.id === webhook.id ? (webhook as DiscordWebhookChannel) : w
          ),
        };
      } else {
        return {
          ...oldData,
          slack_webhooks: oldData.slack_webhooks.map((w) =>
            w.id === webhook.id ? (webhook as SlackWebhookChannel) : w
          ),
        };
      }
    }
  );
}

// Remove a webhook from the integrations cache.
export function removeWebhookFromCache(
  queryClient: QueryClient,
  webhookId: number,
  type: 'discord' | 'slack'
): void {
  queryClient.setQueryData<CompanyIntegrations>(
    queryKeys.integrations.company(),
    (oldData) => {
      if (!oldData) return oldData;

      if (type === 'discord') {
        return {
          ...oldData,
          discord_webhooks: oldData.discord_webhooks.filter((w) => w.id !== webhookId),
        };
      } else {
        return {
          ...oldData,
          slack_webhooks: oldData.slack_webhooks.filter((w) => w.id !== webhookId),
        };
      }
    }
  );
}

//Add a team member to the cache.
export function addTeamMemberToCache(
  queryClient: QueryClient,
  member: TeamMember
): void {
  queryClient.setQueryData<TeamMember[]>(queryKeys.team.members(), (oldData) => {
    if (!oldData) return [member];

    // Check for duplicates
    if (oldData.some((m) => m.id === member.id)) {
      return oldData;
    }

    return [...oldData, member];
  });
}

// Update a team member in the cache.
export function updateTeamMemberInCache(
  queryClient: QueryClient,
  member: TeamMember
): void {
  queryClient.setQueryData<TeamMember[]>(queryKeys.team.members(), (oldData) => {
    if (!oldData) return oldData;
    return oldData.map((m) => (m.id === member.id ? member : m));
  });
}

//Remove a team member from the cache.
export function removeTeamMemberFromCache(
  queryClient: QueryClient,
  memberId: number
): void {
  queryClient.setQueryData<TeamMember[]>(queryKeys.team.members(), (oldData) => {
    if (!oldData) return oldData;
    return oldData.filter((m) => m.id !== memberId);
  });
}

// Add a pending invitation to the cache.
export function addInvitationToCache(
  queryClient: QueryClient,
  invitation: PendingInvitation
): void {
  queryClient.setQueryData<PendingInvitation[]>(
    queryKeys.team.invitations.pending(),
    (oldData) => {
      if (!oldData) return [invitation];

      if (oldData.some((i) => i.ulid === invitation.ulid)) {
        return oldData;
      }

      return [...oldData, invitation];
    }
  );
}

// Remove a pending invitation from the cache (e.g., when accepted).
export function removeInvitationFromCache(
  queryClient: QueryClient,
  invitationId: string
): void {
  queryClient.setQueryData<PendingInvitation[]>(
    queryKeys.team.invitations.pending(),
    (oldData) => {
      if (!oldData) return oldData;
      return oldData.filter((i) => i.ulid !== invitationId);
    }
  );
}

// Invalidate all domain queries (fallback for complex updates).
export function invalidateDomains(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.domains.all });
}

// Invalidate all integration queries (fallback for complex updates).
export function invalidateIntegrations(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
}

