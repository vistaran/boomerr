# Infrastructure Requirements & Cost Analysis

## 1. Deployment Profiles & Sizing Estimates

Because Boomerr uses asynchronous queue workers and event-driven monitoring checks, server resource consumption scales primarily with **the number of active monitors** and **the frequency of checks**.

Below are three deployment profiles tailored for different self-hosting scenarios.

---

### Profile 1: Small Installation (Personal / Indie Hacker)
- **Scale:** 1 – 20 monitored domains
- **Monitoring Interval:** 5 minutes
- **Total Checks:** ~5,760 checks per day (~4 checks per minute)
- **Target Audience:** Freelancers, developers, personal websites, small blogs.

| Resource Component | Sizing & Configuration | Notes |
|---|---|---|
| **CPU** | 1 vCPU | Lightweight load; checks execute in brief bursts |
| **RAM** | 1 GB – 2 GB | Runs SQLite + API + Worker + Scheduler + Reverb |
| **Disk Storage** | 10 GB – 20 GB SSD | Database logs pruned automatically |
| **Bandwidth** | ~5 GB – 10 GB / month | HTTP HEAD/GET checks generate minimal payload |
| **Database** | SQLite (or single MariaDB container) | SQLite is zero-maintenance and fast for < 20 domains |
| **Queue Workers** | 1 worker process (`--tries=1`) | Handles monitoring and notification jobs sequentially |
| **Est. Hosting Cost** | **$4 – $7 / month** | e.g. Hetzner Cloud (CX22) or DigitalOcean Basic Droplet |

---

### Profile 2: Medium Installation (Digital Agency / SMB)
- **Scale:** 20 – 200 monitored domains
- **Monitoring Interval:** 1 minute
- **Total Checks:** ~288,000 checks per day (~200 checks per minute)
- **Target Audience:** Digital marketing agencies, e-commerce stores, mid-size SaaS.

| Resource Component | Sizing & Configuration | Notes |
|---|---|---|
| **CPU** | 2 vCPU | Sustained background HTTP I/O and SSL socket handshakes |
| **RAM** | 4 GB | PHP-FPM pool + Redis + MySQL + 2 Queue Workers + Reverb |
| **Disk Storage** | 40 GB – 60 GB NVMe | Handles time-series `domain_status_events` table |
| **Bandwidth** | ~50 GB – 100 GB / month | Higher volume of HTTP checks and status page traffic |
| **Database** | MySQL 8.0 or MariaDB 11 with indexing | Requires table partitioning or automated event pruning |
| **Queue Workers** | 2 – 4 worker processes | Split: 2 workers for `monitoring`, 1 for `notifications` |
| **Est. Hosting Cost** | **$15 – $25 / month** | e.g. Hetzner Cloud (CPX21) or Linode 4GB |

---

### Profile 3: Large Installation (Enterprise / High-Frequency)
- **Scale:** 200 – 1,000+ monitored domains
- **Monitoring Interval:** 30 seconds to 1 minute
- **Total Checks:** 1.5M – 3M checks per day (~1,000 – 2,000 checks per minute)
- **Target Audience:** Hosting providers, high-traffic e-commerce networks, enterprise IT.

| Resource Component | Sizing & Configuration | Notes |
|---|---|---|
| **CPU** | 4 – 8 vCPU | Multi-threaded concurrency for high check volume |
| **RAM** | 8 GB – 16 GB | Generous buffer pool for MySQL and Redis in-memory cache |
| **Disk Storage** | 100 GB – 200 GB NVMe | Requires daily aggregation and event pruning (`monitor:aggregate-daily`) |
| **Bandwidth** | ~300 GB – 500 GB / month | High concurrent socket traffic and WebSocket connections |
| **Database** | Dedicated MySQL 8.0 / Amazon RDS / Managed DB | Separate database server recommended for IOPS |
| **Queue Workers** | 8 – 16 worker processes | Dedicated queue container fleet processing `monitoring` |
| **Est. Hosting Cost** | **$60 – $120 / month** | e.g. Dedicated Hetzner server or 8-core Cloud VPS |

---

## 2. Infrastructure Costs vs. Third-Party API Costs

A common misconception in self-hosting is conflating server costs with API costs. In Boomerr:
1. **Core Monitoring is 100% Free:** Uptime, SSL, WHOIS, Reverb WebSockets, Status Pages, and Discord/Slack/Telegram alerts incur **$0 in API fees**.
2. **Optional Integrations are Pay-As-You-Go:**

| Service | Pricing Assumption & Method | Estimated Cost per 1,000 Incidents / Operations |
|---|---|---|
| **DeepSeek LLM** | ~$0.14 per 1M input tokens, ~$0.28 per 1M output tokens | **~$0.15** per 1,000 incident diagnoses (~500 tokens/incident) |
| **OpenAI GPT-4o-mini** | ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens | **~$0.25** per 1,000 incident diagnoses |
| **Meta WhatsApp Cloud** | First 1,000 service conversations/month are free; then ~$0.005–$0.04/conversation | **$0 – $15** per month depending on volume and country |
| **Twilio SMS** | ~$0.0079 per SMS (US) / regional carrier fees | **~$8.00** per 1,000 SMS alerts |
| **MSG91 SMS** | ~$0.0025 per SMS in India | **~$2.50** per 1,000 SMS alerts |
| **AWS S3 (Screenshots)** | $0.023 per GB-month + $0.005 per 1,000 PUT requests | **~$0.05** per month (or **$0** if stored on local disk) |

---

## 3. SaaS Cost Elimination for Our Company

Transitioning Boomerr from a commercially hosted SaaS platform into an open-source model eliminates significant ongoing operational and legal liabilities for our company:

| SaaS Expense Category | Current Operational Burden | Post-Migration Reality |
|---|---|---|
| **AWS Lambda Multi-Region Fleet** | Incurred invocation charges, concurrency reservations, and data transfer across 6 AWS regions. | **Eliminated.** Users monitor locally or host their own probe nodes. |
| **AWS S3 Screenshot Storage** | Accumulating gigabytes of uncompressed incident PNGs from thousands of tenant domains. | **Eliminated.** Users store screenshots on their own local disks or S3 buckets. |
| **Razorpay / Payment Compliance** | Merchant transaction fees, chargebacks, GST/VAT tax filings, and subscription disputes. | **Eliminated.** No customer billing, payment disputes, or financial liabilities. |
| **Credit Pool Subsidies** | Company paid for upfront WhatsApp and SMS credit bundles used by free/starter tier users. | **Eliminated.** Users provide their own Twilio, MSG91, or Meta credentials. |
| **Customer Support Overhead** | Ongoing troubleshooting of third-party domains, SSL handshakes, and false positives. | **Eliminated / Transferred.** Shifted to community GitHub Discussions and Issues. |
| **Central Server Fleet** | Multi-server production cluster with database clustering, Redis replication, and load balancers. | **Downsized / Eliminated.** Company only maintains a static project website and demo instance. |
