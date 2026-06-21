# Implementation Phases

This document is the **line to follow** — each phase builds on the previous one. Check off items as they ship.

---

## Phase 0 — Foundation ✅ Complete

Scaffolding and core pipeline infrastructure.

- [x] npm workspaces monorepo (`apps/web`, `apps/worker`, `packages/db`, `packages/shared-types`, `packages/metrics`)
- [x] Root `docker-compose.yml` (Postgres, Redis, Ollama; web/worker via `production` profile)
- [x] Prisma schema + initial migration
- [x] BullMQ sync worker with GitLab client
- [x] Vitest + MSW test foundation
- [x] Production Dockerfiles (web standalone, worker esbuild bundle)

---

## Phase 1 — MVP (Core product)

**Goal:** A team can connect a GitHub or GitLab project, sync issues, and see triage metrics on a dashboard.

> **Verified:** GitHub + GitLab sync, dashboard overview, ghost/zombie/milestone decay — working end-to-end in local dev (June 2026).

### Step 3 — Web API & sync trigger ✅

- [x] Add `@triage-ops/db` dependency to `apps/web`
- [x] API route: `GET/POST /api/connections` — register VCS connection (GitHub or GitLab)
- [x] API route: `GET/POST /api/projects` — register project under a connection
- [x] API route: `POST /api/projects/[id]/sync` — create `SyncRun`, enqueue `gitlab-sync` job
- [x] API route: `GET /api/projects/[id]/sync-runs` — list sync history
- [x] Shared enqueue helper using BullMQ `Queue` from web
- [x] Vitest tests for API validation helpers
- [x] Full route-handler tests with mocked Prisma + queue

### Step 3b — GitHub integration ✅

- [x] `VcsConnection` model with `provider: GITLAB | GITHUB`
- [x] GitHub REST client (`/repos/{owner}/{repo}/issues`)
- [x] Provider routing in sync worker
- [x] `gitlabIssueId` as `BigInt` (GitHub global IDs exceed 32-bit)
- [x] UI: provider picker, `owner/repo` project registration

### Step 4 — Triage metrics engine ✅

- [x] `packages/metrics` with pure functions:
  - `countGhostIssues(issues, thresholdDays)`
  - `countZombieIssues(issues, thresholdDays)`
  - `getMilestoneDecay(milestones, issues)`
- [x] TDD: unit tests for each metric (zero matches, boundary dates, empty input)
- [x] API route: `GET /api/projects/[id]/metrics` — returns metric summary JSON
- [x] Dashboard overview counts (total/open/closed issues, milestones)

### Step 5 — Dashboard UI (Shadcn) ✅

- [x] Install and configure Shadcn UI in `apps/web`
- [x] Layout shell: sidebar navigation, project selector
- [x] Page: **Connections** — list / add GitHub or GitLab connections
- [x] Page: **Projects** — list registered projects, sync button + last sync status
- [x] Page: **Dashboard** — overview + triage metric cards + issue/milestone tables
- [x] Loading and error states for interactive forms
- [x] Configurable metric thresholds in UI (per-project settings on dashboard)

### Step 6 — Developer experience ✅

- [x] Seed script: sample connections + projects (`packages/db/src/seed.ts`)
- [x] GitLab seed script: milestones/issues for metrics + LLM test data (`npm run gitlab:seed`)
- [x] Worker sync upserts milestones from issue payload (title, due date, state)
- [x] Worker sync upserts labels
- [ ] Encrypt `accessToken` at rest (deferred to Phase 3 — documented as known MVP limitation)
- [x] Update root `README.md` to point to `docs/`
- [x] Root `.env` loading for Prisma, web, and worker dev scripts

### Step 7 — MVP hardening — partial

- [x] End-to-end smoke test script (register → sync → metrics) — `npm run test:e2e`
- [x] Docker Compose full-stack verification (`npm run docker:up:all` + migrate) — `npm run docker:verify`
- [x] Basic CI: lint + test + web build on push (GitHub Actions)
- [x] Review [MVP Definition of Done](./mvp-definition-of-done.md) — formal sign-off

### Step 8 — Authentication & access control ✅

> OAuth login via Auth.js. Disabled by default locally (`AUTH_DISABLED=true`). Required before exposing the instance beyond local dev.

- [x] User sign-in via GitHub or GitLab OAuth (configurable per deployment)
- [x] Session management (HTTP-only cookies via Auth.js + Prisma adapter)
- [x] Protect all `/api/*` routes and dashboard pages (proxy)
- [x] `userId` on `VcsConnection` with `AUTH_DATA_SCOPE=shared|per_user`
- [x] Email/domain allowlist for on-prem (`ALLOWED_EMAIL_DOMAINS`, `ALLOWED_EMAILS`)
- [x] Document auth setup in `docs/running-the-app.md`
- [x] Unit test: unauthenticated API session returns 401 when auth enabled

**Out of scope for Step 8 (Phase 3):** multi-tenant billing, enterprise SSO (direct IdP), fine-grained RBAC.

---

## Phase 2 — LLM-assisted triage ✅

**Goal:** Privacy-first local LLMs identify duplicates and draft missing descriptions.

> Ollama container starts with `npm run docker:up`. Analysis runs via dashboard **Run analysis**; suggestions are reviewed before apply.

### Step 9 — Ollama integration ✅

- [x] Ollama client wrapper with health check (`/api/tags`, `/api/chat`, `/api/embed`)
- [x] New BullMQ queue: `llm-analysis`
- [x] Job: scan open issues for likely duplicates (embedding cosine similarity ~0.82)
- [x] Job: draft description text for issues with empty `description`
- [x] Store LLM suggestions in new `IssueSuggestion` table (human review required before apply)
- [x] Dashboard panel: review / dismiss / apply suggestions

### Step 10 — Safety & isolation ✅

- [x] LLM jobs run only against local DB copies (never send raw tokens to Ollama)
- [x] Rate limiting on LLM queue concurrency (`LLM_WORKER_CONCURRENCY=1` default)
- [x] Audit fields on applied suggestions (`reviewedAt`, `appliedAt`, `LlmAnalysisRun` history)

---

## Phase 2.5 — VCS write-back ✅

**Goal:** When users **Apply** AI suggestions, push changes to GitLab/GitHub and sync local Postgres state.

### Step 11 — Async write-back worker ✅

- [x] `IssueSuggestionStatus`: `APPLYING`, `APPLY_FAILED`; `writeBackError` audit field
- [x] BullMQ queue: `vcs-writeback` (`WriteBackJobPayload`)
- [x] GitLab write client: update description, add note, close issue
- [x] GitHub write client: update body, comment, close as duplicate
- [x] Duplicate policy: lower IID canonical; comment both issues; close duplicate
- [x] Worker acquires `sync:{projectId}` lock; patches local `Issue` rows on success
- [x] Web: Apply → `APPLYING` + enqueue; PATCH returns **202**; retry from `APPLY_FAILED`
- [x] Dashboard: applying / failed / retry UX; poll until write-back completes

---

## Phase 3 — Production & growth (post-MVP)

- [ ] Multi-tenant workspace isolation (orgs, teams, shared projects)
- [ ] Scheduled auto-sync (cron jobs via BullMQ repeatable jobs)
- [ ] Webhook-triggered sync on GitHub/GitLab issue events
- [ ] Self-hosted install guide + Helm chart
- [ ] Token encryption at rest (if not done in Step 6)
- [ ] Billing / license tier (if SaaS)
- [ ] Enterprise SSO (SAML/OIDC beyond Step 8 basic auth)

---

## Suggested immediate next steps

Phase 1 MVP is complete (June 2026). Next options:

1. **Phase 3 — Production & growth** — scheduled sync, webhooks, token encryption
2. **P2 hardening** from [code review](./code-review-2026-06-21.md) — duplicate write-back edge cases, route integration depth
