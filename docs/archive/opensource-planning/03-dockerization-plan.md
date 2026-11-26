# Dockerization Strategy & Deployment Architecture

## 1. Architectural Strategy

The primary goal of the Boomerr Dockerization plan is:
> **A developer or sysadmin should be able to clone the repository, copy an environment file, and launch a complete, fully functioning Boomerr platform using a single `docker compose up -d` command.**

To achieve this without bloating infrastructure costs or managing excessive independent containers, we design a modular, container-reuse architecture based on official Alpine-based images.

### 1.1 Service Topology & Container Layout

```mermaid
flowchart TD
    subgraph Client ["Client Devices"]
        UserBrowser["User Browser"]
    end

    subgraph HostPorts ["Exposed Host Ports"]
        Port80["Port 80 (HTTP)"]
        Port443["Port 443 (HTTPS)"]
    end

    subgraph DockerNetwork ["Internal Docker Bridge Network (boomerr-net)"]
        subgraph WebEdge ["Web Edge Service (boomerr-web)"]
            Nginx["Nginx Reverse Proxy & Static Asset Server"]
        end

        subgraph ApplicationServices ["Core PHP Services (Shared Base Image: boomerr-app)"]
            App["boomerr-api (PHP 8.2-FPM)"]
            Worker["boomerr-worker (Queue Worker)"]
            Scheduler["boomerr-scheduler (Artisan Cron)"]
            Reverb["boomerr-reverb (Laravel Reverb :8080)"]
        end

        subgraph DataServices ["State & Storage Services"]
            DB[(boomerr-db : MySQL 8.0 / MariaDB)]
            Redis[(boomerr-redis : Redis 7 Alpine)]
        end

        subgraph PersistentVolumes ["Persistent Named Docker Volumes"]
            VolDB[("boomerr_db_data")]
            VolRedis[("boomerr_redis_data")]
            VolStorage[("boomerr_app_storage")]
        end
    end

    UserBrowser --> Port80
    UserBrowser --> Port443
    Port80 --> Nginx
    Port443 --> Nginx

    Nginx -->|Route /api, /broadcasting, /auth| App
    Nginx -->|Route /ws, /reverb (WebSocket Upgrade)| Reverb
    Nginx -->|Serve / (Static Assets)| Nginx

    App --> DB
    App --> Redis
    App --> VolStorage

    Worker --> DB
    Worker --> Redis
    Worker --> VolStorage

    Scheduler --> DB
    Scheduler --> Redis

    Reverb --> Redis

    DB --- VolDB
    Redis --- VolRedis
```

---

## 2. Container Role Specifications

Instead of building 5 separate Dockerfiles for the PHP components, we build **one optimized, multi-stage production base image** (`boomerr-app`) and instantiate it across 4 services with different entrypoint commands.

| Container Service | Base Image | Role & Executed Command | Memory (Min/Rec) |
|---|---|---|---|
| `boomerr-web` | `nginx:alpine` | Terminates HTTP/S, serves compiled React SPA static assets, and proxies `/api` and `/broadcasting` to `boomerr-api`, and WebSockets to `boomerr-reverb`. | 64 MB / 128 MB |
| `boomerr-api` | `boomerr-app` | FastCGI PHP-FPM processing application logic, REST endpoints, and authentication. | 128 MB / 256 MB |
| `boomerr-worker` | `boomerr-app` | Processes queues: `php artisan queue:work --queue=monitoring,notifications,system-logs,default --tries=3 --timeout=90`. | 128 MB / 512 MB |
| `boomerr-scheduler` | `boomerr-app` | Lightweight runner executing `php artisan schedule:work` (native in Laravel) or cron every minute. | 64 MB / 128 MB |
| `boomerr-reverb` | `boomerr-app` | Real-time WebSocket server: `php artisan reverb:start --host=0.0.0.0 --port=8080`. | 64 MB / 128 MB |
| `boomerr-db` | `mysql:8.0` / `mariadb:11` | Relational storage for domains, events, users, incidents, and workspaces. | 256 MB / 1 GB |
| `boomerr-redis` | `redis:7-alpine` | Low-latency caching, queue processing, and Reverb pub/sub state. | 64 MB / 256 MB |

> [!NOTE]
> **Single-Node Ultra-Lightweight Option:** For personal or hobby self-hosters with a 1 GB VPS, `DB_CONNECTION=sqlite` and `CACHE_STORE=database`, `QUEUE_CONNECTION=database` can eliminate both the `boomerr-db` and `boomerr-redis` containers, running the entire stack in under **400 MB RAM total**.

---

## 3. Production Dockerfile Specification

A production-ready, multi-stage build that:
1. Builds the React 19 frontend into static HTML/JS/CSS.
2. Installs PHP composer dependencies with autoloader optimization.
3. Packages production PHP 8.2-FPM with all required system extensions (`pdo_mysql`, `pdo_sqlite`, `bcmath`, `pcntl`, `sockets`, `redis`, `gd`, `zip`).

```dockerfile
# ==========================================
# Stage 1: Frontend Build Stage
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# Inject relative API root for self-hosted build
ENV VITE_API_BASE_URL=/api
ENV VITE_REVERB_SCHEME=https
ENV VITE_REVERB_PORT=443
RUN npm run build

# ==========================================
# Stage 2: Backend Dependencies Stage
# ==========================================
FROM composer:2.8 AS vendor-builder
WORKDIR /app/backend

COPY backend/composer*.json ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

# ==========================================
# Stage 3: Production PHP Runtime (Shared)
# ==========================================
FROM php:8.2-fpm-alpine AS base-runtime

# Install required system libraries
RUN apk add --no-cache \
    curl \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libzip-dev \
    icu-dev \
    sqlite-dev \
    oniguruma-dev \
    bash \
    netcat-openbsd

# Configure and install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        pdo_sqlite \
        bcmath \
        pcntl \
        sockets \
        intl \
        zip \
        gd \
        opcache

# Install redis extension via PECL
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del .build-deps

# Production PHP & Opcache configuration
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini
COPY docker/php/php.ini /usr/local/etc/php/conf.d/custom.ini

WORKDIR /var/www/html

# Copy application source and vendor
COPY backend/ .
COPY --from=vendor-builder /app/backend/vendor ./vendor
COPY --from=frontend-builder /app/frontend/dist ./public/app

# Set file permissions for www-data
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache \
    && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Copy entrypoint script
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["php-fpm"]
```

---

## 4. Production Docker Compose Configuration

File: `docker-compose.yml`

```yaml
version: '3.8'

networks:
  boomerr-net:
    driver: bridge

volumes:
  boomerr_db_data:
  boomerr_redis_data:
  boomerr_app_storage:

services:
  # ----------------------------------------------------
  # Web Ingress & Static File Server
  # ----------------------------------------------------
  web:
    image: nginx:alpine
    container_name: boomerr-web
    restart: unless-stopped
    ports:
      - "${HTTP_PORT:-80}:80"
      - "${HTTPS_PORT:-443}:443"
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
      - boomerr_app_storage:/var/www/html/storage/app/public:ro
    depends_on:
      api:
        condition: service_healthy
      reverb:
        condition: service_started
    networks:
      - boomerr-net

  # ----------------------------------------------------
  # Application API Backend (PHP-FPM)
  # ----------------------------------------------------
  api:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: boomerr-api
    restart: unless-stopped
    env_file: .env
    volumes:
      - boomerr_app_storage:/var/www/html/storage
    healthcheck:
      test: ["CMD-SHELL", "php artisan route:list || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - boomerr-net

  # ----------------------------------------------------
  # Background Queue Worker
  # ----------------------------------------------------
  worker:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: boomerr-worker
    restart: unless-stopped
    env_file: .env
    command: php artisan queue:work --queue=monitoring,notifications,system-logs,default --tries=3 --timeout=90
    volumes:
      - boomerr_app_storage:/var/www/html/storage
    depends_on:
      api:
        condition: service_healthy
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - boomerr-net

  # ----------------------------------------------------
  # Recurring Scheduler (Cron Replacement)
  # ----------------------------------------------------
  scheduler:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: boomerr-scheduler
    restart: unless-stopped
    env_file: .env
    command: php artisan schedule:work
    depends_on:
      api:
        condition: service_healthy
    networks:
      - boomerr-net

  # ----------------------------------------------------
  # Laravel Reverb WebSocket Server
  # ----------------------------------------------------
  reverb:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: boomerr-reverb
    restart: unless-stopped
    env_file: .env
    command: php artisan reverb:start --host=0.0.0.0 --port=8080
    depends_on:
      api:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - boomerr-net

  # ----------------------------------------------------
  # Relational Database (MySQL 8.0)
  # ----------------------------------------------------
  db:
    image: mysql:8.0
    container_name: boomerr-db
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: ${DB_DATABASE:-boomerr}
      MYSQL_USER: ${DB_USERNAME:-boomerr}
      MYSQL_PASSWORD: ${DB_PASSWORD:-secret}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:-root_secret}
    volumes:
      - boomerr_db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${DB_ROOT_PASSWORD:-root_secret}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - boomerr-net

  # ----------------------------------------------------
  # Redis Cache & Queue Broker
  # ----------------------------------------------------
  redis:
    image: redis:7-alpine
    container_name: boomerr-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass "${REDIS_PASSWORD:-}"
    volumes:
      - boomerr_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - boomerr-net
```

---

## 5. Nginx Reverse Proxy Configuration

File: `docker/nginx/default.conf`

```nginx
upstream php-fpm {
    server api:9000;
}

upstream reverb-ws {
    server reverb:8080;
}

server {
    listen 80;
    listen [::]:80;
    server_name _;

    client_max_body_size 50M;

    # Root for static frontend assets
    root /var/www/html/public/app;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 1. Laravel Reverb WebSocket Proxy
    location /app {
        proxy_pass http://reverb-ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # 2. Laravel API Endpoints
    location ^~ /api/ {
        root /var/www/html/public;
        try_files $uri /index.php?$query_string;
    }

    # 3. Broadcasting Auth Endpoints
    location ^~ /broadcasting/ {
        root /var/www/html/public;
        try_files $uri /index.php?$query_string;
    }

    # 4. Status Feed & Public Tools
    location ^~ /status {
        try_files $uri $uri/ /index.html;
    }

    # 5. Public Upload Storage
    location ^~ /storage/ {
        alias /var/www/html/storage/app/public/;
        try_files $uri =404;
        expires 30d;
        access_log off;
    }

    # 6. Pass PHP requests to PHP-FPM
    location ~ \.php$ {
        root /var/www/html/public;
        fastcgi_pass php-fpm;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
        fastcgi_read_timeout 120s;
    }

    # 7. Frontend Single Page Application Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Deny dotfiles
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

---

## 6. Container Startup & Auto-Migration Script

File: `docker/entrypoint.sh`

```bash
#!/bin/bash
set -e

# Wait for MySQL to be ready if DB_CONNECTION is mysql
if [ "$DB_CONNECTION" = "mysql" ]; then
    echo "Waiting for MySQL at $DB_HOST:$DB_PORT..."
    while ! nc -z "$DB_HOST" "$DB_PORT"; do
        sleep 1
    done
    echo "MySQL is reachable!"
fi

# Wait for Redis to be ready
if [ -n "$REDIS_HOST" ]; then
    echo "Waiting for Redis at $REDIS_HOST:$REDIS_PORT..."
    while ! nc -z "$REDIS_HOST" "$REDIS_PORT"; do
        sleep 1
    done
    echo "Redis is reachable!"
fi

# Initialize SQLite database file if required
if [ "$DB_CONNECTION" = "sqlite" ]; then
    if [ ! -f "$DB_DATABASE" ]; then
        echo "Creating SQLite database at $DB_DATABASE..."
        touch "$DB_DATABASE"
        chown www-data:www-data "$DB_DATABASE"
    fi
fi

# If running as API container, run migrations and base seeders
if [ "$1" = "php-fpm" ]; then
    echo "Running database migrations..."
    php artisan migrate --force --isolated

    echo "Ensuring default base roles exist..."
    php artisan db:seed --class=RolesSeeder --force

    echo "Ensuring monitoring regions exist..."
    php artisan db:seed --class=MonitoringRegionSeeder --force

    echo "Ensuring email templates exist..."
    php artisan db:seed --class=EmailTemplateSeeder --force

    echo "Linking storage..."
    php artisan storage:link || true

    echo "Caching configuration and routes for production..."
    php artisan config:cache
    php artisan route:cache
    php artisan event:cache
fi

exec "$@"
```

---

## 7. Operational Lifecycle: Upgrades & Backups

### 7.1 Fast 3-Step Setup for Self-Hosters
```bash
# 1. Clone repository
git clone https://github.com/your-org/boomerr.git
cd boomerr

# 2. Configure environment
cp .env.example .env
# Edit APP_URL and passwords in .env

# 3. Start services
docker compose up -d --build

# 4. Create initial Admin account
docker compose exec api php artisan boomerr:admin:create
```

### 7.2 Safe Upgrade Procedure
```bash
# Pull new changes
git pull origin main

# Rebuild containers with zero downtime on persistent volumes
docker compose build
docker compose up -d

# Migrations run automatically on startup via entrypoint.sh!
```

### 7.3 Backup & Restore Procedure
- **Database Backup:**
  ```bash
  docker compose exec db mysqldump -u root -p"$DB_ROOT_PASSWORD" boomerr > backup_$(date +%F).sql
  ```
- **Storage Directory Backup:**
  ```bash
  tar -czvf storage_backup_$(date +%F).tar.gz -C ./docker/volumes/storage .
  ```
- **Restore:**
  ```bash
  cat backup.sql | docker compose exec -T db mysql -u root -p"$DB_ROOT_PASSWORD" boomerr
  ```
