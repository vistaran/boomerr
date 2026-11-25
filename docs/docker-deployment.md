# Boomerr Docker Deployment Guide

This guide covers deploying Boomerr on any self-hosted Linux server (Ubuntu, Debian, AlmaLinux, Rocky, CentOS) using Docker and Docker Compose.

---

## 1. System Requirements

| Metric | Minimum (Small Team / Personal) | Recommended (Production / Agency) |
|---|---|---|
| **CPU** | 2 vCPUs | 4 vCPUs |
| **RAM** | 2 GB | 4 GB - 8 GB |
| **Disk** | 20 GB SSD | 50+ GB SSD |
| **OS** | Ubuntu 22.04 / 24.04 LTS, Debian 12 | Ubuntu 24.04 LTS |
| **Docker** | Engine 24.0+ & Compose v2.20+ | Latest stable Docker CE |

---

## 2. Architecture Overview

Boomerr deploys as a cohesive multi-container stack orchestrated via Docker Compose:

```
                          [ Internet Traffic ]
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │            Host Reverse Proxy             │
             │     (Caddy / Traefik / Nginx with SSL)    │
             └─────────────────────┬─────────────────────┘
                                   │ HTTP :8080
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        boomerr-network (Bridge)                        │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      web (Nginx Reverse Proxy)                 │   │
│   │   - Serves React Frontend (Vite SPA)                           │   │
│   │   - Proxies /api/* to api:9000 (PHP-FPM)                       │   │
│   │   - Proxies /app/* to reverb:8080 (WebSockets)                 │   │
│   └───────────────┬───────────────────────────────┬────────────────┘   │
│                   │                               │                    │
│                   ▼                               ▼                    │
│   ┌───────────────────────────────┐  ┌─────────────────────────────┐   │
│   │       api (PHP 8.2-FPM)       │  │   reverb (WebSocket Server) │   │
│   │   - REST API                  │  │   - Real-time live status   │   │
│   │   - Healthchecks              │  │   - Incident broadcasts     │   │
│   └───────────────┬───────────────┘  └─────────────┬───────────────┘   │
│                   │                                │                   │
│   ┌───────────────┴───────────────┐                │                   │
│   │   worker (Laravel Queue)      │                │                   │
│   │   - Background uptime checks  │                │                   │
│   │   - Incident notifications    │                │                   │
│   │   - Alert dispatchers         │                │                   │
│   └───────────────┬───────────────┘                │                   │
│                   │                                │                   │
│   ┌───────────────┴───────────────┐                │                   │
│   │   scheduler (Cron Daemon)     │                │                   │
│   │   - Periodic monitor dispatch │                │                   │
│   │   - SSL certificate checks    │                │                   │
│   └───────────────┬───────────────┘                │                   │
│                   │                                │                   │
│                   ├────────────────────────────────┤                   │
│                   ▼                                ▼                   │
│   ┌───────────────────────────────┐  ┌─────────────────────────────┐   │
│   │      db (MariaDB 11.4)        │  │      redis (Redis 7)        │   │
│   │   - Persistent relational data│  │   - Caching & rate limits   │   │
│   │   - Volume: mariadb_data      │  │   - High-throughput queues  │   │
│   └───────────────────────────────┘  └─────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Quickstart Deployment

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-org/boomerr.git
cd boomerr
```

### Step 2: Run the Setup Script
```bash
chmod +x setup.sh
./setup.sh
```

The script automatically:
1. Validates Docker and Docker Compose prerequisites.
2. Copies `.env.example` to `.env`.
3. Generates a cryptographically strong `APP_KEY`.
4. Starts the containers in detached mode.
5. Executes database migrations and seeders.
6. Prompts you to create the initial admin account.
7. Executes the system diagnostic doctor.

---

## 4. Production Domain & SSL Setup

For production instances, it is recommended to place a reverse proxy in front of Boomerr to handle TLS/SSL termination.

### Option A: Caddy (Recommended - Automatic SSL)

Install Caddy on the host:
```bash
sudo apt install -y caddy
```

Add the following to `/etc/caddy/Caddyfile`:
```caddy
status.yourdomain.com {
    reverse_proxy localhost:8080 {
        # WebSocket support
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

Reload Caddy:
```bash
sudo systemctl reload caddy
```

### Option B: Host Nginx with Certbot (Let's Encrypt)

```nginx
server {
    server_name status.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen 80;
}
```

Enable SSL:
```bash
sudo certbot --nginx -d status.yourdomain.com
```

---

## 5. Scaling Background Workers

If you are monitoring hundreds of domains with 1-minute intervals, you can scale the background queue workers:

```bash
docker compose up -d --scale worker=3
```

This starts 3 parallel worker containers processing domain health checks concurrently.

---

## 6. Container Management Commands

| Action | Command |
|---|---|
| View logs in real time | `docker compose logs -f` |
| View specific service logs | `docker compose logs -f api` (or `worker`, `web`, `db`) |
| Check container health | `docker compose ps` |
| Restart all containers | `docker compose restart` |
| Stop all containers | `docker compose down` |
| Run diagnostic doctor | `docker compose exec api php artisan boomerr:doctor` |
| Create admin user | `docker compose exec api php artisan boomerr:admin:create` |
| Run bash shell in API container | `docker compose exec api sh` |
