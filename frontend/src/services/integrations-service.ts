import type { DomainIntegration } from "../types/domain-integrations";
import type { IntegrationWebhook } from "../types/integration-webhooks";
import type { WorkspaceIntegration } from "../types/workspace-integrations";
import { apiFetch } from "./api-service";

export type Integration = {
    id: number;
    key: string; // e.g., 'discord', 'slack', etc.
    name: string; // e.g., 'Discord', 'Slack'
    is_active: boolean;
    is_launched?: boolean;
};

export async function testNotificationChannel(id: string) {
    const res = await apiFetch(`/domains/integrations/channels/${encodeURIComponent(id)}/test`, {
        method: "POST",
        headers: {
            Accept: "application/json",
        },
    });

    return res;
}

export async function testSlackNotificationChannel(id: string) {
    // Slack uses the same generic test endpoint on the server - reuse it
    return testNotificationChannel(id);
}

export async function getAvailableIntegrations(domainId): Promise<DomainIntegration[]> {
    const data = await apiFetch<{ data: DomainIntegration[] }>(`/domains/${domainId}/integrations`, { method: "GET" });
    return data.data ?? [];
}

export async function getWorkspaceIntegrations(): Promise<WorkspaceIntegration[]> {
    const data = await apiFetch<{ data: WorkspaceIntegration[] }>(`/workspaces/integrations`, { method: "GET" });
    return data.data ?? [];
}

export async function getAvailableIntegrationWebhooks(domainId: string | number | null, selectedProvider: string | number): Promise<IntegrationWebhook[]> {
    const provider = encodeURIComponent(String(selectedProvider));
    const data = await apiFetch<{ data: IntegrationWebhook[] }>(`/domains/${domainId}/integrations/${provider}/webhooks?_t=${Date.now()}`, { method: "GET" });
    return data.data ?? [];
}

export async function getNotificationChannel(id: string): Promise<IntegrationWebhook> {
    const data = await apiFetch<{ data: IntegrationWebhook }>(`/integrations/webhooks/${encodeURIComponent(id)}?_t=${Date.now()}`, { method: "GET" });
    return data.data;
}

export type CompanyIntegrations = {
    primary_contact_email: string | null;
    discord_webhooks: any[];
    slack_webhooks: any[];
};

export async function getCompanyIntegrations(): Promise<CompanyIntegrations> {
    const data = await apiFetch<{ data: CompanyIntegrations }>("/company/integrations", { method: "GET" });
    return data.data as CompanyIntegrations;
}

// /domains/{domain_id}/integrations/webhooks
export async function addNotificationChannel(payload: {
    name: string;
    url: string;
    integration_ulid: string;
    domain_id: string;
    events?: string[];
    meta_json?: any;
}) {
    const data = await apiFetch<{ data: any }>(`/integrations/webhooks/${payload.domain_id}`, {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return data.data;
}

export async function updateNotificationChannel(
    id: string,
    payload: { name?: string; url?: string; is_active?: boolean; events?: string[]; meta_json?: any }
) {
    const data = await apiFetch<{ data: any }>(`/integrations/webhooks/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
    return data.data;
}

export async function deleteNotificationChannel(id: string): Promise<void> {
    await apiFetch(`/integrations/webhooks/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}

export async function updateDomainIntegration(
    id: string | number,
    payload: { enabled: boolean }
) {
    const encoded = encodeURIComponent(String(id));
    const data = await apiFetch<{ data: any }>(`/domains/integrations/${encoded}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
    return data.data;
}

export async function updateWorkspaceIntegration(
    id: string,
    payload: { enabled: boolean }
) {
    const data = await apiFetch<{ data: any }>(`/workspaces/integrations/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
    return data.data;
}

// Facebook Ads
export type FacebookAd = {
    id: string;
    name?: string;
    status?: string; // ACTIVE | PAUSED
    effective_status?: string;
    configured_status?: string;
    adset?: { id: string; name?: string } | null;
    campaign?: { id: string; name?: string; status?: string } | null;
};

export type FacebookAdAccount = {
    id: string;
    name?: string;
    account_status?: number;
};

export type FacebookAdsGroup = {
    integration_id?: number;
    integration_ulid?: string;
    account_id?: string;
    account?: FacebookAdAccount | null;
    ads: FacebookAd[];
};

export async function getFacebookAds(integrationUlid?: string): Promise<FacebookAdsGroup[]> {
    const query = integrationUlid ? `?integration_ulid=${encodeURIComponent(integrationUlid)}` : "";
    const data = await apiFetch<{ data: any }>(`/integrations/facebook/ads${query}`, { method: "GET" });
    const payload = data?.data ?? [];

    if (Array.isArray(payload) && payload.length > 0 && typeof payload[0] === 'object' && 'ads' in payload[0]) {
        return payload as FacebookAdsGroup[];
    }

    return [
        {
            ads: Array.isArray(payload) ? (payload as FacebookAd[]) : [],
            account: null,
        },
    ];
}

export async function setFacebookAdEnabled(campaignId: string, enabled: boolean, fbAccountId: string): Promise<{ id: string; status: string }> {
    const data = await apiFetch<{ data: { id: string; status: string } }>(`/integrations/facebook/ads/${campaignId}/status`, {
        method: "POST",
        body: JSON.stringify({ enabled, fb_account_id: fbAccountId }),
    });
    return data.data;
}

export async function checkFacebookAdsStatus(workspaceUlid?: string | null) {
    let id = String(workspaceUlid ?? '');

    if (!id) {
        try {
            const raw = localStorage.getItem('dm_user');
            if (raw) {
                const parsed = JSON.parse(raw);
                id = parsed?.workspace_ulid ?? '';
                if (!id && Array.isArray(parsed?.workspaces)) {
                    const current = parsed.workspaces.find((w: any) => w?.is_current);
                    id = current?.ulid ?? '';
                }
            }
        } catch (err) {
            console.log(err, "err");

            // ignore parse errors
        }
    }

    if (!id) {
        console.error('checkFacebookAdsStatus: missing workspace ULID; pass workspace_ulid to the function');
        throw new Error('Missing workspace ULID');
    }

    const data = await apiFetch(`/integrations/facebook/ads/status/${encodeURIComponent(id)}`, {
        method: 'POST',
    });
    return data;
}

export async function listFacebookAdsAccounts(workspaceUlid?: string | null) {
    let id = String(workspaceUlid ?? '');

    if (!id) {
        try {
            const raw = localStorage.getItem('dm_user');
            if (raw) {
                const parsed = JSON.parse(raw);
                id = parsed?.workspace_ulid ?? '';
                if (!id && Array.isArray(parsed?.workspaces)) {
                    const current = parsed.workspaces.find((w: any) => w?.is_current);
                    id = current?.ulid ?? '';
                }
            }
        } catch (err) {
            // ignore parse errors
            console.log(err, "err");

        }
    }

    if (!id) {
        console.error('listFacebookAdsAccounts: missing workspace ULID; returning empty list');
        return [] as any;
    }

    const data = await apiFetch<{ data: any }>(`/integrations/facebook/get-all-accounts/${encodeURIComponent(id)}`, {
        method: 'POST',
    });
    return data.data;
}

export async function disconnectFacebookAccount(ulid: string): Promise<void> {
    await apiFetch(`/integrations/facebook/${ulid}`, {
        method: "DELETE",
    });
}

// ============ Domain Facebook Ads Assignments ============

export type FacebookAssignment = {
    id: number;
    ulid: string;
    facebook_entity_id: string;
    facebook_entity_type: 'ad' | 'campaign';
    facebook_entity_name: string | null;
    is_system_paused: boolean;
    system_paused_at: string | null;
    original_status: string | null;
    integration: {
        id: number;
        ulid: string;
        account_id: string;
    } | null;
    created_at: string | null;
};

export type FacebookIntegrationOption = {
    id: number;
    ulid: string;
    account_id: string;
    account_name: string | null;
    business_name: string | null;
    is_current: boolean;
    connected_at: string | null;
};

export type AvailableFacebookAd = {
    id: string;
    name: string;
    status: string | null;
    effective_status: string | null;
    configured_status: string | null;
    adset: { id: string; name?: string } | null;
    campaign: { id: string; name?: string; status?: string } | null;
    is_assigned: boolean;
};

export async function getDomainFacebookAssignments(domainId: string): Promise<FacebookAssignment[]> {
    const data = await apiFetch<{ data: FacebookAssignment[] }>(`/domains/${domainId}/facebook-assignments`, {
        method: "GET",
    });
    return data.data ?? [];
}

export async function getAvailableFacebookIntegrations(domainId: string): Promise<{
    integrations: FacebookIntegrationOption[];
    current_integration_id: number | null;
}> {
    const data = await apiFetch<{ data: FacebookIntegrationOption[]; current_integration_id: number | null }>(
        `/domains/${domainId}/facebook-assignments/integrations`,
        { method: "GET" }
    );
    return {
        integrations: data.data ?? [],
        current_integration_id: data.current_integration_id ?? null,
    };
}

export async function getAvailableFacebookAds(domainId: string, integrationId: number): Promise<{
    ads: AvailableFacebookAd[];
    assigned_ids: string[];
}> {
    const data = await apiFetch<{ data: AvailableFacebookAd[]; assigned_ids: string[] }>(
        `/domains/${domainId}/facebook-assignments/available-ads/${integrationId}`,
        { method: "GET" }
    );
    return {
        ads: data.data ?? [],
        assigned_ids: data.assigned_ids ?? [],
    };
}

export async function assignFacebookAdsToDomain(
    domainId: string,
    integrationId: number,
    entities: Array<{
        id: string;
        type?: 'ad' | 'campaign';
        name?: string;
        campaign_id?: string;
        campaign_status?: string | null;
    }>
): Promise<{ assigned: number; conflicts: any[] }> {
    const data = await apiFetch<{ data: { assigned: number; conflicts: any[] } }>(
        `/domains/${domainId}/facebook-assignments`,
        {
            method: "POST",
            body: JSON.stringify({ integration_id: integrationId, entities }),
        }
    );
    return data.data;
}

export async function updateFacebookAssignments(
    domainId: string,
    integrationId: number,
    entities: Array<{
        id: string;
        type?: 'ad' | 'campaign';
        name?: string;
        campaign_id?: string;
        campaign_status?: string | null;
    }>
): Promise<any> {
    const data = await apiFetch<{ data: { assigned: number; conflicts: any[] } }>(
        `/domains/${domainId}/facebook-assignments`,
        {
            method: "PUT",
            body: JSON.stringify({ integration_id: integrationId, entities }),
        }
    );
    return data.data;
}

export async function removeFacebookAssignments(
    domainId: string,
    assignmentIds?: number[],
    removeAll?: boolean
): Promise<{ removed: number }> {
    const data = await apiFetch<{ data: { removed: number } }>(
        `/domains/${domainId}/facebook-assignments`,
        {
            method: "DELETE",
            body: JSON.stringify({
                assignment_ids: assignmentIds,
                remove_all: removeAll,
            }),
        }
    );
    return data.data;
}

export async function pauseDomainFacebookAds(domainId: string): Promise<{ paused: number; failed: number; skipped: number }> {
    const data = await apiFetch<{ data: { paused: number; failed: number; skipped: number } }>(
        `/domains/${domainId}/facebook-assignments/pause`,
        { method: "POST" }
    );
    return data.data;
}

export async function resumeDomainFacebookAds(domainId: string): Promise<{ resumed: number; failed: number; skipped: number }> {
    const data = await apiFetch<{ data: { resumed: number; failed: number; skipped: number } }>(
        `/domains/${domainId}/facebook-assignments/resume`,
        { method: "POST" }
    );
    return data.data;
}

export async function getWorkspaceFacebookAssignments(): Promise<Array<{
    domain: { id: number; name: string; url: string; status: string };
    integration: { id: number; ulid: string; account_id: string } | null;
    assignments: FacebookAssignment[];
}>> {
    const data = await apiFetch<{ data: any[] }>(`/workspace/facebook-assignments`, { method: "GET" });
    return data.data ?? [];
}

export async function connectGoogleAds() {
    const data = await apiFetch<{ data: any }>(`/integrations/google-ads/connect`, {
        method: "GET",
    });
    return data.data;
}

// ============ Google Ads Integration ============

export type GoogleAdsIntegrationStatus = {
    isConnected: boolean;
    integration?: {
        id: number;
        ulid: string;
        email: string | null;
        name: string | null;
        connected_at: string | null;
    };
};

export type GoogleAdsAccount = {
    id: number;
    ulid: string;
    customer_id: string;
    name: string | null;
    currency: string | null;
    timezone: string | null;
    is_manager: boolean;
};

export type GoogleAdsCampaign = {
    id: number;
    ulid: string;
    campaign_id: string;
    name: string;
    status: string | null;
    channel_type: string | null;
    budget_micros: number | null;
    start_date: string | null;
    end_date: string | null;
};

export type GoogleAdsAd = {
    id: number;
    ulid: string;
    ad_id: string;
    ad_group_id: string;
    name: string | null;
    status: string | null;
    type: string | null;
    headlines: string[];
    descriptions: string[];
    final_urls: string[];
};

export type GoogleAdsAccountWithCampaigns = GoogleAdsAccount & {
    campaigns: (GoogleAdsCampaign & {
        ads: GoogleAdsAd[];
    })[];
};

export async function getGoogleAdsStatus(): Promise<GoogleAdsIntegrationStatus> {
    const data = await apiFetch<GoogleAdsIntegrationStatus>(`/integrations/google/status`, {
        method: "GET",
    });
    return data;
}

export async function getGoogleAdsAccounts(): Promise<GoogleAdsAccount[]> {
    const data = await apiFetch<{ data: GoogleAdsAccount[] }>(`/integrations/google/accounts`, {
        method: "GET",
    });
    return data.data ?? [];
}

export async function getGoogleAdsCampaigns(accountId: number): Promise<GoogleAdsCampaign[]> {
    const data = await apiFetch<{ data: GoogleAdsCampaign[] }>(`/integrations/google/accounts/${accountId}/campaigns`, {
        method: "GET",
    });
    return data.data ?? [];
}

export async function getGoogleAdsAds(campaignId: number): Promise<GoogleAdsAd[]> {
    const data = await apiFetch<{ data: GoogleAdsAd[] }>(`/integrations/google/campaigns/${campaignId}/ads`, {
        method: "GET",
    });
    return data.data ?? [];
}

export async function getGoogleAdsHierarchy(): Promise<GoogleAdsAccountWithCampaigns[]> {
    const data = await apiFetch<{ data: GoogleAdsAccountWithCampaigns[] }>(`/integrations/google/hierarchy`, {
        method: "GET",
    });
    return data.data ?? [];
}

export async function syncGoogleAds(): Promise<{ message: string; data: { accounts: number; campaigns: number; ads: number; errors: any[] } }> {
    const data = await apiFetch<{ message: string; data: { accounts: number; campaigns: number; ads: number; errors: any[] } }>(`/integrations/google/sync`, {
        method: "POST",
    });
    return data;
}

export async function disconnectGoogleAds(): Promise<void> {
    await apiFetch(`/integrations/google/disconnect`, {
        method: "DELETE",
    });
}

// ============ Domain Google Ads Assignments ============

export type GoogleAssignment = {
    id: number;
    ulid: string;
    google_campaign_id: string;
    google_account_id: string;
    campaign_name: string | null;
    campaign_status: string | null;
    is_system_paused: boolean;
    system_paused_at: string | null;
    original_status: string | null;
    integration: {
        id: number;
        ulid: string;
        account_id: string;
    } | null;
    created_at: string | null;
};

export type GoogleIntegrationOption = {
    id: number;
    ulid: string;
    account_id: string;
    email: string | null;
    name: string | null;
    is_current: boolean;
    connected_at: string | null;
};

export type AvailableGoogleCampaign = {
    id: number;
    campaign_id: string;
    name: string;
    status: string | null;
    channel_type: string | null;
    account_id: string;
    account_name: string | null;
    is_assigned_elsewhere: boolean;
};

export async function getDomainGoogleAssignments(domainId: string): Promise<GoogleAssignment[]> {
    const data = await apiFetch<{ data: GoogleAssignment[] }>(`/domains/${domainId}/google-assignments`, {
        method: "GET",
    });
    return data.data ?? [];
}

export async function getAvailableGoogleIntegrations(domainId: string): Promise<{
    integrations: GoogleIntegrationOption[];
    current_integration_id: number | null;
}> {
    const data = await apiFetch<{ data: GoogleIntegrationOption[]; current_integration_id: number | null }>(
        `/domains/${domainId}/google-assignments/integrations`,
        { method: "GET" }
    );
    return {
        integrations: data.data ?? [],
        current_integration_id: data.current_integration_id ?? null,
    };
}

export async function getAvailableGoogleCampaigns(domainId: string, integrationId: number): Promise<{
    campaigns: AvailableGoogleCampaign[];
    assigned_keys: string[];
}> {
    const data = await apiFetch<{ data: AvailableGoogleCampaign[]; assigned_keys: string[] }>(
        `/domains/${domainId}/google-assignments/available-campaigns/${integrationId}`,
        { method: "GET" }
    );
    return {
        campaigns: data.data ?? [],
        assigned_keys: data.assigned_keys ?? [],
    };
}

export async function updateGoogleAssignments(
    domainId: string,
    integrationId: number,
    campaigns: Array<{ campaign_id: string; account_id: string; name?: string; status?: string }>
): Promise<{ updated: number; conflicts: any[] }> {
    const data = await apiFetch<{ data: { updated: number; conflicts: any[] } }>(
        `/domains/${domainId}/google-assignments`,
        {
            method: "PUT",
            body: JSON.stringify({ integration_id: integrationId, campaigns }),
        }
    );
    return data.data;
}

export async function removeGoogleAssignments(
    domainId: string,
    assignmentIds?: number[],
    removeAll?: boolean
): Promise<{ removed: number }> {
    const data = await apiFetch<{ data: { removed: number } }>(
        `/domains/${domainId}/google-assignments`,
        {
            method: "DELETE",
            body: JSON.stringify({
                assignment_ids: assignmentIds,
                remove_all: removeAll,
            }),
        }
    );
    return data.data;
}

// ============ SMS Configurations (multi-config per workspace) ============

export type SmsConfiguration = {
    id: number;
    name: string;
    workspace_id: number;
    domain_id: number | null;
    sms_enabled: boolean;
    phone_number: string | null;
    down_threshold: number;
    ssl_days_before: number;
    events: string[] | null;
    created_at: string;
    updated_at: string;
};

export type SmsConfigurationPayload = {
    name: string;
    sms_enabled: boolean;
    phone_number: string;
    domain_id?: number | null;
    down_threshold?: number;
    ssl_days_before?: number;
    events?: string[];
};

export type SmsCreditDetails = {
    enabled: boolean;
    limit: number | null;
    used: number;
    remaining: number | null;
    has_credit: boolean;
    resets_at: string;
    period: string;
};

export async function getSmsConfigurations(domainId?: string | number | null): Promise<SmsConfiguration[]> {
    const url = domainId ? `/sms-settings?domain_id=${domainId}` : `/sms-settings`;
    const data = await apiFetch<{ data: SmsConfiguration[]; credits?: SmsCreditDetails }>(url, {
        method: "GET",
    });
    return data.data;
}

export async function getSmsConfigurationsWithCredits(domainId?: string | number | null): Promise<{ data: SmsConfiguration[]; credits: SmsCreditDetails | null }> {
    const url = domainId ? `/sms-settings?domain_id=${domainId}` : `/sms-settings`;
    const res = await apiFetch<{ data: SmsConfiguration[]; credits?: SmsCreditDetails }>(url, {
        method: "GET",
    });
    return {
        data: res.data ?? [],
        credits: res.credits ?? null,
    };
}

export async function getSmsCredits(): Promise<SmsCreditDetails> {
    const data = await apiFetch<{ data: SmsCreditDetails }>('/sms-settings/credits', {
        method: "GET",
    });
    return data.data;
}

export async function createSmsConfiguration(
    payload: SmsConfigurationPayload
): Promise<SmsConfiguration> {
    const data = await apiFetch<{ data: SmsConfiguration }>(`/sms-settings`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    return data.data;
}

export async function updateSmsConfiguration(
    id: number,
    payload: Partial<SmsConfigurationPayload>
): Promise<SmsConfiguration> {
    const data = await apiFetch<{ data: SmsConfiguration }>(`/sms-settings/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
    return data.data;
}

export async function deleteSmsConfiguration(id: number): Promise<void> {
    await apiFetch<unknown>(`/sms-settings/${id}`, { method: "DELETE" });
}

export async function testSmsConfiguration(id: number): Promise<{ message: string }> {
    const data = await apiFetch<{ message: string }>(`/sms-settings/${id}/test`, {
        method: "POST",
    });
    return data;
}

// OTP verification for SMS
export async function sendSmsOtp(
    payload: SmsConfigurationPayload
): Promise<{ message: string; otp_id: number }> {
    const data = await apiFetch<{ message: string; otp_id: number }>(`/sms-settings/send-otp`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    return data;
}

export async function verifySmsOtp(
    otpId: number,
    code: string
): Promise<{ message: string; data: SmsConfiguration }> {
    const data = await apiFetch<{ message: string; data: SmsConfiguration }>(`/sms-settings/verify-otp`, {
        method: "POST",
        body: JSON.stringify({ otp_id: otpId, code }),
    });
    return data;
}

export async function resendSmsOtp(
    otpId: number
): Promise<{ message: string; otp_id: number }> {
    const data = await apiFetch<{ message: string; otp_id: number }>(`/sms-settings/resend-otp`, {
        method: "POST",
        body: JSON.stringify({ otp_id: otpId }),
    });
    return data;
}

// ============ WhatsApp Configurations (multi-config per workspace) ============

export type WhatsAppConfiguration = {
    id: number;
    name: string;
    workspace_id: number;
    whatsapp_enabled: boolean;
    phone_number: string | null;
    down_threshold: number;
    ssl_days_before: number;
    events: string[] | null;
    created_at: string;
    updated_at: string;
};

export type WhatsAppCreditDetails = {
    enabled: boolean;
    limit: number | null;
    used: number;
    remaining: number | null;
    has_credit: boolean;
    resets_at: string;
    period: string;
};

export type WhatsAppConfigurationPayload = {
    name: string;
    whatsapp_enabled: boolean;
    phone_number: string;
    down_threshold?: number;
    ssl_days_before?: number;
    events?: string[];
};

export async function getWhatsAppConfigurations(domainId?: string | number | null): Promise<WhatsAppConfiguration[]> {
    const url = domainId ? `/whatsapp-settings?domain_id=${domainId}` : `/whatsapp-settings`;
    const data = await apiFetch<{ data: WhatsAppConfiguration[]; credits?: WhatsAppCreditDetails }>(url, {
        method: "GET",
    });
    return data.data;
}

export async function getWhatsAppConfigurationsWithCredits(domainId?: string | number | null): Promise<{ data: WhatsAppConfiguration[]; credits: WhatsAppCreditDetails | null }> {
    const url = domainId ? `/whatsapp-settings?domain_id=${domainId}` : `/whatsapp-settings`;
    const res = await apiFetch<{ data: WhatsAppConfiguration[]; credits?: WhatsAppCreditDetails }>(url, {
        method: "GET",
    });
    return {
        data: res.data ?? [],
        credits: res.credits ?? null,
    };
}

export async function getWhatsAppCredits(): Promise<WhatsAppCreditDetails> {
    const data = await apiFetch<{ data: WhatsAppCreditDetails }>('/whatsapp-settings/credits', {
        method: "GET",
    });
    return data.data;
}

export async function createWhatsAppConfiguration(
    payload: WhatsAppConfigurationPayload
): Promise<WhatsAppConfiguration> {
    const data = await apiFetch<{ data: WhatsAppConfiguration }>(`/whatsapp-settings`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    return data.data;
}

export async function updateWhatsAppConfiguration(
    id: number,
    payload: Partial<WhatsAppConfigurationPayload>
): Promise<WhatsAppConfiguration> {
    const data = await apiFetch<{ data: WhatsAppConfiguration }>(`/whatsapp-settings/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
    return data.data;
}

export async function deleteWhatsAppConfiguration(id: number): Promise<void> {
    await apiFetch<unknown>(`/whatsapp-settings/${id}`, { method: "DELETE" });
}

export async function testWhatsAppConfiguration(id: number): Promise<{ message: string }> {
    const data = await apiFetch<{ message: string }>(`/whatsapp-settings/${id}/test`, {
        method: "POST",
    });
    return data;
}

// OTP verification for WhatsApp
export async function sendWhatsAppOtp(
    payload: WhatsAppConfigurationPayload
): Promise<{ message: string; otp_id: number }> {
    const data = await apiFetch<{ message: string; otp_id: number }>(`/whatsapp-settings/send-otp`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    return data;
}

export async function verifyWhatsAppOtp(
    otpId: number,
    code: string
): Promise<{ message: string; data: WhatsAppConfiguration }> {
    const data = await apiFetch<{ message: string; data: WhatsAppConfiguration }>(`/whatsapp-settings/verify-otp`, {
        method: "POST",
        body: JSON.stringify({ otp_id: otpId, code }),
    });
    return data;
}

export async function resendWhatsAppOtp(
    otpId: number
): Promise<{ message: string; otp_id: number }> {
    const data = await apiFetch<{ message: string; otp_id: number }>(`/whatsapp-settings/resend-otp`, {
        method: "POST",
        body: JSON.stringify({ otp_id: otpId }),
    });
    return data;
}

// ============ ClickUp Integration ============

export async function getClickUpStatus(): Promise<{ connected: boolean; user?: any }> {
    const data = await apiFetch<{ data: { connected: boolean; user?: any } }>(`/integrations/clickup/status`, {
        method: "GET",
    });
    return data.data;
}

export async function getClickUpConnectUrl(): Promise<string> {
    const data = await apiFetch<{ data: { oauthUrl: string } }>(`/integrations/clickup/connect`, {
        method: "GET",
    });
    return data.data.oauthUrl;
}

export async function disconnectClickUp(): Promise<void> {
    await apiFetch(`/integrations/clickup/disconnect`, {
        method: "DELETE",
    });
}

const CLICKUP_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

export function clearClickUpHierarchyCache(): void {
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith("clickup_hierarchy_")) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch {
        // ignore
    }
}

export async function getClickUpHierarchy(
    type: string,
    params?: Record<string, string>,
    forceRefresh: boolean = false
): Promise<any> {
    const searchParams = new URLSearchParams();
    searchParams.append('type', type);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value) {
                searchParams.append(key, value);
            }
        });
    }

    const cacheKey = `clickup_hierarchy_${searchParams.toString()}`;

    if (!forceRefresh) {
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < CLICKUP_CACHE_TTL_MS && parsed.data !== undefined) {
                    return parsed.data;
                }
            }
        } catch {
            // ignore sessionStorage error
        }
    }

    const data = await apiFetch<{ data: any }>(`/integrations/clickup/hierarchy?${searchParams.toString()}`, {
        method: "GET",
    });

    try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
            data: data.data,
            timestamp: Date.now()
        }));
    } catch {
        // ignore quota error
    }

    return data.data;
}
export const getIntegrationDeliveries = async (type: string, id: string | number, page: number = 1): Promise<{ data: any[], current_page: number, last_page: number, total: number }> => {
    const response = await apiFetch<{ data: any[], current_page: number, last_page: number, total: number }>(`/integration-deliveries?type=${encodeURIComponent(type)}&id=${encodeURIComponent(String(id))}&page=${page}`);
    return response;
};
