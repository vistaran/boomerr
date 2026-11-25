<?php

return [
    'lambda_enabled' => env('MONITORING_LAMBDA_ENABLED', false),
    'api_key' => env('MONITORING_API_KEY'),
    'lambda_function_name' => env('LAMBDA_FUNCTION_NAME', 'boomerr-monitor'),
    'freshness_window_minutes' => env('MONITORING_FRESHNESS_WINDOW', 2),
    'min_healthy_regions' => env('MONITORING_MIN_HEALTHY_REGIONS', 1),
    'http_timeout' => (int) env('MONITORING_HTTP_TIMEOUT', 20),
    'ssl_timeout' => (int) env('MONITORING_SSL_TIMEOUT', 15),
    'ssl_http_timeout' => (int) env('MONITORING_SSL_HTTP_TIMEOUT', 10),
];
