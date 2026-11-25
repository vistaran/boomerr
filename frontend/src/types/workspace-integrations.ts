import type { Integration } from "./domain-integrations";

export interface WorkspaceIntegration {
    id: number;
    ulid: string;
    workspace_id: number;
    integration_id: number;
    enabled: boolean; // 1 | 0 from backend
    created_at: string;
    updated_at: string;
    integration: Integration;
}