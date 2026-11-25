<p align="center">
  <img src="frontend/src/assets/Boomerr.png" alt="Boomerr Logo" width="220" />
</p>

<h1 align="center">Boomerr — Self-Hosted Website & Domain Monitoring</h1>

<p align="center">
  <strong>An open-source, full-stack website monitoring, SSL tracking, incident diagnosis, and public status page platform.</strong>
</p>

<p align="center">
  <a href="https://github.com/vistaran/boomerr/actions/workflows/ci.yml"><img src="https://github.com/vistaran/boomerr/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <img src="https://img.shields.io/badge/PHP-8.2-777BB4?style=flat-square&logo=php&logoColor=white" alt="PHP 8.2" />
  <img src="https://img.shields.io/badge/Laravel-12-FF2D20?style=flat-square&logo=laravel&logoColor=white" alt="Laravel 12" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker Ready" />
  <img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat-square" alt="License AGPL-3.0" />
</p>

---

## ⚡ Overview

Boomerr is an open-source, self-hosted website and domain monitoring platform designed for developers, sysadmins, agencies, and businesses. Monitor unlimited endpoints, track SSL certificates, diagnose outages with optional AI diagnostics, and publish customizable status pages for your users.

Self-hosted Boomerr instances run in **Community Edition** mode with zero paywalls, zero artificial limits, and zero external telemetry.

---

## ✨ Features

- 🌐 **High-Frequency Uptime Monitoring:** Sub-minute HTTP/HTTPS ping checks, latency graphs, and response code tracking.
- 🔒 **SSL & Domain Certificate Tracking:** Automatic alerts before certificates expire or fail validation.
- 📡 **Real-Time WebSockets:** Live dashboard updates via Laravel Reverb without needing external third-party socket services.
- 🤖 **Optional AI Outage Diagnostics:** Integrates with OpenAI, DeepSeek, or local Ollama instances to analyze incident headers and suggest root cause fixes.
- 📢 **Multi-Channel Incident Alerts:** Instant notifications via Email (SMTP), Telegram, Discord, Slack, SMS (Twilio), and WhatsApp.
- 📄 **Branded Public Status Pages:** Host public or private status pages with custom domains, subscriber email alerts, and incident history feeds.
- 👥 **Multi-Workspace & Team Support:** Role-based access control (Owners, Admins, Members) across independent workspaces.
- 🛡️ **SSRF & Security Hardening:** Hardened URL resolution and private IP blockers to ensure security when testing user-provided URLs.
- 🐳 **One-Command Docker Deployment:** Production-ready multi-container architecture with automated database migrations and health checks.

---

## 🚀 Quickstart in 3 Steps

### Prerequisites
- Docker Engine 24.0+
- Docker Compose v2.20+ (or `docker-compose`)

### 1. Clone the Repository
```bash
git clone https://github.com/vistaran/boomerr.git
cd boomerr
```

### 2. Run the Interactive Setup Script
```bash
chmod +x setup.sh
./setup.sh
```

The script will automatically validate prerequisites, configure `.env`, start the Docker containers, run database migrations, and prompt you to create an administrator user.

### 3. Open the Dashboard
Navigate to `http://localhost:8080` in your browser. Log in with the administrator credentials created during setup.

---

## 🛠️ Management CLI Commands

Boomerr includes powerful artisan commands for self-hosters:

| Task | Command |
|---|---|
| **System Health Check** | `docker compose exec api php artisan boomerr:doctor` |
| **Create Admin Account** | `docker compose exec api php artisan boomerr:admin:create` |
| **View Live Logs** | `docker compose logs -f` |
| **Run Migrations** | `docker compose exec api php artisan migrate --force` |
| **Clear Caches** | `docker compose exec api php artisan config:clear && docker compose exec api php artisan route:clear` |

---

## 📦 Docker Architecture

```
                    [ Port 8080 (HTTP) ]
                             │
                             ▼
                    ┌─────────────────┐
                    │  web (Nginx)    │
                    └───┬─────────┬───┘
                        │         │
             /api/*     ▼         ▼     /app/* (WebSockets)
        ┌─────────────────┐     ┌──────────────────┐
        │  api (PHP-FPM)  │     │ reverb (Sockets) │
        └───────┬─────────┘     └────────┬─────────┘
                │                        │
       ┌────────┴────────┐               │
       │ worker / sched. │               │
       └────────┬────────┘               │
                ├────────────────────────┤
                ▼                        ▼
        ┌─────────────────┐     ┌──────────────────┐
        │ db (MariaDB 11) │     │ redis (Redis 7)  │
        └─────────────────┘     └──────────────────┘
```

---

## 📚 Documentation

Detailed guides are available in the [`docs/`](docs/) directory:

- 🐳 [Docker Deployment & Production SSL Guide](docs/docker-deployment.md)
- ⚙️ [Configuration Reference (.env)](docs/configuration-reference.md)
- 🔧 [Troubleshooting & FAQ](docs/troubleshooting.md)
- 💾 [Backup & Disaster Recovery](docs/backup-restore.md)

---

## 🤝 Contributing

We welcome community contributions, bug reports, and pull requests! Please ensure any code changes include relevant unit or feature tests.

---

## 📄 License

Boomerr is open-source software licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
