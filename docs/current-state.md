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
- **BullMQ queues** — `gitlab-sync`, `llm-analysis`, and `vcs-writeback` with retry/backoff
- **Sync worker** — upserts issues, milestones, and labels from issue payload
- **LLM worker** — reads Postgres only; writes `IssueSuggestion` + `LlmAnalysisRun`
- **Write-back worker** — applies suggestions to VCS; patches local `Issue` rows; `APPLYING` / `APPLY_FAILED` statuses
- **esbuild bundle** for production Docker image
- **50+ unit tests** (Vitest + MSW): VCS clients, Ollama, LLM logic, locks, milestones, labels, normalizers

### Web (`apps/web`)

- **Dashboard** — overview counts, triage signals, per-project threshold settings, issue labels, milestone tables, **AI suggestions panel**
- **Connections** — add/list GitHub or GitLab connections (provider picker)
- **Projects** — register repo/project, manual sync, last run status
- **Authentication** — Auth.js OAuth (GitHub/GitLab), proxy route protection, deployment profiles
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
- Run: `npm run test:e2e` (also included in `npm test`)

---

## Partially implemented

| Item | Notes |
|------|-------|
| Milestone sync | Upserted from issue-linked milestones only (no standalone milestones API) |
| Token security | Access tokens stored as plain strings; deferred to Phase 3 (documented in UI) |
| Phase 3 infrastructure | Auto-sync, webhooks, token encryption, Helm — [phases](./phases.md) |
| Phase 4 governance | RBAC, admin UI, audit, reporting, rollback — [phases](./phases.md) |

---

### Phase 2 — LLM-assisted triage ✅

- Ollama client (`healthCheck`, `chat`, `embed`) with env config
- `IssueSuggestion` + `LlmAnalysisRun` Prisma models
- `llm-analysis` BullMQ worker (Postgres-only reads, Redis lock per project)
- Dashboard: run analysis, review/dismiss/apply suggestions with VCS write-back on apply
- Unit tests for Ollama client, duplicate detection, description drafting, worker processor

---

## Not started

### Phase 3 — Production infrastructure

- Token encryption at rest
- Scheduled auto-sync, webhooks
- Helm chart / production install guide
- Enterprise SSO (direct IdP), API rate limiting
- Multi-tenant orgs (optional; overlaps Phase 4 project membership)
- SaaS billing

### Phase 4 — Governance, admin & operations

- Role-based access control (admin, lead, operator, viewer)
- Admin dashboard (users, projects, auth, jobs)
- Per-action audit log and `appliedBy` on suggestions
- Change log of affected VCS issues + export
- Impact timeline (metric snapshots, campaign reporting)
- Rollback / revert for applied write-back (description first, duplicate partial)

See [Implementation Phases](./phases.md#phase-4--governance-admin--operations-planned) for the full checklist.

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

| Variable | Required by | Default (local) |
|----------|-------------|-----------------|
| `DATABASE_URL` | db, worker, web | `postgresql://triage_ops:triage_ops@localhost:5433/triage_ops` |
| `REDIS_URL` | worker, web | `redis://localhost:6379` |
| `OLLAMA_HOST` | worker | `http://localhost:11434` |
| `OLLAMA_CHAT_MODEL` | worker | `llama3.2:3b` |
| `OLLAMA_EMBED_MODEL` | worker | `nomic-embed-text` |
| `WORKER_CONCURRENCY` | worker | `2` |
| `LLM_WORKER_CONCURRENCY` | worker | `1` |
| `WRITEBACK_WORKER_CONCURRENCY` | worker | `2` |
| `AUTH_DISABLED` | web | `true` (local dev) |
| `AUTH_SECRET` | web | — (required when auth enabled) |
| `AUTH_PROVIDERS` | web | `github,gitlab` |
| `AUTH_DATA_SCOPE` | web | `shared` or `per_user` |

See [Running the App](./running-the-app.md) for full setup instructions.
