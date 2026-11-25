import { useState, useEffect } from "react";
import { getOnboardingData, type OnboardingData } from "../services/api-service";

// Default fallback data (same as backend defaults)
const defaultOnboardingData: OnboardingData = {
    welcome_highlights: [
        {
            title: "Website Monitoring",
            description: "Monitor uptime and detect downtime instantly.",
            icon: "Activity",
            color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
        },
        {
            title: "Security Monitoring",
            description: "Track SSL status and important security headers.",
            icon: "ShieldCheck",
            color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
        },
        {
            title: "Ad Protection",
            description: "Automatically pause your ad campaigns if your website goes down.",
            icon: "Zap",
            color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
        },
    ],
    company_sizes: [
        { id: "solo", label: "Solo creator", range: null },
        { id: "small", label: "Small team", range: "2-9" },
        { id: "growing", label: "Growing team", range: "10-99" },
        { id: "mid", label: "Mid-size team", range: "100-499" },
        { id: "large", label: "Large team", range: "500-999" },
        { id: "enterprise", label: "Enterprise", range: "1000+" },
    ],
    hear_about_sources: [
        { id: 'search_engines', label: 'Search Engines (Google, Bing)', icon: 'Search', color: 'text-blue-400' },
        { id: 'shopify', label: 'Shopify', icon: 'ShoppingBag', color: 'text-green-500' },
        { id: 'ads_campaigns', label: 'Ads / Campaigns', icon: 'Megaphone', color: 'text-purple-400' },
        { id: 'comparing_tools', label: 'Comparing Monitoring Tools', icon: 'BarChart2', color: 'text-amber-400' },
        { id: 'alternative_tool', label: 'Alternative to Existing Tool', icon: 'Repeat', color: 'text-rose-400' },
        { id: 'dev_communities', label: 'Developer / Technical Communities', icon: 'Terminal', color: 'text-indigo-400' },
        { id: 'tech_blogs', label: 'Technical Blogs or Articles', icon: 'BookOpen', color: 'text-pink-400' },
        { id: 'referral', label: 'Referral (Friend, Colleague, Client)', icon: 'Users', color: 'text-sky-400' },
        { id: 'hosting_provider', label: 'Hosting Provider or Cloud Platform', icon: 'Server', color: 'text-teal-400' },
        { id: 'social_media', label: 'Social Media', icon: 'Share2', color: 'text-slate-400' },
        { id: 'online_advertising', label: 'Online Advertising', icon: 'Globe', color: 'text-cyan-400' },
        { id: 'direct_visit', label: 'Direct Visit (Typed URL or Bookmark)', icon: 'MousePointer', color: 'text-blue-500' },
        { id: 'twitter_x', label: 'Twitter / X', icon: 'Twitter', color: 'text-slate-200' },
        { id: 'other', label: 'Other', icon: 'MoreHorizontal', color: 'text-slate-400' },
    ],
    usage_plans: [
        {
            id: "personal",
            label: "Personal Use",
            desc: "Monitor personal blogs, portfolios, and side projects.",
            icon: "Sparkles",
            color: "text-blue-400",
        },
        {
            id: "agency",
            label: "Agency / Freelancing",
            desc: "Manage and monitor multiple client domains smoothly.",
            icon: "Users",
            color: "text-indigo-400",
        },
        {
            id: "marketing",
            label: "Marketing & Ads",
            desc: "Avoid revenue loss by pausing campaigns when landing pages go down.",
            icon: "Megaphone",
            color: "text-amber-400",
        },
        {
            id: "saas",
            label: "SaaS / Business",
            desc: "Ensure maximum uptime for business-critical applications.",
            icon: "Building",
            color: "text-emerald-400",
        },
        {
            id: "devops",
            label: "IT & DevOps",
            desc: "Track SSL certificates, security headers, and server health.",
            icon: "Shield",
            color: "text-violet-400",
        },
        {
            id: "education",
            label: "Education & Learning",
            desc: "Explore domain monitoring and security best practices.",
            icon: "GraduationCap",
            color: "text-rose-400",
        },
    ],
    environment_options: [
        { value: "Production", label: "Production", icon: "Rocket", desc: "Live environment", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
        { value: "Staging", label: "Staging", icon: "GitBranch", desc: "Pre-release testing", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
        { value: "Development", label: "Development", icon: "Server", desc: "Local dev environment", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    ],
    monitoring_features: [
        { label: "Uptime monitoring", icon: "Activity" },
        { label: "SSL monitoring", icon: "Shield" },
        { label: "Security header checks", icon: "Check" },
    ],
    suggestions: [
        { label: "Connect Slack", icon: "BellRing", color: "text-blue-400 bg-blue-400/10" },
        { label: "Ad protection", icon: "ShieldAlert", color: "text-rose-400 bg-rose-400/10" },
        { label: "New domain", icon: "PlusCircle", color: "text-emerald-400 bg-emerald-400/10" },
    ],
};

let cachedOnboardingData: OnboardingData | null = null;
let isFetching = false;
let fetchPromise: Promise<OnboardingData | null> | null = null;

export function clearOnboardingCache() {
    cachedOnboardingData = null;
    isFetching = false;
    fetchPromise = null;
}

export function useOnboardingData() {
    const [data, setData] = useState<OnboardingData | null>(cachedOnboardingData);
    const [loading, setLoading] = useState(!cachedOnboardingData);
    const [error, setError] = useState<Error | null>(null);
    const [fetched, setFetched] = useState(!!cachedOnboardingData);

    useEffect(() => {
        // If we already fetched, don't fetch again
        if (fetched) {
            return;
        }

        // Prevent multiple simultaneous fetches
        if (isFetching && fetchPromise) {
            fetchPromise
                .then((result) => {
                    if (result) {
                        cachedOnboardingData = result;
                        setData(result);
                    }
                    setLoading(false);
                    setFetched(true);
                })
                .catch((err) => {
                    setError(err);
                    setLoading(false);
                    setFetched(true);
                });
            return;
        }

        // Fetch data from API
        isFetching = true;
        fetchPromise = getOnboardingData();

        fetchPromise
            .then((result) => {
                if (result) {
                    cachedOnboardingData = result;
                    setData(result);
                } else {
                    // Use default data if API returns null
                    cachedOnboardingData = defaultOnboardingData;
                    setData(defaultOnboardingData);
                }
            })
            .catch((err) => {
                setError(err);
                // Use default data on error
                cachedOnboardingData = defaultOnboardingData;
                setData(defaultOnboardingData);
            })
            .finally(() => {
                isFetching = false;
                fetchPromise = null;
                setLoading(false);
                setFetched(true);
            });
    }, [fetched]);

    return { data: data || defaultOnboardingData, loading, error };
}

// Helper to get specific data sections
export function getWelcomeHighlights(data: OnboardingData | null) {
    return (data?.welcome_highlights && data.welcome_highlights.length > 0)
        ? data.welcome_highlights
        : defaultOnboardingData.welcome_highlights;
}

export function getCompanySizes(data: OnboardingData | null) {
    return (data?.company_sizes && data.company_sizes.length > 0)
        ? data.company_sizes
        : defaultOnboardingData.company_sizes;
}

export function getHearAboutSources(data: OnboardingData | null) {
    return (data?.hear_about_sources && data.hear_about_sources.length > 0)
        ? data.hear_about_sources
        : defaultOnboardingData.hear_about_sources;
}

export function getUsagePlans(data: OnboardingData | null) {
    return (data?.usage_plans && data.usage_plans.length > 0)
        ? data.usage_plans
        : defaultOnboardingData.usage_plans;
}

export function getEnvironmentOptions(data: OnboardingData | null) {
    return (data?.environment_options && data.environment_options.length > 0)
        ? data.environment_options
        : defaultOnboardingData.environment_options;
}

export function getMonitoringFeatures(data: OnboardingData | null) {
    return (data?.monitoring_features && data.monitoring_features.length > 0)
        ? data.monitoring_features
        : defaultOnboardingData.monitoring_features;
}

export function getSuggestions(data: OnboardingData | null) {
    return (data?.suggestions && data.suggestions.length > 0)
        ? data.suggestions
        : defaultOnboardingData.suggestions;
}
