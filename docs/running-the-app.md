# Running the App

Instructions for local development and full Docker deployment.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Docker + Docker Compose | Latest stable |
| Git | Any recent version |

For real sync testing, you need **one** of:
- **GitHub** personal access token with `repo` scope (list repos + read issues)
- **GitLab** personal access token with `read_api` scope (list projects + read issues)

### Personal access token scopes

TriageOps uses the connection PAT for two things: **listing repos/projects** on the Projects page and **syncing issues** in the worker.

| Provider | Required scope | Notes |
|----------|----------------|-------|
| **GitHub** | `repo` | Lists private and public repos you can access, and reads issues |
| **GitHub** | `public_repo` | Public repos only — insufficient if you need private repositories |
| **GitLab** | `read_api` | Lists projects and reads issues via the REST API |

If the token lacks list permissions, the Projects page shows an error asking you to update the connection with a token that has the scopes above. Login OAuth is separate and does not replace the sync PAT.

---

## First-time setup

```bash
# 1. Clone and install
git clone <repo-url> triage-ops
cd triage-ops
npm install

# 2. Environment
cp .env.example .env
# Edit .env if your ports or credentials differ

# 3. Start infrastructure (Postgres, Redis, Ollama)
npm run docker:up

# 4. Apply database migrations
npm run db:migrate

# 5. (Optional) Seed sample data
npm run db:seed
```

> **Note:** `db:seed` creates placeholder connections named **Local GitLab** and **My GitHub** with dummy tokens (`replace-me-with-real-token`). They are safe to delete from the **Connections** page. Only run seed when you want sample data; skip it if you are adding your own connections.

Verify containers are healthy:

```bash
docker compose ps
```

Expected: `triage-ops-postgres`, `triage-ops-redis`, and `triage-ops-ollama` running.

---

## Local development (recommended)

Run app processes on the host for fast reload; infrastructure in Docker.

### Terminal 1 — Web

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Terminal 2 — Worker

```bash
npm run dev:worker
```

The worker connects to Redis and listens on the `gitlab-sync` queue.

### Environment (.env)

```env
DATABASE_URL=postgresql://triage_ops:triage_ops@localhost:5433/triage_ops
REDIS_URL=redis://localhost:6379
OLLAMA_HOST=http://localhost:11434
PORT=3000
NODE_ENV=development
WORKER_CONCURRENCY=2
```

> Postgres uses host port **5433** (mapped from container 5432).  
> Root `.env` is loaded automatically by web (`dotenv-cli`), worker, and Prisma scripts.

---

## Using the dashboard

1. Open [http://localhost:3000](http://localhost:3000)
2. Go to **Connections** → add a GitHub or GitLab connection with your token
3. Go to **Projects** → pick a connection, select a repo/project from the list (or enter manually)
4. Click **Sync** and wait for status `COMPLETED`
5. Open **Dashboard** to see overview counts and triage metrics

> **Security:** Auth is **disabled by default** locally (`AUTH_DISABLED=true`). Before exposing the app to a network, enable auth — see [Authentication](#authentication) below.

---

## Authentication

Auth is implemented via **Auth.js v5** with GitHub and/or GitLab OAuth. Local development skips login when `AUTH_DISABLED=true` (default in `.env.example`).

### Enable auth locally

```env
AUTH_DISABLED=false
AUTH_SECRET=<run: openssl rand -base64 32>
AUTH_URL=http://localhost:3000
AUTH_PROVIDERS=github          # or gitlab, or github,gitlab
AUTH_DATA_SCOPE=shared         # or per_user for hosted solo-dev profile
```

### Deployment profiles

| Profile | `AUTH_PROVIDERS` | `AUTH_DATA_SCOPE` | Allowlist |
|---------|------------------|-------------------|-----------|
| On-prem intranet | `gitlab` | `shared` | `ALLOWED_EMAIL_DOMAINS=company.com` |
| Hosted solo dev | `github` | `per_user` | optional |
| Local dev | any | any | off (`AUTH_DISABLED=true`) |

### OAuth app registration

**GitHub** (Settings → Developer settings → OAuth Apps):

- Homepage URL: `http://localhost:3000` (or your deployment URL)
- Callback URL: `http://localhost:3000/api/auth/callback/github`
- Env: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`

**GitLab** (User Settings → Applications, or Admin → Applications for self-hosted):

- Redirect URI: `http://localhost:3000/api/auth/callback/gitlab`
- Scopes: `read_user` (or `openid`, `profile`, `email` depending on instance)
- Env: `AUTH_GITLAB_ID`, `AUTH_GITLAB_SECRET`, `AUTH_GITLAB_ISSUER` (e.g. `https://gitlab.com` or your self-hosted URL)

> Login OAuth is **separate** from VCS sync tokens. After signing in, users still add a PAT on the Connections page for issue sync.

### On-prem allowlist

Restrict who can sign in:

```env
ALLOWED_EMAIL_DOMAINS=company.com
# or explicit list:
ALLOWED_EMAILS=alice@company.com,bob@company.com
```

When both are empty, any authenticated OAuth user may access the instance.

### Production security

Before rolling out on an intranet or exposing the app beyond localhost, complete the checklist in **[Security](./security.md)**. At minimum:

1. Set `AUTH_DISABLED=false` and a strong `AUTH_SECRET`
2. Terminate HTTPS at a reverse proxy; set `AUTH_URL` to the HTTPS origin
3. Configure `ALLOWED_EMAIL_DOMAINS` (on-prem)
4. Change default Postgres credentials in Docker/production
5. Do not expose Postgres or Redis ports outside the private network
6. Use VCS PATs with least privilege (`read_api` on GitLab; `repo` or `public_repo` on GitHub)

---

## Full Docker deployment

Build and run all services including web and worker:

```bash
cp .env.example .env
npm run docker:up:all    # postgres + redis + ollama + web + worker
npm run docker:migrate
```

| Service | URL |
|---------|-----|
| Web | [http://localhost:3000](http://localhost:3000) |
| Postgres | `localhost:5433` |
| Redis | `localhost:6379` |
| Ollama | [http://localhost:11434](http://localhost:11434) |

Stop everything:

```bash
npm run docker:down
```

Remove volumes (⚠️ deletes database data):

```bash
docker compose down -v
```

---

## Database commands

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:migrate` | Create + apply migration (development) |
| `npm run db:migrate:deploy` | Apply pending migrations (production/CI) |
| `npm run db:seed` | Insert sample connections and projects (optional; delete placeholders in UI if unused) |
| `npm run gitlab:seed` | Create GitLab milestones/issues for local metrics + LLM testing (see below) |
| `npm run db:push -w @triage-ops/db` | Push schema without migration file (prototyping only) |
| `npm run db:studio -w @triage-ops/db` | Open Prisma Studio GUI |

---

## Local GitLab test data

Use a self-hosted GitLab (e.g. Docker) to sync real issues into TriageOps. After creating a project and PAT in GitLab, add these to `.env`:

```env
GITLAB_URL=http://gitlab.local
GITLAB_TOKEN=glpat-...              # `api` scope (write)
GITLAB_PROJECT_PATH=triage-test/demo
GITLAB_CONTAINER=gitlab             # container name for timestamp backdating
```

Seed milestones and issues (metrics + future LLM scenarios):

```bash
npm run gitlab:seed
```

The script creates:

| Category | Count | Purpose |
|----------|-------|---------|
| Milestone decay | 1 overdue sprint, 2 open issues | `getMilestoneDecay` |
| Zombie issues | 2 assigned, no milestone, stale | `countZombieIssues` (>14d) |
| Ghost issues | 2 unassigned, stale | `countGhostIssues` (>30d) |
| Duplicate pairs | 3 pairs | similar titles/descriptions for LLM dedup |
| Empty descriptions | 3 issues | future description drafting |

GitLab’s REST API cannot set historical `updated_at` values. The seed script backdates timestamps via `docker exec … gitlab-rails runner` when `GITLAB_PROJECT_PATH` and the GitLab container are available. Set `GITLAB_BACKDATE=false` to skip that step.

> **Note:** Re-running the seed on the same project creates duplicate milestones/issues. Use a fresh project or delete the old data first.

Then register the project in TriageOps (Connections → Projects) and trigger sync. **Re-sync** after upgrading to pick up labels if issues were seeded before label sync shipped.

---

## Phase 1 exit checklist

Before starting Phase 2 (LLM), confirm:

1. `npm run db:migrate` — applies latest schema (including per-project thresholds)
2. `npm test` and `npm run lint` pass
3. Sync a project — labels appear in the **All synced issues** table
4. Dashboard **Metric thresholds** — change ghost/zombie days and confirm counts update
5. Optional full Docker stack:
   ```bash
   npm run docker:up:all
   npm run docker:migrate
   curl -f http://localhost:3000/login || curl -f http://localhost:3000
   ```
   Trigger sync via UI; worker container must be running.

---

## Testing & quality

```bash
npm test                              # All workspace tests (incl. e2e smoke)
npm run test:e2e                      # E2E smoke only (needs Postgres + Redis)
npm run test -w @triage-ops/worker    # Worker tests only
npm run test -w @triage-ops/metrics    # Metrics tests only
npm run lint                          # TypeScript + ESLint all packages
npm run build                         # Production build all packages
```

---

## Troubleshooting

### Port 5432 already in use

The compose file maps Postgres to host port **5433**. Ensure `DATABASE_URL` in `.env` uses port `5433` for local dev.

### Port 11434 already in use (Ollama)

Another Ollama instance may be running locally. Stop it or change the host port mapping in `docker-compose.yml`.

### Local GitLab is slow or freezes the machine

GitLab CE is memory-heavy (often 4 GB+ RAM). On a laptop, limit Docker memory in Docker Desktop settings or stop GitLab when not testing (`docker compose -f <your-gitlab-compose>.yml stop`). TriageOps itself only needs Postgres + Redis + worker for sync testing.

### Worker exits with "Missing required environment variable"

Ensure `.env` exists at repo root and contains `REDIS_URL` and `DATABASE_URL`. Dev scripts load it via `dotenv-cli`.

### `Environment variable not found: DATABASE_URL` (Prisma / Next.js)

Run commands from repo root, or use the workspace scripts (`npm run db:migrate`, `npm run dev`) which load `../../.env` automatically.

### Redis connection refused

```bash
docker compose up -d redis
docker compose ps redis   # should show (healthy)
```

### GitHub sync fails with integer overflow

Re-run migrations — `gitlabIssueId` must be `BigInt` for GitHub global IDs:

```bash
npm run db:migrate
```

### Milestone decay shows 0 after first sync

Re-sync the project after upgrading — milestone `dueDate` and `state` are written during issue sync.

### Prisma migration fails

```bash
docker compose ps postgres   # check Postgres is reachable
npm run db:migrate
# Or reset: docker compose down -v && npm run docker:up && npm run db:migrate
```

### Vitest EACCES / worker pool errors

Run tests outside restricted sandboxes:

```bash
npm run test -w @triage-ops/worker
```

---

## Service reference

| Process | Package | Port | Depends on |
|---------|---------|------|------------|
| Web dev server | `@triage-ops/web` | 3000 | Postgres, Redis |
| Worker daemon | `@triage-ops/worker` | — | Postgres, Redis |
| Postgres | Docker | 5433 | — |
| Redis | Docker | 6379 | — |
| Ollama | Docker | 11434 | — (Phase 2 app code) |
