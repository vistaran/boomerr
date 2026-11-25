#!/usr/bin/env bash
# ==============================================================================
# Boomerr Automated Backup Script
# ==============================================================================
# Usage:
#   ./scripts/backup.sh [destination_directory]
# ==============================================================================

set -eo pipefail

BACKUP_ROOT="${1:-backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEMP_BACKUP_DIR="${BACKUP_ROOT}/temp_${TIMESTAMP}"
ARCHIVE_NAME="boomerr_backup_${TIMESTAMP}.tar.gz"

echo "=== Starting Boomerr Backup (${TIMESTAMP}) ==="

mkdir -p "$TEMP_BACKUP_DIR"

# 1. Detect Docker Compose Command
DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo "Error: Docker Compose not found."
    exit 1
fi

# 2. Backup Database
echo "Dumping MariaDB database..."
DB_PASS=$(grep -E '^DB_PASSWORD=' .env | cut -d '=' -f2- || true)
DB_USER=$(grep -E '^DB_USERNAME=' .env | cut -d '=' -f2- || echo "root")
DB_NAME=$(grep -E '^DB_DATABASE=' .env | cut -d '=' -f2- || echo "domain_monitoring")

if [ -n "$DB_PASS" ]; then
    $DOCKER_COMPOSE_CMD exec -T db mariadb-dump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$TEMP_BACKUP_DIR/db.sql.gz"
else
    $DOCKER_COMPOSE_CMD exec -T db mariadb-dump -u "$DB_USER" "$DB_NAME" | gzip > "$TEMP_BACKUP_DIR/db.sql.gz"
fi

# 3. Backup Storage Files (Screenshots, Avatars, Badges)
echo "Archiving uploaded files and incident screenshots..."
if [ -d "backend/storage/app/public" ]; then
    tar -czf "$TEMP_BACKUP_DIR/storage.tar.gz" -C backend/storage/app/public .
else
    # Fallback to copy from web container
    $DOCKER_COMPOSE_CMD exec -T api tar -czf - -C /var/www/html/backend/storage/app/public . > "$TEMP_BACKUP_DIR/storage.tar.gz"
fi

# 4. Backup Environment Configuration
echo "Backing up configuration..."
if [ -f .env ]; then
    cp .env "$TEMP_BACKUP_DIR/.env.backup"
fi

# 5. Generate Checksums
cd "$TEMP_BACKUP_DIR"
if command -v sha256sum &> /dev/null; then
    sha256sum * > checksums.sha256
elif command -v shasum &> /dev/null; then
    shasum -a 256 * > checksums.sha256
fi
cd - > /dev/null

# 6. Bundle Final Archive
echo "Packaging final backup archive: ${BACKUP_ROOT}/${ARCHIVE_NAME}"
tar -czf "${BACKUP_ROOT}/${ARCHIVE_NAME}" -C "$TEMP_BACKUP_DIR" .
rm -rf "$TEMP_BACKUP_DIR"

echo "=== Backup Complete: ${BACKUP_ROOT}/${ARCHIVE_NAME} ==="
