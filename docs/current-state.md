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
  - `Issue`, `Milestone`, `Label`, `IssueLabel`, `SyncRun`, `IssueSuggestion`, `LlmAnalysisRun`
- **Migrations applied:** `init`, `vcs_provider` (GitHub + rename), `github_issue_id_bigint`
- **Prisma client singleton** with monorepo root `.env` discovery
- **Seed script** (`npm run db:seed`) for GitLab and/or GitHub sample data

### Shared types (`packages/shared-types`)

- Queue name constants (`gitlab-sync`, `llm-analysis`, `vcs-writeback`)
- Job payload types (`SyncJobPayload`, `LlmAnalysisJobPayload`, `WriteBackJobPayload`)
- GitLab and GitHub issue DTOs
- `NormalizedIssue` contract for provider-agnostic sync

### Metrics engine (`packages/metrics`)

- Pure functions: `countGhostIssues`, `countZombieIssues`, `getMilestoneDecay`
- 17 unit tests (boundaries, empty input, edge cases)

### Worker (`apps/worker`)

- **GitLab API client** — paginated issue fetch, validation, error types; **write** (description, notes, close)
- **GitHub API client** — paginated issues, PR filtering, Link-header pagination; **write** (body, comments, close)
- **VCS router** — `fetchProjectIssues()` dispatches by `VcsProvider`
- **Ollama client** — health check, chat, embeddings (MSW-tested)
- **LLM analysis** — duplicate detection (cosine similarity), description drafting
- **Redis distributed locks** — per-project sync and LLM exclusion
- **BullMQ queues** — `gitlab-sync`, `llm-analysis`, `vcs-writeback`, `auto-sync` with retry/backoff
- **Sync worker** — upserts issues, milestones, and labels from issue payload
- **LLM worker** — reads Postgres only; writes `IssueSuggestion` + `LlmAnalysisRun`
- **Write-back worker** — applies suggestions to VCS; patches local `Issue` rows; `APPLYING` / `APPLY_FAILED` statuses
- **esbuild bundle** for production Docker image
- **50+ unit tests** (Vitest + MSW): VCS clients, Ollama, LLM logic, locks, milestones, labels, normalizers

### Web (`apps/web`)

- **Dashboard** — home (starred projects) + per-project triage at `/project/[id]`; see [dashboard-restructure.md](./dashboard-restructure.md)
- **Connections** — add/list GitHub or GitLab connections (provider picker)
- **Projects** — register repo/project, manual sync, last run status
- **Authentication** — Auth.js OAuth (GitHub/GitLab), proxy route protection, deployment profiles
- **RBAC (partial)** — `UserRole`, permission matrix, API enforcement, `/admin` overview + users + audit + **jobs**
- **API routes:**
  - `GET/POST /api/connections`
  - `GET/POST /api/projects`
  - `POST /api/projects/[id]/sync`
  - `GET /api/projects/[id]/sync-runs`
  - `GET /api/projects/[id]/metrics`
  - `POST /api/projects/[id]/analyze`
  - `GET /api/projects/[id]/suggestions`
  - `PATCH /api/projects/[id]/suggestions/[suggestionId]` — dismiss (200) or apply (202 + async write-back)
- **Shadcn-style UI** — sidebar layout, cards, tables, badges
- **BullMQ enqueue** from web via Redis
- **7+ API/auth unit tests**; **51 route-handler tests** across 11 API routes (`app/api/**/*.test.ts`)
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
- Uses **Redis DB 15** automatically so a running `dev:worker` (DB 0) does not steal sync jobs
- Run: `npm run test:e2e` (also included in `npm test`)
- If full `npm test` fails only on smoke: re-run `npm run test:e2e` — see [running-the-app.md § E2E smoke 401](./running-the-app.md#e2e-smoke-github-api-request-failed-with-status-401)

---

## Partially implemented

| Item | Notes |
|------|-------|
| Milestone sync | Upserted from issue-linked milestones only (no standalone milestones API) |
| Token security | Optional AES-256-GCM via `TOKEN_ENCRYPTION_KEY` (Phase 3a); legacy plain tokens supported |
| API rate limiting | Redis-backed; env-configurable tiers (`RATE_LIMIT_*`); enabled by default in production |
| Auto-sync | Per-project toggle; worker `auto-sync` queue when `AUTO_SYNC_SCHEDULER_ENABLED=true` |
| Phase 3b | Webhooks not started |
| Phase 3c | Helm, multi-tenant, billing not started |
| Phase 4 governance | RBAC, admin UI, audit **largely done** — `/admin/jobs`, invite UX; change log / rollback open (WS5) |
| Product distribution | Image-based install, `compose.prod.yml`, private registry — [production-readiness.md](./production-readiness.md) |

---

### Phase 2 — LLM-assisted triage ✅

- Ollama client (`healthCheck`, `chat`, `embed`) with env config
- `IssueSuggestion` + `LlmAnalysisRun` Prisma models
- `llm-analysis` BullMQ worker (Postgres-only reads, Redis lock per project)
- Dashboard: run analysis, review/dismiss/apply suggestions with VCS write-back on apply
- Unit tests for Ollama client, duplicate detection, description drafting, worker processor

---

### Phase 3 — Production infrastructure (partial)

- **3a:** PAT encryption (`sealAccessToken` / `openAccessToken`, `TOKEN_ENCRYPTION_KEY`); API rate limiting (`RATE_LIMIT_*` env vars, Redis-backed)
- **3b:** Per-project auto-sync + BullMQ scheduler (`AUTO_SYNC_SCHEDULER_ENABLED`)
- **Open:** webhooks, rate limiting, Helm, multi-tenant — see [phases.md](./phases.md)

---

## Not started

### Phase 4 — remaining

- Instance bootstrap (`/setup`, first admin, closed registration) — **shipped** [on-prem-product.md](./on-prem-product.md)
- Admin: invite user — **shipped**; auth status dashboard, job overview — **shipped**
- Change log of affected VCS issues + export
- Impact timeline (metric snapshots, campaign reporting)
- Rollback / revert for applied write-back (description first, duplicate partial)

### Phase 3c — product distribution

- `docker-compose.prod.yml`, CI image push to GHCR, install bundle — **shipped** [on-prem-product.md](./on-prem-product.md) · [install/install.md](../install/install.md)
- Dry-run from bundle on clean VM — pending ops validation

See [Implementation Phases](./phases.md#phase-4--governance-admin--operations-in-progress) for the full checklist.

---

## Test coverage

| Package | Framework | Tests | Scope |
|---------|-----------|-------|-------|
| `@triage-ops/worker` | Vitest + MSW | 50+ | VCS clients, Ollama, LLM logic, locks, milestones, normalizers |
| `@triage-ops/metrics` | Vitest | 17 | Ghost, zombie, milestone decay |
| `@triage-ops/web` | Vitest | 92+ | API validation, auth helpers, route handlers, suggestion services |
| `@triage-ops/e2e` | Vitest | 1 | Register → sync → metrics smoke |

Run all tests:

```bash
npm test
```

---

## Key environment variables

| Variable | Required by | Default (local) | Meaning |
|----------|-------------|-----------------|---------|
| `DATABASE_URL` | db, worker, web | `postgresql://triage_ops:triage_ops@localhost:5433/triage_ops` | Postgres connection string |
| `REDIS_URL` | worker, web | `redis://localhost:6379` | Redis for BullMQ and API rate limits |
| `OLLAMA_HOST` | worker | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_CHAT_MODEL` | worker | `llama3.2:3b` | Chat model for description drafts |
| `OLLAMA_EMBED_MODEL` | worker | `nomic-embed-text` | Embedding model for duplicate detection |
| `WORKER_CONCURRENCY` | worker | `2` | Parallel sync jobs |
| `LLM_WORKER_CONCURRENCY` | worker | `1` | Parallel LLM analysis jobs |
| `WRITEBACK_WORKER_CONCURRENCY` | worker | `2` | Parallel write-back jobs |
| `TOKEN_ENCRYPTION_KEY` | web, worker | — | Encrypt VCS PATs at rest (AES-256-GCM) |
| `RATE_LIMIT_ENABLED` | web | off in dev / on in prod | Master switch for HTTP rate limiting |
| `RATE_LIMIT_WINDOW_SECONDS` | web | `60` | Counting window length (seconds) |
| `RATE_LIMIT_MAX_REQUESTS` | web | `120` | Max authenticated API requests per user per window |
| `RATE_LIMIT_SYNC_MAX` | web | `10` | Max `POST …/sync` per user per window |
| `RATE_LIMIT_ANALYZE_MAX` | web | `5` | Max `POST …/analyze` per user per window |
| `RATE_LIMIT_APPLY_MAX` | web | `20` | Max suggestion PATCH per user per window |
| `RATE_LIMIT_ADMIN_MAX` | web | `30` | Max `/api/admin/*` per user per window |
| `RATE_LIMIT_AUTH_MAX` | web | `20` | Max `/api/auth/*` per client IP per window |
| `RATE_LIMIT_TRUST_PROXY` | web | `true` | Use proxy headers for client IP |
| `AUTO_SYNC_SCHEDULER_ENABLED` | worker | `false` | BullMQ auto-sync scheduler |
| `AUTO_SYNC_TICK_MINUTES` | worker | `15` | Scheduler tick interval |
| `AUTH_DISABLED` | web | `true` (local dev) | Skip OAuth (dev only) |
| `AUTH_SECRET` | web | — | Session JWT signing secret |
| `AUTH_PROVIDERS` | web | `github,gitlab` | OAuth providers |
| `AUTH_DATA_SCOPE` | web | `shared` or `per_user` | Connection visibility model |

Rate limit details: [Security § Environment variables](./security.md#environment-variables).

See [Running the App](./running-the-app.md) for full setup instructions.
