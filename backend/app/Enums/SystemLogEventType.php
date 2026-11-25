<?php

namespace App\Enums;

enum SystemLogEventType: string
{
    case DOMAIN_CREATED = 'domain.created';
    case DOMAIN_UPDATED = 'domain.updated';
    case DOMAIN_DELETED = 'domain.deleted';
    case DOMAIN_UPTIME = 'domain.uptime';
    case DOMAIN_SSL = 'domain.ssl';
    case WEBHOOK_DISPATCH = 'webhook.dispatch';
    case WEBHOOK_TEST = 'webhook.test';
    case INTEGRATION_CHANNEL_CREATED = 'integration.channel.created';
    case INTEGRATION_CHANNEL_UPDATED = 'integration.channel.updated';
    case INTEGRATION_CHANNEL_DELETED = 'integration.channel.deleted';
    case SYSTEM_ALERT = 'system.alert';

    public function label(): string
    {
        return match ($this) {
            self::DOMAIN_CREATED => 'Domain Created',
            self::DOMAIN_UPDATED => 'Domain Updated',
            self::DOMAIN_DELETED => 'Domain Deleted',
            self::DOMAIN_UPTIME => 'Domain Uptime Check',
            self::DOMAIN_SSL => 'SSL Check',
            self::WEBHOOK_DISPATCH => 'Webhook Dispatch',
            self::WEBHOOK_TEST => 'Webhook Test',
            self::INTEGRATION_CHANNEL_CREATED => 'Integration Channel Created',
            self::INTEGRATION_CHANNEL_UPDATED => 'Integration Channel Updated',
            self::INTEGRATION_CHANNEL_DELETED => 'Integration Channel Deleted',
            self::SYSTEM_ALERT => 'System Alert',
        };
    }
}
