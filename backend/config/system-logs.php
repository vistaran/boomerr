<?php

return [
    'queue' => env('SYSTEM_LOGS_QUEUE', 'system-logs'),

    'sensitive_retention_days' => env('SYSTEM_LOGS_SENSITIVE_RETENTION_DAYS', 150),
    'sensitive_retention_min_days' => env('SYSTEM_LOGS_SENSITIVE_RETENTION_MIN_DAYS', 90),
    'sensitive_retention_max_days' => env('SYSTEM_LOGS_SENSITIVE_RETENTION_MAX_DAYS', 180),
];
