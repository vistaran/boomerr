// --- Dynamic Integrations List ---

export type Integration = {
  id: number;
  key: string;
  name: string;
  is_active: boolean;
  is_launched?: boolean;
};

/**
 * Hook to fetch available integrations for a domain (dynamic, not hardcoded).
 *
 * @example
 * const { data: availableIntegrations, isLoading } = useAvailableIntegrations(domainId);
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/api-client';
import { queryKeys } from '../api/query-keys';
import toast from 'react-hot-toast';

// Types

export type DiscordWebhookChannel = {
  id?: number;
  ulid?: string;
  name: string;
  url: string;
  is_active: boolean;
  last_triggered_at?: string | null;
  success_count?: number;
  failure_count?: number;
};

export type SlackWebhookChannel = {
  id?: number;
  ulid?: string;
  name: string;
  url: string;
  is_active: boolean;
};

export type WebhookChannel = DiscordWebhookChannel | SlackWebhookChannel;

export type CompanyIntegrations = {
  primary_contact_email: string | null;
  discord_webhooks: DiscordWebhookChannel[];
  slack_webhooks: SlackWebhookChannel[];
};

export type AddChannelPayload = {
  integration_ulid: string;
  name: string;
  url: string;
};

export type UpdateChannelPayload = {
  name?: string;
  url?: string;
  is_active?: boolean;
};

type ChannelResponse = {
  data: WebhookChannel;
};

type DomainIntegration = {
  id: number;
  domain_id: number;
  integration_id: number;
  enabled: number;
  integration: {
    id: number;
    key: string;
    name: string;
    is_active: boolean;
    is_launched: number;
  };
};

/**
 * Hook to fetch domain-specific integrations (webhooks, contact email, etc.).
 * 
 * @example
 * const { data: integrations, isLoading } = useDomainIntegrations(domainId);
 */
export function useDomainIntegrations(domainId: number | null) {
  return useQuery({
    queryKey: queryKeys.integrations.domain(domainId),
    enabled: typeof domainId === 'number',

    queryFn: async ({ queryKey }) => {
      const [, , resolvedDomainId] = queryKey as [
        'integrations',
        'domain',
        number
      ];

      const response = await api.get<any>(
        `/domains/${resolvedDomainId}/integrations`
      );

      return response.data;
    },
  });
}

export function useAvailableIntegrations(domainId: number | null) {
  return useQuery({
    queryKey: queryKeys.integrations.available(domainId),
    queryFn: async () => {
      if (!domainId) return [];
      const response = await api.get<{ data: DomainIntegration[] }>(
        `/domains/${domainId}/integrations`
      );

      // 🔥 NORMALIZE HERE
      return response.data.map((item) => ({
        id: item.integration.id,
        key: item.integration.key,
        name: item.integration.name,
        is_active: item.integration.is_active,
        is_launched: Boolean(item.integration.is_launched),
        enabled: Boolean(item.enabled),
      }));
    },
    enabled: !!domainId,
  });
}
// Mutations

// Hook to add a new notification channel (Discord or Slack webhook).

export function useAddNotificationChannel(domainId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AddChannelPayload) => {
      if (!domainId) throw new Error('No domain selected');
      const response = await api.post<ChannelResponse>(`/domains/${domainId}/integrations/webhooks`, { ...payload, domain_id: domainId });
      return { channel: response.data, type: payload.integration_ulid };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.domain(domainId) });
      toast.success('Webhook added successfully');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to add webhook';
      toast.error(message);
    },
  });
}

// Hook to update a notification channel.

export function useUpdateNotificationChannel(domainId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: UpdateChannelPayload; }) => {
      if (!domainId) throw new Error('No domain selected');
      // Expecting `id` to be the channel ULID (string) or fallback to numeric id
      const encoded = encodeURIComponent(String(id));
      const response = await api.put<ChannelResponse>(`/integrations/webhooks/${encoded}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.domain(domainId) });
      toast.success('Webhook updated successfully');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update webhook';
      toast.error(message);
    },
  });
}

// Hook to delete a notification channel.

export function useDeleteNotificationChannel(domainId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      if (!domainId) throw new Error('No domain selected');
      const encoded = encodeURIComponent(String(id));
      await api.delete(`/integrations/webhooks/${encoded}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.domain(domainId) });
      toast.success('Webhook deleted successfully');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to delete webhook';
      toast.error(message);
    },
  });
}

// Hook to test a Discord notification channel.


export function useTestChannel(domain_id: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const encoded = encodeURIComponent(String(id));
      const res = await api.post<{ message: string }>(
        `/domains/integrations/channels/${encoded}/test`
      );
      return res;
    },
    onSuccess: (_data, id) => {
      toast.success('Test notification sent!');
      if (id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.integrations.domain(domain_id),
        });
      }
    },
    onError: (error: any, id?: number) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to send test notification';
      toast.error(message);
      if (id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.integrations.domain(domain_id),
        });
      }
    },
  });
}

// Hook to test a Slack notification channel.
export function useTestSlackChannel(domain_id: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const encoded = encodeURIComponent(String(id));
      return api.post(`/domains/integrations/channels/${encoded}/test`);
    },
    onSuccess: () => {
      toast.success('Test notification sent!');
      if (domain_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.integrations.domain(domain_id),
        });
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to send test notification';
      toast.error(message);
      if (domain_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.integrations.domain(domain_id),
        });
      }
    },
  });
}