# LQAS Discovery — Quality Analytics System (Phase 15)

**Date:** 2026-07-04 · Verified against the real repository. **No coding before this discovery.**

## 1. What already exists (LQAS composes)

| Capability | Where (verified) | LQAS reuse |
|---|---|---|
| Test / verification planning | `lcis-engineering` `VerificationIntelligenceService`: planTests / planVerification / coverageGaps / acceptanceCriteria | Coverage-gap + test-plan substrate |
| Testing compliance | `lcis-governance` `ComplianceService.evaluateTestingCompliance` | Test-quality compliance signal |
| Architecture quality signals | **Phase 11 `lcis-twin`**: cycles (coupling), SPOF (fragility), fan-in/out (complexity) | Architecture quality + maintainability + complexity |
| Change churn | **Phase 10 `lcis-tracking`** timeline (change frequency per subject) | Tech-debt hotspot ranking (churn × complexity) |
| Structural inventory | `graphify-out/db-intel.json` / `infra-intel.json` / `graph.json` via core | Doc/API surface counts, complexity via graph degree |
| Verification/readiness | `lcis-core` `VerificationService`, `lcis-governance` readiness | Quality gates |

**Net-new in LQAS (verified absent):** a unified quality-analytics report — test/coverage/mutation analytics, flaky-test detection, documentation quality, API quality, architecture quality, technical debt, maintainability, complexity, and a composite quality score. Coverage/mutation/flaky **values** require CI test-run data → NOT_CONNECTED with exact source; structural quality (complexity via graph fan/degree, architecture cycles/SPOF, doc/API presence) is CONNECTED.

## 2. Phase 15 scope — new package `packages/lcis-quality`

Foundation: `QualityFinding`, `TestAnalytics`, `CoverageAnalytics`, `MutationAnalytics`, `FlakyReport`, `DocQuality`, `ApiQuality`, `ArchitectureQuality`, `TechDebtItem`, `Maintainability`, `Complexity`, `QualityScore`, flagship `QualityReport`; rules QA01–QA08; `quality()` envelope.

Services (6):
1. **TestAnalyticsService** — test-plan/coverage-gap composition (engineering) + honest NOT_CONNECTED coverage/mutation/flaky values (source: CI test-run store).
2. **ComplexityService** — per-entity complexity from graph fan/degree (CONNECTED structural).
3. **ArchitectureQualityService** — twin cycles/SPOF/fan → architecture quality + maintainability.
4. **TechDebtService** — churn (tracking) × complexity → ranked debt hotspots.
5. **DocApiQualityService** — doc/API presence & drift from artifacts.
6. **QualityScoreService** — deterministic weighted composite (pure) → quality score + health + advisory recommendations.

Facade: `QualityAnalyticsEngine.generateQualityReport()`.

Honesty: structural quality CONNECTED; coverage/mutation/flaky NOT_CONNECTED + exact source; advisory-only.

## 3. Verification plan

`pnpm typecheck test --filter=@letbuyy/lcis-quality`. Target ≥500 tests.
