# MVP Definition of Done

Phase 1 MVP is **done** when a developer can connect a GitHub or GitLab project, run a sync, and view meaningful triage metrics on a dashboard — self-hosted via Docker or running locally — without manual database intervention.

Use this checklist before calling MVP **functionally complete**. A separate **production-ready** sign-off additionally requires [Step 8 — Authentication](./phases.md) before the app is exposed beyond local dev.

---

## Functional requirements

### VCS integration (GitHub + GitLab)

- [x] User can register a connection (GitHub token, or GitLab instance URL + token)
- [x] User can register one or more projects/repos under a connection
- [x] User can trigger a manual sync for a project from the UI
- [x] Sync progress/status is visible (pending → running → completed/failed)
- [x] Synced issues appear in Postgres with correct title, state, assignee, and dates
- [x] Synced labels appear in Postgres (upserted during issue sync)

### Triage metrics

- [x] Dashboard displays **Stale ticket** count (default 30-day inactivity threshold)
- [x] Dashboard displays **Stuck ticket** count (open + assigned + stale, default 14 days)
- [x] Dashboard displays **Milestone decay** — active milestones past due date with open issues
- [x] Dashboard displays **Overview** counts (total/open/closed issues, milestones)
- [x] Each triage metric links to a filterable issue list on the dashboard
- [x] Metrics reflect last successful sync timestamp
- [x] Metric thresholds configurable via UI (per-project stale/stuck days on dashboard)

### User interface

- [x] Shadcn UI component library integrated
- [x] Responsive layout usable on desktop (mobile nice-to-have)
- [x] Clear error messages for failed syncs and invalid input
- [x] Empty states when no connections/projects/issues exist

---

## Technical requirements

### Data layer

- [x] All Prisma migrations apply cleanly via `npm run db:migrate:deploy`
- [x] Unique constraints prevent duplicate project/issue rows on re-sync
- [x] `SyncRun` records capture status, timestamps, issue count, and error messages
- [x] GitHub global issue IDs stored as `BigInt`

### Worker

- [x] Sync jobs process without crashing on empty projects (zero issues)
- [x] Concurrent sync requests for the same project are rejected (Redis lock)
- [x] Failed API calls mark `SyncRun` as `FAILED` with readable error
- [x] Worker restarts gracefully (`SIGTERM` / `SIGINT` handled)
- [x] GitHub and GitLab providers supported via shared sync pipeline

### Web

- [x] Next.js production build succeeds (`npm run build -w @gridnull/web`)
- [x] API routes validate input and return appropriate HTTP status codes (400, 404, 500)
- [x] Connection tokens not returned in GET API responses
- [x] API routes return 401 when unauthenticated (when `AUTH_DISABLED=false`)

### Testing

- [x] `npm test` passes in CI
- [x] GitLab client tests cover: success, pagination, empty results, 401, 500, validation
- [x] GitHub client tests cover: success, pagination, empty results, 401, 500, validation
- [x] Metrics engine tests cover: zero matches, boundary dates, malformed input
- [x] No unit test makes real network calls (MSW or mocks only)
- [x] E2E smoke test script in CI (`npm run test:e2e`)

### Infrastructure

- [x] `npm run docker:up` starts infra (postgres, redis, ollama)
- [x] `npm run docker:migrate` applies migrations inside Docker
- [x] `.env.example` documents required variables
- [x] Documentation in `docs/` reflects current implementation (June 2026)
- [x] `npm run docker:up:all` verified end-to-end — use `npm run docker:verify` (2026-06-21)

---

## Non-goals for MVP (explicitly out of scope)

These are **not** required for MVP functional sign-off:

- LLM duplicate detection or description drafting (Phase 2)
- Automatic scheduled syncs
- GitHub/GitLab webhooks
- Token encryption at rest (document as known limitation; track for post-MVP)
- Mobile-optimised UI
- SaaS billing
- Multi-tenant orgs / enterprise SSO (Phase 3)
- RBAC, admin dashboard, audit log, impact reporting, write-back rollback (Phase 4)

## Required before production / shared deployment

These are **not** MVP feature-complete items but **must** ship before the app is reachable by others:

- [x] **Authentication** — login + protected routes (see [phases.md](./phases.md) Step 8)
- [ ] HTTPS termination (reverse proxy or platform)
- [ ] Secrets not committed to git (`.env` only local)

---

## Acceptance scenario

A reviewer should be able to perform this flow without assistance:

1. Clone repo, copy `.env.example` → `.env`, run `npm install`
2. Run `npm run docker:up` and `npm run db:migrate`
3. Start web (`npm run dev`) and worker (`npm run dev:worker`)
4. Open `http://localhost:3000`
5. Add a **GitHub** or **GitLab** connection with a valid token
6. Register a project/repo
7. Click **Sync** and wait for completion
8. View dashboard showing overview counts and stale, stuck, and milestone decay metrics

**MVP (functional) = all checked functional and technical boxes above, and the acceptance scenario passes.**

**Production-ready = MVP + Step 8 authentication + HTTPS.**

---

## Sign-off template

| Field | Value |
|-------|-------|
| Date | 2026-06-21 |
| Version / commit | 644ffe7 (+ Phase 1 closure work) |
| Reviewer | Karsten / Cursor Agent |
| Provider tested (GitHub / GitLab) | GitHub (e2e smoke + MSW); GitLab (manual dev) |
| Notes | Phase 1 MVP functionally complete (sign-off 2026-06-21). Subsequent phases added RBAC, admin, LLM write-back, and expanded API test coverage (~16 route files, 190+ web tests) without changing MVP scope. Docker full stack verified via `npm run docker:verify`. Production hardening documented in [security.md](./security.md). |
