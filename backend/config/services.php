<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'ap-south-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'hcaptcha' => [
        'secret' => env('HCAPTCHA_SECRET_KEY'),
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
    ],

    'github' => [
        'client_id' => env('GITHUB_CLIENT_ID'),
        'client_secret' => env('GITHUB_CLIENT_SECRET'),
        'redirect' => env('GITHUB_REDIRECT_URI', env('APP_URL') . '/auth/github/callback'),
    ],

    'plivo' => [
        'auth_id' => env('PLIVO_AUTH_ID'),
        'auth_token' => env('PLIVO_AUTH_TOKEN'),
        'from' => env('PLIVO_FROM'),
    ],

    'google_genai' => [
        'key' => env('GOOGLE_GENAI_API_KEY'),
        'model' => env('GOOGLE_GENAI_MODEL', 'gemini-2.5-flash'),
        'endpoint' => env('GOOGLE_GENAI_ENDPOINT', 'https://generativelanguage.googleapis.com/v1beta'),
    ],

    'ai' => [
        'base_url' => env('AI_BASE_URL', 'https://api.deepseek.com/v1'),
        'key' => env('DEEPSEEK_API_KEY', env('AI_API_KEY')),
        'model' => env('DEEPSEEK_MODEL', env('AI_MODEL', 'deepseek-chat')),
    ],

    'facebook' => [
        'app_id' => env('FACEBOOK_APP_ID'),
        'app_secret' => env('FACEBOOK_APP_SECRET'),
        'whatsapp_phone_id' => env('FACEBOOK_WHATSAPP_PHONE_ID'),
        'whatsapp_access_token' => env('FACEBOOK_ACCESS_TOKEN'),
        'whatsapp_api_url' => env('FACEBOOK_API_URL', 'https://graph.facebook.com/v22.0'),
        'whatsapp_verify_token' => env('FACEBOOK_WHATSAPP_VERIFY_TOKEN'),
        'whatsapp_webhook_secret' => env('FACEBOOK_WHATSAPP_WEBHOOK_SECRET'),
    ],

    'whatsapp' => [
        'provider' => env('WHATSAPP_PROVIDER', 'facebook'),
        'template_language' => env('WHATSAPP_TEMPLATE_LANGUAGE', 'en'),
        'templates' => [
            'otp' => env('WHATSAPP_TEMPLATE_OTP', 'otp_verification'),
            'domain_alert' => env('WHATSAPP_TEMPLATE_DOMAIN_ALERT', 'boomerr_domain_status_alert'),
            'ssl_alert' => env('WHATSAPP_TEMPLATE_SSL_ALERT', 'boomerr_domain_ssl_alert'),
        ],
    ],

    'google_ads' => [
        'client_id' => env('GOOGLE_ADS_CLIENT_ID'),
        'client_secret' => env('GOOGLE_ADS_CLIENT_SECRET'),
        'developer_token' => env('GOOGLE_ADS_DEVELOPER_TOKEN'),
        'redirect_uri' => env('GOOGLE_ADS_REDIRECT_URI'),
    ],

    'twilio' => [
        'sid' => env('TWILIO_SID'),
        'token' => env('TWILIO_AUTH_TOKEN'),
        'from' => env('TWILIO_FROM'),
        'whatsapp_from' => env('TWILIO_WHATSAPP_FROM'),
        'whatsapp_content_sid' => env('TWILIO_WHATSAPP_CONTENT_SID'),
    ],

    'msg91' => [
        'api_key' => env('MSG91_API_KEY'),
        'sender_id' => env('MSG91_SENDER_ID'),
        'flow_id' => env('MSG91_FLOW_ID'),
        'flows' => [
            'default' => env('MSG91_FLOW_ID_DEFAULT', env('MSG91_FLOW_ID')),
            'otp' => env('MSG91_FLOW_ID_OTP'),
            'domain_down' => env('MSG91_FLOW_ID_DOMAIN_DOWN'),
            'domain_up' => env('MSG91_FLOW_ID_DOMAIN_UP'),
            'ssl_alert' => env('MSG91_FLOW_ID_SSL_ALERT'),
            'test' => env('MSG91_FLOW_ID_TEST'),
        ],
    ],

    'sms' => [
        'provider' => env('SMS_PROVIDER', 'msg91'),
    ],

    'browsershot' => [
        'node_binary' => env('BROWSERSHOT_NODE_BINARY', 'node'),
        'npm_binary' => env('BROWSERSHOT_NPM_BINARY', 'npm'),
    ],

    // Shopify App credentials
    'shopify' => [
        'client_id' => env('SHOPIFY_API_KEY'),
        'client_secret' => env('SHOPIFY_API_SECRET'),
        'scopes' => env('SHOPIFY_SCOPES', 'read_products,write_products'),
        'redirect' => env('SHOPIFY_REDIRECT_URI', env('APP_URL') . '/auth/shopify/callback'),
    ],

    'monitoring' => [
        'api_key' => env('MONITORING_API_KEY'),
    ],

    'discord' => [
        'webhook_url' => env('DISCORD_WEBHOOK_URL'),
    ],

    'clickup' => [
        'client_id' => env('CLICKUP_CLIENT_ID'),
        'client_secret' => env('CLICKUP_CLIENT_SECRET'),
        'redirect_uri' => env('CLICKUP_REDIRECT_URI', env('APP_URL') . '/api/integrations/clickup/callback'),
    ],

    'telegram' => [
        'bot_token' => env('TELEGRAM_BOT_TOKEN'),
        'bot_username' => env('TELEGRAM_BOT_USERNAME'),
        'webhook_secret' => env('TELEGRAM_WEBHOOK_SECRET'),
    ],

    'super_admin' => [
        'token' => env('SUPER_ADMIN_TOKEN'),
    ],
];

