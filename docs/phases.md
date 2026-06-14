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
- [ ] Full route-handler tests with mocked Prisma + queue

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
- [ ] Configurable metric thresholds in UI (API supports query params; no settings UI yet)

### Step 6 — Developer experience — mostly done

- [x] Seed script: sample connections + projects (`packages/db/prisma/seed.ts`)
- [x] Worker sync upserts milestones from issue payload (title, due date, state)
- [ ] Worker sync upserts labels
- [ ] Encrypt `accessToken` at rest (documented as known MVP limitation in UI)
- [x] Update root `README.md` to point to `docs/`
- [x] Root `.env` loading for Prisma, web, and worker dev scripts

### Step 7 — MVP hardening — partial

- [x] End-to-end smoke test script (register → sync → metrics) — `npm run test:e2e`
- [ ] Docker Compose full-stack verification (`npm run docker:up:all` + migrate)
- [x] Basic CI: lint + test + web build on push (GitHub Actions)
- [ ] Review [MVP Definition of Done](./mvp-definition-of-done.md) — formal sign-off

### Step 8 — Authentication & access control 🔒 (required before shared deployment)

> **Not started.** Currently anyone with network access to the app can manage connections, tokens, and sync jobs. This step is a **pre-production gate** — not required for local-only dev, but required before exposing the instance to a team or the internet.

- [ ] User sign-in (email/password or OAuth — GitHub/GitLab OIDC recommended for this product)
- [ ] Session management (HTTP-only cookies or JWT with secure storage)
- [ ] Protect all `/api/*` routes and dashboard pages (middleware)
- [ ] Optional: per-user or per-workspace ownership of `VcsConnection` records
- [ ] Document auth setup in `docs/running-the-app.md`
- [ ] CI smoke test for unauthenticated API access returns 401

**Out of scope for Step 8 (Phase 3):** multi-tenant billing, SSO for enterprises, fine-grained RBAC.

---

## Phase 2 — LLM-assisted triage

**Goal:** Privacy-first local LLMs identify duplicates and draft missing descriptions.

> Ollama container starts with `npm run docker:up`. Application code is not wired yet.

### Step 9 — Ollama integration

- [ ] Ollama client wrapper with health check and model pull helper
- [ ] New BullMQ queue: `llm-analysis`
- [ ] Job: scan open issues for likely duplicates (embedding or prompt-based)
- [ ] Job: draft description text for issues with empty `description`
- [ ] Store LLM suggestions in new `IssueSuggestion` table (human review required before apply)
- [ ] Dashboard panel: review / dismiss / apply suggestions

### Step 10 — Safety & isolation

- [ ] LLM jobs run only against local DB copies (never send raw tokens to Ollama)
- [ ] Rate limiting on LLM queue concurrency
- [ ] Audit log for applied suggestions

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

If you are picking up development now, start here in order:

1. **Step 8 — Authentication** — secure API and dashboard before any shared deployment
2. **Step 6 — Label sync** — upsert labels during issue sync
3. **Phase 2 — Ollama** — duplicate detection and description drafting

Each step should include tests before or alongside implementation (see [Development Guide](./development-guide.md)).
