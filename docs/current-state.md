# Current State

Last updated: June 2026 · Version: `0.1.0`

This document describes what is **implemented**, **partially implemented**, and **not yet started**.

---

## Completed (Step 1 & Step 2)

### Monorepo foundation

- npm workspaces at repo root (`apps/*`, `packages/*`)
- Root scripts for dev, build, lint, test, database, and Docker
- `.env.example` with local defaults

### Database layer (`packages/db`)

- **Prisma schema** with relational models:
  - `GitLabConnection` — GitLab instance URL + access token
  - `Project` — registered GitLab project per connection
  - `Issue` — synced issue metadata (title, state, assignee, dates, etc.)
  - `Milestone`, `Label`, `IssueLabel` — supporting triage metrics
  - `SyncRun` — audit trail for background sync jobs
- **Initial migration** applied: `20260613044427_init`
- **Prisma client singleton** exported from `@triage-ops/db`

### Shared types (`packages/shared-types`)

- Queue name constants (`gitlab-sync`)
- Job payload types (`SyncJobPayload`)
- GitLab API response DTOs (`GitLabIssueRaw`, `FetchGitLabIssuesParams`)

### Worker (`apps/worker`)

- **GitLab API client** — paginated issue fetch with input validation and error types
- **Redis distributed locks** — prevents concurrent syncs for the same project
- **BullMQ queue** — `gitlab-sync` with retry/backoff
- **Sync worker** — fetches all issue pages from GitLab and upserts into Postgres; updates `SyncRun` status
- **esbuild bundle** for production Docker image
- **15 unit tests** (Vitest + MSW) covering GitLab client and lock behaviour

### Web (`apps/web`)

- Next.js 16 App Router starter (default create-next-app page)
- `output: "standalone"` configured for Docker production builds
- No dashboard, API routes, or Shadcn UI yet

### Infrastructure

- `docker-compose.yml` with:
  - **postgres** (host port `5433` → container `5432`)
  - **redis** (port `6379`)
  - **ollama** (port `11434`, Phase 2 placeholder)
  - **web** and **worker** production images
  - **migrate** profile for `prisma migrate deploy`
- Multi-stage Dockerfiles for web and worker

---

## Partially implemented

| Item | Notes |
|------|-------|
| Milestone / label sync | Schema exists; worker only upserts issues today |
| Ollama integration | Container runs; no application code uses it yet |
| Web ↔ worker integration | No API to register connections or enqueue sync jobs |
| Token encryption | Access tokens stored as plain strings in DB (MVP risk) |

---

## Not started

- Dashboard UI (ghost / zombie / milestone decay metrics)
- Shadcn UI component library setup
- API routes for connection/project CRUD and sync triggers
- Seed script for local development data
- Authentication / multi-tenant isolation
- Phase 2 LLM jobs (duplicate detection, description drafting)
- CI pipeline (GitHub Actions / GitLab CI)
- Production secrets management

---

## Test coverage

| Package | Framework | Tests | Scope |
|---------|-----------|-------|-------|
| `@triage-ops/worker` | Vitest + MSW | 15 | GitLab client, Redis locks |
| `@triage-ops/db` | — | 0 | — |
| `@triage-ops/web` | — | 0 | — |

Run all tests:

```bash
npm test
```

---

## Key environment variables

| Variable | Required by | Default (local) |
|----------|-------------|-----------------|
| `DATABASE_URL` | db, worker, web | `postgresql://triage_ops:triage_ops@localhost:5433/triage_ops` |
| `REDIS_URL` | worker | `redis://localhost:6379` |
| `OLLAMA_HOST` | worker (Phase 2) | `http://localhost:11434` |
| `WORKER_CONCURRENCY` | worker | `2` |

See [Running the App](./running-the-app.md) for full setup instructions.
