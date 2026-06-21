# TriageOps — Agent guide

TriageOps syncs GitHub/GitLab issues into Postgres and surfaces triage metrics plus local LLM suggestions (Ollama). Monorepo: `apps/web`, `apps/worker`, `packages/db`, `packages/metrics`, `packages/shared-types`.

**Human docs:** start at [`docs/README.md`](docs/README.md). Update [`docs/current-state.md`](docs/current-state.md) when shipping phase work.

**Cursor rules:** file-specific agent instructions in [`.cursor/rules/`](.cursor/rules/) (auto-attached when you edit matching paths). These are not subagents — see below.

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Local dev (minimum)

```bash
npm install                  # runs prisma generate via postinstall
npm run docker:up            # Postgres :5433, Redis, Ollama
npm run db:migrate
npm run dev                  # web → :3000
npm run dev:worker           # BullMQ sync + llm-analysis + vcs-writeback workers
```

GitLab test data (optional): `npm run gitlab:seed` then sync from Projects page.

---

## Where code goes

| Change | Location |
|--------|----------|
| Schema / migration | `packages/db/prisma/schema.prisma` → `npm run db:migrate` |
| Queue name + payload | `packages/shared-types/src/` |
| VCS API client | `apps/worker/src/lib/github/` or `gitlab/` |
| Background job | `apps/worker/src/workers/` + register in `index.ts` |
| API route | `apps/web/app/api/` |
| Dashboard UI | `apps/web/app/(dashboard)/` + `components/` |
| Server helpers | `apps/web/lib/services/` |
| Pure metrics | `packages/metrics/src/` |
| LLM logic (no VCS tokens) | `apps/worker/src/lib/llm/`, `lib/ollama/` |

---

## Architecture constraints

- **Sync worker** (`gitlab-sync` queue): fetches VCS APIs, upserts issues/milestones/labels.
- **LLM worker** (`llm-analysis` queue): reads **Postgres only**; never send tokens to Ollama.
- **Write-back worker** (`vcs-writeback` queue): applies suggestions to GitHub/GitLab using stored PATs; patches local `Issue` rows.
- **Apply suggestions**: sets `APPLYING`, enqueues write-back; worker sets `APPLIED` or `APPLY_FAILED` + `writeBackError`.
- **Redis locks**: per-project `sync:{id}` and `llm:{id}`; worker recovers interrupted LLM runs on startup.
- **Auth**: disabled locally via `AUTH_DISABLED=true`; API routes use `requireApiSession()`.

---

## Database

1. Edit `schema.prisma`
2. `npm run db:migrate`
3. If TypeScript complains about unknown Prisma fields → `npm run db:generate` and restart dev servers

Never edit applied migration SQL — add a new migration.

---

## Testing

- **Vitest** + **MSW** for worker VCS/LLM clients; tests live beside source (`*.test.ts`).
- TDD for pure logic and API clients: test first, then implement.
- `npm test` — all workspaces; `npm run test:e2e` needs Postgres + Redis.
- Run `npm run build` for web after API/type changes.

---

## LLM analysis (Phase 2)

- Models (local): `llama3.2:3b` (chat), `nomic-embed-text` (embeddings).
- Dashboard: **Run analysis** → progress bar polls `GET /api/projects/[id]/analyze`.
- **Clear analysis** → `DELETE` same route (wipes suggestions + run history for project).
- Duplicate detection: embedding cosine similarity (~0.82 threshold).
- Do not kill `dev:worker` mid-run (Ctrl+C); restart worker to recover stale runs.

---

## Implementation style

- **Minimize scope** — smallest correct diff; match existing patterns in the file you edit.
- **No drive-by refactors** or extra abstractions.
- **Comments** only for non-obvious business logic.
- **Commits / PRs** only when the user asks.
- Prefer extending existing functions over parallel implementations.

---

## Phase status (June 2026)

| Phase | Status |
|-------|--------|
| 0 Foundation | ✅ |
| 1 MVP (sync, metrics, dashboard, auth, labels, thresholds) | ✅ |
| 2 LLM triage (Ollama, suggestions, progress, clear) | ✅ |
| 2.5 VCS write-back (apply → GitLab/GitHub) | ✅ |
| 3 Production infrastructure | Partial (3a encryption, 3b auto-sync) |
| 4 Governance (RBAC, admin, audit, reporting, rollback) | Not started |

See [`docs/phases.md`](docs/phases.md) for the full checklist.

---

## Cursor: rules vs subagents

| Mechanism | What it is |
|-----------|------------|
| **AGENTS.md** | Project-wide agent readme (always referenced) |
| **`.cursor/rules/*.mdc`** | Extra instructions injected when relevant files are open (`alwaysApply` rules are always on) |
| **Subagents** (Task tool) | Separate autonomous runs (e.g. `explore` to search the repo, `shell` for commands) — only when the agent explicitly launches them |

The “DB-Agent / Queue-Agent” roles in `docs/development-guide.md` are **conceptual** — not configured subagents. Use `.cursor/rules/` to specialize behavior per folder; use subagents for heavy one-off exploration or parallel work.
