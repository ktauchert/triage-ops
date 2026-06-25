# Code Review — 2026-06-25

**Reviewer:** Cursor Agent (Production-Readiness- & Security-Audit)
**Scope:** Gesamte Codebasis (`apps/web`, `apps/worker`, `packages/`*) + Deployment-/Install-Artefakte (`docker-compose*.yml`, `install/`, `.github/workflows/`, `scripts/`)
**Fokus:** Produktionsreife und Sicherheitstauglichkeit für **End-User und Firmen** (On-Prem/Intranet-Selbstbetrieb)
**Stand:** Uncommitted working tree nach Phase 3a/3b + Phase-4-Teillieferung (RBAC, Admin-UI, Audit, Instance-Bootstrap, Produktdistribution)
**Verifikation:** Unit-Tests ausgeführt (326 grün), Web-Build erfolgreich, Kern-Sicherheitsdateien manuell gelesen.

> Dies ist ein reines Analyse-Dokument. Es wurde **kein Code geändert.** Vorgänger: `[code-review-2026-06-21.md](./code-review-2026-06-21.md)`.

---

## Update 2026-06-25 — Alle „Hoch"-Befunde behoben

Nach Erstellung dieses Reviews wurden **alle 15 High-Severity-Befunde** umgesetzt (Workstreams A/B/C). Verifikation: **355 Unit-Tests grün** (db 7, metrics 17, worker 103, web 228), Web-Build + Worker-`tsc` sauber.

| ID | Befund | Fix |
| --- | --- | --- |
| H1/H2 | JWT-Session-Lifecycle (Deaktivierung/Löschung) | `session.ts` lädt jetzt `{ role, deactivatedAt }` und gibt **401** bei deaktiviertem/gelöschtem User statt VIEWER-Fallback |
| H3 | Bootstrap-Race → mehrere Admins | Atomarer `appSettings.updateMany(setupComplete:false→true)`-Claim; nur Gewinner wird ADMIN |
| H4 | Pre-Setup-Takeover | Allowlist wird im Bootstrap-Fenster erzwungen, sofern konfiguriert |
| H5/M5 | Kein Fail-Fast bei fehlenden Secrets | `assertEncryptionConfigured()` (Web-`instrumentation.ts` + Worker-`index.ts`) + `AUTH_SECRET`-Prüfung in `assertProductionAuthConfig` |
| B1 | HTTP-Timeouts + 429/5xx-Backoff | Neuer `lib/http.ts` (`fetchWithResilience`); alle VCS-/Ollama-Pfade geroutet |
| B2 | Lock-TTL ohne Renewal | `startLockHeartbeat`/`renewLock` in Sync-/LLM-/Write-back-Workern |
| B3 | Kein Sync-Run-Recovery | `recoverInterruptedSyncRuns()` beim Worker-Start (Sync-Runs FAILED, stale `APPLYING` → `APPLY_FAILED`, Lock-Release) |
| B4 | Sync-Lock-Failure ließ Run `PENDING` | `sync-worker.ts` setzt `SyncRun` auf FAILED |
| B5 | Write-back-Retry wirkungslos / Doppel-Kommentare | Retry verarbeitet `APPLYING`+`APPLY_FAILED`; Duplicate-Close idempotent (Read-before-write) |
| C1 | Worker-Container als root | `apps/worker/Dockerfile`: non-root `USER worker` (UID 1001) |
| C2 | Release nicht an CI gekoppelt | `ci.yml` als `workflow_call`; `release.yml` `build-and-push` mit `needs: ci` |
| C3 | Kein Backup/Restore-/Rollback-Runbook | `install/install.md` §6 Backup & Restore, §7 Rollback |

---

## Executive Summary

TriageOps ist seit dem letzten Review (2026-06-21) deutlich gereift: PAT-Verschlüsselung (AES-256-GCM), API-Rate-Limiting (Redis), per-Projekt Auto-Sync, RBAC mit vier Rollen, Admin-UI (Users/Audit/Jobs), Instance-Bootstrap (`/setup`, geschlossene Registrierung, Invites) und eine Image-basierte On-Prem-Distribution (GHCR + Install-Bundle) sind hinzugekommen. Architektur und Code-Qualität bleiben **stark**; die Testkultur ist breit (326 grüne Unit-Tests, Web-Build sauber).

Die zentrale Bewertungsfrage lautet: **Ist das System sicher und reif genug, um es Endkunden zum Selbstbetrieb zu überlassen?** Antwort:

> **Gut für einen herstellerbegleiteten Pilot (Gate A). Noch nicht freigabereif für unbeaufsichtigten Kunden-Selbstbetrieb (Gate B)** — wegen einer Handvoll konkreter, aber gut behebbarer Lücken: JWT-Session-Lebenszyklus (Deaktivierung/Löschung greift nicht sofort), Bootstrap-/Allowlist-Härtung, fehlende Fail-Fast-Validierung für Krypto-/Auth-Secrets, Container-Härtung (Worker als root) und fehlende Betriebs-Runbooks (Backup/Restore/Rollback) im Kundenbundle.

### Gesamtbewertung


| Bereich              | Bewertung            | Kurz                                                                                  |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| Architektur          | ✅ Stark              | Saubere Paketgrenzen, dünne Routes, fette Services, 4 Queues mit einheitlichem Muster |
| Code-Qualität        | ✅ Gut                | Konsistente Patterns, wenig Schulden, 326 Unit-Tests grün, Web-Build grün             |
| Authentifizierung    | ⚠️ Solide mit Lücken | OAuth + zentrale Session-Gate + Bootstrap; JWT-Lifecycle-Gaps offen                   |
| Autorisierung (RBAC) | ✅ Gut                | Explizite Matrix, getestet, durchgängig auf mutierenden Routen                        |
| Secret-Handling      | ⚠️ Teilweise         | PAT-Verschlüsselung vorhanden, aber **kein Fail-Fast** bei fehlenden Keys             |
| Worker-Robustheit    | ⚠️ Mittel            | Locks/Idempotenz solide; Lock-TTL, HTTP-Timeouts, Teilfehler offen                    |
| Deployment/On-Prem   | ⚠️ Pilotreif         | Prod-Compose + Migrate + Bundle vorhanden; Härtung + Runbooks offen                   |
| Beobachtbarkeit      | ⚠️ Minimal           | Nur stdout, keine strukturierten Logs/Metriken/Healthchecks mit Aussagekraft          |
| Produktnutzen        | ✅ Hoch               | Klarer, realer Use-Case; differenzierte Funktionen; menschlich kontrolliert           |


---

## Was sich seit dem 2026-06-21-Review geändert hat


| Lieferung                                          | Status                      | Beleg                                                                      |
| -------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------- |
| PAT-Verschlüsselung at rest (AES-256-GCM)          | ✅                           | `packages/db/src/token-crypto.ts`                                          |
| API-Rate-Limiting (Redis, Tiers)                   | ✅                           | `apps/web/lib/rate-limit/`*, `docs/security.md`                            |
| Per-Projekt Auto-Sync + Scheduler                  | ✅                           | `apps/worker/src/queues/auto-sync-queue.ts`, `lib/enqueue-project-sync.ts` |
| RBAC (ADMIN/LEAD/OPERATOR/VIEWER)                  | ✅                           | `apps/web/lib/auth/permissions.ts`                                         |
| Admin-UI (Users/Audit/Jobs) + Invites              | ✅                           | `apps/web/app/(dashboard)/admin/*`, `app/api/admin/*`                      |
| Instance-Bootstrap (`/setup`, closed registration) | ✅                           | `apps/web/lib/auth/setup.ts`, `app/setup/page.tsx`                         |
| Image-Distribution (GHCR + Bundle)                 | ✅                           | `docker-compose.prod.yml`, `install/`, `.github/workflows/release.yml`     |
| User-Deaktivierung                                 | ✅ (mit Lifecycle-Gap, s.u.) | Migration `20260623120000_user_deactivated`                                |


Die meisten in der Vorgängerprüfung als „Phase 3/4 / später“ markierten Punkte sind damit **umgesetzt** — das hebt das Produkt klar Richtung Marktreife.

---

## Verifikation in diesem Lauf


| Prüfung                                    | Ergebnis                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `npm run test -w metrics -w worker -w web` | ✅ **326 Tests grün** (metrics 17, worker 88, web 221), 58 Testdateien                             |
| `npm run build -w @triage-ops/web`         | ✅ Erfolgreich (alle Routes kompiliert, Middleware/Proxy gebaut)                                   |
| e2e Smoke (`@triage-ops/e2e`)              | ⏭️ Übersprungen — benötigt laufendes Postgres/Redis (nicht im Review-Sandbox)                     |
| Manuell gelesen (Security-Kern)            | `session.ts`, `setup.ts`, `auth.config.ts`, `token-crypto.ts`, `release.yml`, `apps/*/Dockerfile` |


---

## Sicherheits-Audit (Schwerpunkt)

Die folgenden Befunde sind nach Schweregrad geordnet. **Severity = produktives Risiko bei Exposition gegenüber echten End-Usern/Firmen.**

### Befundübersicht


| ID    | Schwere  | Thema                                                               | Datei (verifiziert)                                        |
| ----- | -------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| H1    | **Hoch** | Deaktivierte User behalten Zugriff bis JWT abläuft                  | `apps/web/lib/auth/session.ts:65–107`                      |
| H2    | **Hoch** | Gelöschter User → JWT fällt auf VIEWER zurück (kein Reject)         | `apps/web/lib/auth/session.ts:18–25`                       |
| H3    | **Hoch** | Bootstrap-Race → potenziell mehrere Admins                          | `apps/web/lib/auth/setup.ts:70–74, 116–122`                |
| H4    | **Hoch** | Pre-Setup-Takeover: erster Login besitzt die Instanz                | `apps/web/lib/auth/setup.ts:72–73`; `auth.config.ts:85–86` |
| H5    | **Hoch** | Kein Fail-Fast bei fehlendem `TOKEN_ENCRYPTION_KEY` → PATs klartext | `packages/db/src/token-crypto.ts:27–31`                    |
| M1    | Mittel   | Leere Allowlist in Prod nur Warnung, kein Deny                      | `apps/web/lib/auth/setup.ts:179–193`                       |
| M2    | Mittel   | `ADMIN_EMAILS` re-eskaliert bei jedem Login (Demote rückgängig)     | `apps/web/lib/auth/setup.ts:156–161`                       |
| M3    | Mittel   | `GET /api/connections` ohne Rollen-Check (nur Scope)                | `apps/web/app/api/connections/route.ts`                    |
| M4    | Mittel   | Proxy liefert ggf. Redirect statt 401 an API-Clients                | `apps/web/auth.config.ts:85–89`                            |
| M5    | Mittel   | Keine Prod-Validierung von `AUTH_SECRET` (Stärke/Vorhandensein)     | `apps/web/lib/auth/config.ts:45`; `environment.ts`         |
| M6    | Mittel   | Rate-Limiting **fail-open** bei Redis-Ausfall                       | `apps/web/lib/rate-limit/enforce.ts`                       |
| M7    | Mittel   | `trustHost: true` — Host-Header-Vertrauen                           | `apps/web/auth.config.ts:45`                               |
| L1–L5 | Niedrig  | Diverse Defense-in-Depth-Lücken (s. Detail)                         | siehe unten                                                |


### Detail — Hohe Befunde

**H1 — Deaktivierung wirkt nicht sofort (JWT-Lifecycle).**
`requireApiSession()` (`session.ts:65–107`) prüft **nicht** `deactivatedAt` und lädt nur die Rolle (`loadUserRole`, `session.ts:18–25`). Die Deaktivierung (`admin.ts`) löscht `Session`-Zeilen — bei **JWT-Strategie** (`auth.config.ts:50–52`) invalidiert das den Cookie aber nicht. Folge: Ein deaktivierter Mitarbeiter behält vollen API-/Dashboard-Zugriff bis zum JWT-Ablauf. Für „Mitarbeiter verlässt die Firma“ ist das ein reales Risiko.
*Empfehlung:* In `requireApiSession` zusätzlich `deactivatedAt`/Existenz pro Request prüfen (kostet eine DB-Query, die via `loadUserRole` ohnehin schon passiert — einfach `select` erweitern), oder kurze `maxAge` + Blocklist.

**H2 — Gelöschter User wird zu VIEWER statt abgewiesen.**
`loadUserRole` gibt `user?.role ?? UserRole.VIEWER` zurück (`session.ts:24`). Zeigt ein JWT-`sub` auf einen gelöschten User, erhält der Inhaber Lese-Zugriff (Metriken, Suggestions, im `shared`-Scope Projektlisten). *Empfehlung:* Bei nicht gefundenem User 401 statt Default-Rolle.

**H3/H4 — Bootstrap-Fenster.**
Vor Abschluss von `/setup` darf **jede** OAuth-Identität sich anmelden, solange kein Admin existiert; der erste erfolgreiche Login wird `ADMIN` und schließt das Setup (`setup.ts:72–73, 116–122`). Eine netzwerkerreichbare frische Instanz kann so von „wer zuerst kommt“ übernommen werden; gleichzeitige Logins können mehrere Admins erzeugen (kein „first-wins“-Transaktionslock). Die Allowlist wird im Bootstrap **nicht** angewandt. *Empfehlung:* Setup nur aus vertrauenswürdigem Netz erreichbar machen (Deployment-Runbook), bzw. Bootstrap auf einen vorkonfigurierten Admin-Identifier beschränken.

**H5 — Verschlüsselung silently optional.**
`sealAccessToken` gibt bei fehlendem Key **den Klartext zurück** (`token-crypto.ts:27–31`). Das ist für lokale Dev sinnvoll, in Produktion aber gefährlich: Vergisst der Kunde `TOKEN_ENCRYPTION_KEY`, landen PATs unverschlüsselt in Postgres — ohne jede Warnung. *Empfehlung:* In Produktion beim Start hart fehlschlagen, wenn `TOKEN_ENCRYPTION_KEY` fehlt (analog zum `AUTH_DISABLED`-Guard in `instrumentation.ts`).

### Positive Sicherheitsbefunde (bestätigt)

- **Zentrale API-Gate:** Alle 15 Nicht-Auth-Routes rufen `requireApiSession()`; Setup-Check → Session → Rate-Limit in einer Funktion (`session.ts:65–107`).
- `**AUTH_DISABLED` standardmäßig aus**; Prod-Start wirft ohne `ALLOW_AUTH_DISABLED` (`environment.ts`, `instrumentation.ts`).
- **RBAC-Matrix explizit & getestet** (`permissions.ts:17–40`, `permissions.matrix.test.ts`).
- **Rolle wird pro Request aus DB geladen** (Demotions wirken sofort — im Gegensatz zum Deaktivierungs-Gap).
- **Geschlossene Registrierung** nach Setup via Invite/`ProvisionedUser`; Deaktivierte werden beim Sign-in geblockt (`setup.ts:81–96`).
- **Admin-Schutzgeländer:** kein Self-Demote/Deactivate/Delete, letzter Admin geschützt, Audit-Logging.
- **LLM-Sicherheitsgrenze bestätigt:** Ollama erhält keine PATs; Worker liest Postgres-only (Grep über `lib/llm/` ohne Token-Referenzen).
- **PATs nie in API-Responses** (dokumentiert + Praxis).

---

## Robustheit Worker / Background-Jobs

Solide Grundlage (per-Projekt Redis-Locks, `finally`-Release, BullMQ-Retries/Backoff, LLM-Stale-Recovery beim Start). Offene Produktionsrisiken:


| Schwere  | Thema                                                                                                                                           | Ort                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Hoch** | Sync-Lock-TTL **300 s ohne Renewal** → bei großen Repos kann der Lock ablaufen, während der Job noch läuft (paralleler Sync/Write-back möglich) | `lib/lock.ts:22`, `sync-worker.ts:109`                                 |
| **Hoch** | Duplicate-Close ist 3-stufige VCS-Sequenz **ohne Kompensation**; Retry postet Kommentare doppelt                                                | `lib/vcs/apply-suggestion.ts` (GitLab/GitHub)                          |
| **Hoch** | **Keine HTTP-Timeouts** auf VCS/Ollama → hängende Verbindung blockiert Worker-Concurrency                                                       | `lib/github/client.ts`, `lib/gitlab/client.ts`, `lib/ollama/client.ts` |
| Hoch     | Keine 429/`Retry-After`- und keine 5xx-Backoff-Behandlung auf HTTP-Ebene                                                                        | alle VCS-Fetch-Pfade                                                   |
| Hoch     | Write-back-BullMQ-Retry ist wirkungslos: nach `APPLY_FAILED` no-opt der Retry (kein `APPLYING` mehr)                                            | `vcs-writeback-worker.ts:63–65, 112–115`                               |
| Hoch     | Kein Sync-Run-Recovery beim Worker-Start (nur LLM) → Sync-Runs können in `PENDING` hängen                                                       | `index.ts:113–116`; `sync-worker.ts:111–113`                           |
| Mittel   | LLM und Sync teilen sich **keinen** Lock (`llm:` vs `sync:`) → Analyse liest Snapshot, während Sync mutiert                                     | `llm-analysis-worker.ts:43`, `sync-worker.ts:109`                      |
| Mittel   | Sync löscht in VCS entfernte Issues nicht (kein Tombstoning) → veraltete „offene“ Issues                                                        | `sync-worker.ts` (upsert-only)                                         |
| Mittel   | Duplikat-Scan O(n²) → skaliert bei vielen offenen Issues schlecht                                                                               | `lib/llm/duplicate-detection.ts`                                       |
| Mittel   | Worker-Docker-HEALTHCHECK ist No-op (`node -e "process.exit(0)"`)                                                                               | `apps/worker/Dockerfile:28–29` (verifiziert)                           |
| Niedrig  | Nur `console.log/error` — keine strukturierten Logs/Korrelations-IDs/Metriken                                                                   | `index.ts`                                                             |


---

## Deployment / On-Prem-Distribution

Die Distribution ist überraschend weit: Prod-Compose ohne `build:` (nur `image:`-Pins), erzwungene Secrets via Compose-Interpolation, Netzwerk-Isolation (Postgres/Redis/Ollama ohne Host-Ports in Prod), persistente Volumes, dedizierter `migrate`-Profile-Job, Install-Guide und tag-getriggerte Release-Pipeline.

> **Korrektur zu vorläufigen Befunden:** Zwei zunächst als „kritisch“ eingestufte Punkte halten der Prüfung **nicht** stand:
>
> 1. `install/.env.example` **existiert** (3118 B, derzeit untracked) — das Release-Bundle bricht **nicht**. (`release.yml:94` referenziert die Datei korrekt.)
> 2. Der Web-HEALTHCHECK nutzt `wget`, das auf `node:24-alpine` via BusyBox **vorhanden** ist — er ist **nicht** kaputt. (`apps/web/Dockerfile:31–32`)

Verbleibende Lücken für unbeaufsichtigten Kunden-Selbstbetrieb:


| Schwere  | Lücke                                                                                               | Beleg                                                                             |
| -------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Hoch** | Release-Build ist **nicht** an CI/Tests gekoppelt — getaggte Images können aus rotem `main` shippen | `.github/workflows/release.yml` (kein `needs:`-CI, kein `npm test`) — verifiziert |
| **Hoch** | Worker-Container läuft **als root** (kein `USER`)                                                   | `apps/worker/Dockerfile:19–30` — verifiziert                                      |
| **Hoch** | Kein Backup/Restore-Runbook im Kundenbundle (`pg_dump`/Volume-Restore)                              | `install/install.md` (keine Backup-Sektion)                                       |
| **Hoch** | Kein dokumentierter Rollback-Pfad bei fehlgeschlagenem Upgrade                                      | `install/install.md` (nur Upgrade)                                                |
| Mittel   | Ollama-Image unpinned (`ollama/ollama:latest`) → Supply-Chain-Drift                                 | `docker-compose.prod.yml:35`                                                      |
| Mittel   | `:latest`-Tag wird neben Semver gepusht (mutierbarer Tag-Risiko)                                    | `release.yml:58, 68`                                                              |
| Mittel   | Redis ohne Authentifizierung in Prod-Compose                                                        | `docker-compose.prod.yml`                                                         |
| Mittel   | Kein dedizierter `/api/health`/Readiness-Endpoint (Smoke curlt `/login`)                            | `scripts/verify-prod-install.sh`                                                  |
| Mittel   | Kein Gate-B-Dry-Run auf sauberer VM dokumentiert                                                    | `docs/production-readiness.md`                                                    |
| Niedrig  | Keine SBOM/Image-Signatur/Provenance in der Pipeline                                                | `release.yml`                                                                     |
| Niedrig  | `workflow_dispatch` erzeugt kein Bundle (nur Images)                                                | `release.yml:72`                                                                  |


---

## Datenbank / Schema

- 12 Migrationen, sauber inkrementell; Phase-3/4-Migrationen (Auto-Sync, RBAC/Audit, Bootstrap, User-Deaktivierung) konsistent ergänzt.
- `onDelete: Cascade` von `Project` abwärts; sinnvolle Indizes.
- **Hinweis:** Re-Analyse kann Duplicate-/Description-Suggestions ohne DB-Unique-Constraint neu erzeugen (`schema.prisma` Suggestion-Modell; siehe Worker-Befunde) — keine harte Lücke, aber Datenhygiene.
- Historisches `gitlabIssueIid` wird auch für GitHub-Issue-Nummern genutzt (konsistent, Onboarding-Hinweis).

---

## Testabdeckung (verifiziert 2026-06-25)


| Paket                 | Tests   | Status                     |
| --------------------- | ------- | -------------------------- |
| `@triage-ops/metrics` | 17      | ✅                          |
| `@triage-ops/worker`  | 88      | ✅                          |
| `@triage-ops/web`     | 221     | ✅                          |
| **Summe Unit**        | **326** | ✅ (58 Dateien)             |
| `@triage-ops/e2e`     | 1       | ⏭️ benötigt Postgres+Redis |


**Bekannte Test-Lücken (Produktionsrelevanz):**

1. Kein Test für JWT-Lifecycle (Deaktivierung/Löschung wirkt sofort) — würde H1/H2 absichern.
2. E2E deckt Apply/Write-back nicht ab.
3. Kein Test für Sync-Lock-Failure → `SyncRun`-Status (Worker-Befund).
4. Kein Negativtest für fehlenden `TOKEN_ENCRYPTION_KEY` in Prod (H5).

---

## Produktnutzen & Marktreife

**Use-Case:** TriageOps adressiert ein echtes, schmerzhaftes Problem — Issue-Backlogs in GitHub/GitLab werden unübersichtlich; „Ghost“-/„Zombie“-Issues und verfallende Milestones bleiben unbemerkt. Das Produkt liefert dafür (a) belastbare Metriken, (b) lokale LLM-Vorschläge (Duplikate, Beschreibungsentwürfe) **ohne** Cloud-/Token-Leak und (c) menschlich kontrollierte Write-backs zurück ins VCS. Das ist ein klar differenziertes, datenresidenz-freundliches Angebot — besonders attraktiv für sicherheitsbewusste/air-gapped Firmen.

**Stärken als Produkt:**

- **On-Prem-First & Datenresidenz:** keine SaaS-Telemetrie, lokales Ollama, alle Daten im Kunden-Postgres — starkes Verkaufsargument für Enterprises.
- **Human-in-the-loop:** Vorschläge sind reviewbar; nichts wird automatisch in fremde Repos geschrieben.
- **Tiefe statt Breite:** Sync, Metriken, LLM-Triage, Write-back, RBAC, Audit, Auto-Sync bilden einen kohärenten Funktionsbogen — kein „Feature-Flickenteppich“.

**Reife-Einschätzung für Endkunden:**

- **Interner Einsatz / begleiteter Pilot bei 1–3 Firmen:** **Ja** — heute machbar mit dokumentierter Härtung (`docs/security.md`, `docs/intranet-rollout.md`).
- **Unbeaufsichtigter Self-Service-Verkauf an beliebige Firmen:** **Noch nicht** — erst nach P0-Liste (unten), einem getesteten Backup/Restore-Zyklus und einem Clean-VM-Dry-Run.

**Produktlücken mit Geschäftswirkung (nicht sicherheitskritisch):**

- Write-back-**Rollback/Revert** fehlt — bei einem falschen „Apply“ in ein Kunden-Repo gibt es keinen Ein-Klick-Undo (nur nächster Sync gleicht teilweise ab). Für Kundenvertrauen wichtig.
- **Impact-/Reporting-Timeline** (Metrik-Snapshots über Zeit) fehlt — wäre der „ROI-Beweis“ fürs Management.
- **Beobachtbarkeit** (strukturierte Logs, Health, Metriken) fehlt — erschwert Support-Fälle bei Kunden.

---

## Priorisierte Empfehlungen

### P0 — Vor Freigabe an externe Kunden (Gate B)

1. **JWT-Lifecycle schließen (H1/H2):** In `requireApiSession` `deactivatedAt` prüfen und bei nicht existierendem User 401 statt VIEWER. (Kleiner Diff, hoher Sicherheitswert.)
2. **Fail-Fast Secrets (H5/M5):** In Produktion Start abbrechen, wenn `TOKEN_ENCRYPTION_KEY` fehlt; `AUTH_SECRET`-Vorhandensein/-Länge validieren (analog `instrumentation.ts`).
3. **Release an CI koppeln:** `release.yml` `needs:` auf einen Test-/Lint-/Build-Job (oder Tests im Release-Job) — keine Images aus rotem Stand.
4. **Clean-VM-Dry-Run** ausschließlich aus dem Release-ZIP + `scripts/verify-prod-install.sh` durchführen und dokumentieren.
5. **Bootstrap-Härtung (H3/H4):** Setup-Erreichbarkeit im Runbook auf vertrauenswürdiges Netz beschränken; optional „first-wins“-Lock.

### P1 — Robustheit/Betrieb

1. **Worker als non-root** (`USER` im Runner-Stage) + aussagekräftiger Worker-Healthcheck oder bewusst Restart-Policy dokumentieren.
2. **Backup/Restore + Rollback** ins `install/install.md` (mit `pg_dump`/Volume-Restore und Image-Downgrade-Pfad).
3. **Worker-Resilienz:** HTTP-Timeouts auf VCS/Ollama; 429/5xx-Retry mit Backoff; Sync-Lock-TTL renewen oder skalieren; Sync-Run-Recovery beim Start.
4. **Allowlist-Deny in Prod** (M1) statt nur Warnung; `ADMIN_EMAILS`-Re-Eskalation (M2) dokumentieren oder einschränken.
5. **Ollama-Image pinnen**; Redis `requirepass` in Prod-Compose anbieten.

### P2 — Produktwert / später

1. **Write-back-Rollback/Revert** (Description first) — starkes Vertrauens-Feature.
2. **Beobachtbarkeit:** strukturierte JSON-Logs mit `projectId`/`syncRunId`/`suggestionId`, `/api/health`, Basis-Metriken.
3. **Impact-/Reporting-Timeline** (Metrik-Snapshots, Kampagnen-Reporting).
4. **Duplicate-Apply idempotent** machen (bestehende Kommentare/State prüfen) bzw. kompensierende Aktion.
5. SBOM/Image-Signatur/Provenance in der Release-Pipeline.

---

## Go/No-Go-Verdikt


| Szenario                                                  | Verdikt                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Interner Einsatz / Eigenbetrieb                           | ✅ **Go** mit dokumentierter Härtung                                                  |
| Begleiteter Pilot bei ausgewählten Firmen (Gate A)        | ✅ **Go**, sofern P0-1 (JWT) und P0-2 (Secret Fail-Fast) vorgezogen werden            |
| Unbeaufsichtigter Self-Service für „alle Firmen“ (Gate B) | ⛔ **No-Go bis P0 vollständig** + getesteter Backup/Restore-Zyklus + Clean-VM-Dry-Run |


**Fazit:** TriageOps ist ein architektonisch sauberes, funktional reiches und gut getestetes Produkt mit einem überzeugenden On-Prem-Wertversprechen. Die Lücken zur vollen Kundenfreigabe sind **konkret, klein und ohne Architekturumbau behebbar** — primär JWT-Session-Lebenszyklus, Secret-Fail-Fast, Release-Gating und Betriebs-Runbooks. Mit der P0-Liste erreicht das System einen kunden­freigabefähigen Stand.

---

## Anhang: Verifizierte Kern-Dateien


| Bereich      | Dateien                                                                                 |
| ------------ | --------------------------------------------------------------------------------------- |
| Auth/Session | `apps/web/lib/auth/session.ts`, `setup.ts`, `auth.config.ts`, `lib/auth/environment.ts` |
| Krypto       | `packages/db/src/token-crypto.ts`                                                       |
| RBAC         | `apps/web/lib/auth/permissions.ts` (+ Matrix-Test)                                      |
| Worker       | `apps/worker/src/index.ts`, `workers/`*, `lib/lock.ts`, `lib/vcs/apply-suggestion.ts`   |
| Infra        | `docker-compose.prod.yml`, `apps/web/Dockerfile`, `apps/worker/Dockerfile`, `install/`  |
| CI/CD        | `.github/workflows/release.yml`, `.github/workflows/ci.yml`                             |
| Verifikation | `npm test` (326 grün), `npm run build -w @triage-ops/web` (grün)                        |


> Methodik: Statische Analyse + gezieltes Lesen der sicherheitskritischen Pfade + Ausführung der Test-/Build-Pipelines. Zwei vorläufige „kritische“ Infra-Befunde wurden bei der Verifikation **widerlegt** (siehe Deployment-Abschnitt) und entsprechend korrigiert.

