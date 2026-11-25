import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../api/query-keys";
import { getPlanInfo } from "../services/billing-service";
import type { PlanFeatures, PlanInfo, PlanIntegrations, PlanLimits } from "../types/plan";

const FREE_DEFAULTS: PlanInfo = {
  plan: { name: "Free", code: "free" },
  limits: {
    max_monitors: 10,
    monitor_interval_minutes: 5,
    max_team_members: 0,
    max_status_pages: 1,
    sms_credits_per_month: 30,
    whatsapp_credits_per_month: 30,
  },
  features: {
    domain_monitoring: true,
    ssl_monitoring: false,
    ai_response_time: false,
    ai_performance: false,
    ai_seo_score: false,
    ai_ux_monitoring: false,
    ai_security_monitoring: false,
    dns_tools: false,
    security_tools: false,
    incident_reporting: false,
    ai_analysis: false,
  },
  integrations: {
    email: true,
    sms: true,
    whatsapp: true,
    calls: true,
    slack: true,
    discord: true,
    telegram: true,
    facebook_ads: false,
    google_ads: false,
  },
};

export function usePlanLimits() {
  const { data, isLoading, isError, refetch } = useQuery<PlanInfo>({
    queryKey: queryKeys.billing.planInfo(),
    queryFn: getPlanInfo,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const isPlanInfoLoading = isLoading && !data;
  const planInfo: PlanInfo = data ?? FREE_DEFAULTS;
  const limits: PlanLimits = planInfo.limits;
  const features: PlanFeatures = planInfo.features;
  const integrations: PlanIntegrations = planInfo.integrations;
  const planCode = planInfo.plan.code;
  const planName = planInfo.plan.name;

  /** True when the workspace can still add a monitor/domain */
  const canAddMonitor =
    isPlanInfoLoading
      ? true
      : limits.max_monitors === null || limits.max_monitors === undefined
      ? true
      : (count: number) => count < (limits.max_monitors as number);

  /** True when the workspace can still invite a team member */
  const canAddTeamMember =
    isPlanInfoLoading
      ? true
      : limits.max_team_members === null || limits.max_team_members === undefined
      ? true
      : (count: number) => count < (limits.max_team_members as number);

  function hasFeature(key: keyof PlanFeatures): boolean {
    if (isPlanInfoLoading) return false;
    return !!features[key];
  }

  function hasIntegration(key: keyof PlanIntegrations): boolean {
    if (isPlanInfoLoading) return false;
    return !!integrations[key];
  }

  return {
    planInfo,
    planCode,
    planName,
    limits,
    features,
    integrations,
    isLoading,
    isPlanInfoLoading,
    isError,
    refetch,
    canAddMonitor,
    canAddTeamMember,
    hasFeature,
    hasIntegration,
  };
}
