import type { OnboardingData } from "../services/api-service";

export type User = {
    id: number;
    ulid?: string;
    name: string;
    email: string;
    contact_email?: string | null;
    workspace_id?: number | null;
    workspace_ulid?: string | null;
    role?: "owner" | "admin" | "member";
    email_verified_at?: string | null;
    onboarding_settings?: OnboardingData;
};