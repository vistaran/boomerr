import type { User } from "../types/user";

export async function getAuthRedirectPath(token: string, user: User | any): Promise<string> {
    const defaultVal = localStorage.getItem("redirectPath");
    const safeRedirectPath = (defaultVal && defaultVal !== "/login") ? defaultVal : null;

    let isNewUserWithoutDomains = false;
    let onboardingCompleted = false;
    let resumeStep = "/onboarding/plan";

    try {
        const envApi = import.meta.env.VITE_API_BASE_URL;
        const apiBase = (import.meta.env.PROD || !envApi || envApi.includes('localhost:8000')) ? '/api' : envApi;

        // Fetch domains from API
        const domainsRes = await fetch(`${apiBase}/domains`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const domainsData = await domainsRes.json();
        const domainsList = domainsData?.data ?? [];

        // Fetch onboarding data from API to check completion status
        const onboardingRes = await fetch(`${apiBase}/onboarding/data`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const onboardingData = await onboardingRes.json();
        onboardingCompleted = onboardingData?.data?.onboarding_completed === true;
        const selections = onboardingData?.data?.selections || {};

        // Determine which step to resume from based on saved selections
        if (selections.hear_about) {
            resumeStep = "/onboarding/add-domain";
        } else if (selections.company_size) {
            resumeStep = "/onboarding/hear-about";
        } else if (selections.usage_plan) {
            resumeStep = "/onboarding/company-size";
        }

        if (domainsList.length === 0 && !onboardingCompleted) {
            isNewUserWithoutDomains = true;
        }
    } catch (e) {
        // Fall back gracefully if error fetching data
        console.error("Error fetching redirect data:", e);
    }

    if (isNewUserWithoutDomains) {
        // Resume onboarding from the last step
        return resumeStep;
    }

    if (safeRedirectPath) {
        return safeRedirectPath;
    }

    return "/dashboard";
}


