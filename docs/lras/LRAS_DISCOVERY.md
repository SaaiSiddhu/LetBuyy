# LRAS Discovery — Root Cause Analysis System (Phase 12)

**Date:** 2026-07-04 · Verified against the real repository. **No coding before this discovery.**

## 1. What already exists (LRAS composes)

| Capability | Where (verified) | LRAS reuse |
|---|---|---|
| Incident operations (per-domain incident view) | `lcis-operations` `IncidentOperationsService` | The incident-shape substrate |
| Runtime / deployment operations | `lcis-operations` `RuntimeOperationsService`, `DeploymentOperationsService` | Affected-system + deployment context |
| Change history + reasons | **Phase 10 `lcis-tracking`** (timeline, history, recent migrations, semantic diffs) | "What changed recently" evidence |
| Dependency paths / blast | **Phase 11 `lcis-twin`** (shortest path, impact radius, SPOF) + `lcis-core` blast | Symptom → affected-systems propagation |
| Owners | `lcis-governance` `OwnershipService` | Likely-owner attribution |
| Rollback plans | `lcis-engineering` rollback planner (EINS facade) | Recommended-rollback delegation |
| Verification plans | `lcis-engineering` verification planner | Post-fix verification delegation |
| Execution state | `lcis-orchestration` (blocked work, rollout state) | Execution context for the diagnosis |

**Net-new in LRAS (verified absent):** the symptom → ranked-hypothesis engine: a deterministic rule-based diagnosis that takes a natural symptom (orders failing / checkout broken / queue backlog / high latency / deployment failed / worker crashed), maps it to affected domains via a fixed symptom taxonomy, walks the twin for propagation, joins recent changes from LCTS, and emits ranked `CauseHypothesis[]` with evidence + confidence — returning UNKNOWN when signals are absent. No existing package ranks causes for a symptom.

## 2. Phase 12 scope

**New package `packages/lcis-rootcause`** (LRAS). Foundation: `Symptom` (taxonomy of the 6 mandated kinds + free text mapped deterministically by keyword table), `CauseHypothesis` `{ cause, category: change|dependency|infrastructure|configuration|external|unknown, confidence 0..1, connection, evidence[] }`, `Diagnosis` (hypotheses ranked, affected systems/deployments, recent changes/migrations, likelyOwner, recommendedRollback, verificationPlan, honest `UNKNOWN` verdict when nothing matches), provenance-stamped via a `rootcause()` envelope.

Services: SymptomService (parse/classify — deterministic keyword taxonomy, UNKNOWN on no match), HypothesisService (rule registry RC01.. mapping symptom×context→causes), AffectedService (twin impact radius + operations areas), ChangeCorrelationService (LCTS recent timeline ∩ affected subjects), AttributionService (owners), RemediationService (EINS rollback+verification delegation), facade `RootCauseEngine` → `diagnose(symptomText)` + `generateDiagnosisReport`.

Anti-hallucination law (enforced by tests): every hypothesis must carry ≥1 evidence item; empty evidence → the hypothesis is dropped; zero hypotheses → verdict UNKNOWN with the exact missing signals named.

## 3. Verification plan

`pnpm typecheck test --filter=@letbuyy/lcis-rootcause`. Target ≥350 tests: taxonomy ~50, per-service ~40×6, facade ~40, determinism (same symptom+fixtures → identical diagnosis) ~15, UNKNOWN honesty ~20, security scan ~25.
