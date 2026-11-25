export interface DeveloperWebhookEvent {
    id: number;
    webhook_id: number;
    event_name: string;
    created_at: string;
    updated_at: string;
}

export interface DeveloperWebhook {
    id: number;
    workspace_id: number;
    name: string;
    url: string;
    secret: string | null;
    enabled: boolean;
    timeout: number;
    retry_enabled: boolean;
    created_at: string;
    updated_at: string;
    events?: DeveloperWebhookEvent[];
}

export interface WebhookDelivery {
    id: number;
    webhook_id: number;
    event_id: string | null;
    event_name: string;
    http_status: number | null;
    status: 'success' | 'failed' | 'pending';
    attempt: number;
    request_payload: any;
    response_headers: any;
    response_body: string | null;
    duration_ms: number | null;
    created_at: string;
    updated_at: string;
}

export const WEBHOOK_AVAILABLE_EVENTS = [
    'Domain Up',
    'Domain Down',
    'SSL Expiring',
    'SSL Expired'
];