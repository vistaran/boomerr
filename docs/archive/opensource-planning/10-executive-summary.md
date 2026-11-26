# Executive Summary: Open-Source Migration Assessment

**Project:** Boomerr (Domain & SSL Monitoring Platform)  
**Assessment Date:** November 20, 2026  
**Auditor:** Senior DevOps Engineer, Software Architect & Open-Source Consultant  
**Status:** Inspection & Audit Complete — Awaiting Approval for Execution  

---

## 1. Is Boomerr Ready to Become Open Source?

**Verdict: Structurally YES, but Operationally NO (Requires 1–2 Weeks of Cleanup & Containerization).**

The underlying codebase is robust, modular, and built on modern, supported technologies (Laravel 12, React 19, Laravel Reverb, TypeScript, Tailwind CSS v4). Crucially:
- **Core Monitoring is Already 100% Self-Hostable:** The native HTTP check engine, SSL certificate stream socket inspector, and WHOIS domain expiration tracker **do not rely on paid external APIs**. They execute natively in PHP.
- **Real-Time WebSockets Are Built-In:** Laravel Reverb runs independently on local infrastructure without Pusher fees.
- **Multi-Tenancy is Solid:** Workspaces, roles, and status pages are cleanly architected.

However, the repository currently cannot be cloned and run by an outside developer due to missing containerization, hardcoded cloud storage assumptions, required anti-bot challenges, commercial billing gates, and SSRF security vulnerabilities.

---

## 2. What Currently Prevents a Clean Self-Hosted Installation?

Five specific technical blockers prevent immediate self-hosting:

1. **Lack of Docker & Container Orchestration:** There are no Dockerfiles, Docker Compose files, or container entrypoint scripts. Setting up the project currently requires manually installing PHP 8.2, Composer, Node.js 22, MySQL/SQLite, Redis, a cron runner, and a Reverb WebSocket daemon.
2. **Hardcoded AWS S3 Dependency in Outage Screenshots:** In `IncidentRecorderService.php`, the system directly instantiates an AWS S3 client with a hardcoded region (`ap-south-1`). In an environment without AWS credentials, incident enrichment throws an unhandled fatal error.
3. **Hardcoded Captcha Enforcement on Auth:** Both standard user registration/password-reset (`AuthController.php`) and admin login (`Admin\AuthController.php`) enforce `required` validation on `captcha_token`. If hCaptcha is not configured, users are locked out of their own servers with HTTP 422.
4. **Commercial SaaS Billing & Plan Lockouts:** `PlanLimitService.php` enforces the `free` tier plan from `config/billing.php` if no Razorpay subscription exists. This restricts users to 10 monitors, 5-minute intervals, and **completely disables SSL monitoring, AI diagnostics, and incident reporting**.
5. **Hardcoded Domain & Telemetry References:** `frontend/index.html` loads Google Tag Manager tracking ID `G-YDE08CL8FW` linked to `boomerr.ai`. `frontend/src/reverb-echo.ts` hardcodes a fallback to `https://api.boomerr.ai`. `backend/bootstrap/app.php` reports uncaught exceptions directly to a Discord webhook URL.

---

## 3. What Are the Biggest Technical & Security Risks?

1. **Server-Side Request Forgery (SSRF) — Critical Risk:**
   The public tools (`UptimeCheckerController`, `AdLandingPageCheckerController`, `ShopifyDetectorController`) and the uptime check engine make cURL requests with `CURLOPT_FOLLOWLOCATION = true` without validating resolved IP addresses. An attacker can probe `http://169.254.169.254` (cloud metadata), internal Docker services (`http://db:3306`, `http://redis:6379`), or intranet IP addresses.
2. **Information Disclosure via Discord Exception Handler — High Risk:**
   `bootstrap/app.php` transmits unhandled exceptions, database query strings, and system stack traces to an external Discord webhook.
3. **Unprotected Debug Endpoints — Medium Risk:**
   `routes/api.php` contains active `/_debug/sms-test` and `/_debug/log-test` routes that allow unauthenticated users to trigger outbound SMS jobs.
4. **Denial of Service via Broken Third-Party APIs — Medium Risk:**
   If third-party notification APIs (Twilio, MSG91, Meta WhatsApp) fail or run out of credits, queue workers can exhaust retry limits without proper backoff.

---

## 4. What Needs to Be Changed Before Publishing the Source Code?

1. **Implement IP/CIDR Filtering (SSRF Guard):** Create a security helper that rejects loopback, RFC 1918 private subnets, and link-local cloud metadata IPs across all HTTP checks.
2. **Implement `ENABLE_BILLING=false`:** Modify `PlanLimitService` so that when commercial billing is disabled, the platform defaults to an unlimited "Community Edition" with full access to SSL monitoring, 1-minute checks, AI diagnostics, and unlimited monitors.
3. **Make hCaptcha Conditional:** Validate captcha tokens only when `HCAPTCHA_SECRET_KEY` is present in `.env`.
4. **Refactor Screenshots to Local Storage:** Use Laravel's standard `Storage::disk(config('filesystems.default'))` abstraction.
5. **Remove Company Telemetry & Debug Code:** Strip Google Tag Manager from `frontend/index.html`, remove the Discord exception webhook from `bootstrap/app.php`, delete debug routes, and delete all 12 ad-hoc development scripts (`repair_db.php`, `backend/scaffold_*.php`, etc.).
6. **Add First-Time Admin Creation Command:** Implement `php artisan boomerr:admin:create` to allow self-hosters to set up their administrative accounts securely.

---

## 5. What Is the Simplest Recommended Docker Architecture?

The simplest, production-ready architecture uses a **single `docker-compose.yml` file with a unified multi-stage Docker image**:

- **`web` (Nginx Alpine):** Terminates HTTP/S, serves static compiled React assets, routes `/api` to PHP-FPM, and upgrades `/app` to Reverb WebSockets.
- **`api` (PHP 8.2-FPM):** Processes REST requests, database queries, and business logic.
- **`worker` (PHP 8.2):** Runs `php artisan queue:work --queue=monitoring,notifications,system-logs,default`.
- **`scheduler` (PHP 8.2):** Runs `php artisan schedule:work` to trigger uptime, SSL, and WHOIS checks every minute.
- **`reverb` (PHP 8.2):** Runs `php artisan reverb:start` on port 8080.
- **`db` (MySQL 8.0):** Relational storage with persistent named Docker volume.
- **`redis` (Redis 7 Alpine):** Low-latency caching, queue broker, and Reverb state.

*Note for 1GB VPS users:* By switching `DB_CONNECTION=sqlite` and `QUEUE_CONNECTION=database`, the `db` and `redis` containers can be omitted entirely, running the whole stack in under 400 MB RAM.

---

## 6. What Can Be Completed in 1–2 Weeks?

Within a **2-week sprint (~80 engineering hours)**, the entire core migration can be completed:
- **Week 1 (Days 1–5):**
  - Fix SSRF vulnerabilities and remove debug endpoints.
  - Remove Discord exception reporting and GTM tracking tags.
  - Refactor screenshot capture to use local disk storage.
  - Delete all ad-hoc development scripts.
  - Implement `ENABLE_BILLING=false` community edition bypass in `PlanLimitService`.
  - Make hCaptcha optional across user and admin auth.
- **Week 2 (Days 6–10):**
  - Author production multi-stage `Dockerfile`, `docker-compose.yml`, and `entrypoint.sh`.
  - Implement `php artisan boomerr:admin:create` artisan command.
  - Author complete `README.md`, `.env.example`, and deployment guides.
  - Test clean installation from scratch on an empty Ubuntu 24.04 server.
  - Set up GitHub Actions CI workflow (`.github/workflows/ci.yml`).

---

## 7. What Will Take Longer (Post-Launch Enhancements)?

Features that should be deferred to future releases:
1. **Decentralized Multi-Region Probe Network:** Replacing AWS Lambda with lightweight, open-source Go/Rust remote agent containers deployed across different cloud providers.
2. **Containerized Headless Chrome for Screenshots:** Packaging Chromium and Puppeteer into a dedicated microservice container so the PHP container remains lightweight Alpine.
3. **Enterprise SSO & SAML:** Adding Okta / Azure AD / Keycloak SAML support for corporate environments.
4. **Plugin & Integration Marketplace:** A modular system allowing third parties to contribute custom notification adapters.

---

## 8. Development Effort & Resource Estimates

| Phase | Milestone | Estimated Effort |
|---|---|---|
| **Phase A** | Security Hardening & Code Cleanup | 16 hours (~2 days) |
| **Phase B** | Dockerization & Process Orchestration | 18 hours (~2.5 days) |
| **Phase C** | Billing Decoupling & Community Architecture | 16 hours (~2 days) |
| **Phase D** | Validation Testing on Fresh Linux VPS & Documentation | 20 hours (~2.5 days) |
| **Phase E** | GitHub Repository Health & CI/CD Pipelines | 10 hours (~1.5 days) |
| **TOTAL** | **Full Production-Grade Open-Source Migration** | **80 Hours (~2 Weeks)** |

---

## 9. Ongoing Costs Our Company Can Eliminate

By transitioning from a centralized commercial SaaS host to an open-source model:

| Cost Item | Monthly SaaS Burden Before | Post-Migration Reality |
|---|---|---|
| **AWS Lambda Multi-Region Invocations** | Recurring charges across 6 AWS regions | **$0** (Handled by local workers or user probes) |
| **AWS S3 Storage & Bandwidth** | Gigabytes of uncompressed tenant screenshots | **$0** (Stored on self-hoster disks) |
| **Razorpay / Merchant Payment Liabilities** | Payment gateway fees, chargebacks, tax compliance | **$0** (No payment processing required) |
| **Subsidized SMS & WhatsApp Credits** | Upfront credit pools paid to MSG91 & Meta | **$0** (Users supply their own API keys) |
| **L1/L2 Technical Support Overhead** | Ongoing ticket support for tenant monitoring setup | **$0** (Shifted to community GitHub Discussions) |
| **Central Production Infrastructure** | Multi-server cloud cluster and managed DBs | **$0** (Downsized to lightweight project website) |

---

## 10. Next Steps & Approval Gate

The inspection is complete, and the 10 planning documents are staged in `opensource-planning/`.

**Recommended Immediate Action:**
1. Review the deliverables in `opensource-planning/`.
2. Approve the proposed license (**AGPLv3** recommended).
3. Grant authorization to begin **Phase A (Security & Code Cleanup)** and **Phase B (Dockerization)**.
