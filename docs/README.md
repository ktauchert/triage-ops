# TriageOps Documentation

**TriageOps** is a developer-tooling platform that syncs GitHub and GitLab issue metadata into a local Postgres database and surfaces triage metrics — ghost tickets, zombie tickets, milestone decay — via a dashboard.

This folder is the single source of truth for project direction, architecture, and day-to-day development.

## Contents

| Document | Purpose |
|----------|---------|
| [Current State](./current-state.md) | What exists today, what is stubbed, test coverage |
| [Architecture](./architecture.md) | Monorepo layout, services, data flow, package roles |
| [Implementation Phases](./phases.md) | Phase roadmap with step-by-step plan |
| [MVP Definition of Done](./mvp-definition-of-done.md) | Checklist that marks Phase 1 MVP as shippable |
| [Running the App](./running-the-app.md) | Local dev, Docker, migrations, troubleshooting |
| [Development Guide](./development-guide.md) | Conventions, TDD workflow, adding features |

## Quick reference

```bash
# First-time setup
cp .env.example .env
npm install
npm run docker:up          # Postgres (5433), Redis, Ollama
npm run db:migrate         # Apply Prisma migrations

# Daily development
npm run dev                # Next.js web → http://localhost:3000
npm run dev:worker         # BullMQ worker daemon
npm test                   # Vitest across all packages
```

## Repository layout

```
triage-ops/
├── apps/
│   ├── web/          Next.js dashboard + API routes
│   └── worker/       BullMQ background jobs + VCS API clients
├── packages/
│   ├── db/           Prisma schema, migrations, Postgres client
│   ├── metrics/      Pure triage metric functions
│   └── shared-types/ Queue payloads and VCS DTOs
├── docker-compose.yml
├── .env.example
└── docs/             ← you are here
```

## Status at a glance

| Area | Status |
|------|--------|
| Monorepo scaffolding | ✅ Done |
| Prisma schema + migrations | ✅ Done |
| Docker infrastructure | ✅ Done |
| GitHub + GitLab sync worker | ✅ Done |
| Web dashboard + API routes | ✅ Done |
| Metrics engine (`packages/metrics`) | ✅ Done |
| Shadcn UI | ✅ Done |
| CI (test + lint + build) | ✅ Done |
| **Authentication** | ❌ Not started — [Step 8](./phases.md) |
| Phase 2 LLM (Ollama) | ⏳ Infra only |
| Label sync | ⏳ Schema only |
| E2E smoke test | ✅ `npm run test:e2e` |

See [Implementation Phases](./phases.md) for the full roadmap.
