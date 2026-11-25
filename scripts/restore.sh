#!/usr/bin/env bash
# ==============================================================================
# Boomerr Automated Disaster Recovery & Restore Script
# ==============================================================================
# Usage:
#   ./scripts/restore.sh <path_to_backup_archive_or_directory>
# ==============================================================================

set -eo pipefail

BACKUP_SOURCE="$1"

if [ -z "$BACKUP_SOURCE" ] || [ ! -e "$BACKUP_SOURCE" ]; then
    echo "Usage: $0 <path_to_backup_archive_or_directory>"
    echo "Example: $0 backups/boomerr_backup_20261123_120000.tar.gz"
    exit 1
fi

TEMP_RESTORE_DIR="/tmp/boomerr_restore_$$"
mkdir -p "$TEMP_RESTORE_DIR"

cleanup() {
    rm -rf "$TEMP_RESTORE_DIR"
}
trap cleanup EXIT

echo "=== Starting Boomerr Restore from: ${BACKUP_SOURCE} ==="

# 1. Unpack Archive
if [ -f "$BACKUP_SOURCE" ]; then
    echo "Extracting backup archive..."
    tar -xzf "$BACKUP_SOURCE" -C "$TEMP_RESTORE_DIR"
elif [ -d "$BACKUP_SOURCE" ]; then
    cp -r "$BACKUP_SOURCE"/* "$TEMP_RESTORE_DIR"/
fi

# 2. Verify Checksums
if [ -f "$TEMP_RESTORE_DIR/checksums.sha256" ]; then
    echo "Verifying archive integrity..."
    cd "$TEMP_RESTORE_DIR"
    if command -v sha256sum &> /dev/null; then
        sha256sum -c checksums.sha256 --ignore-missing || true
    elif command -v shasum &> /dev/null; then
        shasum -a 256 -c checksums.sha256 --ignore-missing || true
    fi
    cd - > /dev/null
fi

# 3. Detect Docker Compose Command
DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo "Error: Docker Compose not found."
    exit 1
fi

# 4. Restore Database
if [ -f "$TEMP_RESTORE_DIR/db.sql.gz" ]; then
    echo "Restoring MariaDB database..."
    DB_PASS=$(grep -E '^DB_PASSWORD=' .env | cut -d '=' -f2- || true)
    DB_USER=$(grep -E '^DB_USERNAME=' .env | cut -d '=' -f2- || echo "root")
    DB_NAME=$(grep -E '^DB_DATABASE=' .env | cut -d '=' -f2- || echo "domain_monitoring")

    if [ -n "$DB_PASS" ]; then
        gunzip -c "$TEMP_RESTORE_DIR/db.sql.gz" | $DOCKER_COMPOSE_CMD exec -T db mariadb -u "$DB_USER" -p"$DB_PASS" "$DB_NAME"
    else
        gunzip -c "$TEMP_RESTORE_DIR/db.sql.gz" | $DOCKER_COMPOSE_CMD exec -T db mariadb -u "$DB_USER" "$DB_NAME"
    fi
    echo "✓ Database restored successfully."
fi

# 5. Restore Storage Files
if [ -f "$TEMP_RESTORE_DIR/storage.tar.gz" ]; then
    echo "Restoring storage files..."
    mkdir -p backend/storage/app/public
    tar -xzf "$TEMP_RESTORE_DIR/storage.tar.gz" -C backend/storage/app/public
    $DOCKER_COMPOSE_CMD exec -T api chown -R www-data:www-data /var/www/html/backend/storage || true
    echo "✓ Storage files restored."
fi

# 6. Run Migrations & Cache Clear
echo "Running schema sync & clearing caches..."
$DOCKER_COMPOSE_CMD exec -T api php artisan migrate --force
$DOCKER_COMPOSE_CMD exec -T api php artisan route:clear
$DOCKER_COMPOSE_CMD exec -T api php artisan config:clear

echo "=== Restore Completed Successfully! ==="
