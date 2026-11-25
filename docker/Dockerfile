# -------------------------------------------------------------
# Stage 1: Build Frontend SPA
# -------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN mkdir -p dist/assets && npm run build

# -------------------------------------------------------------
# Stage 2: Install Composer Dependencies
# -------------------------------------------------------------
FROM composer:2 AS vendor-builder

WORKDIR /app

COPY backend/composer.* ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

# -------------------------------------------------------------
# Stage 3: Backend Application Image (PHP 8.2-FPM Alpine)
# -------------------------------------------------------------
FROM php:8.2-fpm-alpine AS app

# Install system dependencies
RUN apk add --no-cache \
    curl \
    netcat-openbsd \
    libpng \
    libpng-dev \
    libjpeg-turbo \
    libjpeg-turbo-dev \
    freetype \
    freetype-dev \
    libzip \
    libzip-dev \
    icu-libs \
    icu-dev \
    oniguruma \
    oniguruma-dev \
    mariadb-client \
    linux-headers \
    $PHPIZE_DEPS \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        bcmath \
        gd \
        zip \
        intl \
        pcntl \
        opcache \
        sockets \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del --no-cache $PHPIZE_DEPS linux-headers \
    && rm -rf /tmp/pear

# Copy PHP and OPcache configuration
COPY docker/php/php.ini $PHP_INI_DIR/conf.d/99-boomerr.ini
COPY docker/php/opcache.ini $PHP_INI_DIR/conf.d/opcache.ini

WORKDIR /var/www/html

# Copy application source code and vendor
COPY backend/ /var/www/html/
COPY --from=vendor-builder /app/vendor /var/www/html/vendor

# Copy and setup entrypoint script
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN tr -d '\r' < /usr/local/bin/entrypoint.sh > /usr/local/bin/entrypoint-clean.sh \
    && mv /usr/local/bin/entrypoint-clean.sh /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

# Ensure storage and cache directory permissions
RUN mkdir -p storage/framework/cache/data \
             storage/framework/sessions \
             storage/framework/views \
             storage/logs \
             storage/app/public \
             bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["php-fpm", "-F"]

# -------------------------------------------------------------
# Stage 4: Web Server Reverse Proxy (Nginx Alpine)
# -------------------------------------------------------------
FROM nginx:alpine AS web

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy compiled frontend assets
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy backend public directory for static asset fallback & PHP proxying
COPY backend/public /var/www/html/public

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
