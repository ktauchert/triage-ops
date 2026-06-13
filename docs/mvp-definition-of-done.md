# MVP Definition of Done

Phase 1 MVP is **done** when a developer can connect a GitLab project, run a sync, and view meaningful triage metrics on a dashboard — self-hosted via Docker or running locally — without manual database intervention.

Use this checklist before calling MVP shippable.

---

## Functional requirements

### GitLab integration

- [ ] User can register a GitLab connection (instance URL + personal/group access token)
- [ ] User can register one or more GitLab projects under a connection
- [ ] User can trigger a manual sync for a project from the UI
- [ ] Sync progress/status is visible (pending → running → completed/failed)
- [ ] Synced issues appear in Postgres with correct title, state, assignee, dates, and labels

### Triage metrics

- [ ] Dashboard displays **Ghost ticket** count (configurable inactivity threshold, default 30 days)
- [ ] Dashboard displays **Zombie ticket** count (open + assigned + stale, default 14 days)
- [ ] Dashboard displays **Milestone decay** — active milestones past due date with open issues
- [ ] Each metric links to a filterable issue list
- [ ] Metrics reflect last successful sync timestamp

### User interface

- [ ] Shadcn UI component library integrated
- [ ] Responsive layout usable on desktop (mobile nice-to-have)
- [ ] Clear error messages for failed syncs and invalid GitLab credentials
- [ ] Empty states when no connections/projects/issues exist

---

## Technical requirements

### Data layer

- [ ] All Prisma migrations apply cleanly via `npm run db:migrate:deploy`
- [ ] Unique constraints prevent duplicate project/issue rows on re-sync
- [ ] `SyncRun` records capture status, timestamps, issue count, and error messages

### Worker

- [ ] `gitlab-sync` jobs process without crashing on empty projects (zero issues)
- [ ] Concurrent sync requests for the same project are rejected (Redis lock)
- [ ] Failed GitLab API calls mark `SyncRun` as `FAILED` with readable error
- [ ] Worker restarts gracefully (`SIGTERM` / `SIGINT` handled)

### Web

- [ ] Next.js production build succeeds (`npm run build -w @triage-ops/web`)
- [ ] API routes validate input and return appropriate HTTP status codes (400, 401, 404, 500)
- [ ] No secrets exposed in client-side bundles or API responses

### Testing

- [ ] `npm test` passes in CI
- [ ] GitLab client tests cover: success, pagination, empty results, 401, 500, validation
- [ ] Metrics engine tests cover: zero matches, boundary dates, malformed input
- [ ] No unit test makes real network calls (MSW or mocks only)

### Infrastructure

- [ ] `docker compose up` starts full stack (postgres, redis, web, worker)
- [ ] `npm run docker:migrate` applies migrations inside Docker
- [ ] `.env.example` documents all required variables
- [ ] Documentation in `docs/` is accurate and up to date

---

## Non-goals for MVP (explicitly out of scope)

These are **not** required for MVP sign-off:

- User authentication / multi-tenant accounts
- LLM duplicate detection or description drafting (Phase 2)
- Automatic scheduled syncs
- GitLab webhooks
- Token encryption at rest (document as known limitation; track for post-MVP)
- Mobile-optimised UI
- SaaS billing

---

## Acceptance scenario

A reviewer should be able to perform this flow without assistance:

1. Clone repo, copy `.env.example` → `.env`, run `npm install`
2. Run `npm run docker:up` and `npm run db:migrate`
3. Start web (`npm run dev`) and worker (`npm run dev:worker`)
4. Open `http://localhost:3000`
5. Add a GitLab connection with a valid token
6. Register a GitLab project
7. Click **Sync** and wait for completion
8. View dashboard showing ghost, zombie, and milestone decay counts that match manual GitLab inspection

**MVP = all functional and technical checkboxes above are ticked, and the acceptance scenario passes.**

---

## Sign-off template

| Field | Value |
|-------|-------|
| Date | |
| Version / commit | |
| Reviewer | |
| GitLab instance tested | |
| Notes | |
