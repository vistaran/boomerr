<?php

namespace App\Enums;

final class SubscriptionStatus
{
    public const CREATED = 'created';
    public const AUTHENTICATED = 'authenticated';
    public const TRIALING = 'trialing';
    public const ACTIVE = 'active';
    public const PAST_DUE = 'past_due';
    public const PENDING = 'pending';
    public const FAILED_RETRYING = 'failed_retrying';
    public const HALTED = 'halted';
    public const PAUSED = 'paused';
    public const CANCEL_AT_CYCLE_END = 'cancel_at_cycle_end';
    public const COMPLETED = 'completed';
    public const EXPIRED = 'expired';
    public const CANCELLED = 'cancelled';

    public static function paymentLifecycleStatuses(): array
    {
        return [
            self::PENDING,
            self::HALTED,
            self::PAUSED,
            self::FAILED_RETRYING,
            self::CREATED,
            self::AUTHENTICATED,
        ];
    }

    public static function nonTerminalStatuses(): array
    {
        return [
            self::CREATED,
            self::AUTHENTICATED,
            self::TRIALING,
            self::ACTIVE,
            self::PAST_DUE,
            self::PENDING,
            self::FAILED_RETRYING,
            self::HALTED,
            self::PAUSED,
            self::CANCEL_AT_CYCLE_END,
        ];
    }

    public static function terminalStatuses(): array
    {
        return [
            self::COMPLETED,
            self::EXPIRED,
            self::CANCELLED,
        ];
    }

    public static function retryableStatuses(): array
    {
        return [
            self::FAILED_RETRYING,
            self::HALTED,
            self::PAUSED,
            self::PENDING,
            self::PAST_DUE,
        ];
    }

    public static function precedence(): array
    {
        return [
            self::CREATED => 5,
            self::AUTHENTICATED => 7,
            self::ACTIVE => 10,
            self::TRIALING => 20,
            self::PAST_DUE => 25,
            self::PENDING => 30,
            self::FAILED_RETRYING => 35,
            self::PAUSED => 38,
            self::HALTED => 40,
            self::CANCEL_AT_CYCLE_END => 50,
            self::COMPLETED => 55,
            self::EXPIRED => 60,
            self::CANCELLED => 70,
        ];
    }

    public static function rank(string $status): int
    {
        return self::precedence()[$status] ?? 0;
    }
}
