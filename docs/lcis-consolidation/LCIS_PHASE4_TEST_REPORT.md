# LCIS Phase 4 Test Report

**Date:** 2026-06-20  
**Scope:** `@letbuyy/lcis-execution` (new) + 4 extended access packages  
**Verified against:** actual test runs (`pnpm --filter "@letbuyy/lcis-*" test`)

---

## Aggregate Result

| Metric | Value |
|--------|-------|
| **Total passing tests (all 8 LCIS packages)** | **1046** |
| **Total failing** | **0** |
| **New in Phase 4** | **265** (lcis-execution) + incremental additions to cli/mcp/api/pr-check |
| **Phase 1–3 baseline** | 781 (confirmed by running Phase 3 packages minus Phase 4 contributions) |

Test runner: `tsx --test` (Node.js built-in test runner).

---

## Per-Package Breakdown

| Package | Location | Tests | Notes |
|---------|----------|-------|-------|
| `@letbuyy/lcis-core` | `packages/lcis-core/` | 140 | Unchanged from Phase 3 |
| `@letbuyy/lcis-adapters` | `packages/lcis-adapters/` | 172 | Unchanged from Phase 3 |
| `@letbuyy/lcis-live` | `packages/lcis-live/` | 67 | Unchanged from Phase 3 |
| `@letbuyy/lcis-execution` | `packages/lcis-execution/` | **265** | New package (Phase 4) |
| `@letbuyy/lcis-pr-check` | `packages/lcis-pr-check/` | 128 | Extended: verdicts suite added |
| `services/lcis-api` | `services/lcis-api/` | 96 | Extended: 7 plan routes added |
| `@letbuyy/lcis-cli` | `packages/lcis-cli/` | 89 | Extended: plan command group added |
| `@letbuyy/lcis-mcp` | `packages/lcis-mcp/` | 89 | Extended: 7 plan tools added |
| **Total** | | **1046** | **0 failures** |

---

## `@letbuyy/lcis-execution` — 265 Tests Across 7 Suites

The 265 tests run as 7 files (`test/*.test.ts`). The node test runner reports `7 suites` and `265 tests`.

### `test/foundation.test.ts` — 12 Tests

The foundation layer: `SeedResolver`, `ChangeAnalyzer`, `assessComplexity`, `assessRisk`, `plan()` envelope, `planConfidence`, `tokenizeRequest`. Runs against real `graphify-out` artifacts; pulls real `moneyTable` / `tenantTable` / `aDomain` so assertions are not brittle to specific names.

| Subject | Assertions |
|---------|-----------|
| `tokenizeRequest` | Strips stopwords + short tokens, de-duplicates; `"Add GST Filing"` → `['gst', 'filing']` |
| `plan()` envelope | Stamps `evidence`, `confidence ∈ (0,0.95]`, `sources`, `timestamp` |
| `planConfidence` | Returns 0 for zero evidence; capped at 0.95 for large evidence arrays |
| `assessComplexity` | Empty footprint → `trivial`; 4+ domains / 10 tables / 2+ RPCs → `high` or `severe` |
| `assessRisk` | Money table → `critical`; tenant table → at least `high`; empty → `low` |
| `SeedResolver` | Explicit seeds resolve at score 1 with evidence; NL `"Add GST Filing"` resolves to real GST entities, no LLM |
| `ChangeAnalyzer` | Real domain → non-empty footprint with full provenance; money table → `risk.money = true`, `risk.level = 'critical'`, rollbackStrategy references ledger; tenant table → `launchImpact` references tenancy/merchants; unmatched request → `unresolved = true`, `affected.domains = []`, evidence cites `'unresolved'`; all `affected` keys are arrays |

### `test/execution.test.ts` — 47 Tests

`ExecutionIntelligenceService`, `ExecutionGraphService`, and the `work-graph.ts` utilities (`topoSort`, `criticalPath`).

| Subject | Key assertions |
|---------|---------------|
| Read-only source scan | No `fetch(`, `child_process`, `spawn(`, `exec(`, `eval(`, `writeFile`, `appendFile` in `src/execution/*.ts` |
| `topoSort` | Empty input → empty order; single node → layer 0; linear chain → correct topo order; parallel nodes sorted alphabetically within layer; node with missing dep → blocked |
| `criticalPath` | Empty → empty; linear chain length == nodes count; branching picks longest path, excludes shorter branch |
| `analyzeChange` | Returns `ChangeAnalysis` with provenance; unresolved → honestly empty |
| `estimateComplexity` | Returns `ComplexityAssessment`; unresolved → `trivial`/0; pre-computed analysis re-used (facade reuse) |
| `estimateRisk` | Money table → `critical`; returns valid `RiskAssessment`; unresolved → `low`/0 |
| `estimateDependencies` | Returns string array; de-duped (no repeat entries) |
| `generateWorkBreakdown` | Always includes `test`, `docs`, `verification` items; one `schema` item per affected table; `migration` item when tables affected; `rpc` items depend on `schema` items; `verification` depends on `wb-test-0`; every item has evidence; money change → schema items are `high` or `critical` risk |
| `generateMilestones` | Non-empty; every milestone has `id`, `title`, `items[]`, `gate`; `milestone-4` (Test & Verify) always present; all work item ids covered |
| `generateExecutionChecklist` | Items have `done: false`, `step`, `category`, `evidence`; schema before rpc in order |
| `generateExecutionGraph` | Carries provenance; `implementationOrder` is valid topological order; `criticalPath` non-empty when deps exist; `parallelizable` nodes have no `dependsOn`; all nodes in order appear in nodes array; `onCriticalPath` correct on nodes |
| `ExecutionGraphService.build` | Same `implementationOrder`/`criticalPath`/`parallelizable` as `eis.generateExecutionGraph` |
| `planImplementation` / `buildExecutionPlan` | Returns `ExecutionPlan` with full provenance; all required fields present; alias produces same result; unresolved → plan honestly empty; determinism (same request+now → deep-equal) |

### `test/migration.test.ts` — 46 Tests

`MigrationIntelligenceService`. Runs against real artifacts; uses `relationship-intel.json` to find high fan-in tables.

| Subject | Key assertions |
|---------|---------------|
| Read-only source scan | No forbidden APIs in `src/migration/*.ts` |
| `analyzeMigration` | Carries `evidence`, `confidence ∈ (0,0.95]`, `sources`, `timestamp`; all required fields present |
| Money table | `detectDataLossRisk` → `risk: 'high'`; reason references `canonical-ledger`; `readiness.ready = false` with blocker; `simulatedImpact` non-empty |
| Tenant table | Data-loss risk `high`; readiness warning about tenant table |
| High FK fan-in table | Data-loss risk `high` |
| FK ordering | Referenced table comes before referencer in `dependencyOrder` |
| Reversibility | `kv`/`r2` steps are irreversible; SQL column-add is reversible |
| LCIS DDL-honesty note | `simulatedImpact` includes "NOT executed by LCIS" |
| Determinism | Two calls with same input → identical output |

### `test/testing.test.ts` — 42 Tests

`TestingIntelligenceService`.

| Subject | Key assertions |
|---------|---------------|
| Read-only source scan | No forbidden APIs; imports only from `../shared/index` and `@letbuyy/lcis-core` |
| `detectAffectedTests` | Returns string array; money/tenant domain returns non-empty |
| `detectMissingCoverage` | Returns `CoverageGap[]`; unresolved → empty |
| `generateTestPlan` | Carries all required top-level fields; `recommended` always present; money + tenant → `recommended` non-empty |
| Per-kind helpers | `generateRegressionPlan`, `generateSmokePlan`, `generateLoadPlan`, `generateSecurityPlan`, `generateAcceptancePlan` each return typed arrays; money/tenant → security plan non-empty; money/tenant → critical/high coverage gaps |
| `coverageConfidence` | Always in `[0,1]`; unresolved → 0; no fabrication |
| Determinism | Identical inputs → identical outputs |

### `test/rollback.test.ts` — 56 Tests

`RollbackIntelligenceService`. Uses a mock-engine builder for pure-unit coverage alongside the real engine.

| Subject | Key assertions |
|---------|---------------|
| `detectIrreversibleChanges` | Money table → irreversible finding; schema deletion → irreversible; no-table request → empty |
| `detectRollbackRisk` | Money + irreversible → risk `critical`; clean → `low` |
| `identifyRollbackDependencies` | Returns string array; money change includes payment/refund RPC dependencies |
| `identifyRecoverySteps` | Returns ordered `RollbackStep[]`; steps cover deploy-revert, worker, migration-down; money → includes ledger-safe reversal step |
| `estimateRecoveryTime` | Returns a string; money → longer estimate than clean |
| `generateRollbackPlan` | Carries full provenance; `readiness` is `'READY' | 'CONDITIONAL' | 'NOT_READY'`; money → `readiness: 'NOT_READY'`, irreversible findings present; steps are ordered (no missing order values); clean → `READY`; unresolved → `READY`, no irreversible findings |
| Read-only enforcement | Source scan passes |

### `test/launch.test.ts` — 50 Tests

`LaunchIntelligenceService` and `VerificationPlanner` (Deliverables 6 + 7).

| Subject | Key assertions |
|---------|---------------|
| `calculateLaunchReadiness` | Returns number in `[0,1]`; money risk lowers readiness vs clean; tenant risk lowers readiness; deterministic; value stays ≤ 1 even for zero-risk change |
| `detectLaunchBlockers` | All blockers have required fields; money change includes money-path blocker; tenant change includes tenant-RLS blocker; clean → no money/RLS blockers; blockers from real artifact have `state: 'KNOWN'` |
| `generateLaunchChecklist` | Items present with required fields; covers areas: readiness, tests, rollback, security, observability, migration; tenant → RLS item; money → rollback item referencing ledger |
| `generateGoNoGoDecision` | Has provenance; `decision` is `GO | CONDITIONAL_GO | NO_GO`; `blockers` present; `unknowns` is string[]; KNOWN critical blocker → `NO_GO` (never softened); unknowns → at most `CONDITIONAL_GO` (never silently `GO`); rationale non-empty; all three verdicts reachable; money change → `NO_GO`; deterministic |
| `evaluateLaunch` | Returns `LaunchPlan` with all required fields; request echoed; readiness matches `calculateLaunchReadiness`; decision matches `generateGoNoGoDecision`; deterministic; `confidence ∈ [0,0.95]`; `sources` all strings |
| `buildVerificationPlan` | Returns `VerificationPlan` with all required fields; each check has `id`, `description`, `method`, `evidence`; pre-merge gates include typecheck and governance gate; post-deploy checks include production-readiness verify; money → canonical-ledger gate + VC-06-money-rpc check; tenant → RLS check + post-deploy RLS check; clean → no VC-06/VC-07; core checks VC-01..VC-05 always present; accepts pre-computed `ChangeAnalysis` |
| Read-only source scan | No forbidden APIs in `src/launch/*.ts` |

### `test/engine.test.ts` — 12 Tests

`EisEngine` facade — end-to-end integration.

| Subject | Key assertions |
|---------|---------------|
| `planAll` | Produces all 8 plans for a natural-language request |
| Provenance | Every plan in the full set carries `evidence`, `confidence`, `sources`, `timestamp` |
| Clock injection | Every plan timestamp honours the injected clock |
| Confidence bounds | Always in `[0, 0.95]` across all 8 plans |
| Determinism | Same request+now → deep-equal `FullPlan` |
| Money propagation | Money change → `risk.money = true`, `risk.level = 'critical'`, rollback has irreversible findings, migration `readiness.ready = false` |
| `analyze()` | Returns `ChangeAnalysis` backbone with `affected`, `seeds`, `risk`; honours clock |
| Singleton | `getEisEngine()` returns same instance; `resetEisEngine()` clears it |
| Launch decision | One of `GO | CONDITIONAL_GO | NO_GO` with rationale |
| Graph ordering | No item before its dependencies in `executionGraph.implementationOrder` |
| Unresolved | `unresolved = true`; all 8 plans still carry provenance; `affected.domains = []` |

---

## Key Contract Assertions

The following invariants are verified by at least one test in `lcis-execution` and transitively by the access-layer tests:

| Contract | Where verified |
|----------|---------------|
| Every plan output carries `evidence[]`, `confidence ∈ [0, 0.95]`, `sources[]`, `timestamp` | All 7 test suites |
| Confidence is 0 when there is no evidence | `foundation.test.ts` (`planConfidence`) |
| Confidence is capped at 0.95 (structural-only; no certainty claimed) | `foundation.test.ts`, `engine.test.ts` |
| Money table → `risk.money = true`, `risk.level = 'critical'`, rollback irreversible, migration NOT_READY | `foundation.test.ts`, `execution.test.ts`, `migration.test.ts`, `rollback.test.ts`, `engine.test.ts` |
| Tenant table → multi-tenant launch impact, RLS checks in verification | `foundation.test.ts`, `launch.test.ts` |
| Unresolved (no seed matched) → `unresolved = true`, empty affected sets, evidence cites `'unresolved'`, exit 0 | `foundation.test.ts`, `engine.test.ts`, `execution.test.ts` |
| `implementationOrder` is a valid topological order (no item before its deps) | `execution.test.ts`, `engine.test.ts` |
| Read-only by construction | Source scans in `execution.test.ts`, `testing.test.ts`, `rollback.test.ts`, `launch.test.ts` |
| Determinism (same request + same clock → deep-equal output) | `execution.test.ts`, `migration.test.ts`, `rollback.test.ts`, `launch.test.ts`, `engine.test.ts` |
| KNOWN critical blocker → `NO_GO` (never softened to `CONDITIONAL_GO`) | `launch.test.ts` |
| `UNKNOWN` forces at most `CONDITIONAL_GO` (never silently `GO`) | `launch.test.ts` |

---

## Layered Test Strategy

```
foundation (seed-resolver + change-analysis + scoring + envelope)
  └─ seeds resolved deterministically, honesty contract established

        ↓

5 service suites (execution / migration / testing / rollback / launch+verification)
  └─ each service against real graphify-out artifacts
  └─ read-only source scan per service
  └─ determinism per service

        ↓

facade suite (engine.test.ts)
  └─ end-to-end planAll: one request → 8 plans
  └─ provenance + money/tenant propagation through full pipeline
  └─ singleton / reset lifecycle

        ↓

access layer (cli.test.ts, tools.test.ts, app.test.ts, verdicts.test.ts)
  └─ plan command/tool/route exists and returns correct envelope source
  └─ unresolved request exits 0 (no crash)
  └─ PR verdicts: 6 dimensions, correct structure, backward compat
```
