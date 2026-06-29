# TriageOps — Product install guide

Install TriageOps on a server **without** cloning the source repository. You receive pre-built container images from a private registry and this install bundle.

## Prerequisites

Prepare the following **before** you start the install steps below.

### Server

- Linux host with **Docker Engine** and **Docker Compose v2** (`docker compose`, not the legacy `docker-compose` binary)
- **4 GB RAM** minimum; **8 GB+** recommended if you use larger Ollama models
- **Disk space** for container images, Postgres data, and Ollama model weights (budget roughly 15–30 GB depending on models)

### Network

- Users can reach the host on **port 3000** (HTTP), or you terminate TLS at a **reverse proxy** in front of it — see [Security — network hardening](https://github.com/ktauchert/triage-ops/blob/main/docs/security.md#network-and-infrastructure-hardening)
- The **worker** container needs outbound HTTPS to your GitLab or GitHub API (issue sync and write-back)
- Outbound HTTPS to **ghcr.io** (or your vendor's registry mirror) to pull images
- Outbound access to download **Ollama models** on first use (or mirror models internally)

Postgres, Redis, and Ollama are **not** exposed on host ports in the bundled Compose file.

### Credentials and configuration

| Item | Purpose |
|------|---------|
| **Registry read token** | Pull private `triage-ops-web` and `triage-ops-worker` images — [Registry access](#registry-access) |
| **OAuth application** | User login via GitHub and/or GitLab — redirect URI must be `{AUTH_URL}/api/auth/callback/<provider>` — see [OAuth registration (docs)](https://github.com/ktauchert/triage-ops/blob/main/docs/running-the-app.md#oauth-app-registration) |
| **Email allowlist** | `ALLOWED_EMAIL_DOMAINS` or `ALLOWED_EMAILS` — **required** in production; the web app refuses to start without one |
| **Secrets** | Plan strong values for `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `AUTH_SECRET`, and `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`) |

Login OAuth is **separate** from VCS sync tokens. After sign-in, users add a personal access token on the **Connections** page. See [Security](https://github.com/ktauchert/triage-ops/blob/main/docs/security.md) for PAT scopes and hardening guidance.

### HTTPS reverse proxy (recommended, not bundled)

TriageOps serves **HTTP on port 3000** only; it does not ship a reverse proxy or TLS certificates. You may run it directly over HTTP on a trusted intranet — set `AUTH_URL` to your `http://…` URL and register matching OAuth redirect URIs. Use a reverse proxy (nginx, Caddy, Traefik, etc.) when you need HTTPS — **required for GitHub OAuth on non-`localhost` hostnames**, and recommended for internet-facing deployments.

## 1. Registry login

Log in to GitHub Container Registry with the read-only token your vendor provided:

```bash
echo "<registry-token>" | docker login ghcr.io -u <github-username> --password-stdin
```

If your organization mirrors images to an internal registry, log in to that registry instead and use the mirror URL documented by your vendor.

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and replace every `<placeholder>`:

| Variable | Notes |
|----------|--------|
| `POSTGRES_PASSWORD` | Strong password; must match `DATABASE_URL` |
| `REDIS_PASSWORD` | Strong password; must match `REDIS_URL` (`redis://:<password>@redis:6379`) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` — required for VCS PAT encryption |
| `AUTH_URL` | Public URL users open in the browser (`https://…` behind a proxy, or `http://…` on a trusted intranet) — must match OAuth redirect URIs exactly |
| `AUTH_*` OAuth | Client ID/secret from GitHub or GitLab |
| `ALLOWED_EMAIL_DOMAINS` or `ALLOWED_EMAILS` | **Required** in production — the web app refuses to start without one |

Do **not** set `AUTH_DISABLED=true` in production.

By completing **initial setup** in the web UI, the first administrator accepts the **EULA** and **Privacy Policy** included in this bundle (`EULA.md`, `PRIVACY.md`). The same texts are available in the app at `/legal/eula` and `/legal/privacy`.

The bundled `docker-compose.prod.yml` pins the Ollama image to `ollama/ollama:0.30.10` and requires Redis authentication via `REDIS_PASSWORD`.

## 3. First install

From the directory containing `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d postgres redis ollama
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
docker compose -f docker-compose.prod.yml --profile production up -d
```

Postgres, Redis, and Ollama are **not** exposed on host ports. Only the web service listens on `:3000` (direct HTTP or behind your reverse proxy).

### Ollama models

Before running LLM analysis, pull models into the Ollama container:

```bash
docker exec triage-ops-ollama ollama pull llama3.2:3b
docker exec triage-ops-ollama ollama pull nomic-embed-text
```

Adjust model names if you changed `OLLAMA_CHAT_MODEL` / `OLLAMA_EMBED_MODEL` in `.env`.

## 4. Complete setup

1. If using HTTPS: configure your reverse proxy to forward to `http://127.0.0.1:3000`. If using HTTP on the intranet, ensure users can reach `http://<host>:3000` and that `AUTH_URL` matches.
2. Open `AUTH_URL` in a browser.
3. Visit `/setup` and sign in with GitHub or GitLab — the first successful login becomes the instance admin. See [On-prem bootstrap (docs)](https://github.com/ktauchert/triage-ops/blob/main/docs/on-prem-product.md) for closed registration after setup.
4. In **Admin → Users**, invite additional users before they sign in.

## 5. Upgrades

> Always take a fresh database backup **before** upgrading — see [Backup and restore](#6-backup-and-restore). Migrations are forward-only; a backup is your rollback path.

When your vendor releases a new version:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
docker compose -f docker-compose.prod.yml --profile production up -d
```

Replace `docker-compose.prod.yml` and `.env.example` from the new install bundle if image tags changed. Your `.env` secrets are preserved.

## 6. Backup and restore

All durable state lives in **Postgres** (issues, suggestions, users, connections, encrypted PATs). Redis holds only transient job state and Ollama holds re-pullable models, so a Postgres backup plus your `.env` is sufficient to restore the instance.

> Keep `.env` (and especially `TOKEN_ENCRYPTION_KEY`) backed up **separately and securely**. Without the same `TOKEN_ENCRYPTION_KEY`, encrypted VCS tokens in a restored database cannot be decrypted and must be re-entered.

### Back up the database

```bash
# Logical dump (recommended) — writes a compressed, restorable archive
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > triage-ops-$(date +%F).dump
```

Store the dump and a copy of `.env` in encrypted, access-restricted storage. Automate this on a schedule (e.g. a nightly cron job) and test restores periodically.

### Restore the database

```bash
# Bring up only the database
docker compose -f docker-compose.prod.yml up -d postgres

# Restore into a clean database (drops and recreates objects)
cat triage-ops-2026-06-25.dump | docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists

# Start the rest of the stack
docker compose -f docker-compose.prod.yml --profile production up -d
```

For a full disaster-recovery rebuild on a new host: install the bundle, restore the same `.env`, restore the dump, then `--profile production up -d`. Do **not** run the `migrate` profile against a freshly restored database unless you are upgrading — the dump already contains the schema at its captured version.

## 7. Rollback a failed upgrade

If an upgrade fails (bad migration, broken release, failing health checks), roll back to the previous version:

```bash
# 1. Stop application containers (leave Postgres running if reachable)
docker compose -f docker-compose.prod.yml --profile production down

# 2. Pin the previous version in the bundle and pull it
#    Set TRIAGE_OPS_VERSION to the last known-good tag in .env (or the compose file)
docker compose -f docker-compose.prod.yml pull

# 3. Restore the pre-upgrade database backup (required if the new version
#    applied migrations the old version cannot read)
cat triage-ops-<pre-upgrade-date>.dump | docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists

# 4. Start the previous version
docker compose -f docker-compose.prod.yml --profile production up -d
```

Because migrations are forward-only, downgrading the image **without** restoring the matching pre-upgrade backup can leave the old code running against a newer schema. Always restore the backup taken in step 5's pre-upgrade note when rolling back across a migration.

## Registry access

Customers need **read** access to the vendor's private GHCR packages:

| Method | When to use |
|--------|-------------|
| **Personal access token** | GitHub PAT with `read:packages` scope; vendor adds your GitHub user as package collaborator |
| **Organization token** | Shared read token issued by vendor ops (rotate periodically) |
| **Registry mirror** | Air-gapped or policy requires images on internal registry — vendor provides mirror/sync instructions |

To create a GitHub PAT for registry pull:

1. GitHub → Settings → Developer settings → Personal access tokens
2. Grant `read:packages` (classic token) or Packages read (fine-grained)
3. Vendor grants your account access to `triage-ops-web` and `triage-ops-worker` packages

## Troubleshooting

The worker container uses a no-op Docker `HEALTHCHECK` by design. Process recovery relies on `restart: unless-stopped` in Compose — if the worker exits, Docker restarts it automatically.

```bash
# Service status
docker compose -f docker-compose.prod.yml ps

# Logs
docker compose -f docker-compose.prod.yml logs -f web worker

# Re-run migrations after failed upgrade
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
```

## Further documentation

These guides live in the TriageOps repository (not included in the install bundle):

| Topic | Document |
|-------|----------|
| Security hardening & reviewer FAQ | [security.md](https://github.com/ktauchert/triage-ops/blob/main/docs/security.md) |
| Intranet rollout checklist (extended) | [intranet-rollout.md](https://github.com/ktauchert/triage-ops/blob/main/docs/intranet-rollout.md) |
| OAuth app registration details | [running-the-app.md — Authentication](https://github.com/ktauchert/triage-ops/blob/main/docs/running-the-app.md#authentication) |
| First-admin bootstrap & closed registration | [on-prem-product.md](https://github.com/ktauchert/triage-ops/blob/main/docs/on-prem-product.md) |
| Production acceptance test checklist | [e2e-acceptance-test.md](https://github.com/ktauchert/triage-ops/blob/main/docs/e2e-acceptance-test.md) |
| Legal (EULA, privacy, disclaimers) | [legal.md](https://github.com/ktauchert/triage-ops/blob/main/docs/legal.md) |

## Bundle contents

```
triage-ops-install-x.y.z/
├── docker-compose.prod.yml   # pinned image tags for this release
├── .env.example
├── install.md                # this file
├── LICENSE.txt               # proprietary summary (see EULA.md)
├── EULA.md                   # End User License Agreement
└── PRIVACY.md                # Privacy Policy
```

No source code, Node.js, or `npm install` is required on the install host.
