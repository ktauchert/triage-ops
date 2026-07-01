#!/usr/bin/env bash
set -euo pipefail

# Smoke-test a product install bundle (no monorepo / npm required).
# Usage: scripts/verify-prod-install.sh [bundle-directory]

BUNDLE_DIR="${1:-.}"
cd "$BUNDLE_DIR"

COMPOSE_FILE="docker-compose.prod.yml"

log() {
  echo "[prod:verify] $*"
}

fail() {
  echo "[prod:verify] ERROR: $*" >&2
  echo "[prod:verify] Hint: docker compose -f ${COMPOSE_FILE} logs web worker postgres" >&2
  exit 1
}

wait_for_healthy() {
  local service="$1"
  local attempts="${2:-60}"
  local i=0

  while [ "$i" -lt "$attempts" ]; do
    if docker compose -f "$COMPOSE_FILE" ps --status running "$service" 2>/dev/null | grep -q "$service"; then
      local health
      health="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "gridnull-${service}" 2>/dev/null || echo "missing")"
      if [ "$health" = "healthy" ] || [ "$health" = "none" ]; then
        return 0
      fi
    fi
    i=$((i + 1))
    sleep 2
  done

  fail "Timed out waiting for $service to become healthy"
}

if ! command -v docker >/dev/null 2>&1; then
  fail "docker is not installed or not in PATH"
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  fail "${COMPOSE_FILE} not found in $(pwd)"
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    log "No .env found — copying .env.example (edit secrets before real production use)"
    cp .env.example .env
    # Replace placeholders with dev-safe values for smoke test only
    if grep -q '<strong-password>' .env; then
      sed -i 's/<strong-password>/gridnull_verify/g' .env
    fi
    if grep -q '<openssl rand -base64 32>' .env; then
      sed -i 's/<openssl rand -base64 32>/verify-test-secret-base64-value/g' .env
    fi
  else
    fail ".env is missing and no .env.example to copy"
  fi
fi

log "Pulling images..."
docker compose -f "$COMPOSE_FILE" pull

log "Starting infrastructure (postgres, redis, ollama)..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis ollama

log "Waiting for postgres and redis..."
wait_for_healthy postgres 60
wait_for_healthy redis 60

log "Applying migrations..."
docker compose -f "$COMPOSE_FILE" --profile migrate run --rm migrate

log "Starting production services (web, worker)..."
docker compose -f "$COMPOSE_FILE" --profile production up -d

log "Waiting for web to respond..."
web_ready=false
for i in $(seq 1 60); do
  if curl -sf -o /dev/null http://localhost:3000/login 2>/dev/null; then
    web_ready=true
    break
  fi
  if curl -sf -o /dev/null http://localhost:3000/setup 2>/dev/null; then
    web_ready=true
    break
  fi
  sleep 2
done

if [ "$web_ready" != true ]; then
  fail "Web did not respond on http://localhost:3000"
fi

for service in postgres redis web worker; do
  if ! docker compose -f "$COMPOSE_FILE" ps --status running "$service" 2>/dev/null | grep -q "$service"; then
    fail "Container $service is not running"
  fi
done

log "Product install verification passed."
log "Web: http://localhost:3000"
