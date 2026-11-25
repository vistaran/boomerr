<?php

namespace App\Enums;

enum AuditLogEventType: string
{
    // Domain Management
    case DOMAIN_CREATED = 'domain.created';
    case DOMAIN_UPDATED = 'domain.updated';
    case DOMAIN_DELETED = 'domain.deleted';

        // Workspace Management
    case WORKSPACE_CREATED = 'workspace.created';
    case WORKSPACE_RENAMED = 'workspace.renamed';

        // Incident Management
    case INCIDENT_RESOLVED = 'incident.resolved';

        // Department Management
    case DEPARTMENT_CREATED = 'department.created';
    case DEPARTMENT_UPDATED = 'department.updated';
    case DEPARTMENT_USER_ADDED = 'department.user_added';
    case DEPARTMENT_USER_REMOVED = 'department.user_removed';

        // Domain Integrations (Notification Channels / Webhooks)
    case INTEGRATION_CHANNEL_CREATED = 'integration.channel.created';
    case INTEGRATION_CHANNEL_UPDATED = 'integration.channel.updated';
    case INTEGRATION_CHANNEL_DELETED = 'integration.channel.deleted';

        // Team Management
    case USER_INVITED = 'team.user_invited';
    case USER_INVITED_ACCEPTED = 'team.user_invite_accepted';
    case USER_INVITE_CANCELED = 'team.invite_canceled';
    case USER_INVITE_RESENT = 'team.invite_resent';
    case USER_REMOVED = 'team.user_removed';

        // Authentication
    case USER_LOGIN = 'auth.login';
    case USER_LOGOUT = 'auth.logout';

        // Integration Status Changes
    case DOMAIN_INTEGRATION_ENABLED = 'integration.domain.enabled';
    case DOMAIN_INTEGRATION_DISABLED = 'integration.domain.disabled';
    case WORKSPACE_INTEGRATION_ENABLED = 'integration.workspace.enabled';
    case WORKSPACE_INTEGRATION_DISABLED = 'integration.workspace.disabled';

        // Ads Assignment
    case GOOGLE_ADS_ASSIGNED = 'ads.google.assigned';
    case GOOGLE_ADS_UNASSIGNED = 'ads.google.unassigned';
    case FACEBOOK_ADS_ASSIGNED = 'ads.facebook.assigned';
    case FACEBOOK_ADS_UNASSIGNED = 'ads.facebook.unassigned';

    /**
     * Human-readable label for display.
     */
    public function label(): string
    {
        return match ($this) {
            self::WORKSPACE_CREATED => 'Workspace Created',
            self::WORKSPACE_RENAMED => 'Workspace Renamed',
            self::DOMAIN_CREATED => 'Domain Created',
            self::DOMAIN_UPDATED => 'Domain Updated',
            self::DOMAIN_DELETED => 'Domain Deleted',
            self::INCIDENT_RESOLVED => 'Incident Resolved',
            self::DEPARTMENT_CREATED => 'Department Created',
            self::DEPARTMENT_UPDATED => 'Department Updated',
            self::DEPARTMENT_USER_ADDED => 'User Added to Department',
            self::DEPARTMENT_USER_REMOVED => 'User Removed from Department',
            self::INTEGRATION_CHANNEL_CREATED => 'Integration Created',
            self::INTEGRATION_CHANNEL_UPDATED => 'Integration Updated',
            self::INTEGRATION_CHANNEL_DELETED => 'Integration Deleted',
            self::USER_INVITED => 'User Invited',
            self::USER_INVITED_ACCEPTED => 'User Invite Accepted',
            self::USER_INVITE_CANCELED => 'Invite Canceled',
            self::USER_INVITE_RESENT => 'Invite Resent',
            self::USER_REMOVED => 'User Removed',
            self::USER_LOGIN => 'User Login',
            self::USER_LOGOUT => 'User Logout',
            self::DOMAIN_INTEGRATION_ENABLED => 'Domain Integration Enabled',
            self::DOMAIN_INTEGRATION_DISABLED => 'Domain Integration Disabled',
            self::WORKSPACE_INTEGRATION_ENABLED => 'Workspace Integration Enabled',
            self::WORKSPACE_INTEGRATION_DISABLED => 'Workspace Integration Disabled',
            self::GOOGLE_ADS_ASSIGNED => 'Google Ads Assigned',
            self::GOOGLE_ADS_UNASSIGNED => 'Google Ads Unassigned',
            self::FACEBOOK_ADS_ASSIGNED => 'Facebook Ads Assigned',
            self::FACEBOOK_ADS_UNASSIGNED => 'Facebook Ads Unassigned',
        };
    }

    /**
     * Categorize the action (create, update, delete, auth, toggle, assign).
     */
    public function action(): string
    {
        return match ($this) {
            self::DOMAIN_CREATED,
            self::DEPARTMENT_CREATED,
            self::WORKSPACE_CREATED,
            self::INTEGRATION_CHANNEL_CREATED => 'create',

            self::DOMAIN_UPDATED,
            self::DEPARTMENT_UPDATED,
            self::WORKSPACE_RENAMED,
            self::INTEGRATION_CHANNEL_UPDATED => 'update',

            self::DOMAIN_DELETED,
            self::INTEGRATION_CHANNEL_DELETED => 'delete',

            self::INCIDENT_RESOLVED => 'update',

            self::USER_LOGIN => 'login',
            self::USER_LOGOUT => 'logout',

            self::USER_INVITED => 'invite',
            self::USER_INVITED_ACCEPTED => 'invite_accepted',
            self::USER_INVITE_CANCELED => 'remove',
            self::USER_INVITE_RESENT => 'update',
            self::USER_REMOVED => 'remove',

            self::DEPARTMENT_USER_ADDED => 'assign',
            self::DEPARTMENT_USER_REMOVED => 'unassign',

            self::DOMAIN_INTEGRATION_ENABLED,
            self::WORKSPACE_INTEGRATION_ENABLED => 'enable',

            self::DOMAIN_INTEGRATION_DISABLED,
            self::WORKSPACE_INTEGRATION_DISABLED => 'disable',

            self::GOOGLE_ADS_ASSIGNED,
            self::FACEBOOK_ADS_ASSIGNED => 'assign',

            self::GOOGLE_ADS_UNASSIGNED,
            self::FACEBOOK_ADS_UNASSIGNED => 'unassign',
        };
    }
}
