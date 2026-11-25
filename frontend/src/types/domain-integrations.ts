export interface DomainIntegration {
    id: number;
    ulid?: string;
    domain_id: number;
    integration_id: number;
    enabled: boolean; // 1 | 0 from backend
    created_at: string;
    updated_at: string;
    integration: Integration;
}

export interface Integration {
    id: number;
    key: string; // e.g. "discord", "slack"
    name: string;
    is_active: boolean;
    is_launched: number; // 1 | 0 from backend
    is_configuration_needed: number;
    created_at: string | null;
    updated_at: string | null;
}