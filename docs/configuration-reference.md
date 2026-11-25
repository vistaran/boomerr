# Boomerr Configuration Reference

All application settings are controlled through environment variables in the `.env` file at the root of the project.

---

## 1. Application & Core Settings

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `Boomerr` | Display name of the platform across headers, emails, and alerts. |
| `APP_ENV` | `production` | Environment mode (`production`, `local`, `testing`). |
| `APP_KEY` | *(Required)* | 32-byte base64 encryption key. Set automatically by `./setup.sh`. |
| `APP_DEBUG` | `false` | Enable verbose stack traces. **Must be `false` in production.** |
| `APP_URL` | `http://localhost:8080` | Public URL of the Boomerr dashboard. Used in email alerts & links. |
| `HTTP_PORT` | `8080` | Host port on which the web container listens. |
| `FILESYSTEM_DISK` | `public` | Storage disk for uploaded assets and incident screenshots (`public` or `s3`). |

---

## 2. Community Edition & Billing

| Variable | Default | Description |
|---|---|---|
| `ENABLE_BILLING` | `false` | When `false`, activates **Community Edition** with unlimited monitors, team members, status pages, and all features enabled. Set to `true` only for commercial SaaS operation with Stripe/Razorpay. |

---

## 3. Database Settings (MariaDB)

| Variable | Default (Docker) | Description |
|---|---|---|
| `DB_CONNECTION` | `mysql` | Database driver (`mysql` / `mariadb`). |
| `DB_HOST` | `db` | Database hostname (use `db` within Docker network). |
| `DB_PORT` | `3306` | Internal database port. |
| `DB_DATABASE` | `domain_monitoring` | Database name. |
| `DB_USERNAME` | `boomerr_user` | Database user. |
| `DB_PASSWORD` | *(Set in .env)* | Database user password. |
| `DB_ROOT_PASSWORD`| *(Set in .env)* | Database root password (used for initialization and backups). |

---

## 4. Redis, Queue & Cache Settings

| Variable | Default (Docker) | Description |
|---|---|---|
| `REDIS_HOST` | `redis` | Redis service hostname within Docker network. |
| `REDIS_PORT` | `6379` | Redis port. |
| `REDIS_PASSWORD` | `null` | Optional Redis authentication password. |
| `QUEUE_CONNECTION` | `redis` | Queue driver (`redis` recommended for background jobs). |
| `CACHE_STORE` | `redis` | Cache driver (`redis` or `database`). |
| `SESSION_DRIVER` | `cookie` | Session driver (`cookie`, `database`, `redis`). |

---

## 5. WebSockets & Real-Time Broadcasts (Laravel Reverb)

| Variable | Default | Description |
|---|---|---|
| `BROADCAST_CONNECTION` | `reverb` | Broadcasting connection driver. |
| `REVERB_APP_ID` | `boomerr-app` | Internal Reverb Application ID. |
| `REVERB_APP_KEY` | *(Set in .env)* | Public client key for WebSocket subscriptions. |
| `REVERB_APP_SECRET` | *(Set in .env)* | Secret key for server-side event dispatching. |
| `REVERB_HOST` | `localhost` | External hostname for client WebSocket connections. |
| `REVERB_PORT` | `8080` | External port for client WebSocket connections (proxied by Nginx). |
| `REVERB_SCHEME` | `http` | External protocol (`http` or `https` if SSL terminated). |

---

## 6. Email & Notifications (SMTP)

| Variable | Default | Description |
|---|---|---|
| `MAIL_MAILER` | `smtp` | Mail driver (`smtp`, `sendmail`, `log`). |
| `MAIL_HOST` | `smtp.mailgun.org` | SMTP server hostname. |
| `MAIL_PORT` | `587` | SMTP server port (`587` for TLS, `465` for SSL). |
| `MAIL_USERNAME` | `null` | SMTP login username. |
| `MAIL_PASSWORD` | `null` | SMTP login password. |
| `MAIL_ENCRYPTION` | `tls` | SMTP encryption protocol (`tls` or `ssl`). |
| `MAIL_FROM_ADDRESS` | `noreply@yourdomain.com` | Sender email address for alert and invitation emails. |
| `MAIL_FROM_NAME` | `Boomerr Monitoring` | Sender display name. |

---

## 7. AI Diagnostics (Optional)

Boomerr can analyze incident root causes and suggest remediation steps using any OpenAI-compatible endpoint (DeepSeek, OpenAI, Ollama, vLLM).

| Variable | Default | Description |
|---|---|---|
| `AI_BASE_URL` | `https://api.deepseek.com/v1` | Base URL of the LLM API endpoint. Point to local Ollama with `http://host.docker.internal:11434/v1`. |
| `DEEPSEEK_API_KEY` | *(Optional)* | API key for the AI provider. Leave empty to disable AI analysis gracefully. |
| `DEEPSEEK_MODEL` | `deepseek-chat` | Model identifier (e.g. `deepseek-chat`, `gpt-4o-mini`, `llama3`). |

---

## 8. Security & Bot Protection (Optional)

| Variable | Default | Description |
|---|---|---|
| `HCAPTCHA_SITE_KEY` | `null` | Public hCaptcha site key to protect signup/login forms. |
| `HCAPTCHA_SECRET_KEY`| `null` | Secret key for server-side hCaptcha validation. |

---

## 9. Notification Channels & Third-Party Integrations

All third-party alert channels are optional. Configure them only if you wish to use them in your workspaces:

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather for Telegram incident alerts. |
| `TWILIO_SID` & `TWILIO_AUTH_TOKEN` | Twilio credentials for SMS and voice phone call alerts. |
| `META_WHATSAPP_TOKEN` | Meta Graph API token for official WhatsApp incident alerts. |
| `SHOPIFY_API_KEY` & `SHOPIFY_API_SECRET` | Shopify Partner credentials for automated store monitoring. |
| `FACEBOOK_APP_ID` & `FACEBOOK_APP_SECRET` | Meta Marketing API credentials for Ads Protection. |
| `GOOGLE_ADS_CLIENT_ID` | Google Ads API credentials for Ads Protection. |
