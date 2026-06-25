# Completion Roadmap — Final Steps to v1.0

Last updated: June 2026

This document is the **master checklist** for taking TriageOps from a working hobby project to a **complete on-prem product** — safe for security-conscious firms, installable without source access, and operable with full governance.

Use it as the day-to-day todo list. Check items off as they ship. For phase-level detail and effort estimates, see [Implementation Phases](./phases.md). For pilot vs customer gates, see [Production Readiness](./production-readiness.md).

**Related:** [Security](./security.md) · [On-Prem Product Model](./on-prem-product.md) · [Intranet Rollout](./intranet-rollout.md)

---

## Vision

TriageOps runs **entirely inside the customer network**:

- Syncs only to **their** GitHub or GitLab (no third-party SaaS)
- Runs LLM on **local Ollama** (issue text never sent to cloud AI)
- Stores PATs in **their Postgres** (encrypted at rest)
- Closed registration, RBAC, audit trail, change log, rollback

**“Complete”** means finishing all open items in Phases 3–4 plus product distribution — not stopping at “good enough for a friendly pilot.”

---

## Progress at a glance

| Area | Progress | Notes |
|------|----------|-------|
| Phases 0–2.5 (core product) | ✅ 100% | Sync, metrics, LLM, write-back |
| Phase 3a (security) | ✅ ~95% | Encryption ✅ · rate limits ✅ · docs ✅ · SSO deferred |
| Phase 3b (automation) | ~70% | Auto-sync ✅ · webhooks ❌ |
| Phase 3c (distribution / scale) | ~20% | Dockerfiles ✅ · images/bundle/Helm ❌ |
| Phase 4 (governance) | ~55% | RBAC, bootstrap, admin, audit partial |
| Phase 15–17 (change log, reporting, rollback) | 0% | Not started |

**Target release:** tag **`v1.0.0`** after Workstreams 1–5 (Blocks A–F below). Workstream 6 (enterprise tier) → **`v1.x`**.

---

## Definition of done — v1.0 shippable

All must be checked before calling the product complete for on-prem SME customers:

- [ ] [Security](./security.md) checklist signed off (HTTPS, secrets, network, rate limits)
- [ ] Gate B distribution pipeline works end-to-end (install bundle, no monorepo)
- [ ] [Intranet Rollout](./intranet-rollout.md) completed on a **clean VM from install bundle only**
- [ ] Bootstrap + invite flow tested with a second real user
- [ ] Sync + analyze + apply tested against GitHub and GitLab
- [ ] Backup/restore tested once
- [ ] Upgrade tested once (pull newer tag → migrate → restart)
- [ ] Admin can operate instance without SSH (users, jobs, auth, audit in UI)
- [ ] Change log + CSV export available
- [ ] Description rollback works; duplicate rollback documented (partial)
- [ ] Support runbook: logs, common failures, contact path

---

## Workstream 1 — Security hardening (Phase 3a)

**Goal:** Everything else deploys under this security bar.

**Gate:** [security.md](./security.md) checklist fully signed off — **code shipped June 2026**; ops sign-off still open.

### Tasks

- [x] API rate limiting middleware on `/api/*` (~2–3 days)
- [x] Production `.env` template — secrets called out, no dev defaults (~0.5 day)
- [x] Document PAT scope requirements for GitHub and GitLab reviewers (~0.5 day)
- [x] Verify `AUTH_DISABLED` blocked at startup when `NODE_ENV=production`
- [x] Verify empty allowlist denies sign-in after setup (document behavior)
- [x] Document air-gapped / self-hosted GitLab path (OAuth stays on customer network)

### Deferred (enterprise only)

- [ ] Direct SAML/OIDC SSO (~1–2 weeks) — only if GitHub/GitLab OAuth upstream is insufficient

---

## Workstream 2 — Admin & RBAC polish (Phase 4, Steps 12–14)

**Goal:** Operators run the instance from the admin UI — no SSH required.

**Gate:** Admin can provision users, inspect health, and review audit without shell access.

### Tasks

- [ ] Admin: connections overview (PAT metadata only — never show tokens)
- [ ] Admin: auth status (providers, allowlist summary, setup state, active session count)
- [ ] Admin: background jobs panel (recent sync / LLM / write-back runs + failures)
- [ ] Admin: invite user form polish (email + role for closed registration)
- [ ] `appliedByUserId` on `IssueSuggestion` (link write-back to actor)
- [ ] Audit log covers all new admin actions

### Optional (larger orgs)

- [ ] `ProjectMembership` model (user ↔ project + role override)

---

## Workstream 3 — Product distribution (Phase 3c core)

**Goal:** Other firms install from a bundle — never clone the monorepo.

**Gate:** [Production Readiness Gate B](./production-readiness.md#gate-b--external-customer-no-source-access) — hand customer ZIP + registry token.

### Tasks

- [ ] Add `docker-compose.prod.yml` at repo root (`image:` pins only, no `build:`)
- [ ] Pin image names/tags (`ghcr.io/<org>/triage-ops-web`, `…-worker`)
- [ ] CI job: on tag `v*`, build + push both images
- [ ] Create `install/` template folder for release ZIP
- [ ] GitHub Release workflow: attach install bundle
- [ ] Document registry access (per-customer read token or org token)
- [ ] Dry-run install on clean VM from bundle **without** monorepo
- [ ] Update [intranet-rollout.md](./intranet-rollout.md) — product path is primary
- [ ] Document customer upgrade path: `pull` → `migrate` → `up -d`

### Target install bundle layout

```
triage-ops-install-1.0.0/
├── docker-compose.prod.yml
├── .env.example
├── install.md
└── LICENSE.txt
```

---

## Workstream 4 — Sync automation (Phase 3b finish)

**Goal:** Hands-off operation; near-real-time sync when needed.

**Gate:** Issue change in VCS → dashboard reflects it without manual sync (within webhook latency).

### Tasks

- [ ] Webhook endpoint(s) for GitHub issue events → enqueue sync
- [ ] Webhook endpoint(s) for GitLab issue events → enqueue sync
- [ ] Signature verification (GitHub HMAC, GitLab token)
- [ ] Document: webhooks vs auto-sync vs manual sync — when to use each
- [ ] Tests for webhook handlers (MSW or fixture payloads)

---

## Workstream 5 — Governance depth (Phase 15–17)

**Goal:** Audit/compliance-ready — who changed what, campaign impact, undo mistakes.

**Gate:** A Lead can answer “who changed what, when, and can we undo it?”

### Step 15 — Change log

- [ ] Unified **changes** view: all applied suggestions with issue IIDs, VCS links, actor, timestamp
- [ ] Filters: project, type (DESCRIPTION / DUPLICATE), user, date range
- [ ] CSV export for compliance / handover
- [ ] API route(s) for change log data

### Step 16 — Impact reporting

- [ ] Periodic **metric snapshots** per project (ghost, zombie, milestone decay, open count)
- [ ] Dashboard timeline: “since campaign start” — issues touched, duplicates closed, descriptions added
- [ ] Delta vs baseline for management reporting
- [ ] Optional: snapshot scheduler or manual “capture baseline” action

### Step 17 — Rollback

- [ ] Store **previous state** before apply (`previousDescription`, duplicate close metadata)
- [ ] **DESCRIPTION revert:** worker job restores prior body on VCS + local `Issue`
- [ ] **DUPLICATE revert (partial):** reopen issue via VCS API; document manual comment cleanup
- [ ] UI: “Revert” on eligible change-log entries (permission: Lead or Admin)
- [ ] Optional queue: `vcs-rollback` (same lock conventions as write-back)
- [ ] Tests for rollback worker + API

---

## Workstream 6 — Enterprise scale (Phase 3c optional → v1.x)

**Goal:** Strict enterprise customers (K8s, multi-team, commercial tier).

**Gate:** Customer on K8s or air-gapped network can deploy with documented runbooks.

### Tasks

- [ ] Helm chart (~1–2 weeks)
- [ ] Postgres backup + restore procedure (documented + tested)
- [ ] Log retention / disk monitoring for Ollama + Postgres
- [ ] Multi-tenant orgs/teams (~2–4 weeks) — if one instance serves many departments
- [ ] License / edition gating — only if commercial Pro SKU ships ([editions.md](./editions.md))

---

## Recommended build order

Work top to bottom. Each block has a clear ship gate before moving on.

| Block | Workstreams | Est. effort | Ship gate |
|-------|-------------|-------------|-----------|
| **A** | 1 ✅ + 2 | ~2 weeks | Security signed off; admin UI operable |
| **B** | 3 | ~1 week | Clean-VM install from bundle |
| **C** | 4 + ops runbooks | ~1 week | Webhooks + backup/upgrade docs tested |
| **D** | 5 (Step 15) | ~1 week | Change log + CSV export |
| **E** | 5 (Step 16) | ~1–2 weeks | Impact timeline on dashboard |
| **F** | 5 (Step 17) | ~1–2 weeks | Description rollback works |
| **G** | 6 | ~3–5 weeks | Helm / enterprise extras |

**Tag `v1.0.0` after Block F.** Block G is post-v1 unless a customer requires K8s earlier.

### Next up (Block A continued)

Workstream 1 is **done**. Continue Block A with Workstream 2:

1. Admin job overview + auth status (Workstream 2)
2. Admin connections overview + invite polish (Workstream 2)
3. `docker-compose.prod.yml` + CI image publish (Workstream 3 — Block B)

Then run a clean-VM dry-run from the install bundle.

---

## Security story (reviewer FAQ)

When pitching to security teams, the **completed** product demonstrates:

| Claim | How |
|-------|-----|
| No cloud AI | Ollama on customer metal; LLM worker reads Postgres only |
| No telemetry | No analytics SaaS, no phone-home |
| Closed by default | Setup wizard, invite-only registration, RBAC on every API action |
| Encrypted secrets | PATs sealed at rest (`TOKEN_ENCRYPTION_KEY`); tokens never shown in UI |
| Accountable write-back | Audit log + change log + description rollback |
| Install without source | Pre-built images, documented upgrade path, ops runbooks |

**Note:** OAuth to GitHub/GitLab requires reachability to the customer’s VCS (or self-hosted GitLab entirely on their network). Document this in [security.md](./security.md).

---

## Pre-ship smoke checklist (~30 min)

Run before tagging `v1.0.0`:

```bash
# From install bundle on test VM (not monorepo)
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
docker compose -f docker-compose.prod.yml --profile production up -d

# Auth
# - AUTH_DISABLED must be false
# - /setup works on fresh DB
# - Unknown email rejected after setup
# - Invited user can sign in

# Functional
# - Add connection (GitHub or GitLab PAT)
# - Register project → sync → metrics visible
# - Run analysis → suggestion → apply → verify on VCS
# - Change log shows apply; revert description if enabled

# Ops
# - Backup Postgres volume → restore on second VM
# - Pull newer image tag → migrate → restart
```

---

## Tracking notes

| Date | Block | Notes |
|------|-------|-------|
| 2026-06-25 | WS 1 | Shipped: API rate limits, `.env.production.example`, security/intranet/running-the-app docs, allowlist startup warning |
| | | |
| | | |

_Add rows as blocks complete._

---

## Quick links

| Doc | Use when |
|-----|----------|
| [phases.md](./phases.md) | Full phase checklist with historical trace |
| [production-readiness.md](./production-readiness.md) | Gate A / Gate B criteria |
| [intranet-rollout.md](./intranet-rollout.md) | Installing on a company network |
| [on-prem-product.md](./on-prem-product.md) | Bootstrap + distribution decisions |
| [security.md](./security.md) | Hardening + reviewer FAQ |
| [current-state.md](./current-state.md) | What exists today (update when shipping) |
