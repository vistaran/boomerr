// (already imported at the top)
import { apiClient } from '../api/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getIncident,
  resolveIncident,
  chatWithIncidentAI,
  getIncidentAIChat,
} from '../services/incident-service';
import type { IncidentListResponse } from '../services/incident-service';
import * as incidentService from '../services/incident-service';
import type { Incident } from '../types/incidents';
import type { SystemLogEntry } from './use-system-logs';

export function useIncidentScreenshotUrl(incidentId: number | string | undefined) {
  return useQuery({
    queryKey: ['incident-screenshot-url', incidentId],
    queryFn: async () => {
      if (!incidentId) return null;
      const res = await apiClient(`/incidents/${incidentId}/screenshot-url`);
      return (res as { url: string | null })?.url ?? null;
    },
    enabled: !!incidentId,
    staleTime: 1000 * 60 * 4, // 4 minutes
  });
}

export function useIncidents(params?: { domain_id?: number; page?: number }, options?: { enabled?: boolean }) {
  return useQuery<IncidentListResponse, Error>({
    queryKey: ['incidents', params],
    queryFn: () => incidentService.getIncidents(params),
    enabled: options?.enabled !== undefined ? options.enabled : true,
  });
}

export function useIncident(id: string, params?: { timezone?: string }, options?: { enabled?: boolean }) {
  return useQuery<{ incident: Incident; system_logs: SystemLogEntry[] }, Error>({
    queryKey: ['incident', id, params?.timezone],
    queryFn: () => getIncident(id, params),
    enabled: (options?.enabled !== undefined ? options.enabled : true) && !!id,
  });
}

export function useResolveIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resolveIncident(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident'] });
    },
  });
}

export function useIncidentAIChat(id: string, timezone?: string) {
  return useMutation({
    mutationFn: (message: string) => chatWithIncidentAI(id, message, timezone),
  });
}

export function useIncidentAIChatHistory(id: string) {
  return useQuery({
    queryKey: ['incident-ai-chat', id],
    queryFn: () => getIncidentAIChat(id),
    enabled: !!id,
  });
}
