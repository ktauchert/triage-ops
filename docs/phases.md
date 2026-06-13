# Implementation Phases

This document is the **line to follow** — each phase builds on the previous one. Check off items as they ship.

---

## Phase 0 — Foundation ✅ Complete

Scaffolding and core pipeline infrastructure.

- [x] npm workspaces monorepo (`apps/web`, `apps/worker`, `packages/db`, `packages/shared-types`)
- [x] Root `docker-compose.yml` (Postgres, Redis, Ollama, web, worker)
- [x] Prisma schema + initial migration
- [x] BullMQ sync worker with GitLab client
- [x] Vitest + MSW test foundation
- [x] Production Dockerfiles (web standalone, worker esbuild bundle)

---

## Phase 1 — MVP (Core product)

**Goal:** A team can connect a GitLab project, sync issues, and see triage metrics on a dashboard.

### Step 3 — Web API & sync trigger

- [ ] Add `@triage-ops/db` dependency to `apps/web`
- [ ] API route: `POST /api/connections` — register GitLab connection (name, baseUrl, token)
- [ ] API route: `POST /api/projects` — register project under a connection
- [ ] API route: `POST /api/projects/[id]/sync` — create `SyncRun`, enqueue `gitlab-sync` job
- [ ] API route: `GET /api/projects/[id]/sync-runs` — list sync history
- [ ] Shared enqueue helper using BullMQ `Queue` from web (or thin API → Redis)
- [ ] Vitest tests for API route handlers (mocked Prisma + queue)

### Step 4 — Triage metrics engine

- [ ] Create `packages/metrics` (or `apps/web/lib/metrics/`) with pure functions:
  - `countGhostIssues(issues, thresholdDays)`
  - `countZombieIssues(issues, thresholdDays)`
  - `getMilestoneDecay(milestones, issues)`
- [ ] TDD: unit tests for each metric with fixture data (zero matches, boundary dates, empty input)
- [ ] API route: `GET /api/projects/[id]/metrics` — returns metric summary JSON

### Step 5 — Dashboard UI (Shadcn)

- [ ] Install and configure Shadcn UI in `apps/web`
- [ ] Layout shell: sidebar navigation, project selector
- [ ] Page: **Connections** — list / add GitLab connections
- [ ] Page: **Projects** — list registered projects, sync button + last sync status
- [ ] Page: **Dashboard** — metric cards (ghost, zombie, milestone decay) + issue tables
- [ ] Loading and error states for all data fetches

### Step 6 — Developer experience

- [ ] Seed script: sample connection + project for local dev (`packages/db/prisma/seed.ts`)
- [ ] Expand worker sync to upsert milestones and labels
- [ ] Encrypt `accessToken` at rest (or document as known MVP limitation)
- [ ] Update root `README.md` to point to `docs/`

### Step 7 — MVP hardening

- [ ] End-to-end smoke test script (register → sync → metrics)
- [ ] Docker Compose full-stack verification (`web` + `worker` + `migrate`)
- [ ] Basic CI: lint + test on push
- [ ] Review [MVP Definition of Done](./mvp-definition-of-done.md) — all boxes checked

---

## Phase 2 — LLM-assisted triage

**Goal:** Privacy-first local LLMs identify duplicates and draft missing descriptions.

> Ollama container is already in `docker-compose.yml`. Application code is not wired yet.

### Step 8 — Ollama integration

- [ ] Ollama client wrapper with health check and model pull helper
- [ ] New BullMQ queue: `llm-analysis`
- [ ] Job: scan open issues for likely duplicates (embedding or prompt-based)
- [ ] Job: draft description text for issues with empty `description`
- [ ] Store LLM suggestions in new `IssueSuggestion` table (human review required before apply)
- [ ] Dashboard panel: review / dismiss / apply suggestions

### Step 9 — Safety & isolation

- [ ] LLM jobs run only against local DB copies (never send raw tokens to Ollama)
- [ ] Rate limiting on LLM queue concurrency
- [ ] Audit log for applied suggestions

---

## Phase 3 — Production & growth (post-MVP)

- [ ] Authentication (OAuth / SSO)
- [ ] Multi-tenant workspace isolation
- [ ] Scheduled auto-sync (cron jobs via BullMQ repeatable jobs)
- [ ] Webhook-triggered sync on GitLab issue events
- [ ] Self-hosted install guide + Helm chart
- [ ] Billing / license tier (if SaaS)

---

## Suggested immediate next steps

If you are picking up development now, start here in order:

1. **Seed script + manual sync test** — verify the worker pipeline end-to-end with real GitLab credentials
2. **API routes for connections/projects/sync** — wire web to worker via BullMQ
3. **Metrics engine with TDD** — pure functions + tests before UI
4. **Shadcn dashboard shell** — metric cards consuming the metrics API

Each step should include tests before or alongside implementation (see [Development Guide](./development-guide.md)).
