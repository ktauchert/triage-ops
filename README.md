# Gridnull

On-prem issue triage for **GitHub and GitLab**: sync issue metadata into Postgres, surface triage metrics (stale tickets, stuck tickets, milestone decay), and review local LLM suggestions before write-back — all from a dashboard.

## Quick start

```bash
cp .env.example .env
npm install
npm run docker:up
npm run db:migrate
npm run dev          # web  → http://localhost:3000
npm run dev:worker   # worker daemon
```

## Documentation

Full project documentation lives in **[`docs/`](./docs/README.md)**:

| Doc | Description |
|-----|-------------|
| [Current State](./docs/current-state.md) | What's built today |
| [Architecture](./docs/architecture.md) | Monorepo layout, worker, DB, data flow |
| [Implementation Phases](./docs/phases.md) | Roadmap and next steps |
| [Security](./docs/security.md) | Auth, credentials, on-prem hardening checklist |
| [MVP Definition of Done](./docs/mvp-definition-of-done.md) | Phase 1 ship criteria |
| [Running the App](./docs/running-the-app.md) | Local dev, Docker, troubleshooting |
| [Development Guide](./docs/development-guide.md) | TDD, conventions, where to put code |

## Monorepo structure

```
apps/web       Next.js dashboard (App Router)
apps/worker    BullMQ background jobs + GitHub/GitLab sync
packages/db    Prisma schema, migrations, Postgres client
packages/shared-types   Queue payloads and shared DTOs
```

## Scripts

```bash
npm run dev              # Start web dev server
npm run dev:worker       # Start worker daemon
npm run test             # Run Vitest across workspaces
npm run build            # Production build all packages
npm run db:migrate       # Apply Prisma migrations
npm run docker:up        # Start Postgres, Redis, Ollama
```

Requires **Node.js ≥ 24** and **Docker**.
