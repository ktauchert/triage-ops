# TriageOps — Product install guide

Install TriageOps on a server **without** cloning the source repository. You receive pre-built container images from a private registry and this install bundle.

## Prerequisites

- Linux host with Docker Engine and Docker Compose v2
- Minimum 4 GB RAM (more if using large Ollama models)
- HTTPS reverse proxy in front of the web service (recommended)
- GitHub or GitLab OAuth application credentials
- Registry read token from your vendor (see [Registry access](#registry-access))

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
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` — required for VCS PAT encryption |
| `AUTH_URL` | Public HTTPS URL users open in the browser |
| `AUTH_*` OAuth | Client ID/secret from GitHub or GitLab |
| `ALLOWED_EMAIL_DOMAINS` or `ALLOWED_EMAILS` | Closed registration after setup |

Do **not** set `AUTH_DISABLED=true` in production.

## 3. First install

From the directory containing `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d postgres redis ollama
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
docker compose -f docker-compose.prod.yml --profile production up -d
```

Postgres, Redis, and Ollama are **not** exposed on host ports. Only the web service listens on `:3000` for your reverse proxy.

### Ollama models

Before running LLM analysis, pull models into the Ollama container:

```bash
docker exec triage-ops-ollama ollama pull llama3.2:3b
docker exec triage-ops-ollama ollama pull nomic-embed-text
```

Adjust model names if you changed `OLLAMA_CHAT_MODEL` / `OLLAMA_EMBED_MODEL` in `.env`.

## 4. Complete setup

1. Configure your reverse proxy to forward HTTPS to `http://127.0.0.1:3000`.
2. Open your public URL in a browser.
3. Visit `/setup` and sign in with GitHub or GitLab — the first successful login becomes the instance admin.
4. In **Admin → Users**, invite additional users before they sign in.

## 5. Upgrades

When your vendor releases a new version:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
docker compose -f docker-compose.prod.yml --profile production up -d
```

Replace `docker-compose.prod.yml` and `.env.example` from the new install bundle if image tags changed. Your `.env` secrets are preserved.

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

```bash
# Service status
docker compose -f docker-compose.prod.yml ps

# Logs
docker compose -f docker-compose.prod.yml logs -f web worker

# Re-run migrations after failed upgrade
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
```

## Bundle contents

```
triage-ops-install-x.y.z/
├── docker-compose.prod.yml   # pinned image tags for this release
├── .env.example
├── install.md                # this file
└── LICENSE.txt
```

No source code, Node.js, or `npm install` is required on the install host.
