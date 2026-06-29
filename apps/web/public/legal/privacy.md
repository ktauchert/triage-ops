# TriageOps — Privacy Policy

**Version:** 1.0 · **Effective:** June 2026

> **Notice:** Template for early pilots. Have qualified legal counsel review for your jurisdiction and whether you act as controller or processor.

## 1. Scope

This Privacy Policy explains how **TriageOps** (“we”, “the software”) handles information when you install and use it. TriageOps is typically deployed **on infrastructure you control** (on-prem or your cloud). In most pilots, **you** (the organization running the instance) are the **data controller** for your users’ and issue data; we provide the software.

**Provider / controller for this website and the software vendor:**

Karsten Tauchert · c/o Block Services, Stuttgarter Str. 106, 70736 Fellbach, Germany · developer@ktauchert.de — see the [Impressum](/legal/impressum) for full details.

## 2. What data the application processes

Depending on configuration, TriageOps may store and process:

| Category | Examples | Purpose |
|----------|----------|---------|
| **Account data** | Name, email, OAuth provider IDs | Authentication and RBAC |
| **VCS metadata** | Issue titles, descriptions, labels, milestones, state | Sync, metrics, AI suggestions |
| **Credentials** | Encrypted personal access tokens | Sync and write-back to GitHub/GitLab |
| **Operational data** | Audit events, job runs, analysis progress | Admin visibility and troubleshooting |
| **Technical logs** | HTTP errors, worker logs (if enabled) | Operations |

We do **not** design the product to send issue content or tokens to the Licensor’s servers during normal on-prem operation. **Local LLM (Ollama)** analysis runs on your infrastructure.

## 3. Legal bases (EU / UK)

If GDPR applies, typical bases for processing **by the controller (you)** include:

- **Contract** — providing the triage tool to your team  
- **Legitimate interests** — securing and operating internal developer tooling  
- **Consent** — where required for optional features  

Your organization should document its own legal basis and retention policies.

## 4. Retention

Data is retained in **your** Postgres database until you delete it or destroy the instance. Configure backups and retention according to your policies.

## 5. Security

You are responsible for securing the host, network, `.env` secrets, OAuth apps, and database backups. See the product security documentation for hardening guidance.

## 6. Sub-processors

On-prem use does not require Licensor-hosted sub-processors for core operation. If you enable external services (GitHub, GitLab, email, etc.), their privacy policies apply.

## 7. This website (marketing/product site)

This section applies to the **public website** where this policy is published (separate from the on-prem software):

- **Server logs.** When you visit, the hosting provider automatically processes technical data (IP address, browser/OS, referrer, time of request) to deliver the site securely and reliably. Legal basis: legitimate interest (Art. 6(1)(f) GDPR). These logs are kept only as long as needed for operation and security.
- **Contact by email.** If you email us, we process your message and contact details to handle your request (Art. 6(1)(b)/(f) GDPR) and delete them once no longer needed and no retention obligation applies.
- **No tracking by default.** We do not set marketing or analytics cookies. If that changes, we will request consent (Art. 6(1)(a) GDPR) and update this policy.
- **Hosting.** The site is hosted by a third-party provider acting as processor under a data-processing agreement. Confirm your actual host and any transfers (e.g. outside the EU/EEA) before launch.

## 8. Your rights

Subject to applicable law, individuals may have rights to access, rectify, erase, restrict, object to, or port their personal data, and to lodge a complaint with a supervisory authority. For data held in a deployed **instance**, contact your organization’s administrator (TriageOps admin). For data processed by the **provider** (this website, vendor contact), use the contact below.

## 9. Contact

For privacy questions about the **software**, this website, or this policy, contact:

Karsten Tauchert · c/o Block Services, Stuttgarter Str. 106, 70736 Fellbach, Germany · developer@ktauchert.de

---

*See also: [EULA](/legal/eula) · [Impressum](/legal/impressum)*
