# Gridnull — Landing page content (marketing copy)

Last updated: June 2026

**Purpose:** Source copy for the public marketing site (`apps/site`). An implementing agent should use this file together with [landing-page-plan.md](./landing-page-plan.md) and [landing-page-agent-prompt.md](./landing-page-agent-prompt.md).

**Owner placeholders** — replace before launch:

| Placeholder | Example |
|-------------|---------|
| `{{CONTACT_EMAIL}}` | `hello@yourdomain.com` |
| `{{SITE_URL}}` | `https://triageops.io` |
| `{{GITHUB_ORG}}` | `ktauchert` |
| `{{COMPANY_NAME}}` | Your legal name or trade name |
| `{{YEAR}}` | `2026` |

---

## Brand

| Field | Value |
|-------|-------|
| **Product name** | Gridnull |
| **Category** | On-prem issue triage & ops dashboard |
| **One-liner** | See your triage debt. Fix it on your network. |
| **Elevator pitch** | Gridnull syncs GitHub and GitLab issues into your infrastructure, surfaces stale tickets, stuck issues, and milestone decay, and optionally runs **local AI** (Ollama) to suggest duplicates and description improvements — with human-approved write-back to your repos. |
| **Tone** | Professional ops tool first. Dark UI, subtle cyan accents. Confident, not hypey. No “revolutionary AI” fluff. |

### Tagline options (pick one for hero)

1. **Recommended:** *Triage debt, inside your network.*
2. *Issue triage metrics and local AI — on infrastructure you control.*
3. *Sync. Measure. Suggest. You approve every change.*

### Trust strip (below hero)

Short pills / badges:

- **On-prem** — Docker Compose install, your Postgres & Redis
- **No cloud AI** — Ollama runs locally; issue text stays on your network
- **GitHub + GitLab** — OAuth login, PAT-based sync
- **Human in the loop** — Apply only when your team confirms
- **Invite-only** — Closed registration after setup

---

## Home page (`/`)

### Hero

**Headline:** Triage debt, inside your network.

**Subheadline:** Gridnull connects to GitHub or GitLab, syncs issue metadata to Postgres, and gives your team stale/stuck metrics plus optional **local LLM suggestions** — without sending repo data to a vendor cloud.

**Primary CTA:** Request a pilot → `/contact`

**Secondary CTA:** View documentation → `/docs`

**Tertiary link:** See how it works → `/features`

### Problem (3 columns)

| Column | Title | Body |
|--------|-------|------|
| 1 | Backlogs hide real risk | Open issues pile up. Stale tickets and decaying milestones are hard to see in the board view alone. |
| 2 | Triage is manual and repetitive | Duplicate issues, empty descriptions, and stuck tickets eat lead time every sprint. |
| 3 | Cloud AI is a hard sell | Security and platform teams often block tools that send issue text to external APIs. |

### Solution (3 pillars)

| Pillar | Title | Body |
|--------|-------|------|
| **Sync** | Unified issue mirror | Pull issues, labels, and milestones from GitHub or GitLab into Postgres on a schedule or on demand. |
| **Measure** | Triage metrics that matter | Stale issues, stuck issues, milestone decay — configurable thresholds per project. |
| **Assist** | Local AI, your approval | Ollama suggests duplicates and description drafts. **Apply** updates VCS only when a human confirms. |

### How it works (4 steps)

1. **Install** — Pull pre-built images, configure `.env`, run migrations (`install` bundle, no git clone).
2. **Bootstrap** — First OAuth sign-in creates the admin; invite teammates with roles.
3. **Connect** — Add a GitHub/GitLab connection and register projects to sync.
4. **Triage** — Review metrics, run analysis, dismiss or apply suggestions.

### Social proof placeholder

> *Pilot customers: add quotes here after first deployments.*

Until then, use a neutral line:

> Built for platform and engineering teams who need triage visibility without surrendering issue data to SaaS AI.

### Home CTA band

**Headline:** Ready to see your triage debt?

**Body:** Request a pilot for SME teams. Install bundle, OAuth, and local Ollama — we help you validate on your network.

**Button:** Contact us → `/contact`

---

## Features page (`/features`)

### Page intro

**Title:** Features

**Subtitle:** Everything in the current product — sync, metrics, local LLM, write-back, and team governance.

> **Note for agent:** Do not list unshipped features as available. Edition gating is **not** in code yet; editions page describes **direction**, current pilots get full product.

### Feature sections

#### Issue sync

- GitHub and GitLab API clients with pagination and retries
- Manual sync per project; optional auto-sync scheduler
- Issues, labels, milestones mirrored to Postgres
- Sync run history and failure visibility in admin

#### Triage metrics

- **Stale issues** — open too long without meaningful activity
- **Stuck issues** — stale but still open
- **Milestone decay** — milestones at risk as dates slip
- Per-project thresholds; dashboard home and project workspace

#### Local LLM analysis

- Ollama integration (`llama3.2:3b` chat, `nomic-embed-text` embeddings)
- Duplicate detection via embedding similarity
- Description drafting for thin issues
- Progress polling; clear analysis and re-run

#### Write-back (human approved)

- Apply description suggestions to GitHub/GitLab
- Duplicate flow: comment, close higher IID, update local state
- Failed apply surfaces `APPLY_FAILED` with error message; retry supported

**Disclaimer (show on this section):**

> AI suggestions can be wrong. Applying changes issues on your connected repositories using your credentials. Review every suggestion before applying. You are responsible for applied changes.

#### Security & governance

- Auth.js OAuth (GitHub / GitLab)
- Instance bootstrap (`/setup`) and closed registration (invite before login)
- RBAC: Admin, Lead, Operator, Viewer
- Admin console: users, audit log, background jobs
- PAT encryption at rest (`TOKEN_ENCRYPTION_KEY`)
- API rate limiting (Redis-backed)
- Production startup guards for secrets and allowlist

#### Deployment

- Customer install bundle: `docker-compose.prod.yml` + `.env.example` + docs
- Pre-built images (GHCR); no source required on install host
- Postgres, Redis, Ollama — standard Compose stack

---

## Security page (`/security`)

### Page intro

**Title:** Security

**Subtitle:** On-prem by design. Your tokens, your network, your audit trail.

### Summary bullets (reviewer-friendly)

| Question | Answer |
|----------|--------|
| Where does data live? | Postgres on infrastructure **you** operate. Issue metadata synced from VCS; PATs encrypted when `TOKEN_ENCRYPTION_KEY` is set. |
| Does issue text go to vendor AI? | **No.** LLM analysis uses **local Ollama** on your network. Workers read Postgres only for analysis jobs. |
| How do users sign in? | GitHub/GitLab OAuth. Production requires email allowlist or pre-provisioned invites. |
| Who can access the app? | Closed registration after setup — admins invite emails + roles before first login. |
| How are VCS tokens stored? | AES-256-GCM when encryption key configured; fail-fast in production if missing. |
| Internet exposure? | You control network placement. Bundle does not expose Postgres/Redis on host ports. HTTPS via your reverse proxy. |
| Rate limiting? | Redis-backed limits on API routes; configurable per tier. |

### Top reviewer FAQ (short answers)

1. **Is this multi-tenant SaaS?** No — single-tenant instance per install.
2. **Can any GitHub user sign in?** Not in production — allowlist + invite model.
3. **What scopes for PATs?** Read for sync; write scopes only if you enable write-back apply.
4. **SSO / SAML?** OAuth via GitHub/GitLab today; direct enterprise SSO is roadmap, not v1.
5. **Audit trail?** Admin audit log for admin actions, sync, analyze, apply, invites.

**Link:** Full security documentation → `/docs/security`

---

## Editions page (`/editions`)

### Page intro

**Title:** Editions

**Subtitle:** Community for visibility. Pro for automation and teams. *(Packaging direction — license gating ships later.)*

**Honesty banner (required on page):**

> Today, pilot installs include the full product. The CE / Pro split below is our **planned packaging** — not enforced in the app yet.

### Edition cards

#### Community (planned)

**Tagline:** See your triage debt.

**Includes (planned):**

- Full sync + triage metrics
- Limited connections / projects (see matrix)
- Manual sync
- Dashboard UI

**Price:** Free self-host (target)

**CTA:** Download from GitHub Releases *(when public)* or Request pilot → `/contact`

#### Pro (planned)

**Tagline:** Automate triage with local AI and operate as a team.

**Includes (planned):**

- LLM analysis + suggestions
- Write-back apply to VCS
- RBAC + admin + audit
- Auto-sync scheduler
- Unlimited connections / projects

**Price:** Contact for pricing *(or “from €X / instance / year” when owner decides)*

**CTA:** Request pilot → `/contact`

### Comparison table (abbreviated from editions.md)

| Capability | Community (planned) | Pro (planned) |
|------------|-------------------|---------------|
| GitHub + GitLab sync | ✓ (limits) | ✓ |
| Triage metrics | ✓ | ✓ |
| Manual sync | ✓ | ✓ |
| LLM suggestions | — | ✓ |
| Apply to VCS | — | ✓ |
| RBAC + admin | — | ✓ |
| Auto-sync | — | ✓ |
| Audit log | — | ✓ |

---

## Contact page (`/contact`)

### Page intro

**Title:** Request a pilot

**Subtitle:** Gridnull is currently offered to **small and medium organizations** for evaluation and production use on your infrastructure.

### Eligibility note

Eligible organizations: fewer than **250 employees** and annual turnover below **EUR 50 million**, unless otherwise agreed in writing.

### Form fields (if using a form)

- Name
- Work email
- Company
- Approx. team size
- Primary VCS (GitHub / GitLab / both)
- Message (optional)
- Checkbox: “I agree to be contacted about Gridnull and have read the [Privacy Policy](/legal/privacy).”

### Without backend (Phase A default)

**mailto block:**

- Email: `{{CONTACT_EMAIL}}`
- Subject: `Gridnull pilot request`

**Body template:**

```
Company:
Team size:
VCS (GitHub/GitLab):
What we want to triage:
```

---

## Documentation preview (`/docs` — Phase B)

### Docs home intro

**Title:** Documentation

**Subtitle:** Install, secure, and operate Gridnull on your network.

### Doc cards

| Card | Slug | Description |
|------|------|-------------|
| Install guide | `/docs/install` | Bundle install, OAuth, Ollama models |
| Security | `/docs/security` | Hardening, PATs, rate limits |
| Architecture | `/docs/architecture` | Workers, queues, data flow |
| On-prem model | `/docs/on-prem` | Bootstrap, closed registration |
| Legal | `/legal/eula` | EULA and privacy (also `/legal/privacy`) |

---

## Footer (all marketing pages)

### Columns

**Product**

- Features → `/features`
- Editions → `/editions`
- Documentation → `/docs`
- Contact → `/contact`

**Legal**

- EULA → `/legal/eula`
- Privacy → `/legal/privacy`
- Impressum → `/legal/impressum`

**Resources**

- GitHub Releases → `https://github.com/{{GITHUB_ORG}}/gridnull/releases` *(install ZIP)*
- Security (full doc) → `/docs/security`

### Footer legal line

© {{YEAR}} {{COMPANY_NAME}}. Gridnull is proprietary software. Use subject to the [EULA](/legal/eula). AI suggestions are recommendations only; you are responsible for changes applied to your repositories.

### Impressum (EU / Germany — required)

Link the footer **Impressum** → `/legal/impressum`. Full text lives in `apps/web/public/legal/impressum.md` (§ 5 DDG). Current responsible party:

> Karsten Tauchert · c/o Block Services, Stuttgarter Str. 106, 70736 Fellbach, Germany · developer@ktauchert.de

---

## SEO metadata

| Route | Title | Description |
|-------|-------|-------------|
| `/` | Gridnull — On-prem issue triage & local AI | Sync GitHub/GitLab issues, measure triage debt, optional local LLM suggestions. On infrastructure you control. |
| `/features` | Features — Gridnull | Sync, metrics, Ollama analysis, human-approved write-back, RBAC. |
| `/security` | Security — Gridnull | On-prem deployment, local inference, OAuth, encrypted PATs, closed registration. |
| `/editions` | Editions — Gridnull | Community vs Pro packaging (direction). Request a pilot. |
| `/contact` | Contact — Gridnull | Request a pilot for SME teams. |
| `/docs` | Documentation — Gridnull | Install and operate Gridnull on your network. |
| `/legal/eula` | EULA — Gridnull | End User License Agreement. |
| `/legal/privacy` | Privacy — Gridnull | Privacy Policy. |

**Open Graph:** `og:site_name` = Gridnull; use dark branded `og-default.png` per landing-page-plan.

---

## Legal pages on marketing site

Render full text from:

- `install/EULA.md` → `/legal/eula`
- `install/PRIVACY.md` → `/legal/privacy`

Use the same markdown renderer as docs. Internal links in bundle files use relative paths — rewrite to `/legal/privacy` etc. on the site.

Key marketing-safe summaries (footer / editions):

- Proprietary — no copying or redistribution without permission
- SME eligibility for current pilot program
- No warranty; liability limited per EULA
- On-prem: customer typically data controller

See [legal.md](./legal.md) for full guidance.

---

## What NOT to claim

- ❌ “SOC 2 certified” (unless you are)
- ❌ “Enterprise SSO included” (not shipped)
- ❌ “Fully automated triage” (human approves apply)
- ❌ “CE/Pro enforced today” (edition gating not in code)
- ❌ Sending data to “Gridnull cloud” (product is on-prem)
- ❌ Helm / Kubernetes install (not shipped)

---

## Screenshots & assets (placeholders until owner provides)

| Asset | Usage | Placeholder |
|-------|-------|-------------|
| Dashboard home | Hero / features | Dark frame + “Screenshot coming soon” |
| Project metrics | Features | Same |
| Suggestions panel | Features / write-back section | Same |
| Architecture diagram | Home / features | Simple SVG: Web → Postgres ← Worker → Ollama; Worker → GitHub/GitLab |

---

## Related repo documents

| Document | Use on site |
|----------|-------------|
| [landing-page-plan.md](./landing-page-plan.md) | Tech stack, design tokens, folder structure, phases |
| [legal.md](./legal.md) | Legal footer, EULA/privacy sync |
| [install/install.md](../install/install.md) | Install doc (Phase B) |
| [security.md](./security.md) | Security doc (Phase B) |
| [architecture.md](./architecture.md) | Architecture doc (Phase B) |
| [editions.md](./editions.md) | Full CE/Pro matrix |
| [on-prem-product.md](./on-prem-product.md) | Bootstrap flow |
