import type {
  DiscordWebhookChannel,
  SlackWebhookChannel
} from '../hooks/use-integrations';
import type { TeamMember, PendingInvitation } from '../hooks/use-team';
import type { Domain } from '../types/domains';

export type EventAction = 'created' | 'updated' | 'deleted';


export type DomainStatusUpdatedPayload = {
  domain: Domain;
};

export type DomainCreatedPayload = {
  domain: Domain;
};

export type DomainUpdatedPayload = {
  domain: Domain;
};

export type DomainDeletedPayload = {
  domain_id?: number;
  domain_ulid?: string;
};

export type WebhookCreatedPayload = {
  webhook: DiscordWebhookChannel | SlackWebhookChannel;
  type: 'discord' | 'slack';
};

export type WebhookUpdatedPayload = {
  webhook: DiscordWebhookChannel | SlackWebhookChannel;
  type: 'discord' | 'slack';
};

export type WebhookDeletedPayload = {
  webhook_id: number;
  type: 'discord' | 'slack';
};

export type TeamMemberAddedPayload = {
  member: TeamMember;
};

export type TeamMemberUpdatedPayload = {
  member: TeamMember;
};

export type TeamMemberRemovedPayload = {
  member_id: number;
};

export type InvitationCreatedPayload = {
  invitation: PendingInvitation;
};

export type InvitationAcceptedPayload = {
  invitation_id: number;
  member: TeamMember;
};

export type BillingStatusUpdatedPayload = {
  workspace_id: number;
  subscription_id: number;
  status: string;
  plan_code: string | null;
  event_type: string | null;
  updated_at: string;
};

export const REVERB_EVENTS = {
  // Domain events
  DOMAIN_STATUS_UPDATED: '.DomainStatusUpdated',
  DOMAIN_CREATED: '.DomainCreated',
  DOMAIN_UPDATED: '.DomainUpdated',
  DOMAIN_DELETED: '.DomainDeleted',

  // Integration events
  WEBHOOK_CREATED: '.WebhookCreated',
  WEBHOOK_UPDATED: '.WebhookUpdated',
  WEBHOOK_DELETED: '.WebhookDeleted',

  // Team events
  TEAM_MEMBER_ADDED: '.TeamMemberAdded',
  TEAM_MEMBER_UPDATED: '.TeamMemberUpdated',
  TEAM_MEMBER_REMOVED: '.TeamMemberRemoved',
  INVITATION_CREATED: '.InvitationCreated',
  INVITATION_ACCEPTED: '.InvitationAccepted',
  BILLING_STATUS_UPDATED: '.BillingStatusUpdated',
} as const;

export type ReverbEventName = typeof REVERB_EVENTS[keyof typeof REVERB_EVENTS];
