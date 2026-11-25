import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/api-client';
import { queryKeys } from '../api/query-keys';
import toast from 'react-hot-toast';
import type { Domain } from '../types/domains';

export const domainListQueryKey = queryKeys.domains.latest();

// Types

export type DomainPayload = {
  name: string;
  url: string;
  label?: string | null;
  environment?: string;
  is_active?: boolean;
};

type DomainsResponse = {
  data: Domain[];
};

type DomainResponse = {
  data: Domain;
};

// Queries

// Hook to fetch all domains for the current company.

export function useDomains() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: domainListQueryKey,
    queryFn: async () => {
      const response = await api.get<DomainsResponse>('/domains');
      const incoming = dedupeDomains(response.data ?? []);
      const existing = queryClient.getQueryData<Domain[]>(domainListQueryKey) ?? [];

      if (existing.length === 0) {
        return incoming;
      }

      return mergeDomainLists(existing, incoming);
    },
    refetchInterval: 30000,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

// Hook to fetch a single domain by ID.

export function useDomain(id: string) {
  return useQuery({
    queryKey: queryKeys.domains.detail(id),
    queryFn: async () => {
      const response = await api.get<DomainResponse>(`/domains/${id}`);
      return response.data;
    },
    enabled: !!id,
    refetchInterval: 15000,
  });
}

// Mutations

// Hook to create a new domain.

export function useCreateDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DomainPayload) => {
      const response = await api.post<DomainResponse>('/domains', payload);
      return response.data;
    },
    onSuccess: (newDomain) => {
      // Optimistically add to cache
      queryClient.setQueryData<Domain[]>(
        domainListQueryKey,
        (old) => dedupeDomains([newDomain, ...(old ?? [])])
      );
      
      toast.success('Domain created successfully');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to create domain';
      toast.error(message);
    },
  });
}

// Hook to update an existing domain.

export function useUpdateDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: DomainPayload }) => {
      const response = await api.put<DomainResponse>(`/domains/${id}`, payload);
      return response.data;
    },
    onMutate: async ({ id, payload }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: domainListQueryKey });

      // Snapshot previous value
      const previousDomains = queryClient.getQueryData<Domain[]>(domainListQueryKey);

      // Optimistically update
      queryClient.setQueryData<Domain[]>(domainListQueryKey, (old) => {
        if (!old) return old;
        return old.map((domain) =>
          domain.ulid === id ? { ...domain, ...payload } : domain
        );
      });

      return { previousDomains };
    },
    onSuccess: (updatedDomain) => {
      // Update the specific domain in the list
      queryClient.setQueryData<Domain[]>(domainListQueryKey, (old) => {
        if (!old || old.length === 0) {
          return [updatedDomain];
        }

        return dedupeDomains(
          old.map((domain) =>
            domain.ulid === updatedDomain.ulid ? updatedDomain : domain
          )
        );
      });
      
      // Update the detail cache
      queryClient.setQueryData(queryKeys.domains.detail(updatedDomain.ulid), updatedDomain);
      
      toast.success('Domain updated successfully');
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousDomains) {
        queryClient.setQueryData(domainListQueryKey, context.previousDomains);
      }
      
      const message = error instanceof Error ? error.message : 'Failed to update domain';
      toast.error(message);
    },
  });
}

// Hook to delete a domain.
export function useDeleteDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/domains/${id}`);
      return id;
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: domainListQueryKey });

      // Snapshot previous value
      const previousDomains = queryClient.getQueryData<Domain[]>(domainListQueryKey);

      // Optimistically remove
      queryClient.setQueryData<Domain[]>(domainListQueryKey, (old) => {
        if (!old) return old;
        return old.filter((domain) => domain.ulid !== id);
      });

      return { previousDomains };
    },
    onSuccess: () => {
      toast.success('Domain deleted successfully');
    },
    onError: (error, _id, context) => {
      // Rollback on error
      if (context?.previousDomains) {
        queryClient.setQueryData(domainListQueryKey, context.previousDomains);
      }
      
      const message = error instanceof Error ? error.message : 'Failed to delete domain';
      toast.error(message);
    },
  });
}

// Hook to fetch a domain's title from its URL.

export function useFetchDomainTitle() {
  return useMutation({
    mutationFn: async (url: string) => {
      return api.post<{ title: string | null }>('/domains/fetch-title', { url });
    },
  });
}

// Utilities

//Utility to update a domain in the cache from realtime events.

export function updateDomainInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  domain: Domain
) {
  queryClient.setQueryData<Domain[]>(domainListQueryKey, (old) => {
    if (!old || old.length === 0) {
      return [domain];
    }

    const hasDomain = old.some((d) => d.ulid === domain.ulid);
    const next = hasDomain
      ? old.map((d) => (d.ulid === domain.ulid ? domain : d))
      : [domain, ...old];

    return dedupeDomains(next);
  });
  
  // Also update the detail cache
  queryClient.setQueryData(queryKeys.domains.detail(domain.ulid), domain);
}

export function dedupeDomains(domains?: Domain[] | null): Domain[] {
  if (!domains || domains.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const unique: Domain[] = [];

  for (const domain of domains) {
    if (!domain || (domain.ulid === undefined && (domain.id === undefined || domain.id === null))) {
      continue;
    }

    const key = domain.ulid ? domain.ulid : String(domain.id);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(domain);
  }

  return sortDomainsByNewest(unique);
}

function sortDomainsByNewest(domains: Domain[]): Domain[] {
  return domains.sort((a, b) => {
    const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
    const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
    if (bCreated !== aCreated) {
      return bCreated - aCreated;
    }
    return b.id - a.id;
  });
}

function mergeDomainLists(existing: Domain[], incoming: Domain[]): Domain[] {
  if (incoming.length === 0) {
    return dedupeDomains(existing);
  }

  const existingMap = new Map<string, Domain>();
  for (const domain of existing) {
    if (!domain || (domain.ulid === undefined && (domain.id === undefined || domain.id === null))) {
      continue;
    }
    const key = domain.ulid ? domain.ulid : String(domain.id);
    existingMap.set(key, domain);
  }

  const result: Domain[] = incoming.map((domain) => {
    const key = domain.ulid ? domain.ulid : String(domain.id);
    const prev = existingMap.get(key);
    return prev ? { ...prev, ...domain } : domain;
  });

  return dedupeDomains(result);
}

function isDomainNewer(candidate: Domain, baseline: Domain): boolean {
  return getDomainRecencyScore(candidate) >= getDomainRecencyScore(baseline);
}

function getDomainRecencyScore(domain: Domain): number {
  const candidates = [
    domain.last_checked_at,
    domain.ssl_last_checked_at,
    domain.updated_at,
    domain.created_at,
  ];

  for (const value of candidates) {
    if (!value) {
      continue;
    }

    const parsed = Date.parse(value);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return domain.id ?? 0;
}
