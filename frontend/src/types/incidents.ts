export interface Incident {
    id: number;
    ulid: string;
    domain_id: number;
    status: 'ongoing' | 'resolved';
    started_at: string;
    resolved_at: string | null;
    screenshot_url: string | null;
    ai_analysis: string | null;
    ai_summary: string | null;
    ai_summary_generated_at: string | null;
    extra_headers: {
        http_status?: number;
        checked_at?: string;
        response_headers?: Record<string, string[] | string>;
        response_body?: string;
        duration_ms?: number;
        exception?: string;
        categorized_headers?: {
            important: Record<string, string | string[]>;
            not_important: Record<string, string | string[]>;
            extra: Record<string, string | string[]>;
        };
        [key: string]: any;
    } | null;
    http_status?: number;
    response_headers?: Record<string, string[] | string>;
    response_body?: string;
    duration_ms?: number;
    exception?: string;
    domain?: any;
    system_logs?: Array<{
        id: number;
        event_type: string;
        status: string;
        message: string | null;
        occurred_at: string;
        response_time_ms: number | null;
        error_message: string | null;
        payload: Record<string, unknown> | null;
    }>;
}