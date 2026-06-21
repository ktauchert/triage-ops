# Code Review — 2026-06-21

**Reviewer:** Cursor Agent (automatisierte Vollständigkeitsprüfung)  
**Scope:** Gesamte Codebasis (`apps/web`, `apps/worker`, `packages/*`)  
**Fokus:** Phase 2.5 VCS Write-back + bestehende MVP-/Phase-2-Architektur  
**Stand:** Uncommitted working tree (VCS write-back Feature-Set)

---

## Executive Summary

TriageOps ist ein gut strukturiertes npm-Workspace-Monorepo mit klarer Trennung: **Web** (Next.js + API), **Worker** (BullMQ), **DB** (Prisma), **Metrics** (reine Funktionen), **Shared Types** (Queue-Verträge). Die Architektur „Sync-and-Analyze“ ist konsistent umgesetzt; der LLM-Pfad liest ausschließlich Postgres, Write-back läuft über einen separaten Worker mit gespeicherten PATs.

**Gesamtbewertung: Gut — produktionsreif für On-Prem/Intranet mit dokumentierten MVP-Einschränkungen.**

| Bereich | Bewertung | Kurz |
|---------|-----------|------|
| Architektur | ✅ Stark | Klare Paketgrenzen, dünne Routes, fette Services |
| Code-Qualität | ✅ Gut | Einheitliche Patterns, wenig technische Schulden |
| Tests | ✅ Gut | 136+ Unit-Tests (Worker 78, Web 41, Metrics 17); MSW für VCS |
| Sicherheit | ⚠️ MVP | OAuth + Session-Schutz ok; PATs plain-text (dokumentiert) |
| Phase 2.5 Write-back | ✅ Gut | End-to-end kohärent, sinnvolle State Machine |
| Dokumentation | ⚠️ Leicht veraltet | `architecture.md` fehlt `vcs-writeback`-Queue |

---

## Architektur

### Stärken

1. **Monorepo-Grenzen sind sauber.** Keine zirkulären Abhängigkeiten; `shared-types` definiert Queue-Namen und Payloads zentral.
2. **Drei BullMQ-Queues mit einheitlichem Muster:** Audit-Row anlegen → Job enqueuen → Worker mit Redis-Lock → Mutation → `finally` release.
3. **Provider-Abstraktion:** Lesen (`fetch-project-issues`) und Schreiben (`apply-suggestion` → `github/write` / `gitlab/write`) sind getrennt und testbar.
4. **LLM-Sicherheitsgrenze:** Ollama erhält keine Tokens; Write-back ist ein eigener Pfad — korrekt in Code und `.cursor/rules/llm-ollama.mdc` verankert.
5. **Human-in-the-loop:** Suggestions durchlaufen `PENDING` → `APPLYING` → `APPLIED` | `APPLY_FAILED` oder `DISMISSED`; Apply ist asynchron (HTTP 202).

### Datenfluss Write-back (Phase 2.5)

```
Dashboard „Apply“
  → PATCH /api/projects/[id]/suggestions/[id]  (status: APPLIED)
  → suggestions.ts: APPLYING + enqueueWriteBackJob()
  → vcs-writeback Worker: sync:{projectId} Lock
  → applySuggestionToVcs() → GitHub/GitLab REST
  → lokale Issue-Patches + suggestion → APPLIED
```

Die State Machine in `apps/web/lib/services/suggestions.ts` und `apps/worker/src/workers/vcs-writeback-worker.ts` ist konsistent: Der Worker überspringt idempotent Nicht-`APPLYING`-Rows; Retry aus `APPLY_FAILED` ist erlaubt.

---

## Review nach Paket

### `packages/db`

**Positiv:**
- Relational sauber modelliert; `onDelete: Cascade` von `Project` nach unten.
- Sinnvolle Indizes (`projectId + status`, `lastActivityAt`, FKs).
- Migration `20260621120000_suggestion_writeback` ergänzt Enum-Werte und `writeBackError` korrekt.

**Hinweise:**
- Feldname `gitlabIssueIid` wird auch für GitHub-Issue-Nummern verwendet — historisch, aber überall konsistent. Neue Mitwirkende sollten das in Onboarding erwähnen.
- `IssueSuggestion.relatedIssue` mit `onDelete: SetNull` — bei gelöschtem Related Issue bleibt eine verwaiste Duplicate-Suggestion möglich (Apply würde validieren und fehlschlagen).

### `packages/metrics`

**Positiv:**
- Reine Funktionen, keine I/O — ideal testbar.
- 17 Tests mit Grenzfällen (leere Inputs, Schwellenwerte).

**Keine Beanstandungen** für den aktuellen Scope.

### `packages/shared-types`

**Positiv:**
- `QUEUE_NAMES.VCS_WRITEBACK` und `WriteBackJobPayload` schlank und ausreichend.

### `apps/worker`

**Positiv:**
- **78 Unit-Tests**, davon neu: `apply-suggestion`, `duplicate-sides`, `github/write`, `gitlab/write`, `vcs-writeback-worker`.
- MSW-Mocking für HTTP-Clients mit injizierbarem `fetchImpl`.
- `duplicate-sides.ts`: klare Policy (niedrigere IID = kanonisch) mit getrennten Kommentar-Templates.
- Lock-Sharing zwischen Sync und Write-back (`sync:{projectId}`) verhindert parallele VCS+DB-Mutation.

**Risiken / Edge Cases:**

| Thema | Schwere | Detail |
|-------|---------|--------|
| Lock nicht erworben | Mittel | Worker setzt `APPLY_FAILED` und **wirft nicht** → BullMQ retried nicht. Nutzer muss „Retry“ klicken. Bewusst, aber UX/Docs sollten das erwähnen. |
| Partielle Duplicate-Writes | Mittel | 3 sequenzielle VCS-Calls (2 Kommentare + Close). Scheitert Call 2/3 → VCS und DB können divergieren bis zum nächsten Sync. Kein Compensating Transaction. |
| DB nach erfolgreichem VCS | Niedrig | VCS-Schreiben vor lokalem `Issue.update`. DB-Fehler danach → Remote ahead of cache. Nächster Sync gleicht aus. |
| `markApplyFailed` + re-throw | Niedrig | Im `catch` wird `markApplyFailed` aufgerufen und der Fehler erneut geworfen → BullMQ-Retry bei transienten Fehlern. Status ist bereits `APPLY_FAILED` — Retry-Pfad aus UI ist der primäre Recovery-Mechanismus. |

**Code-Qualität:** `apply-suggestion.ts` spiegelt Validierung aus dem Web-Service (`validateApplySuggestion`) — symmetrisch, leichte DRY-Duplikation akzeptabel für Grenz-Schichten.

### `apps/web`

**Positiv:**
- **41 Unit-Tests** inkl. neuer `suggestions.test.ts` (Dismiss, Apply → APPLYING + enqueue, Retry).
- API-Routes dünn; Business-Logik in `lib/services/`.
- `SuggestionsPanel`: Polling während Analysis und während `APPLYING`; Badges, Fehlertext, `router.refresh()` bei Abschluss.
- `clearProjectAnalysis` blockiert bei laufender LLM-Analyse (Lock + DB-Status).

**Risiken / Edge Cases:**

| Thema | Schwere | Detail |
|-------|---------|--------|
| Clear während Apply | ~~Mittel~~ Behoben | Server prüft jetzt `APPLYING` vor Löschen; UI-Guard bleibt zusätzlich aktiv. |
| Doppelte Queries | Niedrig | `getAnalysisPanelData` und `metrics.ts` laden Suggestions parallel mit ähnlichem `include` — kleine DRY-Opportunity. |
| Polling-Duplikat | Niedrig | Zwei `useEffect`-Poller in `suggestions-panel.tsx` (Analysis vs. Apply) rufen dieselbe Route auf — funktional ok, könnte konsolidiert werden. |

**Auth:** `requireApiSession()` in allen API-Routes; `AUTH_DISABLED` für lokale Entwicklung. Siehe `docs/security.md` für Produktions-Checkliste.

### `packages/e2e`

- Ein Smoke-Test (Register → Sync → Metrics). **Write-back und Apply sind nicht abgedeckt** — in `phases.md` als Gap notiert.

---

## Sicherheit

Referenz: [`docs/security.md`](./security.md)

| Kontrolle | Status |
|-----------|--------|
| OAuth + HTTP-only Session | ✅ |
| API 401 ohne Session | ✅ |
| PATs nie in API-Responses | ✅ |
| LLM ohne VCS-Tokens | ✅ |
| PAT-Verschlüsselung at rest | ❌ Phase 3 |
| RBAC / Audit-Log-UI | ❌ Out of scope |
| Rate Limiting | ❌ Out of scope |

**Write-back PAT-Scopes:** GitLab `api`, GitHub Issues write — korrekt in Security-Docs und UI-Beschreibung.

**Empfehlung für Reviewer:** Vor Netzwerk-Exposure `AUTH_DISABLED=false`, HTTPS, DB-Netzwerk-Isolation, minimale PAT-Scopes.

---

## Testabdeckung (verifiziert 2026-06-21)

| Paket | Tests | Status |
|-------|-------|--------|
| `@triage-ops/worker` | 78 | ✅ bestanden |
| `@triage-ops/web` | 41 | ✅ bestanden |
| `@triage-ops/metrics` | 17 | ✅ bestanden |
| `@triage-ops/e2e` | 1 | Nicht in diesem Lauf (benötigt Postgres + Redis) |

**32 Testdateien** insgesamt, colocated als `*.test.ts`.

### Bekannte Lücken

1. Keine Integrationstests für `PATCH .../suggestions/[suggestionId]` Route Handler.
2. E2E deckt Apply/Write-back nicht ab.
3. Keine Tests für `clearProjectAnalysis` während `APPLYING`.

---

## Code-Stil & Wartbarkeit

**Positiv:**
- Keine `TODO`/`FIXME`/`HACK`-Marker in TS/TSX gefunden.
- Cursor Rules (`.cursor/rules/`) spiegeln Architektur-Constraints — hilfreich für Agenten und Menschen.
- Konsistente Fehlerbehandlung: `Error` mit Message → `errorResponse` in Routes.
- Vitest + `vi.hoisted` Mocks folgen etabliertem Muster.

**Verbesserungspotential (niedrige Priorität):**
- `docs/architecture.md`: Worker-Tabelle und Mermaid-Diagramm um `vcs-writeback`-Queue ergänzen.
- Optional: gemeinsame Helper-Funktion für Suggestion-Panel-Queries.

---

## Priorisierte Empfehlungen

### P1 — Vor breiterem Rollout

1. ~~**Serverseitig:** `clearProjectAnalysis` ablehnen, wenn Suggestions mit Status `APPLYING` existieren (UI-Guard reicht nicht).~~ ✅ Umgesetzt 2026-06-21
2. ~~**`architecture.md` aktualisieren** — dritte Queue und Write-back-Flow dokumentieren.~~ ✅ Umgesetzt 2026-06-21

### P2 — Robustheit

3. **Duplicate Apply:** Bei partiellem Fehler klare Fehlermeldung mit Hinweis auf manuellen Sync / manuelle Bereinigung in VCS.
4. **Lock-Failure:** In UI oder Docs erklären, dass „Retry“ nach Sync-Wartezeit nötig sein kann.
5. **Route-Integrationstest** für PATCH suggestions (mocked Prisma + queue).

### P3 — Phase 3 / später

6. PAT-Verschlüsselung at rest.
7. E2E-Szenario: Apply Description → Mock VCS → Status `APPLIED`.
8. RBAC und Audit-Log.

---

## Fazit

Die Codebasis ist **reif für den dokumentierten MVP-/Phase-2.5-Scope**: klare Architektur, gute Testkultur im Worker und Web-Service-Layer, durchdachte Async-Apply-Pipeline mit Retry-Pfad. Die wichtigsten offenen Punkte sind **bekannte MVP-Sicherheitsschulden** (plain-text PATs), **ein Race bei Clear-during-Apply** und **partielle VCS-Writes bei Duplicates** — alles adressierbar ohne Architekturumbau.

Für On-Prem-Einsatz mit aktivierter Auth, Netzwerk-Härtung und dokumentierten PAT-Scopes ist das System **review-bestanden mit den oben genannten Vorbehalten**.

---

## Anhang: Reviewte Kern-Dateien

| Bereich | Dateien |
|---------|---------|
| Schema | `packages/db/prisma/schema.prisma`, Migration `20260621120000_suggestion_writeback` |
| Web Service | `apps/web/lib/services/suggestions.ts`, `suggestions.test.ts` |
| API | `apps/web/app/api/projects/[id]/suggestions/[suggestionId]/route.ts` |
| Queue | `apps/web/lib/queue.ts`, `packages/shared-types/src/index.ts` |
| Worker | `vcs-writeback-worker.ts`, `apply-suggestion.ts`, `github/write.ts`, `gitlab/write.ts` |
| UI | `apps/web/app/(dashboard)/suggestions-panel.tsx` |
| Docs | `docs/current-state.md`, `docs/security.md`, `docs/phases.md` |
