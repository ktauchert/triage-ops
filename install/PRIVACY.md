# TriageOps — Privacy Policy

**Version:** 1.0 · **Effective:** June 2026

> **Notice:** Template for early pilots. Have qualified legal counsel review for your jurisdiction and whether you act as controller or processor.

## 1. Scope

This Privacy Policy explains how **TriageOps** (“we”, “the software”) handles information when you install and use it. TriageOps is typically deployed **on infrastructure you control** (on-prem or your cloud). In most pilots, **you** (the organization running the instance) are the **data controller** for your users’ and issue data; we provide the software.

**Software provider:** Karsten Tauchert · c/o Block Services, Stuttgarter Str. 106, 70736 Fellbach, Germany · developer@ktauchert.de.

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

## 7. Your rights

Subject to applicable law, individuals may have rights to access, rectify, erase, restrict, or port personal data. **Contact your organization’s administrator** (TriageOps admin) for requests relating to data in your instance.

## 8. Contact

For privacy questions about the **software** or this policy, contact the provider:

Karsten Tauchert · c/o Block Services, Stuttgarter Str. 106, 70736 Fellbach, Germany · developer@ktauchert.de

---

*See also: [EULA](./EULA.md)*
