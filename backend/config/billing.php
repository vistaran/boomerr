<?php

return [
    'enabled' => (bool) env('ENABLE_BILLING', false),
    'default_gateway' => env('BILLING_DEFAULT_GATEWAY', 'razorpay'),
    'default_currency' => env('BILLING_DEFAULT_CURRENCY', 'USD'),
    'supported_currencies' => array_values(array_unique(array_filter(array_map(
        static fn($currency) => strtoupper(trim((string) $currency)),
        explode(',', (string) env('BILLING_SUPPORTED_CURRENCIES', 'USD,INR'))
    )))),
    'max_failed_payment_attempts' => (int) env('BILLING_MAX_FAILED_PAYMENT_ATTEMPTS', 3),

    /*
    |--------------------------------------------------------------------------
    | Plan Definitions
    |--------------------------------------------------------------------------
    | Defines limits, features and integrations for each plan.
    | null = unlimited (Enterprise custom).
    */
    'plans' => [
        'free' => [
            'name' => 'Free',
            'code' => 'free',
            'limits' => [
                'max_monitors' => 10,
                'monitor_interval_minutes' => 5,
                'max_team_members' => 0,
                'max_status_pages' => 1,
                'sms_credits_per_month' => 30,
                'whatsapp_credits_per_month' => 30,
            ],
            'features' => [
                'domain_monitoring' => true,
                'ssl_monitoring' => false,
                'ai_response_time' => false,
                'ai_performance' => false,
                'ai_seo_score' => false,
                'ai_ux_monitoring' => false,
                'ai_security_monitoring' => false,
                'dns_tools' => false,
                'security_tools' => false,
                'incident_reporting' => false,
                'ai_analysis' => false,
                'multi_region_monitoring' => false,
            ],
            'integrations' => [
                'email' => true,
                'sms' => true,
                'whatsapp' => true,
                'calls' => true,
                'slack' => true,
                'discord' => true,
                'telegram' => true,
                'facebook_ads' => false,
                'google_ads' => false,
            ],
        ],

        'starter' => [
            'name' => 'Starter',
            'code' => 'starter',
            'limits' => [
                'max_monitors' => 10,
                'monitor_interval_minutes' => 1,
                'max_team_members' => 0,
                'max_status_pages' => 3,
            ],
            'features' => [
                'domain_monitoring' => true,
                'ssl_monitoring' => true,
                'ai_response_time' => true,
                'ai_performance' => true,
                'ai_seo_score' => true,
                'ai_ux_monitoring' => true,
                'ai_security_monitoring' => true,
                'dns_tools' => false,
                'security_tools' => false,
                'incident_reporting' => false,
                'ai_analysis' => true,
                'multi_region_monitoring' => false,
            ],
            'integrations' => [
                'email' => true,
                'sms' => true,
                'whatsapp' => true,
                'calls' => false,
                'slack' => true,
                'discord' => true,
                'telegram' => true,
                'facebook_ads' => false,
                'google_ads' => false,
            ],
        ],

        'solopreneur' => [
            'name' => 'Solopreneur',
            'code' => 'solopreneur',
            'limits' => [
                'max_monitors' => 30,
                'monitor_interval_minutes' => 1,
                'max_team_members' => 5,
                'max_status_pages' => 5,
            ],
            'features' => [
                'domain_monitoring' => true,
                'ssl_monitoring' => true,
                'ai_response_time' => true,
                'ai_performance' => true,
                'ai_seo_score' => true,
                'ai_ux_monitoring' => true,
                'ai_security_monitoring' => true,
                'dns_tools' => true,
                'security_tools' => true,
                'incident_reporting' => true,
                'ai_analysis' => true,
                'multi_region_monitoring' => true,
            ],
            'integrations' => [
                'email' => true,
                'sms' => true,
                'whatsapp' => true,
                'calls' => true,
                'slack' => true,
                'discord' => true,
                'telegram' => true,
                'facebook_ads' => true,
                'google_ads' => true,
            ],
        ],

        'teams' => [
            'name' => 'Teams',
            'code' => 'teams',
            'limits' => [
                'max_monitors' => 100,
                'monitor_interval_minutes' => 1,
                'max_team_members' => 10,
                'max_status_pages' => 10,
            ],
            'features' => [
                'domain_monitoring' => true,
                'ssl_monitoring' => true,
                'ai_response_time' => true,
                'ai_performance' => true,
                'ai_seo_score' => true,
                'ai_ux_monitoring' => true,
                'ai_security_monitoring' => true,
                'dns_tools' => true,
                'security_tools' => true,
                'incident_reporting' => true,
                'ai_analysis' => true,
                'multi_region_monitoring' => true,
            ],
            'integrations' => [
                'email' => true,
                'sms' => true,
                'whatsapp' => true,
                'calls' => true,
                'slack' => true,
                'discord' => true,
                'telegram' => true,
                'facebook_ads' => true,
                'google_ads' => true,
            ],
        ],

        'enterprise' => [
            'name' => 'Enterprise',
            'code' => 'enterprise',
            'limits' => [
                'max_monitors' => null, // Custom / unlimited
                'monitor_interval_minutes' => 1,
                'max_team_members' => null, // Custom / unlimited
                'max_status_pages' => null,
            ],
            'features' => [
                'domain_monitoring' => true,
                'ssl_monitoring' => true,
                'ai_response_time' => true,
                'ai_performance' => true,
                'ai_seo_score' => true,
                'ai_ux_monitoring' => true,
                'ai_security_monitoring' => true,
                'dns_tools' => true,
                'security_tools' => true,
                'incident_reporting' => true,
                'ai_analysis' => true,
                'multi_region_monitoring' => true,
            ],
            'integrations' => [
                'email' => true,
                'sms' => true,
                'whatsapp' => true,
                'calls' => true,
                'slack' => true,
                'discord' => true,
                'telegram' => true,
                'facebook_ads' => true,
                'google_ads' => true,
            ],
        ],
    ],

    'razorpay' => [
        'key' => env('RAZORPAY_KEY'),
        'secret' => env('RAZORPAY_SECRET'),
        'webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET'),
    ],
];
