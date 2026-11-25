import { apiFetch } from './api-service';
import type { DeveloperWebhook, WebhookDelivery } from '../types/developer-webhooks';

export const getDeveloperWebhooks = async (): Promise<DeveloperWebhook[]> => {
    const response = await apiFetch<DeveloperWebhook[]>('/developer-webhooks');
    return response;
};

export const createDeveloperWebhook = async (data: Omit<Partial<DeveloperWebhook>, 'events'> & { events: string[] }): Promise<DeveloperWebhook> => {
    const response = await apiFetch<DeveloperWebhook>('/developer-webhooks', {
        method: 'POST',
        body: JSON.stringify(data)
    });
    return response;
};

export const updateDeveloperWebhook = async (id: number, data: Omit<Partial<DeveloperWebhook>, 'events'> & { events?: string[] }): Promise<DeveloperWebhook> => {
    const response = await apiFetch<DeveloperWebhook>(`/developer-webhooks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    return response;
};

export const deleteDeveloperWebhook = async (id: number): Promise<void> => {
    await apiFetch(`/developer-webhooks/${id}`, {
        method: 'DELETE'
    });
};

export const testDeveloperWebhook = async (id: number): Promise<void> => {
    await apiFetch(`/developer-webhooks/${id}/test`, {
        method: 'POST'
    });
};

export const getDeveloperWebhookDeliveries = async (id: number, page: number = 1): Promise<{ data: WebhookDelivery[], current_page: number, last_page: number, total: number }> => {
    const response = await apiFetch<{ data: WebhookDelivery[], current_page: number, last_page: number, total: number }>(`/developer-webhooks/${id}/deliveries?page=${page}`);
    return response;
};

export const toggleWorkspaceWebhooksEnabled = async (enabled: boolean): Promise<{ message: string, enabled: boolean }> => {
    const response = await apiFetch<{ message: string, enabled: boolean }>('/workspaces/developer-webhooks/toggle', {
        method: 'PUT',
        body: JSON.stringify({ enabled })
    });
    return response;
};