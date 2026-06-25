# Development Guide

Conventions, workflows, and patterns for contributing to TriageOps.

---

## Getting started as a developer

1. Read [Current State](./current-state.md) — know what exists
2. Follow [Running the App](./running-the-app.md) — get a working local environment
3. Pick a task from [Implementation Phases](./phases.md)
4. Follow TDD below before merging core logic

---

## Monorepo conventions

### Package naming

| Package | Import name |
|---------|-------------|
| `packages/db` | `@triage-ops/db` |
| `packages/metrics` | `@triage-ops/metrics` |
| `packages/shared-types` | `@triage-ops/shared-types` |
| `apps/web` | `@triage-ops/web` |
| `apps/worker` | `@triage-ops/worker` |

### Adding a dependency

```bash
# To a specific workspace
npm install <package> -w @triage-ops/worker

# Dev dependency
npm install -D vitest -w @triage-ops/worker
```

### Running a script in one workspace

```bash
npm run <script> -w @triage-ops/<package>
```

---

## Code organisation

```
apps/worker/src/
├── config/         Environment variable helpers
├── lib/
│   ├── gitlab/     GitLab REST API client (+ *.test.ts)
│   ├── github/     GitHub REST API client (+ *.test.ts)
│   ├── vcs/        Provider router (fetch + write-back)
│   ├── llm/        Duplicate detection, description drafts, embeddings
│   ├── ollama/     Ollama client wrapper
│   ├── lock.ts     Redis distributed locks (+ *.test.ts)
│   └── redis.ts    Redis singleton
├── queues/         BullMQ queue definitions
├── workers/        Job processors (sync, llm, write-back, auto-sync)
└── index.ts        Daemon entry point

apps/web/
├── app/
│   ├── (dashboard)/   Home, project, connections, projects, admin
│   ├── api/           REST API routes (+ route.test.ts)
│   ├── setup/         Instance bootstrap
│   └── login/         OAuth sign-in
├── auth.config.ts     Auth.js + proxy authorization
├── lib/auth/          RBAC, session, allowlist, bootstrap
└── lib/services/      Server-side data helpers

packages/metrics/src/
├── ghost.ts        countGhostIssues (+ *.test.ts)
├── zombie.ts       countZombieIssues (+ *.test.ts)
└── milestone-decay.ts  getMilestoneDecay (+ *.test.ts)

packages/db/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── src/
    ├── client.ts   Prisma singleton
    └── index.ts    Public exports
```

### Where to put new code

| Feature | Location |
|---------|----------|
| Database model change | `packages/db/prisma/schema.prisma` → migration |
| Shared type / queue payload | `packages/shared-types/src/` |
| GitLab API call | `apps/worker/src/lib/gitlab/` |
| GitHub API call | `apps/worker/src/lib/github/` |
| VCS provider routing | `apps/worker/src/lib/vcs/` |
| Background job logic | `apps/worker/src/workers/` |
| HTTP API route | `apps/web/app/api/` |
| Dashboard UI | `apps/web/app/(dashboard)/` + `apps/web/components/` |
| Metric calculation (pure) | `packages/metrics/src/` |
| Server-side data helpers | `apps/web/lib/services/` |
| Authentication | `apps/web/auth.ts`, `apps/web/auth.config.ts`, `apps/web/proxy.ts`, `apps/web/lib/auth/` |
| Unit tests | Next to source file as `*.test.ts` |

---

## Test-Driven Development (TDD)

All backend utilities, API clients, and job handlers **must** follow this protocol.

### Framework

- **Vitest** — fast TypeScript-native test runner
- **MSW** — mock HTTP for GitLab API tests (no real network calls)

### Workflow

1. **Write the test first** — define the contract in `*.test.ts`
2. **Run test** — confirm it fails (`npm run test -w @triage-ops/worker`)
3. **Implement** — minimal code to pass
4. **Refactor** — clean up without breaking tests

### Required test cases per module

| Case | Example |
|------|---------|
| Success path | Valid input → expected output shape |
| Fault handling | 401 token, 500 server error, malformed params |
| Boundary limits | Zero results, empty array, pagination edge (page 1 of 1) |

### Example: GitLab client (existing)

```
apps/worker/src/lib/gitlab/
├── client.ts
└── client.test.ts    ← 11 tests with MSW handlers
```

MSW setup lives in `apps/worker/src/test/`:
- `msw-server.ts` — shared server + handler factories
- `setup.ts` — lifecycle hooks (listen / reset / close)

### Adding tests to a new package

1. Add `vitest` as devDependency
2. Create `vitest.config.ts`
3. Add `"test": "vitest run"` to `package.json`
4. Root `npm test` will pick it up via workspaces

---

## Database changes

1. Edit `packages/db/prisma/schema.prisma`
2. Run `npm run db:migrate -w @triage-ops/db -- --name describe_change`
3. Commit the generated migration SQL under `prisma/migrations/`
4. Run `npm run db:generate` if client types are stale

**Rules:**
- Never edit applied migration files — create a new migration instead
- Add indexes for columns used in metric queries
- Use `onDelete: Cascade` carefully; prefer explicit cascade from `Project` downward

---

## Background jobs

### Adding a new queue

1. Add queue name to `packages/shared-types/src/index.ts`
2. Create queue factory in `apps/worker/src/queues/`
3. Create processor in `apps/worker/src/workers/`
4. Register worker in `apps/worker/src/index.ts`
5. Write tests for processor logic (mock Prisma + GitLab client)

### Enqueueing from web

Implemented in `apps/web/lib/queue.ts`. API routes create a `SyncRun` row, then add a job:

```typescript
await prisma.syncRun.create({ data: { projectId, status: "PENDING" } });
await enqueueSyncJob({ projectId, syncRunId });
```

---

## UI development (Shadcn)

Shadcn is configured in `apps/web`. Prefer Shadcn primitives over bespoke components. Prioritise function over custom styling.

New components:

```bash
cd apps/web
npx shadcn@latest add <component>
```

---

## Git workflow

- One logical change per commit
- Run `npm test && npm run lint` before pushing
- Update `docs/current-state.md` when completing a phase step
- Check [MVP Definition of Done](./mvp-definition-of-done.md) items as they ship

---

## Agent roles (reference)

When tackling complex tasks, work can be split by concern:

| Agent | Owns |
|-------|------|
| **DB-Agent** | Prisma schema, migrations, relational constraints |
| **Infra-Agent** | Dockerfiles, `docker-compose.yml`, health checks, env wiring |
| **Queue-Agent** | BullMQ queues, Redis locks, retry policies, job processors |
| **QA-Agent** | Vitest specs, MSW mocks, CI test gates |

These are conceptual roles — not separate services.

---

## Useful commands cheat sheet

```bash
# Development
npm run dev
npm run dev:worker

# Database
npm run db:migrate
npm run db:studio -w @triage-ops/db

# Quality
npm test
npm run test:e2e   # requires Postgres + Redis
npm run lint
npm run build

# Docker
npm run docker:up
npm run docker:migrate
npm run docker:verify
npm run docker:down
```
