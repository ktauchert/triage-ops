# Rename to Gridnull — work summary (June 2026)

Chronicle of the **TriageOps → Gridnull** rebrand and related metric vocabulary change. Use this when onboarding, writing release notes, or explaining what changed in the codebase.

**Related docs:**

- [Product naming](./product-naming.md) — name choice, availability checks, rejected alternatives
- [Implementation phases](./phases.md) — **Phase 6** (future UI theme / cyberpunk story; not shipped yet)

---

## Why we renamed

| Problem | Detail |
|---------|--------|
| Brand collision | [triageops.com](https://triageops.com/) / [triageops.dev](https://triageops.dev/) — unrelated products |
| GitLab confusion | Internal project [`triage-ops`](https://gitlab.com/gitlab-org/quality/triage-ops) |
| Positioning | Wanted simple, clean **cyberpunk** tone — grid + null, not graveyard or epic mythology |

**Chosen name:** **Gridnull** — *grid* (structure, dashboard) + *null* (empty signal, inactive cell). Optional tagline: *Find the nulls. Fix what's stale. Unstick the rest.*

**Explored but rejected:** Wiregrave (too dark), Gilgamesh/epic names, Gridify (.NET library collision), Gridrunner (retro game), GlitchGrave (near glitchgrab).

---

## What shipped in the repo

### 1. Product & package rename

| Layer | Before | After |
|-------|--------|--------|
| Product name | TriageOps | **Gridnull** |
| Root npm package | `triage-ops` | `gridnull` |
| Workspace scope | `@triage-ops/*` | `@gridnull/*` |
| Install env prefix | `TRIAGE_OPS_*` | `GRIDNULL_*` (hard cut, no fallback) |
| GHCR images | `triage-ops-web`, `triage-ops-worker` | `gridnull-web`, `gridnull-worker` |
| Install ZIP | `triage-ops-install-x.y.z.zip` | `gridnull-install-x.y.z.zip` |
| Redis lock prefix | `triage-ops:lock:` | `gridnull:lock:` |
| Docker `container_name` | mixed / old | `gridnull-postgres`, `gridnull-redis`, etc. |

**Touched areas:** all workspace `package.json` files, imports, `package-lock.json`, Dockerfiles, `docker-compose*.yml`, CI/release workflows, install bundle, UI strings (layout, sidebar, login, setup, admin), EULA/privacy/LICENSE, `AGENTS.md`, `.cursor/rules/`, and most `docs/`.

### 2. Metric vocabulary (ghost / zombie → stale / stuck)

User-facing and code names were aligned to clearer, less morbid language:

| Before | After |
|--------|--------|
| Ghost issues / tickets | **Stale** |
| Zombie issues / tickets | **Stuck** |
| `countGhostIssues` | `countStaleIssues` |
| `countZombieIssues` | `countStuckIssues` |
| `ghost.ts` / `zombie.ts` | `stale.ts` / `stuck.ts` |
| `ghostThresholdDays` | `staleThresholdDays` |
| `zombieThresholdDays` | `stuckThresholdDays` |
| API `metrics.ghost` / `metrics.zombie` | `metrics.stale` / `metrics.stuck` |

**DB migration:** `20260629120000_rename_metric_threshold_columns` — renames columns on existing databases that already had ghost/zombie fields from `20260619120000_project_thresholds`.

### 3. Local infrastructure cleanup

Dev Docker stack defaults were aligned with the product name (June 2026, after initial rename):

| Item | Before | After |
|------|--------|--------|
| Compose project `name` | (folder-derived `triage-ops`) | `gridnull` |
| Docker volumes | `triage-ops_postgres_data`, etc. | `gridnull_postgres_data`, etc. |
| Postgres DB / user / password | `triage_ops` | `gridnull` |
| `DATABASE_URL` (dev) | `.../triage_ops` | `.../gridnull` |

Fresh install path: `docker compose down -v` → `npm run docker:up` → `npm run db:migrate`.

### 4. Documentation & roadmap

- [`product-naming.md`](./product-naming.md) — Gridnull marked as chosen; Wiregrave/history preserved below the fold
- [`phases.md`](./phases.md) — **Phase 6 — Brand identity & UI theme** added (Step 19: cyberpunk visuals, wordmark, metric card copy — **not implemented**)
- Marketing copy in [`landing-page-content.md`](./landing-page-content.md) updated to stale/stuck language

---

## Migration incident (fixed)

During the bulk rename, a `sed` pass accidentally edited an **already-applied** migration:

- `20260619120000_project_thresholds` — columns were changed from `ghostThresholdDays` / `zombieThresholdDays` to `staleThresholdDays` / `stuckThresholdDays` in the SQL file

**Symptom:** `prisma migrate dev` failed with P3006 — shadow DB replay added stale/stuck columns, then `20260629120000_rename_metric_threshold_columns` tried to rename non-existent `ghost*` columns.

**Fix:** Restore `20260619120000` to original `ADD COLUMN ghostThresholdDays` / `zombieThresholdDays`. Keep `20260629120000` as the rename step for upgrades.

**Rule:** Never edit applied migration SQL — only add new migrations.

---

## Verification (June 2026)

After full cleanup (`docker compose down -v`, fresh `gridnull` volumes, all migrations):

| Check | Result |
|-------|--------|
| `npm test` (web, worker, db, metrics) | Pass |
| `npm run test:e2e` (smoke + navigation) | Pass |
| `npm run build -w @gridnull/web` | Pass |
| Prisma migrate (14 migrations) | Pass |

---

## Still manual / outside the repo

| Task | Status |
|------|--------|
| Register `gridnull.com` + `gridnull.dev` | User action |
| GitHub repo rename `triage-ops` → `gridnull` | Pending; then `git remote set-url origin git@github.com:ktauchert/gridnull.git` |
| Local folder rename (`triage-ops` → `gridnull`) | Optional; Cursor chat history tied to old path if renamed |
| First release with `gridnull-*` GHCR tags + install ZIP | After repo rename |
| Phase 6 UI theme / in-app story | Documented, not built |

**Note:** External GitLab test project paths (e.g. `testing/triage-ops-testing`) are unchanged — they refer to real repos on the VCS, not the product name.

---

## Quick reference for developers upgrading an old dev machine

```bash
# 1. Pull latest main
git pull

# 2. Update local .env (match .env.example)
POSTGRES_USER=gridnull
POSTGRES_PASSWORD=gridnull
POSTGRES_DB=gridnull
DATABASE_URL=postgresql://gridnull:gridnull@localhost:5433/gridnull

# 3. Wipe old stack (destroys local data)
docker compose down -v
docker compose -p triage-ops down -v   # if old project name lingers

# 4. Fresh start
npm install
npm run docker:up
npm run db:migrate

# 5. Re-seed if needed
npm run db:seed
npm run gitlab:seed   # optional

# 6. Re-pull Ollama models after volume wipe
docker exec gridnull-ollama ollama pull llama3.2:3b
docker exec gridnull-ollama ollama pull nomic-embed-text
```

For **production upgrades** with data to keep: run `npm run db:migrate` (or `db:migrate:deploy`) only — do **not** `down -v`. The rename migration applies column renames in place.
