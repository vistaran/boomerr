import { api, getAuthToken } from '../api/api-client';
import type { SystemLogEntry } from '../hooks';
import type { Incident } from '../types/incidents';

export interface IncidentListResponse {
  data: Incident[];
  current_page: number;
  last_page: number;
  total: number;
}

export const getIncidents = async (params?: { domain_id?: number; page?: number }) => {
  return api.get<IncidentListResponse>('/incidents', { body: undefined, ...(params ? { params } : {}) });
};

export const getIncident = async (id: string, params?: { timezone?: string }) => {
  return api.get<{ incident: Incident, system_logs: SystemLogEntry[] }>(`/incidents/${id}`, { body: undefined, ...(params ? { params } : {}) });
};

export const resolveIncident = async (id: string) => {
  return api.post(`/incidents/${id}/resolve`);
};

export const chatWithIncidentAI = async (id: string, message: string, timezone?: string) => {
  return api.post(`/incidents/${id}/chat`, { message, timezone });
};

export const getIncidentAIChat = async (id: string) => {
  return api.get<{ messages: { role: 'user' | 'ai'; message: string; created_at: string }[] }>(`/incidents/${id}/get-chat`);
};

function getIncidentApiBase(): string {
  const envApi = (import.meta as any).env?.VITE_API_BASE_URL;
  if (!envApi || envApi.includes('localhost:8000') || (import.meta as any).env?.PROD) {
    return '/api';
  }
  return envApi;
}

// Stream AI chat response using Server-Sent Events style over fetch
export async function chatWithIncidentAIStream(
  id: string,
  message: string,
  onDelta: (delta: string) => void,
  timezone?: string
): Promise<string> {
  const API_BASE: string = getIncidentApiBase();
  const token = getAuthToken();
  const controller = new AbortController();
  const res = await fetch(`${API_BASE}/incidents/${encodeURIComponent(id)}/chat-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Requested-With': 'XMLHttpRequest',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // credentials not required when using bearer tokens; keep default
    body: JSON.stringify({ message, timezone }),
    // Ensure the browser doesn't try to buffer aggressively
    cache: 'no-store',
    signal: controller.signal,
  });

  if (!res.body) {
    throw new Error('Streaming not supported by the browser or server');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';
  let emittedAnything = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Split into SSE events separated by double newlines
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      // Each event may have multiple lines
      const lines = event.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;
      // Collect data: lines and ignore comments (lines starting with ':')
      const dataLines = lines
        .filter(l => !l.startsWith(':'))
        .filter(l => l.startsWith('data:'))
        .map(l => l.slice(5).trim());

      if (dataLines.length === 0) continue;
      const payload = dataLines.join('\n');
      if (payload === '[DONE]') {
        // Finish reading remaining stream gracefully
        // Drain the reader
        try { await reader.cancel(); } catch { /* ignore cancel errors */ }
        break;
      }
      try {
        const json = JSON.parse(payload);
        const delta = typeof json === 'string' ? json : (json.delta ?? '');
        if (delta) {
          full += delta;
          // If the server/proxy coalesced a big chunk, progressively reveal to simulate typing
          if (!emittedAnything && delta.length > 200) {
            for (let i = 0; i < delta.length; i += 5) {
              const slice = delta.slice(i, i + 5);
              onDelta(slice);
              // small delay yields smoother animation without blocking
              await new Promise(r => setTimeout(r, 10));
            }
          } else {
            onDelta(delta);
          }
          emittedAnything = true;
        }
      } catch {
        // Fallback to raw text
        full += payload;
        if (!emittedAnything && payload.length > 200) {
          for (let i = 0; i < payload.length; i += 5) {
            const slice = payload.slice(i, i + 5);
            onDelta(slice);
            await new Promise(r => setTimeout(r, 10));
          }
        } else {
          onDelta(payload);
        }
        emittedAnything = true;
      }
    }
  }

  return full;
}

export async function downloadIncidentPdf(id: string): Promise<Blob> {
  const API_BASE: string = getIncidentApiBase();
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/incidents/${encodeURIComponent(id)}/download-pdf`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error('Failed to download PDF report');
  }

  return res.blob();
}

export async function downloadAllIncidentsPdf(): Promise<Blob> {
  const API_BASE: string = getIncidentApiBase();
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/incidents-report/download`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error('Failed to download Incidents Summary Report');
  }

  return res.blob();
}
export async function downloadAllIncidentsCsv(): Promise<Blob> {
  const API_BASE: string = getIncidentApiBase();
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/incidents-report/download-csv`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error('Failed to download Incidents Summary CSV');
  }

  return res.blob();
}
