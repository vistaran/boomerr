<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class IpBanService
{
    protected const PREFIX = 'banned_ip:';

    public static function ban(string $ip, int $minutes = 60): void
    {
        Cache::put(self::PREFIX . $ip, true, now()->addMinutes($minutes));
    }

    public static function isBanned(string $ip): bool
    {
        return Cache::has(self::PREFIX . $ip);
    }
}
