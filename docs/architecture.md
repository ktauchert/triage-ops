# Architecture

## System overview

TriageOps follows a **sync-and-analyze** pattern: a background worker pulls issue data from GitHub or GitLab into Postgres; the web app reads that local data to compute and display triage metrics without hammering the VCS API on every page load.

```mermaid
flowchart LR
  subgraph VCS
    GH[GitHub API]
    GL[GitLab API]
  end

  subgraph TriageOps
    WEB[apps/web\nNext.js]
    WORKER[apps/worker\nBullMQ daemon]
    METRICS[packages/metrics]
    REDIS[(Redis)]
    PG[(PostgreSQL)]
    OLLAMA[Ollama\nlocal LLM]
  end

  GH <-->|read + write| WORKER
  GL <-->|read + write| WORKER
  WORKER -->|upsert| PG
  WORKER <-->|jobs + locks| REDIS
  WEB -->|read| PG
  WEB -->|compute| METRICS
  WEB -->|enqueue sync, llm, write-back| REDIS
  WORKER -->|embed + chat| OLLAMA
  WORKER -->|suggestions| PG
```

> **Security:** Auth is disabled by default locally (`AUTH_DISABLED=true`). Set `AUTH_DISABLED=false` and configure OAuth before exposing the app to a network. See [Authentication](./running-the-app.md#authentication).

---

## Monorepo packages

### `apps/web` — Dashboard (Next.js)

**Role:** User-facing UI and API routes.

| Concern | Technology |
|---------|------------|
| Framework | Next.js 16 App Router |
| Styling | Tailwind CSS v4 + Shadcn UI |
| Data access | `@triage-ops/db` (Prisma) |
| Metrics | `@triage-ops/metrics` |
| Job enqueue | BullMQ `Queue` via `lib/queue.ts` |
| Deployment | Standalone Docker image on port 3000 |

**Responsibilities:**
- Display overview counts and triage metrics (ghost, zombie, milestone decay)
- Manage VCS connections (GitHub or GitLab) and registered projects
- Trigger sync jobs by enqueueing to BullMQ via Redis
- Run LLM analysis and review AI suggestions (dismiss / apply)
- Enqueue `vcs-writeback` jobs when the user applies a suggestion (async VCS update)

**Key paths:**

| Path | Purpose |
|------|---------|
| `app/(dashboard)/` | Dashboard, connections, projects pages |
| `app/api/` | REST API routes |
| `components/` | Shadcn UI components, layout shell |
| `lib/services/` | `projects.ts`, `metrics.ts` — server-side data helpers |
| `lib/queue.ts` | BullMQ enqueue helper |

---

### `apps/worker` — Background daemon

**Role:** Long-running Node process that consumes BullMQ jobs.

| Module | Path | Purpose |
|--------|------|---------|
| Entry point | `src/index.ts` | Starts BullMQ workers, handles graceful shutdown |
| GitLab client | `src/lib/gitlab/client.ts` | Paginated fetch of project issues via GitLab REST API |
| GitLab write | `src/lib/gitlab/write.ts` | Update description, add notes, close issues |
| GitHub client | `src/lib/github/client.ts` | Paginated fetch via GitHub REST API |
| GitHub write | `src/lib/github/write.ts` | Update body, add comments, close as duplicate |
| VCS router (read) | `src/lib/vcs/fetch-project-issues.ts` | Dispatches fetch by `VcsProvider` |
| VCS router (write) | `src/lib/vcs/apply-suggestion.ts` | Apply DESCRIPTION / DUPLICATE suggestions to VCS |
| Redis locks | `src/lib/lock.ts` | Distributed lock per project (`SET NX` + token-safe release) |
| Sync queue | `src/queues/sync-queue.ts` | `gitlab-sync` queue factory |
| Sync processor | `src/workers/sync-worker.ts` | Fetch → upsert issues + milestones → update `SyncRun` |
| LLM analysis queue | `src/queues/llm-analysis-queue.ts` | `llm-analysis` queue factory |
| LLM processor | `src/workers/llm-analysis-worker.ts` | Duplicate scan + description drafts → `IssueSuggestion` |
| Write-back queue | `src/queues/vcs-writeback-queue.ts` | `vcs-writeback` queue factory |
| Write-back processor | `src/workers/vcs-writeback-worker.ts` | Apply suggestion to VCS + patch local `Issue` rows |
| Auto-sync processor | `src/workers/auto-sync-worker.ts` | Repeatable tick → enqueue sync for due projects |
| Ollama client | `src/lib/ollama/client.ts` | Health check, chat, embeddings against local Ollama |
| Config | `src/config/env.ts` | Required env var validation |

**Job flow (`gitlab-sync` queue):**

1. Job received with payload `{ projectId, syncRunId }`
2. Acquire Redis lock for `sync:{projectId}` (skip if already locked)
3. Mark `SyncRun` as `RUNNING`
4. Load `Project` + `VcsConnection` from Postgres
5. Route to GitHub or GitLab client based on `connection.provider`
6. Paginate issues (100 per page)
7. Upsert each issue; upsert linked milestones (title, due date, state)
8. Mark `SyncRun` as `COMPLETED` (or `FAILED` on error)
9. Release lock

**Retry policy:** 3 attempts, exponential backoff starting at 5 s.

**Job flow (`llm-analysis` queue):**

1. Job received with payload `{ projectId, analysisRunId }`
2. Acquire Redis lock for `llm:{projectId}`
3. Mark `LlmAnalysisRun` as `RUNNING`
4. Load open issues from Postgres (no VCS API calls)
5. Embed issue text via Ollama; find duplicate pairs above similarity threshold
6. Chat-draft descriptions for issues with empty body
7. Insert `IssueSuggestion` rows (`PENDING`); update `LlmAnalysisRun` as `COMPLETED`
8. Release lock

**Retry policy (LLM):** 2 attempts, exponential backoff starting at 10 s. Default concurrency `LLM_WORKER_CONCURRENCY=1`.

**Job flow (`vcs-writeback` queue):**

1. Job received with payload `{ projectId, suggestionId }`
2. Acquire Redis lock for `sync:{projectId}` (same key as sync — excludes concurrent VCS mutation)
3. Load `IssueSuggestion` with issue, related issue, project, and connection
4. Skip if status is not `APPLYING` (idempotent)
5. Route to `applySuggestionToVcs()` by provider:
   - **DESCRIPTION** — update issue body/description on VCS
   - **DUPLICATE** — comment both issues, close the higher IID as duplicate
6. Patch local `Issue` rows (description and/or `CLOSED` state)
7. Mark suggestion `APPLIED` (or `APPLY_FAILED` + `writeBackError` on error)
8. Release lock

Triggered from web when user clicks **Apply** on a suggestion (`PATCH` → `APPLYING` + enqueue). HTTP **202** indicates async write-back.

**Retry policy (write-back):** 3 attempts, exponential backoff starting at 5 s. Default concurrency `WRITEBACK_WORKER_CONCURRENCY=2`. Lock acquisition failure marks `APPLY_FAILED` without BullMQ retry — user clicks **Retry** in the UI.

---

### `packages/db` — Data layer

**Role:** Single Postgres access point for the entire monorepo.

| Asset | Path |
|-------|------|
| Schema | `prisma/schema.prisma` |
| Migrations | `prisma/migrations/` |
| Seed | `src/seed.ts` |
| Client | `src/client.ts` (singleton, loads root `.env`) |
| Public API | `src/index.ts` |

**Design constraints enforced in schema:**

- One project per connection: `@@unique([connectionId, pathWithNamespace])`
- One issue per project IID: `@@unique([projectId, gitlabIssueIid])`
- External VCS issue ID stored as `BigInt` (`gitlabIssueId`) for GitHub global IDs
- Cascade deletes from connection → project → issues
- Indexes on `Issue.state`, `Issue.lastActivityAt` for metric queries

**Scripts:**

```bash
npm run db:generate -w @triage-ops/db   # Regenerate Prisma client
npm run db:migrate -w @triage-ops/db    # Dev migration
npm run db:migrate:deploy -w @triage-ops/db  # Production deploy
npm run db:seed -w @triage-ops/db       # Sample connections + projects
```

---

### `packages/metrics` — Triage metric engine

**Role:** Pure functions for computing triage signals from synced issue/milestone data. No I/O, no framework dependencies.

| Function | Definition |
|----------|------------|
| `countGhostIssues` | Open issues with `lastActivityAt` older than threshold (default 30 days) |
| `countZombieIssues` | Open + assigned issues stale beyond threshold (default 14 days) |
| `getMilestoneDecay` | Active milestones past `dueDate` with open issues attached |

Used by `apps/web/lib/services/metrics.ts` and exposed via `GET /api/projects/[id]/metrics`.

---

### `packages/shared-types` — Cross-package contracts

**Role:** Types and constants shared between worker and web without circular dependencies.

Exports:
- `QUEUE_NAMES.GITLAB_SYNC`, `QUEUE_NAMES.LLM_ANALYSIS`, `QUEUE_NAMES.VCS_WRITEBACK`, `QUEUE_NAMES.AUTO_SYNC`
- `SyncJobPayload`, `LlmAnalysisJobPayload`, `WriteBackJobPayload`, `AutoSyncJobPayload`
- `GitLabIssueRaw`, `GitLabIssuesPage`, `FetchGitLabIssuesParams`
- `GitHubIssueRaw`, `GitHubIssuesPage`, `FetchGitHubIssuesParams`
- `NormalizedIssue` — provider-agnostic issue shape after normalization

---

## Infrastructure services

| Service | Image | Host port | Profile | Purpose |
|---------|-------|-----------|---------|---------|
| `postgres` | `postgres:16-alpine` | **5433** | default | Primary datastore |
| `redis` | `redis:7-alpine` | 6379 | default | BullMQ job queue + distributed locks |
| `ollama` | `ollama/ollama:latest` | 11434 | default | Local LLM inference (Phase 2) |
| `web` | Built from `apps/web/Dockerfile` | 3000 | `production` | Production web server |
| `worker` | Built from `apps/worker/Dockerfile` | — | `production` | Production worker daemon |
| `migrate` | `packages/db` | — | `migrate` | One-shot migration runner |

> **Note:** Postgres is mapped to host port **5433** (not 5432) to avoid conflicts with a locally installed Postgres instance.

**Docker profiles:**
- `npm run docker:up` — infra only (postgres, redis, ollama) for local dev
- `npm run docker:up:all` — infra + web + worker (`production` profile)
- `npm run docker:migrate` — apply migrations in container

---

## Authentication

OAuth login via **Auth.js v5** with HTTP-only session cookies (Prisma adapter). Disabled by default for local dev (`AUTH_DISABLED=true`).

| Concern | Implementation |
|---------|----------------|
| Providers | GitHub and/or GitLab OAuth (`AUTH_PROVIDERS`) |
| Route protection | `proxy.ts` + `requireApiSession()` in API handlers |
| On-prem profile | `AUTH_PROVIDERS=gitlab`, `AUTH_DATA_SCOPE=shared`, email/domain allowlist |
| Hosted profile | `AUTH_PROVIDERS=github`, `AUTH_DATA_SCOPE=per_user` |
| Data ownership | `VcsConnection.userId` — filtered when `per_user`, shared when `shared` |
| Login page | `/login` with provider buttons |
| VCS sync tokens | Separate from login OAuth — users still add PATs per connection |
| RBAC / admin | Not implemented — all authenticated users share the same capabilities today ([Phase 4](./phases.md#phase-4--governance-admin--operations-planned)) |

See [Running the App](./running-the-app.md) for OAuth app setup and env vars. For production hardening and security review, see [security.md](./security.md).

---

## Testing architecture

- **Framework:** Vitest (TypeScript-native, fast)
- **HTTP mocking:** MSW (Mock Service Worker) — no real network calls in unit tests
- **Locations:**
  - `apps/worker/src/**/*.test.ts` — VCS clients, locks, sync helpers, write-back (78 tests)
  - `packages/metrics/src/**/*.test.ts` — metric functions (17 tests)
  - `apps/web/lib/**/*.test.ts` — API validation, auth helpers, suggestion services (43+ tests)
- **TDD rule:** Write test contract before implementing core utilities

See [Development Guide](./development-guide.md) for the full TDD checklist.
