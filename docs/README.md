# TriageOps Documentation

**TriageOps** is a developer-tooling platform that syncs GitHub and GitLab issue metadata into a local Postgres database and surfaces triage metrics — ghost tickets, zombie tickets, milestone decay — via a dashboard.

This folder is the single source of truth for project direction, architecture, and day-to-day development.

## Contents

| Document | Purpose |
|----------|---------|
| [Current State](./current-state.md) | What exists today, what is stubbed, test coverage |
| [Architecture](./architecture.md) | Monorepo layout, services, data flow, package roles |
| [Security](./security.md) | Auth, credentials, on-prem hardening, reviewer FAQ |
| [Intranet Rollout](./intranet-rollout.md) | Production install checklist (Docker Compose; Helm planned) |
| [Production Readiness](./production-readiness.md) | **Gate checklist: pilot vs customer install, distribution workstreams** |
| [Editions (CE / Pro)](./editions.md) | **Community vs Pro feature split, limits, licensing direction** |
| [On-Prem Product Model](./on-prem-product.md) | **Bootstrap auth, closed registration, image-based distribution (decisions + roadmap)** |
| [Implementation Phases](./phases.md) | Phase roadmap with step-by-step plan |
| [**Completion Roadmap**](./completion-roadmap.md) | **Master todo: final steps to v1.0 (on-prem complete)** |
| [Dashboard restructure](./dashboard-restructure.md) | **Role-aware routes, home/project/admin shells (in progress)** |
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
| **Authentication** | ✅ Auth.js OAuth — [docs](./running-the-app.md#authentication) |
| Phase 2 LLM (Ollama) | ✅ Done — [running-the-app](./running-the-app.md#ollama-llm-analysis-phase-2) |
| Label sync | ✅ Done |
| Phase 2.5 Write-back | ✅ Done |
| Phase 1 MVP hardening | ✅ Done — [phases](./phases.md) |
| E2E smoke test | ✅ `npm run test:e2e` |
| Phase 3 Production infra | Partial — encryption, auto-sync; [production readiness](./production-readiness.md) |
| Phase 4 Governance | In progress — RBAC + admin + bootstrap largely done; [production readiness](./production-readiness.md) |

See [Implementation Phases](./phases.md) for the full roadmap.
