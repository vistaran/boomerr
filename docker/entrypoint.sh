#!/bin/sh
set -e

# Check for required APP_KEY
if [ -z "$APP_KEY" ]; then
    echo ">> ERROR: APP_KEY is not set!"
    echo ">> Please set APP_KEY in your .env file."
    echo ">> You can generate one using:"
    echo ">>   php -r \"echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;\""
    echo ">> or with:"
    echo ">>   openssl rand -base64 32"
    exit 1
fi

# Wait for MariaDB if DB_HOST is set
if [ -n "$DB_HOST" ]; then
    DB_PORT="${DB_PORT:-3306}"
    echo ">> Waiting for MariaDB at $DB_HOST:$DB_PORT..."
    MAX_TRIES=30
    COUNT=0
    until php -r "\$conn = @fsockopen('$DB_HOST', $DB_PORT, \$errno, \$errstr, 2); if (\$conn) { fclose(\$conn); exit(0); } exit(1);" 2>/dev/null; do
        COUNT=$((COUNT + 1))
        if [ "$COUNT" -ge "$MAX_TRIES" ]; then
            echo ">> MariaDB connection timed out ($DB_HOST:$DB_PORT). Exiting."
            exit 1
        fi
        sleep 2
    done
    echo ">> MariaDB is ready."
fi

# Wait for Redis if REDIS_HOST is set
if [ -n "$REDIS_HOST" ]; then
    REDIS_PORT="${REDIS_PORT:-6379}"
    echo ">> Waiting for Redis at $REDIS_HOST:$REDIS_PORT..."
    MAX_TRIES=30
    COUNT=0
    until php -r "\$conn = @fsockopen('$REDIS_HOST', $REDIS_PORT, \$errno, \$errstr, 2); if (\$conn) { fclose(\$conn); exit(0); } exit(1);" 2>/dev/null; do
        COUNT=$((COUNT + 1))
        if [ "$COUNT" -ge "$MAX_TRIES" ]; then
            echo ">> Redis connection timed out ($REDIS_HOST:$REDIS_PORT). Exiting."
            exit 1
        fi
        sleep 2
    done
    echo ">> Redis is ready."
fi

# Execute migrations, seeders, and cache only for the main api container (php-fpm)
if [ "$1" = "php-fpm" ]; then
    echo ">> Refreshing bootstrap package discovery..."
    rm -f /var/www/html/bootstrap/cache/*.php
    php artisan package:discover --ansi

    echo ">> Running database migrations..."
    php artisan migrate --force --isolated

    echo ">> Running idempotent seeders..."
    php artisan db:seed --class=RolesSeeder --force
    php artisan db:seed --class=MonitoringRegionSeeder --force
    php artisan db:seed --class=EmailTemplateSeeder --force

    echo ">> Ensuring storage link exists..."
    php artisan storage:link --force 2>/dev/null || true

    echo ">> Optimizing configuration and routes..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
fi

exec "$@"
