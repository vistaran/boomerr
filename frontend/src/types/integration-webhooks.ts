import type { Integration } from "./domain-integrations";

export type IntegrationWebhook = {
    ulid?: string;
    id: number;
    workspace_id: number;
    domain_id: number;
    integration_id: number;
    type: string;
    name: string;
    url: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    last_triggered_at: string | null;
    failure_count: number;
    events: string[] | null;
    integration: Integration;
    meta_json?: Record<string, any> | null;
};

export type NewWebhookFormState = {
    name: string;
    url: string;
    events: string[];
};