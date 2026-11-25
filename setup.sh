#!/usr/bin/env bash
# ==============================================================================
# Boomerr Open-Source Quickstart & Interactive Setup Script
# ==============================================================================
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
# ==============================================================================

set -eo pipefail

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "=================================================================="
echo "    ____                                          ___    ____ "
echo "   / __ )____  ____  ____ ___  ___  __________   /   |  /  _/ "
echo "  / __  / __ \/ __ \/ __ \`__ \/ _ \/ ___/ ___/  / /| |  / /   "
echo " / /_/ / /_/ / /_/ / / / / / /  __/ /  / /     / ___ |_/ /    "
echo "/_____/\____/\____/_/ /_/ /_/\___/_/  /_/     /_/  |_/___/    "
echo "                                                               "
echo "     Open-Source Self-Hosted Website & Domain Monitoring       "
echo "=================================================================="
echo -e "${NC}"

# 1. Prerequisite Validation
echo -e "${BLUE}[1/6] Validating system prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker is not installed or not in PATH.${NC}"
    echo "Please install Docker from https://docs.docker.com/engine/install/ and retry."
    exit 1
fi

DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}[ERROR] Docker Compose (v2 or v1) is not installed.${NC}"
    echo "Please install Docker Compose plugin and retry."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}[ERROR] Docker daemon is not running or accessible.${NC}"
    echo "Please start the Docker service (or Docker Desktop) and retry."
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose (${DOCKER_COMPOSE_CMD}) detected and running.${NC}"

# 2. Environment File Setup
echo -e "\n${BLUE}[2/6] Configuring environment settings (.env)...${NC}"

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "Creating .env from .env.example..."
        cp .env.example .env
    else
        echo -e "${RED}[ERROR] Neither .env nor .env.example was found in $(pwd).${NC}"
        exit 1
    fi
fi

# Ensure APP_KEY exists and is not empty
CURRENT_KEY=$(grep -E '^APP_KEY=' .env | cut -d '=' -f2- || true)
if [ -z "$CURRENT_KEY" ]; then
    echo "Generating cryptographically secure application key..."
    NEW_KEY="base64:$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^APP_KEY=.*|APP_KEY=${NEW_KEY}|" .env
    else
        sed -i "s|^APP_KEY=.*|APP_KEY=${NEW_KEY}|" .env
    fi
    echo -e "${GREEN}✓ APP_KEY generated successfully.${NC}"
else
    echo -e "${GREEN}✓ Existing APP_KEY found in .env.${NC}"
fi

# Optional Interactive Prompts (with safe defaults)
HTTP_PORT=$(grep -E '^HTTP_PORT=' .env | cut -d '=' -f2- || echo "8080")
HTTP_PORT=${HTTP_PORT:-8080}

if [ -t 0 ]; then
    read -rp "Enter host HTTP port to expose [${HTTP_PORT}]: " INPUT_PORT
    if [ -n "$INPUT_PORT" ]; then
        HTTP_PORT="$INPUT_PORT"
        if grep -q '^HTTP_PORT=' .env; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^HTTP_PORT=.*|HTTP_PORT=${HTTP_PORT}|" .env
            else
                sed -i "s|^HTTP_PORT=.*|HTTP_PORT=${HTTP_PORT}|" .env
            fi
        else
            echo "HTTP_PORT=${HTTP_PORT}" >> .env
        fi
    fi
fi

echo -e "${GREEN}✓ Service will be accessible on port ${HTTP_PORT}.${NC}"

# 3. Build & Launch Containers
echo -e "\n${BLUE}[3/6] Starting Docker containers...${NC}"
$DOCKER_COMPOSE_CMD up -d

echo -e "${GREEN}✓ Containers deployed. Waiting for MariaDB service to be healthy...${NC}"

# Wait for Database readiness
MAX_RETRIES=30
RETRY_COUNT=0
DB_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if $DOCKER_COMPOSE_CMD exec -T db mariadb-admin ping -h 127.0.0.1 -u root --silent &>/dev/null; then
        DB_READY=true
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done
echo ""

if [ "$DB_READY" = false ]; then
    echo -e "${RED}[ERROR] MariaDB database failed to become healthy within 60 seconds.${NC}"
    echo "Check logs with: $DOCKER_COMPOSE_CMD logs db"
    exit 1
fi
echo -e "${GREEN}✓ Database is online and accepting connections.${NC}"

# 4. Database Migrations & Seeders
echo -e "\n${BLUE}[4/6] Running database migrations and seeders...${NC}"
$DOCKER_COMPOSE_CMD exec -T api php artisan migrate --force
$DOCKER_COMPOSE_CMD exec -T api php artisan db:seed --force
$DOCKER_COMPOSE_CMD exec -T api php artisan storage:link || true
echo -e "${GREEN}✓ Database initialized successfully.${NC}"

# 5. Admin Account Creation
echo -e "\n${BLUE}[5/6] Administrative Account Setup${NC}"
if [ -t 0 ]; then
    read -rp "Would you like to create an admin user now? (Y/n): " CREATE_ADMIN
    CREATE_ADMIN=${CREATE_ADMIN:-Y}
    if [[ "$CREATE_ADMIN" =~ ^[Yy]$ ]]; then
        $DOCKER_COMPOSE_CMD exec api php artisan boomerr:admin:create
    else
        echo "You can create an admin user anytime by running:"
        echo "  $DOCKER_COMPOSE_CMD exec api php artisan boomerr:admin:create"
    fi
else
    echo "Non-interactive terminal detected. Run the following after setup to create an admin:"
    echo "  $DOCKER_COMPOSE_CMD exec api php artisan boomerr:admin:create"
fi

# 6. Diagnostics & Verification
echo -e "\n${BLUE}[6/6] Running diagnostic health check...${NC}"
$DOCKER_COMPOSE_CMD exec -T api php artisan boomerr:doctor || true

# Final Summary Banner
echo -e "\n${GREEN}${BOLD}=================================================================="
echo "          🎉 BOOMERR HAS BEEN SUCCESSFULLY INSTALLED!             "
echo "==================================================================${NC}"
echo -e "Dashboard URL:     ${CYAN}http://localhost:${HTTP_PORT}${NC}"
echo -e "API Endpoint:      ${CYAN}http://localhost:${HTTP_PORT}/api${NC}"
echo -e "Mode:              ${GREEN}Community Edition (Unlimited Self-Hosted)${NC}"
echo ""
echo -e "${BOLD}Helpful Commands:${NC}"
echo "  View container logs:      $DOCKER_COMPOSE_CMD logs -f"
echo "  Check system health:      $DOCKER_COMPOSE_CMD exec api php artisan boomerr:doctor"
echo "  Create new admin user:    $DOCKER_COMPOSE_CMD exec api php artisan boomerr:admin:create"
echo "  Stop Boomerr:             $DOCKER_COMPOSE_CMD down"
echo "  Restart Boomerr:          $DOCKER_COMPOSE_CMD restart"
echo ""
echo "For documentation and troubleshooting, refer to the docs/ directory."
echo -e "${GREEN}==================================================================${NC}\n"
