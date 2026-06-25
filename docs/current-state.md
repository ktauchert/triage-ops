# Current State

Last updated: June 2026 · Version: `0.1.0`

This document describes what is **implemented**, **partially implemented**, and **not yet started**.

---

## Completed

### Monorepo foundation

- npm workspaces at repo root (`apps/*`, `packages/*`)
- Root scripts for dev, build, lint, test, database, and Docker
- `.env.example` (local dev) and `.env.production.example` (production template)
- Root `.env` loaded by web, worker, and Prisma scripts

### Database layer (`packages/db`)

- **Prisma schema** — 17 models:
  - **Auth / governance:** `User`, `Account`, `Session`, `VerificationToken`, `AppSettings`, `ProvisionedUser`, `AuditEvent`
  - **VCS / triage:** `VcsConnection`, `Project`, `Issue`, `Milestone`, `Label`, `IssueLabel`, `SyncRun`, `IssueSuggestion`, `LlmAnalysisRun`
- **Enums:** `UserRole` (`ADMIN`, `LEAD`, `OPERATOR`, `VIEWER`), `VcsProvider`, `IssueSuggestionType`, `IssueSuggestionStatus`, `IssueState`, `MilestoneState`, `SyncStatus`
- **Migrations applied (13):**
  1. `init`
  2. `vcs_provider` (GitHub + rename)
  3. `github_issue_id_bigint`
  4. `auth_users`
  5. `favorites_and_crud`
  6. `project_thresholds`
  7. `llm_suggestions`
  8. `llm_analysis_progress`
  9. `suggestion_writeback`
  10. `phase3_auto_sync`
  11. `phase4_rbac_audit`
  12. `instance_bootstrap`
  13. `user_deactivated`
- **Prisma client singleton** with monorepo root `.env` discovery
- **PAT encryption** — `sealAccessToken` / `openAccessToken` (AES-256-GCM when `TOKEN_ENCRYPTION_KEY` set)
- **Seed script** (`npm run db:seed`) for GitLab and/or GitHub sample data

### Shared types (`packages/shared-types`)

- Queue name constants (`gitlab-sync`, `llm-analysis`, `vcs-writeback`, `auto-sync`)
- Job payload types (`SyncJobPayload`, `LlmAnalysisJobPayload`, `WriteBackJobPayload`, `AutoSyncJobPayload`)
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
- **Redis distributed locks** — per-project sync and LLM exclusion; startup recovery for interrupted runs
- **BullMQ queues** — `gitlab-sync`, `llm-analysis`, `vcs-writeback`, `auto-sync` with retry/backoff
- **Sync worker** — upserts issues, milestones, and labels from issue payload
- **LLM worker** — reads Postgres only; writes `IssueSuggestion` + `LlmAnalysisRun`
- **Write-back worker** — applies suggestions to VCS; patches local `Issue` rows; `APPLYING` / `APPLY_FAILED` statuses
- **Auto-sync worker** — repeatable tick when `AUTO_SYNC_SCHEDULER_ENABLED=true`
- **esbuild bundle** for production Docker image
- **100+ unit tests** (Vitest + MSW): VCS clients, Ollama, LLM logic, locks, milestones, labels, normalizers, write-back

### Web (`apps/web`)

- **Dashboard** — role-aware home (`/`) + per-project triage at `/project/[id]`; see [dashboard-restructure.md](./dashboard-restructure.md)
- **Connections** — add/list/edit/delete GitHub or GitLab connections (ADMIN only)
- **Projects** — register repo/project, manual sync, auto-sync toggle, favorites, thresholds
- **Authentication** — Auth.js OAuth (GitHub/GitLab), proxy route protection, deployment profiles
- **Instance bootstrap** — `/setup` on fresh DB; first OAuth login → `ADMIN`; closed registration after setup
- **RBAC** — `UserRole` permission matrix enforced on API routes; role-aware sidebar
- **Admin console** (`/admin`, ADMIN only):
  - Overview — user counts, pending invites, auth status, connections metadata
  - `/admin/users` — invite, role change, deactivate, delete
  - `/admin/audit` — audit event log
  - `/admin/jobs` — recent sync / LLM / write-back runs and failures
- **API routes:**
  - `GET/POST /api/auth/[...nextauth]`
  - `GET/POST /api/connections`
  - `PATCH/DELETE /api/connections/[id]`
  - `GET /api/connections/[id]/remote-projects`
  - `GET/POST /api/projects`
  - `PATCH/DELETE /api/projects/[id]`
  - `POST /api/projects/[id]/sync`
  - `GET /api/projects/[id]/sync-runs`
  - `GET /api/projects/[id]/metrics`
  - `GET/POST/DELETE /api/projects/[id]/analyze`
  - `GET /api/projects/[id]/suggestions`
  - `PATCH /api/projects/[id]/suggestions/[suggestionId]` — dismiss (200) or apply (202 + async write-back)
  - `GET/POST /api/admin/users`
  - `PATCH/DELETE /api/admin/users/[userId]`
  - `DELETE /api/admin/invites/[inviteId]`
  - `GET /api/admin/audit-events`
- **Shadcn-style UI** — sidebar layout, cards, tables, badges, command palette (⌘K)
- **BullMQ enqueue** from web via Redis
- **API rate limiting** — Redis-backed middleware on `/api/*` (`RATE_LIMIT_*` env vars)
- **190+ unit tests** across `lib/` and route handlers (`app/api/**/*.test.ts`)
- Production build verified (`npm run build -w @triage-ops/web`)

### Infrastructure

- `docker-compose.yml`:
  - **postgres** (host `5433`), **redis** (`6379`), **ollama** (`11434`)
  - **web** + **worker** behind `production` profile (`npm run docker:up:all`)
  - **migrate** profile (`npm run docker:migrate`)
- `docker-compose.prod.yml` — pre-built GHCR images, no `build:` (customer install)
- `npm run docker:up` starts infra only (postgres, redis, ollama) for local dev
- GitHub Actions CI: migrate → test (incl. e2e smoke) → lint → web build
- Release workflow: tag `v*` → push images + install bundle ZIP

### E2E smoke test (`packages/e2e`)

- Vitest integration test: register connection/project → BullMQ sync → metrics
- GitHub API mocked via MSW (no real token required)
- Requires Postgres + Redis (`npm run docker:up`)
- Uses **Redis DB 15** automatically so a running `dev:worker` (DB 0) does not steal sync jobs
- Run: `npm run test:e2e` (also included in `npm test`)
- If full `npm test` fails only on smoke: re-run `npm run test:e2e` — see [running-the-app.md § E2E smoke 401](./running-the-app.md#e2e-smoke-github-api-request-failed-with-status-401)

### Phase 2 — LLM-assisted triage ✅

- Ollama client (`healthCheck`, `chat`, `embed`) with env config
- `IssueSuggestion` + `LlmAnalysisRun` Prisma models
- `llm-analysis` BullMQ worker (Postgres-only reads, Redis lock per project)
- Dashboard: run analysis, clear analysis, review/dismiss/apply suggestions with VCS write-back on apply
- Unit tests for Ollama client, duplicate detection, description drafting, worker processor

### Phase 3a — Security & ops minimum ✅

- PAT encryption (`sealAccessToken` / `openAccessToken`, `TOKEN_ENCRYPTION_KEY`)
- API rate limiting (`RATE_LIMIT_*` env vars, Redis-backed)
- Production startup guards (`instrumentation.ts`): auth, encryption, allowlist
- Documented in [security.md](./security.md)

### Phase 3b — Sync automation (partial) ✅ auto-sync

- Per-project `autoSyncEnabled` + `autoSyncIntervalMinutes` on `Project`
- BullMQ `auto-sync` repeatable scheduler (`AUTO_SYNC_SCHEDULER_ENABLED`, `AUTO_SYNC_TICK_MINUTES`)
- Toggle on Projects page

### Phase 3c — Product distribution ✅

- `docker-compose.prod.yml` at repo root
- CI: build + push `web` + `worker` images to GHCR on semver tag
- `install/` template + GitHub Release install bundle
- Customer docs: [install/install.md](../install/install.md)
- Dry-run procedure documented; execute on clean VM before first external customer

### Phase 4 — Governance (partial) ✅ Steps 12–14

- **RBAC** — four roles, permission matrix, API enforcement
- **Bootstrap** — `/setup`, `AppSettings.setupComplete`, closed registration via `ProvisionedUser`
- **Admin UI** — users, audit, jobs, auth status, connections overview
- **Audit log** — `AuditEvent` model; logs apply/dismiss, sync, analyze, CRUD, role changes, invites
- **Not started:** change log (Step 15), impact reporting (Step 16), write-back rollback (Step 17), `ProjectMembership`

---

## Partially implemented

| Item | Notes |
|------|-------|
| Milestone sync | Upserted from issue-linked milestones only (no standalone milestones API) |
| Token security | Optional AES-256-GCM via `TOKEN_ENCRYPTION_KEY`; legacy plain tokens still readable |
| Phase 3b webhooks | Not started — auto-sync + manual sync available |
| Phase 3c scale | Helm, multi-tenant, billing not started |
| Phase 4 depth | Change log, metric snapshots, rollback not started |
| Product validation | Clean-VM install dry-run pending ops sign-off |

---

## Not started

### Phase 4 — remaining (Steps 15–17)

- Unified **change log** of applied suggestions + CSV export
- **Impact reporting** — metric snapshots, campaign timeline, delta vs baseline
- **Write-back rollback** — store previous state, revert description on VCS, partial duplicate reopen

### Phase 3c — optional scale

- Helm chart (Kubernetes)
- Multi-tenant orgs/teams
- Billing / license tier gating — see [editions.md](./editions.md)
- Direct enterprise SSO (SAML/OIDC to IdP)

See [Implementation Phases](./phases.md#phase-4--governance-admin--operations-in-progress) for the full checklist.

---

## Test coverage

| Package | Framework | Test files | Approx. cases | Scope |
|---------|-----------|------------|---------------|-------|
| `@triage-ops/worker` | Vitest + MSW | 22 | 100+ | VCS clients, Ollama, LLM logic, locks, write-back |
| `@triage-ops/metrics` | Vitest | 3 | 17 | Ghost, zombie, milestone decay |
| `@triage-ops/db` | Vitest | 1 | 7 | PAT encryption |
| `@triage-ops/web` | Vitest | 36 | 190+ | API routes, auth, RBAC matrix, services, rate limits |
| `@triage-ops/e2e` | Vitest | 2 | 3 | Register → sync → metrics smoke; navigation |
| **Total** | | **64** | **~320+** | (+ ~44 parameterized RBAC matrix cases at runtime) |

Run all tests:

```bash
npm test
```

---

## Key environment variables

| Variable | Required by | Default (local) | Meaning |
|----------|-------------|-----------------|---------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | docker-compose | `triage_ops` | Postgres credentials (Compose substitution) |
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
| `PORT` | web | `3000` | HTTP listen port |
| `AUTH_DISABLED` | web | `true` (local dev) | Skip OAuth (dev only) |
| `AUTH_SECRET` | web | — | Session JWT signing secret |
| `AUTH_URL` | web | `http://localhost:3000` | Public base URL (OAuth callbacks) |
| `AUTH_PROVIDERS` | web | `github,gitlab` | OAuth providers |
| `AUTH_DATA_SCOPE` | web | `shared` or `per_user` | Connection visibility model |
| `ALLOWED_EMAIL_DOMAINS` | web | — | Comma-separated allowed email domains |
| `ALLOWED_EMAILS` | web | — | Comma-separated allowed emails |
| `ADMIN_EMAILS` | web | — | Optional: promote matching emails to ADMIN on sign-in |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | web | — | GitHub OAuth app credentials |
| `AUTH_GITLAB_ID` / `AUTH_GITLAB_SECRET` / `AUTH_GITLAB_ISSUER` | web | issuer `https://gitlab.com` | GitLab OAuth app credentials |
| `ALLOW_AUTH_DISABLED` | web | — | CI-only: allow `AUTH_DISABLED` in production |
| `REDIS_PASSWORD` | prod compose | — | Required in `docker-compose.prod.yml` |
| `TRIAGE_OPS_VERSION` / `TRIAGE_OPS_REGISTRY` | prod compose | — | Image tag and registry override |

Production template: `.env.production.example`. Rate limit details: [Security § Environment variables](./security.md#environment-variables).

See [Running the App](./running-the-app.md) for full setup instructions.
