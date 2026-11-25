// --- INTEGRATIONS ---


import type { Department, DepartmentUser } from "../realtime/department";
import type { Domain } from "../types/domains";
import type { User } from "../types/user";

// src/api.ts
const envApi = import.meta.env.VITE_API_BASE_URL;
const envServer = import.meta.env.VITE_SERVER_URL;
const API_BASE = (import.meta.env.PROD || !envApi || envApi.includes('localhost:8000'))
    ? '/api'
    : envApi;
const VITE_SERVER_URL = (import.meta.env.PROD || !envServer || envServer.includes('localhost:8000'))
    ? ''
    : envServer;

export type ApiError = Error & {
    status?: number;
    payload?: unknown;
};

export function isApiError(error: unknown): error is ApiError {
    return error instanceof Error;
}

export type WorkspaceSummary = {
    id: number;
    ulid: string;
    name: string;
    slug: string;
    role: "owner" | "admin" | "member";
    is_current: boolean;
    owner_email?: string;
    developer_webhooks_enabled?: boolean;
};

export type Workspace = {
    id: number;
    ulid: string;
    name: string;
    slug: string;
    primary_contact_email: string | null;
    timezone: string | null;
};

export type TeamMember = {
    id: number;
    name: string;
    email: string;
    role: "owner" | "admin" | "member";
};

export type DomainPayload = {
    name: string;
    url: string;
    label?: string | null;
    environment?: string;
    is_active?: boolean;
};

function getToken(): string | null {
    return localStorage.getItem("dm_token");
}

function extractErrorMessage(data: unknown): string | null {
    if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        const errors = obj.errors as unknown;

        if (errors && typeof errors === "object") {
            const bag = errors as Record<string, unknown>;
            const msgs: string[] = [];
            Object.values(bag).forEach((v) => {
                if (Array.isArray(v)) {
                    v.forEach((item) => {
                        if (typeof item === "string") msgs.push(item);
                    });
                }
            });
            if (msgs.length) return msgs.join(", ");
        }

        if (typeof obj.message === "string") {
            // Mask technical framework / routing errors with user-friendly messages
            if (obj.message.toLowerCase().includes("could not be found") || obj.message.toLowerCase().includes("not found")) {
                return "The requested service or account was not found. Please verify your details or try again.";
            }
            return obj.message;
        }
    }
    return null;
}

const inFlightGetRequests = new Map<string, Promise<any>>();

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method || "GET").toUpperCase();

    if (method === "GET") {
        const cacheKey = `${path}:${getToken() ?? ""}`;
        const existing = inFlightGetRequests.get(cacheKey);
        if (existing) {
            return existing;
        }

        const promise = executeFetch<T>(path, options).finally(() => {
            inFlightGetRequests.delete(cacheKey);
        });

        inFlightGetRequests.set(cacheKey, promise);
        return promise;
    }

    return executeFetch<T>(path, options);
}

async function executeFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();

    const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    let data: unknown = null;
    try {
        data = await res.json();
    } catch {
        // ignore
    }

    if (!res.ok) {
        const message = extractErrorMessage(data) ?? "Request failed";
        const apiError = new Error(message) as ApiError;
        apiError.status = res.status;
        apiError.payload = data;

        // Handle rate limiting specifically
        if (res.status === 429 && data && typeof data === 'object') {
            const rateLimitData = data as Record<string, unknown>;
            if (rateLimitData.message) {
                apiError.message = rateLimitData.message as string;
            }
        }

        throw apiError;
    }

    return data as T;
}

export async function fetchHomeData<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${VITE_SERVER_URL}${path}`, {
        ...options,
        headers,
    });

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = extractErrorMessage(data) ?? "Request failed";
        const apiError = new Error(message) as ApiError;
        apiError.status = res.status;
        apiError.payload = data;
        throw apiError;
    }

    return res.json() as Promise<T>;
}

// --- AUTH ---


export async function sendLoginOtp(email: string, captchaToken?: string) {
    const res = await fetch(`${API_BASE}/login/send-otp`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email,
            captcha_token: captchaToken || undefined,
        }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const message = extractErrorMessage(data) ?? "Unable to send verification code. Please try again.";
        throw new Error(message);
    }

    return data as { message: string };
}

export async function verifyLoginOtp(email: string, otp: string) {
    const res = await fetch(`${API_BASE}/login/verify-otp`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email,
            otp,
        }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const message = extractErrorMessage(data) ?? "Invalid verification code.";
        throw new Error(message);
    }

    return data as { token: string; user: User; workspaces: WorkspaceSummary[] };
}

export async function login(email: string, password: string, captchaToken: string) {
    const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email,
            password,
            captcha_token: captchaToken,
            device_name: "web", // Breeze API usually expects this
        }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const message = extractErrorMessage(data) ?? "Unable to login. Please try again.";

        // Handle invalid credentials with a clear message
        if (res.status === 401) {
            throw new Error("Invalid email or password.");
        }

        if (res.status === 422 && message.toLowerCase().includes("credential")) {
            throw new Error("Invalid email or password.");
        }

        // Handle rate limiting specifically
        if (res.status === 429 && data && typeof data === 'object') {
            const rateLimitData = data as Record<string, unknown>;
            const rateLimitMessage = rateLimitData.message as string || "Too many login attempts";
            throw new Error(rateLimitMessage);
        }

        throw new Error(message);
    }

    return data as { token: string; user: User; workspaces: WorkspaceSummary[] };
}

export async function fetchCurrentUser(token: string): Promise<User> {
    const res = await fetch(`${API_BASE}/user`, {
        method: "GET",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        throw new Error(data?.message || "Failed to fetch user profile");
    }

    return data as User;
}


export async function register(
    name: string,
    email: string,
    password: string,
    passwordConfirmation: string,
    captchaToken: string
) {
    const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name,
            email,
            password,
            password_confirmation: passwordConfirmation,
            captcha_token: captchaToken,
            device_name: "web",
        }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const message = extractErrorMessage(data) ?? "Registration failed";
        throw new Error(message);
    }

    // Expecting { token, user }
    return data as { token: string; user: User };
}

export async function logout() {
    try {
        await apiFetch("/logout", { method: "POST" });
    } catch {
        // ignore
    }
}

export async function getWorkspaces(): Promise<WorkspaceSummary[]> {
    const data = await apiFetch<{ data: WorkspaceSummary[] }>("/workspaces", { method: "GET" });
    return data.data ?? [];
}

export async function createWorkspace(payload: { name: string }): Promise<{
    message: string;
    workspace: Workspace;
    user: User;
    workspaces: WorkspaceSummary[];
}> {
    return apiFetch("/workspaces", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function switchWorkspace(workspaceId: string): Promise<{
    message: string;
    user: User;
    workspaces: WorkspaceSummary[];
}> {
    return apiFetch(`/workspaces/${workspaceId}/switch`, {
        method: "POST",
    });
}

// --- DOMAINS ---

export async function getDomains(): Promise<Domain[]> {
    const data = await apiFetch<{ data: Domain[] }>("/domains", {
        method: "GET",
    });
    return (data?.data ?? []) as Domain[];
}

export type MonitoringRegion = {
    aws_region: string;
    name: string;
};

export async function getMonitoringRegions(): Promise<MonitoringRegion[]> {
    const data = await apiFetch<{ data: MonitoringRegion[] }>("/monitoring-regions", {
        method: "GET",
    });
    return data?.data ?? [];
}

// --- DOMAIN STATUS STATS ---

export type DomainStatusBucket = {
    bucket_start: string;          // ISO timestamp
    status: 'up' | 'down';
    incident_ulid: string | null;
};

export type DomainStatusStats = {
    domain_id: number;
    range: '24h' | '7d' | '30d' | '1y';
    bucket: string;                // "hour" | "12h" | "day" | "month"
    buckets: DomainStatusBucket[];
};

export async function getDomainStatusStats(
    domainId: string,
    range: "24h" | "7d" | "30d" | "1y" = "24h",
    region?: string
): Promise<DomainStatusStats> {
    const url = region && region !== 'all'
        ? `/domains/${domainId}/status-stats?range=${encodeURIComponent(range)}&region=${encodeURIComponent(region)}`
        : `/domains/${domainId}/status-stats?range=${encodeURIComponent(range)}`;

    const data = await apiFetch<{ data: DomainStatusStats }>(url, { method: "GET" });
    return data.data;
}

// --- DOMAIN REGIONAL STATUS ---

export type DomainRegionalStatusPoint = {
    id: number;
    status: 'up' | 'down';
    response_time_ms: number | null;
    error_message: string | null;
    checked_at: string | null;
};

export type DomainRegionalIncident = {
    id: number;
    error_message: string;
    checked_at: string | null;
};

export type DomainRegionalStatus = {
    region: string;
    region_name: string;
    location: string | null;
    status: 'up' | 'down';
    response_time_ms: number | null;
    min_response_time_ms: number | null;
    max_response_time_ms: number | null;
    avg_response_time_ms: number | null;
    uptime_percent?: number;
    total_checks_24h?: number;
    checked_at: string | null;
    history?: DomainRegionalStatusPoint[];
    recent_incidents?: DomainRegionalIncident[];
};

export async function getDomainRegionalStatus(domainId: string, region?: string): Promise<DomainRegionalStatus[]> {
    const url = region
        ? `/domains/${domainId}/regional-status?region=${encodeURIComponent(region)}`
        : `/domains/${domainId}/regional-status`;
    const data = await apiFetch<{ data: DomainRegionalStatus[] }>(
        url,
        { method: "GET" }
    );
    return data.data;
}


// --- DOMAIN RESPONSE STATS ---

export type DomainResponseStats = {
    domain_id: number;
    range: "24h" | "7d" | "30d" | "1y";
    bucket: "10s" | "1m" | "15m" | "1h" | "1d" | "custom";
    labels: string[]; // ISO timestamps
    ms: number[]; // avg per bucket (0 for nulls for visibility)
    null_count: number; // number of buckets without data

    min_response_time_ms: number | null;
    max_response_time_ms: number | null;
    avg_response_time_ms: number | null;
};

export async function getDomainResponseStats(
    domainId: string,
    range: "24h" | "7d" | "30d" | "1y" = "24h",
    bucket: "auto" | "10s" | "1m" | "15m" | "1h" | "1d" = "auto",
    region?: string
): Promise<DomainResponseStats> {
    const url = region && region !== 'all'
        ? `/domains/${domainId}/response-stats?range=${encodeURIComponent(range)}&bucket=${encodeURIComponent(bucket)}&region=${encodeURIComponent(region)}`
        : `/domains/${domainId}/response-stats?range=${encodeURIComponent(range)}&bucket=${encodeURIComponent(bucket)}`;

    const data = await apiFetch<{ data: DomainResponseStats }>(url, { method: "GET" });
    return data.data as DomainResponseStats;
}

export type DomainAnalysisRecord = {
    domain_id: number;
    performance: number | null;
    seo: number | null;
    ux: number | null;
    performanceSuggestions: string[];
    seoSuggestions: string[];
    uxSuggestions: string[];
    securitySuggestions: string[];
    updated_at: string | null;
};

export async function getDomainAnalysis(domainId: string): Promise<DomainAnalysisRecord | null> {
    const data = await apiFetch<{ data: DomainAnalysisRecord | null }>(`/domains/${domainId}/analysis`, {
        method: "GET",
    });
    return data.data ?? null;
}

export async function reanalyzeDomainAnalysis(domainId: string): Promise<DomainAnalysisRecord> {
    const data = await apiFetch<{ data: DomainAnalysisRecord }>(`/domains/${domainId}/analysis/reanalyze`, {
        method: "POST",
    });
    return data.data;
}

export async function createDomain(payload: DomainPayload): Promise<Domain> {
    try {
        const data = await apiFetch<{ data: Domain }>("/domains", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        return data.data as Domain;
    } catch (error: unknown) {
        if (isApiError(error)) {
            const lowerMessage = error.message.toLowerCase();
            if (error.status === 409 || lowerMessage.includes("already exists")) {
                error.message = "A domain already exists for this company.";
            }
            if (error.status === 422 || lowerMessage.includes("required")) {
                error.message = "Please ensure all required fields are filled out correctly.";
            }
        }
        throw error;
    }
}

export async function updateDomain(id: string, payload: DomainPayload): Promise<Domain> {
    const data = await apiFetch<{ data: Domain }>(`/domains/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });

    return data.data as Domain;
}

export async function deleteDomain(id: string): Promise<void> {
    await apiFetch(`/domains/${id}`, {
        method: "DELETE",
    });
}

export async function fetchDomainTitle(url: string): Promise<{ title: string | null }> {
    return apiFetch<{ title: string | null }>("/domains/fetch-title", {
        method: "POST",
        body: JSON.stringify({ url }),
    });
}

export type DiscordWebhookChannel = {
    id: number;
    name: string;
    url: string;
    is_active: boolean;
    last_triggered_at?: string | null;
    success_count?: number;
    failure_count?: number;
};

export type SlackWebhookChannel = {
    id: number;
    name: string;
    url: string;
    is_active: boolean;
};

// --- TEAM INVITATIONS ---

export async function sendTeamInvitation(payload: {
    email: string;
    role: string;
}): Promise<void> {
    await apiFetch("/team-invitations", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function getPendingInvitations(): Promise<{ ulid: string; email: string; role: string }[]> {
    return apiFetch("/team-invitations", {
        method: "GET",
    });
}

export async function getInvitationDetails(token: string): Promise<{ email: string; role: string }> {
    const res = await apiFetch<{ data: { email: string; role: string } }>(`/team-invitations/lookup/${token}`, {
        method: "GET",
    });
    return res.data;
}

export async function acceptTeamInvitation(
    token: string,
    payload: { name: string; password: string; password_confirmation: string }
): Promise<{ token?: string; user?: unknown }> {
    return apiFetch<{ token?: string; user?: unknown }>(`/team-invitations/accept/${token}`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

// --- TEAM MEMBERS ---

export async function getTeamMembers(): Promise<TeamMember[]> {
    const data = await apiFetch<{ data: TeamMember[] }>("/team/members", {
        method: "GET",
    });

    return data.data ?? [];
}

export async function removeTeamMember(memberId: number): Promise<void> {
    await apiFetch(`/team/members/${memberId}`, {
        method: "DELETE",
    });
}

export async function getDepartments(): Promise<Department[]> {
    const data = await apiFetch<{ data: Department[] }>("/departments", {
        method: "GET",
    });

    return (data?.data ?? []) as Department[];
}

export async function createDepartment(payload: {
    name: string;
}): Promise<Department> {
    try {
        const data = await apiFetch<{ data: Department }>("/departments", {
            method: "POST",
            body: JSON.stringify(payload),
        });

        return data.data as Department;
    } catch (error: unknown) {
        if (isApiError(error)) {
            if (error.status === 409) {
                error.message = "A department with this name already exists.";
            }
            if (error.status === 422) {
                error.message = "Department name is required.";
            }
        }
        throw error;
    }
}

// --- DEPARTMENT USERS ---

export async function getDepartmentUsers(
    departmentId: string
): Promise<DepartmentUser[]> {
    const data = await apiFetch<{ data: DepartmentUser[] }>(
        `/departments/${departmentId}/users`,
        { method: "GET" }
    );

    return (data?.data ?? []) as DepartmentUser[];
}

// --- ONBOARDING ---

export type OnboardingData = {
    welcome_highlights: Array<{
        title: string;
        description: string;
        icon: string;
        color: string;
    }>;
    company_sizes: Array<{
        id: string;
        label: string;
        range: string | null;
    }>;
    hear_about_sources: Array<{
        id: string;
        label: string;
        icon: string;
        color: string;
    }>;
    usage_plans: Array<{
        id: string;
        label: string;
        desc: string;
        icon: string;
        color: string;
    }>;
    environment_options: Array<{
        value: string;
        label: string;
        icon: string;
        desc: string;
        color: string;
        bg: string;
        border: string;
    }>;
    monitoring_features: Array<{
        label: string;
        icon: string;
    }>;
    suggestions: Array<{
        label: string;
        icon: string;
        color: string;
    }>;
    selections?: Record<string, any>;
    onboarding_completed?: boolean;
    dashboard_tour_completed?: boolean;
};

export async function getOnboardingData(): Promise<OnboardingData | null> {
    try {
        const data = await apiFetch<{ data: OnboardingData }>("/onboarding/data", {
            method: "GET",
        });
        return data.data ?? null;
    } catch (error) {
        console.error("Failed to fetch onboarding data:", error);
        return null;
    }
}

export async function saveOnboardingData(data: Partial<OnboardingData>): Promise<OnboardingData> {
    try {
        console.log("Saving onboarding data:", data);
        const result = await apiFetch<{ data: OnboardingData }>("/onboarding/data", {
            method: "POST",
            body: JSON.stringify(data),
        });
        console.log("Onboarding data saved successfully:", result.data);
        return result.data as OnboardingData;
    } catch (error) {
        console.error("Failed to save onboarding data:", error);
        throw error;
    }
}

export async function syncDepartmentUsers(
    departmentId: string,
    userIds: number[]
): Promise<void> {
    await apiFetch(`/departments/${departmentId}/users`, {
        method: "POST",
        body: JSON.stringify({
            user_ids: userIds,
        }),
    });
}

// --- COMPANY USERS ---

export async function getCompanyUsers(): Promise<DepartmentUser[]> {
    const data = await apiFetch<{ data: DepartmentUser[] }>(
        "/company/users",
        { method: "GET" }
    );

    return (data?.data ?? []) as DepartmentUser[];
}

export async function renameWorkspace(newName: string): Promise<Workspace> {
    const data = await apiFetch<{ data: Workspace }>("/workspaces/rename", {
        method: "POST",
        body: JSON.stringify({ name: newName }),
    });

    return data.data as Workspace;
}

export async function updateUserInfo(name?: string): Promise<User> {
    const payload: Record<string, string> = {};
    if (name) payload.name = name;
    const data = await apiFetch<{ data: User }>("/user/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
    });
    return data.data as User;
}

export async function deleteUserAccount(): Promise<{ message: string }> {
    const data = await apiFetch<{ message: string }>("/user/profile", {
        method: "DELETE",
    });
    return data;
}

// --- SSL MONITORING ---

export type SslDomain = {
    id: number;
    ulid: string;
    name: string;
    url: string;
    environment: string;
    status: string;
    ssl_issuer: string | null;
    ssl_valid_from: string | null;
    ssl_valid_to: string | null;
    ssl_days_remaining: number | null;
    ssl_last_checked_at: string | null;
};

export type SslDetail = {
    domain: {
        id: number;
        ulid: string;
        name: string;
        url: string;
        environment: string;
        status: string;
    };
    ssl: {
        issuer: string | null;
        subject: string;
        sans: string[];
        valid_from: string | null;
        valid_to: string | null;
        days_remaining: number | null;
        serial_number: string;
        signature_algorithm: string;
        certificate_type: string;
        platform: string;
        hosting_provider: string;
        last_checked_at: string | null;
        is_expired: boolean;
        expires_soon: boolean;
        is_valid: boolean;
    };
};

export async function getSslMonitoring(): Promise<SslDomain[]> {
    const data = await apiFetch<{ data: SslDomain[] }>("/ssl-monitoring", {
        method: "GET",
    });
    return (data?.data ?? []) as SslDomain[];
}

export async function getSslDetail(domainUlid: string): Promise<SslDetail> {
    const data = await apiFetch<{ data: SslDetail }>(`/ssl-monitoring/${domainUlid}`, {
        method: "GET",
    });
    return data.data as SslDetail;
}