# Legal — EULA, privacy, and product disclaimers

Last updated: June 2026

This page is the **documentation mirror** of the legal texts shipped in the install bundle. Use it for the **landing page**, pilot emails, and internal reference.

> **Not legal advice.** Templates below are starting points. Have qualified counsel review before commercial reliance, especially for EU/Germany (GDPR, B2B liability).

**Canonical files (install bundle):**

| File | Purpose |
|------|---------|
| [install/EULA.md](../install/EULA.md) | End User License Agreement (bundle) |
| [install/PRIVACY.md](../install/PRIVACY.md) | Privacy Policy (bundle) |
| [install/LICENSE.txt](../install/LICENSE.txt) | Short proprietary notice (points to EULA) |
| [apps/web/public/legal/](../apps/web/public/legal/) | In-app / site copies (`eula.md`, `privacy.md`, `impressum.md`) — keep `eula.md`/`privacy.md` in sync with `install/` when updating legal text |

**In the running app:**

| URL | Content |
|-----|---------|
| `/legal/eula` | EULA (same text as bundle) |
| `/legal/privacy` | Privacy Policy |
| `/legal/impressum` | Impressum / legal notice (§ 5 DDG) — **website only**, not in install bundle |

---

## What customers accept

1. **Install bundle** — `EULA.md` and `PRIVACY.md` are included in every release ZIP.
2. **Initial setup** — first admin must check **“I agree to the EULA and Privacy Policy”** before OAuth sign-in on `/setup`.
3. **Apply actions** — UI reminds users that applying suggestions modifies their GitHub/GitLab issues under their responsibility.

---

## Landing page — suggested links

Add a footer (or legal section) with:

- **Terms / EULA** → `https://<your-site>/legal/eula` (or host static copy from `install/EULA.md`)
- **Privacy** → `https://<your-site>/legal/privacy`
- **Impressum** → `https://<your-site>/legal/impressum` (required for a German-hosted site)
- **Contact** → developer@ktauchert.de

Short tagline for the marketing site:

> TriageOps is proprietary on-prem software. Use is subject to our EULA. AI suggestions are recommendations only; you are responsible for changes applied to your repositories.

---

## Key points (plain language)

Use these on the landing page or in pilot PDFs — they reflect the full EULA:

| Topic | Summary |
|-------|---------|
| **Ownership** | TriageOps and its code remain the vendor’s property. No copying or redistribution without permission. |
| **Who may use** | Currently aimed at **SMEs** (&lt; 250 employees, &lt; EUR 50M turnover) unless a separate contract says otherwise. |
| **Your infrastructure** | You configure OAuth, secrets, backups, and who gets invited. |
| **AI & Apply** | Suggestions can be wrong. **Apply** changes real issues on GitHub/GitLab using **your** tokens — review before confirming. |
| **No warranty** | Software is provided “as is”. |
| **Liability cap** | Limited to fees paid in the last 12 months or EUR 100, whichever is greater (see EULA for full wording). |
| **Privacy** | On-prem: data stays on your systems; your org is typically the controller for employee/issue data. |

---

## Write-back disclaimer (in-app)

Shown near **Apply** in the suggestions panel:

> Applying changes issues on your connected GitHub or GitLab. Review each suggestion before applying. You are responsible for applied changes.

---

## Before first external pilot

- [x] Replace “vendor representative” / contact placeholders in EULA and Privacy — now **Karsten Tauchert, developer@ktauchert.de** (c/o Block Services, Stuttgarter Str. 106, 70736 Fellbach)
- [x] Provider/controller identity added to EULA, Privacy, and a German **Impressum** (`/legal/impressum`)
- [ ] Confirm the **Impressum** details (address, email, VAT status) and the **hosting provider** named in the Privacy “website” section match the live deployment
- [ ] Confirm **governing law** (default in template: Germany) matches your entity
- [ ] Lawyer review if the pilot is paid or outside friendly SME circle
- [ ] Optional: signed **Pilot Agreement** PDF referencing these URLs for enterprise prospects

---

## Related

- [Security](./security.md) — technical hardening, PAT handling  
- [On-Prem Product Model](./on-prem-product.md) — bootstrap and closed registration  
- [Editions](./editions.md) — future commercial tiers (not enforced in code yet)
