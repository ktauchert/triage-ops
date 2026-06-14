# Current State

Last updated: June 2026 · Version: `0.1.0`

This document describes what is **implemented**, **partially implemented**, and **not yet started**.

---

## Completed

### Monorepo foundation

- npm workspaces at repo root (`apps/*`, `packages/*`)
- Root scripts for dev, build, lint, test, database, and Docker
- `.env.example` with local defaults (root `.env` loaded by web, worker, and Prisma scripts)

### Database layer (`packages/db`)

- **Prisma schema** with relational models:
  - `VcsConnection` — GitLab or GitHub credentials (`provider`, `baseUrl`, `accessToken`)
  - `Project` — registered repo/project (`externalProjectId`, `pathWithNamespace`)
  - `Issue`, `Milestone`, `Label`, `IssueLabel`, `SyncRun`
- **Migrations applied:** `init`, `vcs_provider` (GitHub + rename), `github_issue_id_bigint`
- **Prisma client singleton** with monorepo root `.env` discovery
- **Seed script** (`npm run db:seed`) for GitLab and/or GitHub sample data

### Shared types (`packages/shared-types`)

- Queue name constants (`gitlab-sync`)
- Job payload types (`SyncJobPayload`)
- GitLab and GitHub issue DTOs
- `NormalizedIssue` contract for provider-agnostic sync

### Metrics engine (`packages/metrics`)

- Pure functions: `countGhostIssues`, `countZombieIssues`, `getMilestoneDecay`
- 17 unit tests (boundaries, empty input, edge cases)

### Worker (`apps/worker`)

- **GitLab API client** — paginated issue fetch, validation, error types
- **GitHub API client** — paginated issues, PR filtering, Link-header pagination
- **VCS router** — `fetchProjectIssues()` dispatches by `VcsProvider`
- **Redis distributed locks** — per-project sync exclusion
- **BullMQ queue** — `gitlab-sync` with retry/backoff
- **Sync worker** — upserts issues, links milestones from issue payload (title, due date, state)
- **esbuild bundle** for production Docker image
- **35 unit tests** (Vitest + MSW): GitLab client, GitHub client, locks, milestone helpers, normalizers

### Web (`apps/web`)

- **Dashboard** — overview counts (issues, milestones), triage signals, issue/milestone tables
- **Connections** — add/list GitHub or GitLab connections (provider picker)
- **Projects** — register repo/project, manual sync, last run status
- **Authentication** — Auth.js OAuth (GitHub/GitLab), proxy route protection, deployment profiles
- **API routes:**
  - `GET/POST /api/connections`
  - `GET/POST /api/projects`
  - `POST /api/projects/[id]/sync`
  - `GET /api/projects/[id]/sync-runs`
  - `GET /api/projects/[id]/metrics`
- **Shadcn-style UI** — sidebar layout, cards, tables, badges
- **BullMQ enqueue** from web via Redis
- **7+ API/auth unit tests**
- Production build verified (`npm run build -w @triage-ops/web`)

### Infrastructure

- `docker-compose.yml`:
  - **postgres** (host `5433`), **redis** (`6379`), **ollama** (`11434`)
  - **web** + **worker** behind `production` profile (`npm run docker:up:all`)
  - **migrate** profile (`npm run docker:migrate`)
- `npm run docker:up` starts infra only (postgres, redis, ollama) for local dev
- GitHub Actions CI: migrate → test (incl. e2e smoke) → lint → web build

### E2E smoke test (`packages/e2e`)

- Vitest integration test: register connection/project → BullMQ sync → metrics
- GitHub API mocked via MSW (no real token required)
- Requires Postgres + Redis (`npm run docker:up`)
- Run: `npm run test:e2e` (also included in `npm test`)

---

## Partially implemented

| Item | Notes |
|------|-------|
| Label sync | Schema exists; worker does not upsert labels yet |
| Milestone sync | Upserted from issue-linked milestones only (no standalone milestones API) |
| Token security | Access tokens stored as plain strings; documented in UI as MVP limitation |
| API test coverage | Validation helpers tested; route handlers not fully mocked yet |
| Phase 1 hardening | CI + E2E smoke done; full production compose verification open |

---

## Not started

- Multi-tenant workspace isolation
- Token encryption at rest
- Phase 2 LLM jobs (duplicate detection, description drafting)
- Scheduled auto-sync, webhooks
- Helm chart / production install guide
- SaaS billing

---

## Test coverage

| Package | Framework | Tests | Scope |
|---------|-----------|-------|-------|
| `@triage-ops/worker` | Vitest + MSW | 35 | GitLab/GitHub clients, locks, milestones, normalizers |
| `@triage-ops/metrics` | Vitest | 17 | Ghost, zombie, milestone decay |
| `@triage-ops/web` | Vitest | 14+ | API validation + auth helpers |
| `@triage-ops/e2e` | Vitest | 1 | Register → sync → metrics smoke |

Run all tests:

```bash
npm test
```

---

## Key environment variables

| Variable | Required by | Default (local) |
|----------|-------------|-----------------|
| `DATABASE_URL` | db, worker, web | `postgresql://triage_ops:triage_ops@localhost:5433/triage_ops` |
| `REDIS_URL` | worker, web | `redis://localhost:6379` |
| `OLLAMA_HOST` | worker (Phase 2) | `http://localhost:11434` |
| `WORKER_CONCURRENCY` | worker | `2` |
| `AUTH_DISABLED` | web | `true` (local dev) |
| `AUTH_SECRET` | web | — (required when auth enabled) |
| `AUTH_PROVIDERS` | web | `github,gitlab` |
| `AUTH_DATA_SCOPE` | web | `shared` or `per_user` |

See [Running the App](./running-the-app.md) for full setup instructions.
