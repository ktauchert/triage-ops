# TriageOps — End User License Agreement (EULA)

**Version:** 1.0 · **Effective:** June 2026

> **Notice:** This document is a practical template for early pilots. Have qualified legal counsel review it for your jurisdiction and business structure before relying on it commercially.

## 1. Parties and acceptance

This End User License Agreement (“**Agreement**”) is between you (“**Licensee**”, “**you**”) and the owner of the TriageOps software, **Karsten Tauchert** (c/o Block Services, Stuttgarter Str. 106, 70736 Fellbach, Germany) (“**Licensor**”, “**we**”, “**us**”).

By **installing**, **accessing**, or **using** TriageOps (including completing initial setup and signing in), you agree to this Agreement and to the [Privacy Policy](/legal/privacy). If you do not agree, do not install or use the software.

If you accept on behalf of an organization, you represent that you have authority to bind that organization.

## 2. Eligibility (SME / pilot)

TriageOps is currently offered for **evaluation and production use by small and medium-sized organizations** only, unless otherwise agreed in writing.

**“Eligible Licensee”** means an organization that, at the time of first use, has:

- fewer than **250 employees**, and  
- annual turnover below **EUR 50 million** (or equivalent in local currency).

We may refuse or terminate access if we reasonably determine you are not an Eligible Licensee. Enterprise or larger deployments require a separate written agreement.

## 3. License grant

Subject to this Agreement, Licensor grants Licensee a **limited, non-exclusive, non-transferable, revocable** license to:

- run the **pre-built container images and install bundle** provided by Licensor for Licensee’s **internal business purposes** on infrastructure Licensee controls; and  
- allow **authorized users** listed or invited by Licensee to access that instance.

## 4. Restrictions

Except as expressly permitted in writing, Licensee must **not**:

- copy, modify, adapt, translate, or create derivative works of the software;  
- reverse engineer, decompile, or disassemble the software (except where mandatory law allows);  
- distribute, sublicense, sell, rent, lease, or host the software for third parties (multi-tenant SaaS) without a separate agreement;  
- remove or alter proprietary notices;  
- use the software in violation of applicable law or third-party terms (including GitHub/GitLab terms).

**Ownership:** TriageOps, its name, logos, and all related intellectual property remain the exclusive property of Licensor. This Agreement does not transfer ownership.

## 5. Third-party services and components

TriageOps integrates with **GitHub**, **GitLab**, and other services you configure. Your use of those services is governed by **their** terms. The software also incorporates open-source components; applicable third-party licenses are provided separately where required.

Licensor is **not** responsible for outages, API changes, or actions taken by third-party platforms.

## 6. Your responsibilities

Licensee is solely responsible for:

- **Configuration** — OAuth apps, `AUTH_URL`, secrets, allowlists, network security, backups, and updates;  
- **Credentials** — personal access tokens and OAuth connections stored in your instance;  
- **User management** — who is invited, their roles, and their actions in the application;  
- **Review of suggestions** — all AI-generated suggestions are **recommendations**; humans decide whether to dismiss or apply them.

## 7. AI suggestions and VCS write-back (important)

TriageOps may suggest duplicate closures, description updates, and similar changes. **Apply** (or equivalent actions) may **modify, close, or comment on issues** in your connected GitHub or GitLab repositories.

You acknowledge that:

- suggestions may be **incorrect, incomplete, or outdated**;  
- **you** (not Licensor) choose to apply them;  
- applied changes are **performed using your credentials** on your systems;  
- Licensor does **not** guarantee triage outcomes, issue state, or data recovery after apply.

**You are solely responsible** for reviewing suggestions and for all effects of apply operations on your version-control systems.

## 8. Disclaimer of warranties

THE SOFTWARE IS PROVIDED **“AS IS”** AND **“AS AVAILABLE”**, WITHOUT WARRANTY OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY OF AI OUTPUT, OR UNINTERRUPTED OPERATION.

## 9. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:

- LICENSOR SHALL NOT BE LIABLE FOR ANY **INDIRECT**, **INCIDENTAL**, **SPECIAL**, **CONSEQUENTIAL**, OR **PUNITIVE** DAMAGES, OR FOR **LOSS OF DATA**, **LOSS OF PROFITS**, **BUSINESS INTERRUPTION**, OR **REPOSITORY / ISSUE STATE CHANGES** (INCLUDING CLOSED ISSUES OR EDITED DESCRIPTIONS), EVEN IF ADVISED OF THE POSSIBILITY.  
- LICENSOR’S **TOTAL AGGREGATE LIABILITY** ARISING OUT OF OR RELATED TO THIS AGREEMENT OR THE SOFTWARE SHALL NOT EXCEED THE **GREATER OF (A) AMOUNTS PAID BY LICENSEE TO LICENSOR FOR THE SOFTWARE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM, OR (B) EUR 100**.

Some jurisdictions do not allow certain limitations; in those cases, limits apply to the fullest extent permitted.

## 10. Support

Unless a separate support agreement exists, the software is provided on a **best-effort** basis during pilot or evaluation. No service-level agreement (SLA) is implied.

## 11. Term and termination

This license continues until terminated. Licensor may terminate if you breach this Agreement or are not an Eligible Licensee. You may stop using the software at any time. Upon termination, you must cease use and destroy copies of the install bundle in your possession (except backups kept for legal compliance).

Sections that by nature should survive (ownership, disclaimers, liability limits, governing law) survive termination.

## 12. Privacy

Processing of personal data is described in the [Privacy Policy](/legal/privacy). On-prem deployments generally store data on infrastructure you control; roles and responsibilities depend on your deployment and jurisdiction.

## 13. Changes

Licensor may update this Agreement for new releases. Material changes will be reflected in the version bundled with the software. Continued use after an update constitutes acceptance of the revised Agreement.

## 14. Governing law

This Agreement is governed by the laws of **Germany**, excluding conflict-of-law rules, unless mandatory local consumer protection laws require otherwise. Courts in **Germany** shall have exclusive jurisdiction, subject to mandatory statutory rights.

## 15. Contact

For licensing, privacy, or legal inquiries, contact the Licensor:

Karsten Tauchert
c/o Block Services, Stuttgarter Str. 106, 70736 Fellbach, Germany
Email: developer@ktauchert.de

Full provider details are in the [Impressum](/legal/impressum).

---

*Copyright © 2026 Karsten Tauchert (TriageOps). All rights reserved.*
