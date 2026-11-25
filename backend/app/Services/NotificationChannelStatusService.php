<?php

namespace App\Services;

use App\Models\Domain;
use App\Models\DomainIntegration;
use App\Models\Integration;
use App\Models\NotificationChannel;
use App\Models\Workspace;
use App\Models\WorkspaceIntegration;
use App\Services\PlanLimitService;

class NotificationChannelStatusService
{
    /**
     * Checks if a notification channel is effectively active for sending notifications.
     * This checks:
     * - The channel is active
     * - The integration is active globally (platform-level)
     * - The workspace and domain have integrations enabled
     * - The integration is not explicitly disabled for the domain or workspace
     * - The notification channel type is included in the workspace's current plan
     */
    public static function isChannelActive(?NotificationChannel $channel): bool
    {
        if (!$channel) {
            return false;
        }

        // Webhook level check
        if (!$channel->is_active) {
            return false;
        }

        // Workspace global toggle check
        $workspace = $channel->workspace ?? ($channel->workspace_id ? Workspace::find($channel->workspace_id) : null);
        if ($workspace && isset($workspace->integrations_enabled) && !$workspace->integrations_enabled) {
            return false;
        }

        // Domain global toggle check
        if ($channel->domain_id) {
            $domain = $channel->domain ?? Domain::find($channel->domain_id);
            if ($domain && isset($domain->integrations_enabled) && !$domain->integrations_enabled) {
                return false;
            }
        }

        // Resolve integration key / type
        $channelType = $channel->type ?? $channel->domainIntegration?->integration?->key;

        // Platform-level toggle check
        $integration = null;
        if ($channelType) {
            $integration = Integration::where('key', $channelType)->first();
            if ($integration && isset($integration->is_active) && !$integration->is_active) {
                return false;
            }
        }

        // Domain-level integration check
        if ($channel->domain_id) {
            $domainIntegration = null;
            if ($channel->integration_id) {
                $domainIntegration = DomainIntegration::find($channel->integration_id);
            }
            if (!$domainIntegration && $integration) {
                $domainIntegration = DomainIntegration::where('domain_id', $channel->domain_id)
                    ->where('integration_id', $integration->id)
                    ->first();
            }

            // If explicitly toggled off by user, block notification
            if ($domainIntegration && isset($domainIntegration->enabled) && $domainIntegration->enabled === false) {
                return false;
            }
        }

        // Workspace-level integration check
        if ($channel->workspace_id && $integration) {
            $workspaceIntegration = WorkspaceIntegration::where('workspace_id', $channel->workspace_id)
                ->where('integration_id', $integration->id)
                ->first();

            // If explicitly toggled off by user, block notification
            if ($workspaceIntegration && isset($workspaceIntegration->enabled) && $workspaceIntegration->enabled === false) {
                return false;
            }
        }

        // Plan level check: verify the channel type is permitted by the workspace's plan
        if ($workspace && $channelType) {
            $billingKey = match ($channelType) {
                'discord' => 'discord',
                'slack' => 'slack',
                'telegram' => 'telegram',
                'whatsapp' => 'whatsapp',
                'sms' => 'sms',
                'email' => 'email',
                'call', 'calls' => 'calls',
                'facebook-ads', 'facebook_ads' => 'facebook_ads',
                'google-ads', 'google_ads' => 'google_ads',
                default => $channelType,
            };

            if (!PlanLimitService::hasIntegration($workspace, $billingKey)) {
                return false;
            }

            if ($billingKey === 'sms' && !app(\App\Services\SmsCreditService::class)->hasCredit($workspace)) {
                return false;
            }

            if ($billingKey === 'whatsapp' && !app(\App\Services\WhatsAppCreditService::class)->hasCredit($workspace)) {
                return false;
            }
        }

        return true;
    }
}
