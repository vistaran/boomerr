export type PlanCode = 'free' | 'starter' | 'solopreneur' | 'teams' | 'enterprise';

export interface PlanLimits {
  max_monitors: number | null;           // null = unlimited
  monitor_interval_minutes: number;
  max_team_members: number | null;       // null = unlimited, 0 = not allowed
  max_status_pages?: number | null;      // null = unlimited
  sms_credits_per_month?: number | null; // null = unlimited
  whatsapp_credits_per_month?: number | null; // null = unlimited
}

export interface PlanFeatures {
  domain_monitoring: boolean;
  ssl_monitoring: boolean;
  ai_response_time: boolean;
  ai_performance: boolean;
  ai_seo_score: boolean;
  ai_ux_monitoring: boolean;
  ai_security_monitoring: boolean;
  dns_tools: boolean;
  security_tools: boolean;
  /** Incident reporting is available on Solopreneur plan and above */
  incident_reporting: boolean;
  /** Boomerr Agent AI analysis section available on Starter plan and above */
  ai_analysis: boolean;
}

export interface PlanIntegrations {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  calls: boolean;
  slack: boolean;
  discord: boolean;
  telegram: boolean;
  facebook_ads: boolean;
  google_ads: boolean;
}

export interface PlanDetails {
  features: PlanFeatures;
  limits: PlanLimits;
  integrations: PlanIntegrations;
}

export interface PlanInfo {
  plan: {
    name: string;
    code: PlanCode;
  };
  limits: PlanLimits;
  features: PlanFeatures;
  integrations: PlanIntegrations;
}
