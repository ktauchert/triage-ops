# Running the App

Instructions for local development and full Docker deployment.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Docker + Docker Compose | Latest stable |
| Git | Any recent version |

Optional for real sync testing:
- GitLab personal access token with `read_api` scope
- A GitLab project with issues

---

## First-time setup

```bash
# 1. Clone and install
git clone <repo-url> triage-ops
cd triage-ops
npm install

# 2. Environment
cp .env.example .env
# Edit .env if your ports or credentials differ

# 3. Start infrastructure (Postgres, Redis, Ollama)
npm run docker:up

# 4. Apply database migrations
npm run db:migrate
```

Verify containers are healthy:

```bash
docker compose ps
```

Expected: `triage-ops-postgres` and `triage-ops-redis` show `(healthy)`.

---

## Local development (recommended)

Run app processes on the host for fast reload; infrastructure in Docker.

### Terminal 1 — Web

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Terminal 2 — Worker

```bash
npm run dev:worker
```

The worker connects to Redis and listens on the `gitlab-sync` queue.

### Environment (.env)

```env
DATABASE_URL=postgresql://triage_ops:triage_ops@localhost:5433/triage_ops
REDIS_URL=redis://localhost:6379
OLLAMA_HOST=http://localhost:11434
PORT=3000
NODE_ENV=development
WORKER_CONCURRENCY=2
```

> Postgres uses host port **5433** (mapped from container 5432).

---

## Full Docker deployment

Build and run all services including web and worker:

```bash
cp .env.example .env
docker compose up -d --build
npm run docker:migrate
```

| Service | URL |
|---------|-----|
| Web | [http://localhost:3000](http://localhost:3000) |
| Postgres | `localhost:5433` |
| Redis | `localhost:6379` |
| Ollama | [http://localhost:11434](http://localhost:11434) |

Stop everything:

```bash
npm run docker:down
```

Remove volumes (⚠️ deletes database data):

```bash
docker compose down -v
```

---

## Database commands

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:migrate` | Create + apply migration (development) |
| `npm run db:migrate:deploy` | Apply pending migrations (production/CI) |
| `npm run db:push -w @triage-ops/db` | Push schema without migration file (prototyping only) |
| `npm run db:studio -w @triage-ops/db` | Open Prisma Studio GUI |

---

## Testing & quality

```bash
npm test                              # All workspace tests
npm run test -w @triage-ops/worker    # Worker tests only
npm run lint                          # TypeScript + ESLint all packages
npm run build                         # Production build all packages
```

---

## Manually triggering a sync (until UI exists)

After registering a connection and project in the database (via Prisma Studio or seed script), enqueue a job using Node:

```bash
# Example — requires projectId and syncRunId from database
node --env-file=.env -e "
  import { createSyncQueue } from './apps/worker/src/queues/sync-queue.ts';
  const queue = createSyncQueue();
  await queue.add('sync', { projectId: 'YOUR_PROJECT_ID', syncRunId: 'YOUR_SYNC_RUN_ID' });
  console.log('Job enqueued');
  process.exit(0);
"
```

> A proper API route and UI button will replace this in Step 3.

---

## Troubleshooting

### Port 5432 already in use

The compose file maps Postgres to host port **5433**. Ensure `DATABASE_URL` in `.env` uses port `5433` for local dev.

### Worker exits with "Missing required environment variable"

Ensure `.env` exists at repo root and contains `REDIS_URL` and `DATABASE_URL`. The worker loads env from the shell — use `--env-file=.env` or export variables manually if needed.

### Redis connection refused

```bash
docker compose up -d redis
docker compose ps redis   # should show (healthy)
```

### Prisma migration fails

```bash
# Check Postgres is reachable
docker compose ps postgres

# Reset dev database (⚠️ destroys data)
npm run db:migrate -w @triage-ops/db -- --name init
# Or: docker compose down -v && npm run docker:up && npm run db:migrate
```

### Vitest EACCES / worker pool errors

Run tests outside restricted sandboxes:

```bash
npm run test -w @triage-ops/worker
```

---

## Service reference

| Process | Package | Port | Depends on |
|---------|---------|------|------------|
| Web dev server | `@triage-ops/web` | 3000 | Postgres (for future API routes) |
| Worker daemon | `@triage-ops/worker` | — | Postgres, Redis |
| Postgres | Docker | 5433 | — |
| Redis | Docker | 6379 | — |
| Ollama | Docker | 11434 | — (Phase 2) |
