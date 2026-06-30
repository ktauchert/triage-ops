#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
  echo "[docker:verify] $*"
}

fail() {
  echo "[docker:verify] ERROR: $*" >&2
  echo "[docker:verify] Hint: docker compose logs web worker postgres redis" >&2
  exit 1
}

wait_for_healthy() {
  local service="$1"
  local attempts="${2:-60}"
  local i=0

  while [ "$i" -lt "$attempts" ]; do
    if docker compose ps --status running "$service" 2>/dev/null | grep -q "$service"; then
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

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    log "No .env found — copying .env.example"
    cp .env.example .env
  else
    fail ".env is missing and no .env.example to copy"
  fi
fi

log "Building production images..."
docker compose --profile production build

log "Starting full stack (postgres, redis, ollama, web, worker)..."
docker compose --profile production up -d

log "Waiting for postgres and redis..."
wait_for_healthy postgres 60
wait_for_healthy redis 60

log "Applying migrations..."
npm run docker:migrate

log "Waiting for web to respond..."
web_ready=false
for i in $(seq 1 60); do
  if curl -sf -o /dev/null http://localhost:3000/login 2>/dev/null; then
    web_ready=true
    break
  fi
  if curl -sf -o /dev/null http://localhost:3000/ 2>/dev/null; then
    web_ready=true
    break
  fi
  sleep 2
done

if [ "$web_ready" != true ]; then
  fail "Web did not respond on http://localhost:3000"
fi

log "Checking Ollama API..."
if curl -sf -o /dev/null http://localhost:11434/api/tags 2>/dev/null; then
  log "Ollama is reachable"
else
  log "WARN: Ollama not reachable on :11434 (optional for sync/metrics)"
fi

for service in postgres redis web worker; do
  if ! docker compose ps --status running "$service" 2>/dev/null | grep -q "$service"; then
    fail "Container $service is not running"
  fi
  if [ "$service" = "worker" ]; then
    if docker compose ps -a "$service" 2>/dev/null | grep -q "Restarting"; then
      fail "Container $service is crash-looping (check: docker compose logs worker)"
    fi
  fi
done

log "Full Docker stack verification passed."
log "Web:    http://localhost:3000"
log "Postgres: localhost:5433 | Redis: localhost:6379"
