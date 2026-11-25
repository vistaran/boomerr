# Complete Codebase Audit Report

## 1. Stack & Dependency Audit

The project was audited directly from repository manifests (`backend/composer.json`, `backend/package.json`, `frontend/package.json`).

### 1.1 Backend Stack (PHP / Laravel)
- **PHP Version Requirement:** `^8.2`
- **Core Framework:** `laravel/framework: ^12.0` (Laravel 12)
- **Key Production Packages:**
  - `laravel/sanctum: ^4.0` (SPA & API token authentication)
  - `laravel/reverb: ^1.6` (Native WebSocket server)
  - `laravel/socialite: ^5.26` (OAuth integration for Google, GitHub, etc.)
  - `predis/predis: ^3.3` (Redis caching and pub/sub client)
  - `openai-php/laravel: ^0.18.0` (OpenAI / DeepSeek compatible LLM client)
  - `razorpay/razorpay: ^2.9` (Payment processing and subscription billing)
  - `spatie/browsershot: ^5.2` (Puppeteer/Chromium automated screenshot and PDF capture)
  - `io-developer/php-whois: ^4.1` (Direct WHOIS protocol domain expiration queries)
  - `aws/aws-sdk-php-laravel: ^3.10` (AWS SES and AWS Lambda client)
  - `twilio/sdk: ^8.11` (Twilio SMS and WhatsApp integration)
  - `google/apiclient: ^2.18` (Google Ads and Google API integrations)
- **Development & Testing Dependencies:**
  - `phpunit/phpunit: ^11.5.3`
  - `mockery/mockery: ^1.6`
  - `laravel/breeze: ^2.3`
  - `laravel/sail: ^1.41`
  - `laravel/pail: ^1.2.2`
  - `laravel/pint: ^1.24`

### 1.2 Frontend Stack (React / TypeScript / Vite)
- **Build Tooling:** `vite: ^7.2.4`, `typescript: ~5.9.3`
- **Core Runtime:** `react: ^19.2.0`, `react-dom: ^19.2.0`
- **Styling:** `tailwindcss: ^4.1.17`, `@tailwindcss/vite: ^4.1.17`
- **State & Data Management:** `@tanstack/react-query: ^5.90.12`, `axios: ^1.13.2`
- **Real-Time Client:** `laravel-echo: ^2.2.6`, `pusher-js: ^8.4.0`, `@laravel/echo-react: ^2.2.6`
- **Visualization:** `echarts: ^5.5.0`, `echarts-for-react: ^3.0.2`, `recharts: ^3.10.1`, `react-simple-maps: ^3.0.0`, `d3-geo: ^3.1.1`
- **Security & OAuth:** `@hcaptcha/react-hcaptcha: ^1.17.1`, `@react-oauth/google: ^0.12.2`

---

## 2. Repository Structure Analysis

```
domain-monitoring-tool/
├── backend/                  # Laravel 12 API application
│   ├── app/
│   │   ├── Console/Commands/ # Scheduled artisan commands (Uptime, Lambda, SSL, WHOIS, Stats)
│   │   ├── Enums/            # Subscription and Domain status enums
│   │   ├── Events/           # DomainStatusUpdated, Webhook events
│   │   ├── Http/
│   │   │   ├── Controllers/  # Domain, StatusPage, Incident, Ads, Webhooks controllers
│   │   │   │   ├── Admin/    # Platform admin dashboard controllers
│   │   │   │   ├── Auth/     # Sanctum, OTP, Socialite controllers
│   │   │   │   └── Tools/    # Public DNS, SSL, Uptime, Ad-landing tools
│   │   │   └── Middleware/   # Tenancy, Security, API keys, Captcha middleware
│   │   ├── Jobs/             # Asynchronous queue jobs (Checks, Notifications, Webhooks)
│   │   ├── Listeners/        # Ads pause/resume listeners, notification listeners
│   │   ├── Mail/             # Notification and onboarding mailable classes
│   │   ├── Models/           # Eloquent models (Domain, Workspace, Incident, etc.)
│   │   ├── Notifications/    # Laravel notification channels
│   │   └── Services/         # Core business logic (Health checks, Billing, Ads, SMS)
│   │       ├── AI/           # DeepSeek incident diagnosis & analysis
│   │       ├── Billing/      # Razorpay webhook and plan status logic
│   │       ├── Payments/     # Gateway factory and Razorpay driver
│   │       └── SMS/          # Twilio & MSG91 SMS adapters
│   ├── config/               # App, billing, monitoring, services, reverb configs
│   ├── database/
│   │   ├── migrations/       # 45+ relational database migrations
│   │   └── seeders/          # Base roles, default plans, regions, templates
│   ├── routes/
│   │   ├── admin.php         # Admin dashboard routes
│   │   ├── api.php           # Core user REST API
│   │   ├── channels.php      # Reverb WebSocket broadcast channels
│   │   ├── console.php       # Scheduled cron commands
│   │   └── web.php           # OAuth redirects and fallback view
│   └── tests/                # Feature and unit test suites
├── frontend/                 # React 19 Vite SPA
│   ├── src/
│   │   ├── api/              # API client, TanStack Query hooks, query keys
│   │   ├── components/       # UI elements, layout, dialogs, charts
│   │   ├── context/          # React contexts (Auth, AdminAuth, Workspace)
│   │   ├── hooks/            # Custom hooks
│   │   ├── pages/            # View pages (Dashboard, Domains, SSL, Incidents, Admin)
│   │   │   └── admin/        # Admin portal views
│   │   └── realtime/         # Reverb Echo listeners and query cache mutators
│   ├── index.html            # Main HTML shell with title updater & tracking scripts
│   └── vite.config.ts        # Vite build and dev proxy configuration
├── .gitignore                # Root gitignore
├── README.md                 # Brief setup guide
├── index.html                # Legacy root CORS test file
└── repair_db.php             # Ad-hoc development repair script
```

---

## 3. Environment Variables Inventory

All environment variables identified in `backend/.env.example` and `backend/config/` grouped by operational purpose:

### Group 1: Core Application & Runtime
| Variable | Description | Default / Example | Required for Self-Hosting |
|---|---|---|---|
| `APP_NAME` | Name of the instance | `Boomerr` | Optional |
| `APP_ENV` | Environment name | `production` / `local` | **Yes** |
| `APP_KEY` | 32-char AES encryption key | Generated via `artisan key:generate` | **Yes** |
| `APP_DEBUG` | Detailed debug error pages | `false` | **Yes** |
| `APP_URL` | Base URL of the application | `http://localhost:8000` | **Yes** |
| `FRONTEND_URL` | Base URL of frontend SPA (for CORS) | `http://localhost:5173` | **Yes** |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowed domains | `http://localhost:3000,http://localhost:5173` | Recommended |
| `BCRYPT_ROUNDS` | Password hashing complexity | `12` | Optional |
| `LOG_CHANNEL` | Logging destination | `stack` | **Yes** |
| `LOG_LEVEL` | Minimum log severity level | `info` / `debug` | **Yes** |

### Group 2: Database & Caching
| Variable | Description | Default / Example | Required for Self-Hosting |
|---|---|---|---|
| `DB_CONNECTION` | Database driver | `sqlite` / `mysql` / `pgsql` | **Yes** |
| `DB_HOST` | Database host | `127.0.0.1` / `db` | For MySQL/Postgres |
| `DB_PORT` | Database port | `3306` / `5432` | For MySQL/Postgres |
| `DB_DATABASE` | Database name or SQLite file path | `boomerr` / `database.sqlite` | **Yes** |
| `DB_USERNAME` | Database user | `root` / `boomerr` | For MySQL/Postgres |
| `DB_PASSWORD` | Database password | Secret | For MySQL/Postgres |
| `CACHE_STORE` | Cache driver | `database` / `redis` | **Yes** |
| `SESSION_DRIVER` | Session store driver | `database` / `redis` | **Yes** |
| `REDIS_HOST` | Redis server hostname | `127.0.0.1` / `redis` | For Redis |
| `REDIS_PORT` | Redis server port | `6379` | For Redis |
| `REDIS_PASSWORD` | Redis authentication password | `null` | Optional |

### Group 3: Queues & Schedulers
| Variable | Description | Default / Example | Required for Self-Hosting |
|---|---|---|---|
| `QUEUE_CONNECTION` | Queue backend driver | `database` / `redis` | **Yes** |
| `SYSTEM_LOGS_QUEUE` | Specific queue for system logging | `system-logs` | Optional |
| `SYSTEM_LOGS_SENSITIVE_RETENTION_DAYS` | Log retention period | `150` | Optional |

### Group 4: Real-Time WebSockets (Laravel Reverb)
| Variable | Description | Default / Example | Required for Self-Hosting |
|---|---|---|---|
| `BROADCAST_CONNECTION` | Broadcast driver | `reverb` | **Yes** |
| `REVERB_APP_ID` | Reverb App ID | `boomerr-local` | **Yes** |
| `REVERB_APP_KEY` | Reverb public key | Random string | **Yes** |
| `REVERB_APP_SECRET` | Reverb secret key | Random string | **Yes** |
| `REVERB_HOST` | Reverb server host | `localhost` | **Yes** |
| `REVERB_PORT` | Reverb server port | `8080` | **Yes** |
| `REVERB_SCHEME` | Connection protocol (`http`/`https`) | `http` | **Yes** |

### Group 5: Monitoring Configuration
| Variable | Description | Default / Example | Required for Self-Hosting |
|---|---|---|---|
| `MONITORING_LAMBDA_ENABLED` | Toggle multi-region AWS Lambda | `false` | No (Set `false`) |
| `MONITORING_API_KEY` | Shared secret for incoming probe results | Random 64-char string | If probes used |
| `MONITORING_HTTP_TIMEOUT` | Max seconds before HTTP probe timeout | `20` | Optional |
| `MONITORING_SSL_TIMEOUT` | Max seconds before SSL handshake timeout | `15` | Optional |
| `MONITORING_SSL_HTTP_TIMEOUT` | Max seconds before SSL HTTP check timeout | `10` | Optional |
| `MONITORING_FRESHNESS_WINDOW` | Minutes to consider regional ping valid | `2` | Optional |
| `MONITORING_MIN_HEALTHY_REGIONS` | Min regions required for "Up" status | `1` | Optional |

### Group 6: AI Diagnostics
| Variable | Description | Default / Example | Required for Self-Hosting |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek LLM API Key | Secret | Optional (Enables AI) |
| `DEEPSEEK_MODEL` | DeepSeek model identifier | `deepseek-chat` | Optional |
| `GOOGLE_GENAI_API_KEY` | Google Gemini API Key | Secret | Optional alternative |
| `GOOGLE_GENAI_MODEL` | Gemini model identifier | `gemini-2.5-flash` | Optional alternative |
| `BOOMERR_AI_SYSTEM_PROMPT` | Custom prompt for outage diagnostics | String | Optional |
| `BOOMERR_AI_HEADER_FILTER` | Filtered HTTP headers sent to AI | `server,content-type,cf-ray...` | Optional |

### Group 7: Notification & Alert Channels
| Variable | Description | Default / Example | Required for Self-Hosting |
|---|---|---|---|
| `MAIL_MAILER` | Mail provider (`smtp`, `ses`, `log`) | `smtp` / `log` | **Yes** |
| `MAIL_HOST` | SMTP server host | `smtp.mailgun.org` | For SMTP |
| `MAIL_PORT` | SMTP port | `587` | For SMTP |
| `MAIL_USERNAME` | SMTP user | String | For SMTP |
| `MAIL_PASSWORD` | SMTP password | Secret | For SMTP |
| `MAIL_FROM_ADDRESS` | Outgoing email address | `alerts@domain.com` | **Yes** |
| `DISCORD_WEBHOOK_URL` | Discord webhook for system alerts | URL | Optional |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather | Token | Optional |
| `TELEGRAM_BOT_USERNAME` | Telegram bot username | String | Optional |
| `WHATSAPP_PROVIDER` | WhatsApp provider (`facebook` / `twilio`) | `facebook` | Optional |
| `FACEBOOK_WHATSAPP_PHONE_ID` | Meta WhatsApp Cloud Phone ID | String | Optional |
| `FACEBOOK_ACCESS_TOKEN` | Meta WhatsApp Cloud Access Token | Secret | Optional |
| `SMS_PROVIDER` | SMS provider (`msg91` / `twilio` / `plivo`) | `msg91` | Optional |
| `MSG91_API_KEY` | MSG91 API key | Secret | Optional |
| `TWILIO_SID` & `TWILIO_AUTH_TOKEN` | Twilio API credentials | Secret | Optional |

### Group 8: File Storage & Puppeteer
| Variable | Description | Default / Example | Required for Self-Hosting |
|---|---|---|---|
| `FILESYSTEM_DISK` | Storage disk (`local`, `public`, `s3`) | `local` | **Yes** |
| `AWS_ACCESS_KEY_ID` | AWS S3 access key | Secret | For S3 |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 secret key | Secret | For S3 |
| `AWS_BUCKET` | AWS S3 bucket name | String | For S3 |
| `AWS_DEFAULT_REGION` | AWS region | `ap-south-1` | For S3 |
| `BROWSERSHOT_NODE_BINARY` | Path to Node.js executable | `node` | For Browsershot |
| `BROWSERSHOT_NPM_BINARY` | Path to npm executable | `npm` | For Browsershot |

### Group 9: Commercial SaaS & Billing
| Variable | Description | Default / Example | Required for Self-Hosting |
|---|---|---|---|
| `BILLING_DEFAULT_GATEWAY` | Gateway driver (`razorpay`) | `razorpay` | Commercial Only |
| `RAZORPAY_KEY` | Razorpay Key ID | String | Commercial Only |
| `RAZORPAY_SECRET` | Razorpay Key Secret | Secret | Commercial Only |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhook Secret | Secret | Commercial Only |
| `HCAPTCHA_SITE_KEY` | hCaptcha public key | String | Commercial Only |
| `HCAPTCHA_SECRET_KEY` | hCaptcha verification secret | Secret | Commercial Only |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API developer token | Secret | Commercial Only |
| `FACEBOOK_APP_SECRET` | Meta App Secret | Secret | Commercial Only |

---

## 4. Proprietary & External Paid Dependencies Audit

1. **Payment Processing (Razorpay):**
   - Implemented in `App\Services\Billing\RazorpayWebhookHandler`, `RazorpayService`.
   - Subscription models restrict users who are not active subscribers to 10 monitors, 5-minute intervals, and disable SSL monitoring, AI analysis, and incident reporting.
   - **Open-Source Impact:** High. Self-hosters must not be subjected to payment gates to access features on their own hardware.

2. **Multi-Region Monitoring (AWS Lambda):**
   - Implemented in `RunLambdaUptimeChecks.php` and `MonitoringDispatcherService.php`.
   - Dispatches AWS Lambda function calls across up to 6 AWS regions.
   - **Open-Source Impact:** Zero blocking. When `MONITORING_LAMBDA_ENABLED=false` (the default in `.env.example`), `RunUptimeChecks.php` automatically performs local monitoring checks for all domains.

3. **Outage Screenshots (AWS S3 & Browsershot):**
   - In `IncidentRecorderService.php`, screenshot storage hardcodes a direct AWS S3 client with `'region' => 'ap-south-1'`, failing completely if AWS credentials are not configured.
   - **Open-Source Impact:** High failure risk. Needs refactoring to use Laravel's standard `Storage::disk(config('filesystems.default'))` with local disk storage.

4. **Bot Protection (hCaptcha):**
   - `AuthController::sendLoginOtp` and `AuthController::register` include captcha verification checks that fail if secrets are not set or if offline.
   - `Admin\AuthController::login` strictly requires `captcha_token` in validation rules.
   - **Open-Source Impact:** High. Prevents local login unless hCaptcha is made optional.

5. **Analytics & Error Leakage:**
   - `frontend/index.html` includes hardcoded Google Tag Manager tracking ID `G-YDE08CL8FW` with domains `['boomerr.ai', 'app.boomerr.ai']`.
   - `backend/bootstrap/app.php` reports unhandled exceptions directly to a Discord webhook URL configured via `services.discord.webhook_url`.
   - **Open-Source Impact:** High privacy risk. Must be removed from open-source release.

---

## 5. Technical Debt & Ad-Hoc Artifacts

During the audit, multiple leftover files from commercial development were discovered:

| Path | Purpose / Issue | Recommendation |
|---|---|---|
| `repair_db.php` | Root repair script directly altering database tables for a specific Shopify test user | **Delete** |
| `index.html` (root) | Standalone CORS testing page | **Delete** |
| `backend/check_deliveries.php` | Debug script inspecting specific webhook event delivery rows | **Delete** |
| `backend/check_deliveries2.php` | Debug script inspecting webhook delivery rows | **Delete** |
| `backend/check_events.php` | Debug script dumping registered webhooks | **Delete** |
| `backend/check_payloads.php` | Debug script inspecting database jobs payloads | **Delete** |
| `backend/dummy.php` | Empty scratch file | **Delete** |
| `backend/list_jobs.php` | Debug script listing active queued jobs | **Delete** |
| `backend/scaffold_job.php` | One-off code generator script | **Delete** |
| `backend/scaffold_mailables.php`| One-off email generator script | **Delete** |
| `backend/scaffold_views.php` | One-off Blade view generator script | **Delete** |
| `backend/test_update.php` | Ad-hoc domain update test script | **Delete** |
| `backend/routes/api.php:390` | Active `/_debug/log-test` and `/_debug/sms-test` endpoints in production routes | **Remove debug routes** |
| `frontend/test-streaming.html`| Empty 0-byte file | **Delete** |
| `backend/.phpunit.result.cache`| Test cache file tracked in git | **Add to .gitignore & delete** |

---

## 6. Audit Summary

| Category | Status | Assessment |
|---|---|---|
| **Core Architecture** | **Pass** | Clean separation of concerns between API, frontend, real-time Reverb, and worker queues. |
| **Monitoring Independence** | **Pass** | Native local uptime, SSL socket verification, and WHOIS query engines work 100% independently of cloud services. |
| **Self-Hosting Readiness** | **Requires Action** | Blocked by hardcoded S3 screenshot uploads, required hCaptcha on authentication, hardcoded SaaS URLs, and commercial billing restrictions. |
| **Security Posture** | **Requires Action** | SSRF vulnerabilities in public tool endpoints, debug routes in production, and exception reporting to external Discord webhooks. |
