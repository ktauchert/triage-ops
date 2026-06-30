# Gridnull — End-to-End Acceptance Test (Production Install)

A **manual, follow-along acceptance test** for a real production deployment, performed the way an end-user/customer installs and operates Gridnull: pre-built images from the registry + the install bundle (no `git clone`, no `npm`). Work top to bottom and tick each checkbox.

- **Goal:** prove the shipped product installs, secures itself, and performs the full triage workflow (connect → sync → analyze → apply) on a clean host.
- **Audience:** you (vendor) doing a release dry-run, or a customer doing install acceptance.
- **Time budget:** ~60–90 min (model pulls dominate).

> This guide intentionally covers **flows and integration points**, not unit-level behavior. The items in [Already covered by automated tests](#already-covered-by-automated-tests) are verified by ~320+ Vitest cases and are **not** re-tested by hand here.

---

## How to use this document

Each test has: **Goal**, **Steps**, **Expected**, and a result box. Mark one:

- `[ ]` not run · `[x]` pass · `[!]` fail (write the symptom next to it)

Record overall status in the [Sign-off](#sign-off) table at the end. If a step fails, capture logs immediately:

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 web worker postgres redis
```

---

## Already covered by automated tests

Don't hand-test these — they are green in `npm test` (db 7, metrics 17, worker 100+, web 190+, e2e 3):

- Triage metric math, label/threshold logic (`packages/metrics`).
- VCS/Ollama API client request shaping, error mapping, pagination (MSW).
- HTTP resilience: timeout abort, 429/5xx backoff, retry-then-success (`lib/http.test.ts`).
- Redis lock acquire/release/renew + heartbeat (`lib/lock.test.ts`).
- Sync-run recovery, write-back retry semantics, duplicate-close idempotency (worker tests).
- Auth session 401 on deactivated/deleted user; bootstrap race + allowlist; secret fail-fast (`session.test.ts`, `setup.test.ts`, `environment.test.ts`, `token-crypto.test.ts`).
- RBAC permission matrix and admin API route guards.

This document tests that those behaviors **hold together** against real Postgres/Redis/Ollama and a real GitHub/GitLab account.

---

## Test environment & accounts

Prepare before the weekend so you're not blocked:

- [ ] A clean Linux host (or VM) with Docker Engine + Compose v2, ≥ 4 GB RAM, internet egress to the registry and to GitHub/GitLab.
- [ ] The **install bundle** for the release under test: `docker-compose.prod.yml`, `.env.example`, `install.md`, `LICENSE.txt`.
- [ ] A **registry read token** and successful `docker login`.
- [ ] An **OAuth app** (GitHub and/or GitLab) with the callback URL set to `${AUTH_URL}/api/auth/callback/<provider>`.
- [ ] A **test repository/project** with a realistic mix of issues — include at least:
  - 2 near-duplicate open issues (similar titles/bodies) for duplicate detection,
  - 1 open issue with an empty/very short description for description drafting,
  - a few open and a few closed issues so metrics are non-trivial.
- [ ] A **GitHub PAT** (`repo` scope) and/or **GitLab PAT** (`read_api`, plus `api` if you will test write-back) that can read/write the test repo.
- [ ] **Three email identities** mapped to your allowlisted domain to exercise roles: a future admin, a regular member, and one to deactivate.

Fill in once and reuse:

| Placeholder | Value |
|---|---|
| Public URL (`AUTH_URL`) | `https://__________` |
| Host shell user | `__________` |
| Test repo / project | `__________` |
| Admin identity | `__________` |
| Member identity | `__________` |
| Throwaway identity | `__________` |

---

## Phase 0 — Pre-flight: secrets & fail-fast guards

### 0.1 Bundle integrity
- **Goal:** the bundle is self-contained.
- **Steps:** `ls` the bundle; confirm `docker-compose.prod.yml`, `.env.example`, `install.md`, `LICENSE.txt` are present and there is **no** source tree.
- **Expected:** only the four files; image references point at the registry/version you expect.
- Result: `[ ]`

### 0.2 Configure `.env`
- **Goal:** a complete production config.
- **Steps:** `cp .env.example .env` and replace every `<placeholder>`. Generate secrets with `openssl rand -base64 32` for **both** `AUTH_SECRET` and `TOKEN_ENCRYPTION_KEY`. Set `AUTH_URL`, OAuth client id/secret, and **at least one** of `ALLOWED_EMAIL_DOMAINS` / `ALLOWED_EMAILS`. Keep `AUTH_DISABLED=false`.
- **Expected:** no `<...>` placeholders remain (`grep '<' .env` returns nothing).
- Result: `[ ]`

### 0.3 Negative: missing encryption key fails fast
- **Goal:** prove the app refuses to run insecurely in production (fix H5).
- **Steps:** temporarily comment out `TOKEN_ENCRYPTION_KEY` in `.env`, then `docker compose -f docker-compose.prod.yml --profile production up web`. Observe logs. Restore the key afterward.
- **Expected:** the **web** container exits/crashes on startup with a clear error mentioning `TOKEN_ENCRYPTION_KEY` — it does **not** silently start.
- Result: `[ ]`

### 0.4 Negative: weak/missing `AUTH_SECRET` fails fast
- **Goal:** prove auth secret is validated (fix M5).
- **Steps:** temporarily set `AUTH_SECRET=short`, start `web`, observe, then restore.
- **Expected:** startup fails with an `AUTH_SECRET`-related error.
- Result: `[ ]`

### 0.5 Negative: `AUTH_DISABLED=true` is rejected in production
- **Goal:** no accidental auth bypass.
- **Steps:** temporarily set `AUTH_DISABLED=true` (leave `ALLOW_AUTH_DISABLED` unset), start `web`, observe, then restore.
- **Expected:** startup fails with an `AUTH_DISABLED`-related error.
- Result: `[ ]`

---

## Phase 1 — Install & infrastructure

### 1.1 One-shot smoke install (optional but recommended)
- **Goal:** the documented happy path comes up cleanly.
- **Steps:** from the bundle dir run the bring-up from `install.md`:
  ```bash
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d postgres redis ollama
  docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
  docker compose -f docker-compose.prod.yml --profile production up -d
  ```
- **Expected:** images pull; migrate exits `0`; `web` and `worker` start.
- Result: `[ ]`

### 1.2 Container health
- **Goal:** everything is running/healthy.
- **Steps:** `docker compose -f docker-compose.prod.yml ps`.
- **Expected:** `gridnull-postgres` & `gridnull-redis` show **healthy**; `web` and `worker` **running**; `migrate` exited `0`.
- Result: `[ ]`

### 1.3 Network isolation
- **Goal:** only the web port is exposed.
- **Steps:** `docker compose -f docker-compose.prod.yml ps` and check published ports; from the host try to reach Postgres/Redis/Ollama directly.
- **Expected:** only `web` publishes `:3000`. Postgres (`5432`), Redis (`6379`), Ollama (`11434`) are **not** reachable from the host.
- Result: `[ ]`

### 1.4 Web reachable through the reverse proxy over HTTPS
- **Goal:** the user-facing entry point works.
- **Steps:** point your HTTPS reverse proxy at `127.0.0.1:3000`; open `${AUTH_URL}`.
- **Expected:** TLS valid; you are redirected to `/login` or `/setup`. No mixed-content/CORS errors in the browser console.
- Result: `[ ]`

### 1.5 Worker runs as non-root
- **Goal:** container hardening (fix C1).
- **Steps:** `docker exec gridnull-worker id`.
- **Expected:** `uid=1001` (user `worker`), **not** `uid=0(root)`.
- Result: `[ ]`

---

## Phase 2 — First-run bootstrap

### 2.1 Pre-setup screen
- **Goal:** the instance advertises setup.
- **Steps:** open `${AUTH_URL}/setup` in a fresh/incognito session.
- **Expected:** a setup page invites the first sign-in; the dashboard is not accessible yet.
- Result: `[ ]`

### 2.2 Negative: non-allowlisted identity cannot claim the instance
- **Goal:** pre-setup takeover is blocked when an allowlist is set (fix H4).
- **Steps:** with `ALLOWED_EMAIL_DOMAINS`/`ALLOWED_EMAILS` configured, attempt `/setup` sign-in using the **throwaway** identity (outside the allowlist).
- **Expected:** sign-in is **denied**; no admin is created; the instance is still unclaimed.
- Result: `[ ]`

### 2.3 First admin bootstrap
- **Goal:** the first allowlisted login becomes the single instance admin (fix H3).
- **Steps:** sign in at `/setup` with the **admin** identity via OAuth.
- **Expected:** you land in the dashboard as **ADMIN**; setup is now complete; `/setup` no longer bootstraps new admins.
- Result: `[ ]`

### 2.4 Bootstrap window is closed afterwards
- **Goal:** later logins are not auto-promoted.
- **Steps:** sign in with the **member** identity (allowlisted) without an invite, if your policy allows self-join; otherwise confirm it's blocked.
- **Expected:** the member is **not** ADMIN (VIEWER or blocked per your registration policy). Exactly one admin exists.
- Result: `[ ]`

---

## Phase 3 — Authentication & RBAC

### 3.1 Invite a user
- **Goal:** closed registration via invites works.
- **Steps:** as admin, **Admin → Users → Invite users**; invite the **member** identity with role e.g. OPERATOR.
- **Expected:** a pending invite appears; on the member's next sign-in they get the assigned role.
- Result: `[ ]`

### 3.2 Role enforcement (RBAC)
- **Goal:** roles gate mutating actions.
- **Steps:** sign in as the member (non-admin) in a separate browser. Try to reach `/admin/users` and attempt a privileged action.
- **Expected:** admin pages/actions are hidden or rejected (403); read-only views still work per role.
- Result: `[ ]`

### 3.3 Deactivation takes effect immediately
- **Goal:** deactivated users lose access without waiting for token expiry (fix H1).
- **Steps:** with the member **signed in and active**, as admin open **Admin → Users** and **deactivate** that member. Back in the member's session, navigate to any page or trigger an API call (e.g. refresh a project).
- **Expected:** the member is now rejected with **401/redirect to login** on the next request — not allowed to continue, and **not** silently downgraded.
- Result: `[ ]`

### 3.4 Reactivation restores access
- **Steps:** reactivate the member; have them sign in again.
- **Expected:** access restored with the prior role.
- Result: `[ ]`

### 3.5 Audit trail
- **Goal:** sensitive actions are recorded.
- **Steps:** as admin open **Admin → Audit**; filter to recent events.
- **Expected:** invite, role change, deactivation/reactivation, and setup-complete events are present with actor + timestamp.
- Result: `[ ]`

---

## Phase 4 — VCS connections & token encryption

### 4.1 Add a connection
- **Goal:** connect a VCS with a PAT.
- **Steps:** **Connections → Add connection**. Choose provider, name it, (GitLab: set Base URL), paste the PAT, **Save connection**.
- **Expected:** the connection is saved and listed; the token is never echoed back in the UI.
- Result: `[ ]`

### 4.2 PAT is encrypted at rest (fix verified end-to-end)
- **Goal:** stored tokens are ciphertext, not plaintext.
- **Steps:**
  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c 'SELECT name, left("accessToken", 12) AS token_prefix, "accessToken" LIKE '"'"'enc:v1:%'"'"' AS encrypted FROM vcs_connections;'
  ```
- **Expected:** `encrypted = t` for every row and `token_prefix` starts with `enc:v1:` — the raw `ghp_`/`glpat-` value is **not** in the database.
- Result: `[ ]`

### 4.3 Browse remote projects
- **Goal:** the PAT can list repos/projects.
- **Steps:** from the connection, list available remote projects/repositories.
- **Expected:** your test repo appears; a bad token surfaces a clear error (try a deliberately wrong PAT in a second throwaway connection, then delete it).
- Result: `[ ]`

---

## Phase 5 — Projects, sync & metrics

### 5.1 Add a project
- **Steps:** add your test repo/project from the connection.
- **Expected:** the project shows up in **Projects**.
- Result: `[ ]`

### 5.2 First sync
- **Goal:** issues/labels/milestones import.
- **Steps:** trigger a sync for the project; watch the sync run state.
- **Expected:** sync goes `RUNNING → COMPLETED`; issues, labels, and milestones appear; counts match the remote.
- Result: `[ ]`

### 5.3 Metrics render
- **Goal:** the dashboard computes triage metrics on real data.
- **Steps:** open the project dashboard.
- **Expected:** open/closed counts, age/staleness, label/threshold widgets render and look correct for the seeded data.
- Result: `[ ]`

### 5.4 Re-sync reflects changes
- **Steps:** on the remote, close one open issue and edit another's labels; re-sync.
- **Expected:** the local data and metrics update accordingly (no duplicates created).
- Result: `[ ]`

### 5.5 Concurrent sync is locked
- **Goal:** the per-project lock prevents overlap (fix B4 visible).
- **Steps:** trigger a sync and, before it finishes (use a large repo if needed), trigger another.
- **Expected:** the second attempt does not run in parallel; if it cannot acquire the lock it is reported as **FAILED with a clear message** — it is **not** left stuck in `PENDING`.
- Result: `[ ]`

---

## Phase 6 — LLM analysis (Ollama)

### 6.1 Pull models
- **Steps:**
  ```bash
  docker exec gridnull-ollama ollama pull llama3.2:3b
  docker exec gridnull-ollama ollama pull nomic-embed-text
  ```
  (match any custom `OLLAMA_CHAT_MODEL` / `OLLAMA_EMBED_MODEL`).
- **Expected:** both models download successfully.
- Result: `[ ]`

### 6.2 Run analysis with live progress
- **Steps:** on the project dashboard click **Run analysis**.
- **Expected:** the panel shows **Analyzing…** with a progress bar advancing `completedSteps / totalSteps`; stale suggestions are hidden during the run.
- Result: `[ ]`

### 6.3 Duplicate detection
- **Goal:** near-duplicates are surfaced.
- **Expected:** a **DUPLICATE** suggestion is produced for your two similar issues with a sensible canonical/duplicate pairing.
- Result: `[ ]`

### 6.4 Description drafting
- **Expected:** a **DESCRIPTION** suggestion is produced for the thin-description issue with usable drafted text.
- Result: `[ ]`

### 6.5 Token isolation (architecture guarantee)
- **Goal:** the LLM worker never receives VCS tokens.
- **Steps:** spot-check worker logs during analysis.
- **Expected:** no PATs/secrets in logs; analysis reads from Postgres only.
- Result: `[ ]`

### 6.6 Clear analysis
- **Steps:** click **Clear analysis**.
- **Expected:** suggestions and run history for the project are wiped; you can re-run cleanly.
- Result: `[ ]`

---

## Phase 7 — Apply suggestions (VCS write-back)

> Use a PAT with write scope (`api` for GitLab). Apply against the test repo only.

### 7.1 Apply a description suggestion
- **Steps:** on a DESCRIPTION suggestion click **Apply**.
- **Expected:** status goes **Applying… → applied**; the remote issue's description is updated; the local issue reflects the new body.
- Result: `[ ]`

### 7.2 Apply a duplicate-close suggestion
- **Steps:** on a DUPLICATE suggestion click **Apply**.
- **Expected:** the duplicate issue is **closed** on the remote with a linking comment, and a comment is added to the canonical issue; local state shows the duplicate as CLOSED.
- Result: `[ ]`

### 7.3 Idempotency on re-apply (fix B5)
- **Goal:** retrying an already-applied duplicate does not double-post.
- **Steps:** if the UI exposes a re-apply on the now-closed suggestion (or re-run + apply), apply the same duplicate again; also inspect the remote issue.
- **Expected:** **no duplicate comments** are added and the issue is not re-closed/re-opened — the operation is a safe no-op.
- Result: `[ ]`

### 7.4 Failure handling surfaces a clear error
- **Goal:** write-back failures are reported, not swallowed.
- **Steps:** create a suggestion whose apply will fail (e.g. revoke the PAT's write scope or point at a read-only repo), then **Apply**.
- **Expected:** status becomes **APPLY_FAILED** with a readable error message; the rest of the app stays healthy. Restoring the token and re-applying succeeds.
- Result: `[ ]`

---

## Phase 8 — Automation & limits

### 8.1 Auto-sync scheduler
- **Goal:** background per-project sync runs on schedule.
- **Steps:** with `AUTO_SYNC_SCHEDULER_ENABLED=true` and a short `AUTO_SYNC_TICK_MINUTES`, change something on the remote and wait for a tick (watch worker logs / sync-run history).
- **Expected:** a new sync run is enqueued automatically and completes.
- Result: `[ ]`

### 8.2 API rate limiting
- **Goal:** abusive request rates are throttled.
- **Steps:** as a signed-in user, hammer an expensive endpoint (e.g. rapidly click sync/analyze beyond `RATE_LIMIT_SYNC_MAX`/`RATE_LIMIT_ANALYZE_MAX`).
- **Expected:** excess requests get **429**; normal usage is unaffected; limits reset after the window.
- Result: `[ ]`

---

## Phase 9 — Resilience & operations

### 9.1 Worker restart recovery (fix B3)
- **Goal:** interrupted runs are cleaned up on startup.
- **Steps:** start a long sync **or** an analysis, then mid-run restart the worker: `docker compose -f docker-compose.prod.yml restart worker`. Watch startup logs and the run history.
- **Expected:** on boot the worker reports recovering interrupted run(s); stale `RUNNING`/`PENDING` sync runs are marked **FAILED**, stale `APPLYING` suggestions become **APPLY_FAILED**, and locks are released so new jobs work immediately. No run is stuck forever.
- Result: `[ ]`

### 9.2 Full stack restart
- **Steps:** `docker compose -f docker-compose.prod.yml --profile production restart` (or down/up).
- **Expected:** data persists (projects, issues, suggestions, users); the app returns to a working state; no re-setup required.
- Result: `[ ]`

### 9.3 Database backup
- **Goal:** the runbook backup works (install.md §6).
- **Steps:**
  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > gridnull-acceptance.dump
  ```
- **Expected:** a non-empty `.dump` file is produced without errors.
- Result: `[ ]`

### 9.4 Database restore
- **Goal:** the dump is actually restorable.
- **Steps:** make a small visible change (e.g. add a label/sync), then restore the earlier dump per install.md §6 and reload the app.
- **Expected:** state returns to the backup point; app is healthy after `--profile production up -d`.
- Result: `[ ]`

### 9.5 Upgrade then rollback (install.md §5/§7)
- **Goal:** the documented rollback path works.
- **Steps:** take a pre-upgrade backup; bump `GRIDNULL_VERSION` to a newer tag, `pull`, run `migrate`, bring up. Then follow §7 rollback: pin the previous tag, restore the pre-upgrade dump, bring up the old version.
- **Expected:** upgrade succeeds; rollback returns the instance to the previous working version with data intact and no schema mismatch errors.
- Result: `[ ]`

---

## Phase 10 — Final security pass

### 10.1 Secrets are not leaked
- **Steps:** scan `web`/`worker` logs and the rendered pages for PATs, `AUTH_SECRET`, or `TOKEN_ENCRYPTION_KEY`.
- **Expected:** none present.
- Result: `[ ]`

### 10.2 No backend ports exposed (re-confirm after upgrades)
- **Steps:** re-run the Phase 1.3 checks after the upgrade/rollback.
- **Expected:** still only `web:3000` published.
- Result: `[ ]`

### 10.3 Cookies & headers
- **Steps:** in the browser dev tools inspect the session cookie and response headers over HTTPS.
- **Expected:** session cookie is `HttpOnly` and `Secure`; auth flows stay on HTTPS.
- Result: `[ ]`

### 10.4 Unauthenticated access is blocked
- **Steps:** in a fresh incognito window hit a dashboard URL and an `/api/*` route directly.
- **Expected:** redirected to login / `401` — no data leaks without a session.
- Result: `[ ]`

---

## Teardown (optional)

```bash
# Stop everything
docker compose -f docker-compose.prod.yml --profile production down

# Full wipe INCLUDING data volumes (only for a throwaway test host)
docker compose -f docker-compose.prod.yml down -v
```

- [ ] Confirm secrets/dumps created during testing are deleted or stored securely.

---

## Sign-off

| Area | Result | Notes |
|---|---|---|
| Phase 0 — Secrets & fail-fast | `[ ]` | |
| Phase 1 — Install & infra | `[ ]` | |
| Phase 2 — Bootstrap | `[ ]` | |
| Phase 3 — Auth & RBAC | `[ ]` | |
| Phase 4 — Connections & encryption | `[ ]` | |
| Phase 5 — Sync & metrics | `[ ]` | |
| Phase 6 — LLM analysis | `[ ]` | |
| Phase 7 — Write-back | `[ ]` | |
| Phase 8 — Automation & limits | `[ ]` | |
| Phase 9 — Resilience & ops | `[ ]` | |
| Phase 10 — Security pass | `[ ]` | |

**Tester:** ______________  **Release/version:** ______________  **Date:** ______________

**Go / No-Go for end-user production use:** ______________

> Related docs: [install/install.md](../install/install.md) · [docs/security.md](security.md) · [docs/code-review-2026-06-25.md](code-review-2026-06-25.md)
