<?php
return [
        /*
        |--------------------------------------------------------------------------
        | Laravel CORS
        |--------------------------------------------------------------------------
        |
        | allowedOrigins, allowedHeaders and allowedMethods can be set to array('*')
        | to accept any value.
        |
        */
        'paths' => ['api/*', 'admin/*', 'broadcasting/*', 'sanctum/csrf-cookie'],
        'supports_credentials' => true,
        'allowed_origins' => array_values(array_unique(array_filter(array_map(function ($url) {
            return rtrim($url, '/');
        }, array_merge(
            explode(',', (string) env('ALLOWED_ORIGINS', '')),
            explode(',', (string) env('FRONTEND_URL')),
            explode(',', (string) env('WEBSITE_URL', '')),
        ))))),
        'allowed_headers' => ['*'],
        'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        'exposed_headers' => [],
        'max_age' => 0,
        'hosts' => [''],
    ];
