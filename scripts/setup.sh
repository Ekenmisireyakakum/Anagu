#!/usr/bin/env bash
# ANAGU Land Administration Platform — Linux/macOS Setup Script
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${CYAN}$*${NC}"; }
ok()    { echo -e "${GREEN}✓ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
err()   { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

log "================================================="
log " ANAGU Land Administration Platform — Setup"
log "================================================="

# 1. Check Docker
log "[1/5] Checking Docker..."
command -v docker >/dev/null 2>&1 || err "Docker not found. Install from https://docs.docker.com/get-docker/"
docker info >/dev/null 2>&1 || err "Docker daemon is not running. Start Docker and retry."
ok "Docker is running: $(docker --version)"

# 2. Create .env
log "[2/5] Checking .env file..."
if [ ! -f "$ROOT_DIR/.env" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  ok "Created .env from .env.example"
  warn "Review $ROOT_DIR/.env and update secrets before continuing."
else
  ok ".env already exists, skipping."
fi

# 3. Start infrastructure services
log "[3/5] Starting infrastructure services (postgres, redis, minio, mosquitto)..."
cd "$ROOT_DIR"
docker compose up -d postgres redis minio mosquitto
ok "Services started."

# 4. Wait for postgres
log "[4/5] Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U anagu -d anagu_db >/dev/null 2>&1; then
    ok "PostgreSQL is ready."
    break
  fi
  echo "  Attempt $i/30 — waiting 2s..."
  sleep 2
done

# 5. Status
log "[5/5] Service status:"
docker compose ps postgres redis minio mosquitto

log "================================================="
ok " Infrastructure ready!"
log "================================================="
echo ""
echo "Next steps:"
echo "  1. Review .env with real secrets"
echo "  2. npm install"
echo "  3. cd packages/database && npx prisma migrate dev"
echo "  4. npm run dev:api"
echo "  5. npm run dev:web"
