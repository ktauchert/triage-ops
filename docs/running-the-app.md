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
- **GitHub** personal access token with `repo` scope (read issues)
- **GitLab** personal access token with `read_api` scope

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
3. Go to **Projects** → register a repo (`owner/repo` for GitHub, project path for GitLab)
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
| `npm run db:seed` | Insert sample connections and projects |
| `npm run db:push -w @triage-ops/db` | Push schema without migration file (prototyping only) |
| `npm run db:studio -w @triage-ops/db` | Open Prisma Studio GUI |

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
