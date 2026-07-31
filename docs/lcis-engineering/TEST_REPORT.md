# EINS (LCIS Phase 7) — Test Report

**Date:** 2026-06-21
**Status:** 2613 pass / 0 fail — typecheck clean

---

## Authoritative Test Counts (node --test runtime)

All counts below are `node --test` runner totals — per package (this table) and per file (the breakdown that follows). Static `test()`/`it()` declaration counts can differ from these runtime totals; the runner figures are authoritative.

| Package | Tests | Notes |
|---|---|---|
| `@letbuyy/lcis-core` | 140 | Phases 1–2 foundation |
| `@letbuyy/lcis-adapters` | 172 | Phase 3 live adapter contracts |
| `@letbuyy/lcis-live` | 67 | Phase 3 live probes |
| `@letbuyy/lcis-execution` | 265 | Phase 4 EIS (change/migration/test/rollback/launch) |
| `@letbuyy/lcis-governance` | 302 | Phase 5 GDIS (drift/compliance/ownership/security/readiness) |
| `@letbuyy/lcis-operations` | 512 | Phase 6 LCOS (runtime/commerce/merchant/customer/deployment/incident/security/forecast) |
| `@letbuyy/lcis-engineering` | **378** | Phase 7 EINS — this phase |
| `@letbuyy/lcis-cli` | 169 | Access; Phase 7 added 22 engineering commands |
| `lcis-api` | 198 | HTTP API access layer; Phase 7 added 27 POST /engineering/* routes |
| `@letbuyy/lcis-mcp` | 175 | MCP server; Phase 7 added 30 (7 `lcis_engineering_*` tools; registry now 42) |
| `@letbuyy/lcis-pr-check` | 235 | PR analysis; Phase 7 added 52 (`analyzeWithEngineering` + `## LCIS ENGINEERING` section) |
| **Total** | **2613** | **0 failures** |

Phase 7 net-new: **515 tests** (lcis-engineering 378 + access extensions 137).

---

## lcis-engineering Suite Breakdown (378 tests)

### foundation.test.ts — 9 tests
Asserts the FROZEN shared primitives. Tests cover:
- `EngineeringArtifactStore.domains()` returns real domain anatomy from live `graphify-out` artifacts (≥ 10 domains present, correct shape).
- `EngineeringRuleRegistry` exposes exactly 8 rules (E001–E008), with correct `mapsTo` governance-rule references and correct `severity` values.
- `EngineeringEvidenceBuilder.reuse()` produces a citation with `ref = '<system>:<method>'` and `source = 'packages/<system>'` (the compose-not-duplicate proof).
- `EngineeringConfidenceCalculator.fromComposed([])` returns 0 (empty input); `fromComposed([0.8, 0.9])` returns a capped mean ≤ 0.9.
- `EngineeringSeverityScorer` returns correct ordinal ordering (`critical > high > medium`).
- `EngineeringFindingBuilder` produces a finding with all required fields present.
- `engineering()` envelope wraps a payload with evidence, confidence, sources, and timestamp.
- Composition smoke-test: `lcis-execution`, `lcis-governance`, `lcis-operations` all wire in via `createEisEngine`/`createGovernanceEngine`/`createOperationsEngine` without error.

### feature.test.ts — FeatureIntelligenceService (44 tests)
- Engine construction with fixed clock.
- Real domain feature → non-empty `domains`/`tables`/`services` sets matching `eis.analyze` delegation.
- Money-table and tenant-table seeds propagate `risk.money = true` and `risk.tenant = true`.
- Reuse-evidence assertion: every output carries an evidence entry with `ref = 'lcis-execution:eis.analyze'` and `source = 'packages/lcis-execution'` (delegation-equality proof).
- Unresolved/gibberish request → `unresolved = true` + empty affected sets (honest, no fabrication).
- Full provenance: `evidence`, `confidence`, `sources`, `timestamp` present on every output.
- Determinism: identical request + fixed `now` clock → `deepEqual` output across two calls.
- Read-only source scan: no `fetch`, `child_process`, `spawn`, `exec`, `eval`, `writeFile`, `appendFile`, `unlink` keywords present in `src/feature/`.

### change.test.ts — ChangeIntelligenceService (35 tests)
- Delegates to `eis.changeSurface` and surfaces results without re-implementing logic (delegation-equality test: `eis.analyze(req).changeSurface` deep-equals `svc.analyzeChange(req)` content).
- Reuse-evidence citation `lcis-execution:eis.changeSurface` present.
- Money change → E001 gate finding emitted.
- RLS/tenant change → E002 gate finding emitted.
- Unresolved input → honest empty findings list.
- Provenance and determinism.
- Read-only source scan.

### migration.test.ts — MigrationIntelligenceService (38 tests)
- Delegates to `eis.migrationPlan`; delegation-equality asserted.
- Reuse-evidence citation `lcis-execution:eis.migrationPlan`.
- Money migration → E001 (canonical-ledger-only-validator gate) emitted as critical finding.
- Missing rollback → E006 (migration rollback path) finding emitted.
- Unresolved input → honest empty.
- Provenance and determinism.
- Read-only source scan.

### verification.test.ts — VerificationIntelligenceService (41 tests)
- Delegates to `eis.verificationPlan`; delegation-equality asserted.
- Coverage gaps → E005 (new public routes covered by tests) finding emitted.
- Reuse-evidence citation `lcis-execution:eis.verificationPlan`.
- Unresolved input → honest empty.
- Provenance and determinism.
- Read-only source scan.

### launch.test.ts — LaunchIntelligenceService (33 tests)
- Delegates to `eis.launchPlan` (async); delegation-equality asserted.
- `launch.decision.decision` is one of `GO` / `CONDITIONAL_GO` / `NO_GO`.
- Money feature → stricter decision (at minimum `CONDITIONAL_GO`, not `GO`).
- Reuse-evidence citation `lcis-execution:eis.launchPlan`.
- Unresolved input → `NO_GO` with honest blockers (not fabricated evidence).
- Provenance and determinism.
- Read-only source scan.

### rollback.test.ts — RollbackIntelligenceService (55 tests)
- Delegates to `eis.rollbackPlan`; delegation-equality asserted.
- Irreversible migration → E006 (rollback path required) finding emitted; readiness `NOT_READY`.
- Reuse-evidence citation `lcis-execution:eis.rollbackPlan`.
- Unresolved input → honest empty.
- Provenance and determinism.
- Read-only source scan.

### task.test.ts — TaskIntelligenceService (51 tests)
- Ordered build sequence: tasks generated span layers in the canonical order `migration → rpc → gateway → proxy → ui → worker → queue → event → test → docs → verification → launch`.
- `dependsOn` is acyclic: every cited dependency id exists in the same task set.
- Money feature → `rpc` layer task carries gate `canonical-ledger-only-validator` (E001).
- Layer-priority ordering: migration tasks have lower numeric priority than verification tasks (executed first).
- `agentType` mapping correct per layer: `migration`/`rpc` → `database`, `gateway`/`proxy` → `backend`, `ui` → `frontend`, `test` → `testing`, `docs` → `documentation`, `verification` → `verification`.
- Reuse-evidence present on all generated tasks.
- Determinism.
- Honest empty list returned for unresolvable request.
- Read-only source scan.

### agent.test.ts — AgentIntelligenceService (50 tests)
- 1:1 mapping: each `EngineeringTask` in input produces exactly one `AgentTask` in output.
- `agentTypeForLayer` mapping correct for all 12 `EngineeringLayer` values.
- `dependsOn` graph fidelity: agent task dependency graph mirrors the input task dependency graph.
- `byAgentType` counts correct (groups tasks by agent type).
- `layerAcceptanceCriterion` returns a non-empty acceptance string for every layer.
- `agentTaskId` produces stable, unique identifiers.
- Full provenance (`evidence`/`confidence`/`sources`/`timestamp`) on the `AgentPlan` envelope.
- Empty-input honesty: `generateAgentPlan([])` → valid empty plan, not an error.
- Determinism.
- Read-only source scan.

### graph.test.ts — EngineeringGraphService (11 tests)
Tests use synthetic task sets with known shapes (not real artifacts) to prove pure DAG correctness:
- Empty task set → empty graph with correct shape (empty nodes/edges/order/criticalPath/parallelizable/blocked).
- Linear chain `a→b→c`: `implementationOrder = ['a','b','c']`, `criticalPath = ['a','b','c']`, `parallelizable = ['a']`, `depth` values 0/1/2 correct.
- Diamond `a→{b,c}→d`: `a` first, `d` last, `criticalPath.length = 3`, both `b` and `c` parallelizable after `a`.
- Independent roots: all roots in `parallelizable`.
- Dangling dependency (dep id not in task set): task marked `blocked`, not included in `implementationOrder`.
- Cyclic dependency: cycle detected → both participants in `blocked`, no crash.
- `milestones` emitted (one per layer boundary).
- Provenance and determinism.

### engine.test.ts — EngineeringEngine facade (11 tests)
End-to-end synthesis against real `graphify-out` artifacts:
- `analyzeFeature({ text: 'Build GST Filing' })` returns `EngineeringImpact` with `domains`/`tables`/`complexity`/`risk` all present, full provenance, timestamp matches fixed clock.
- `generateTasks` returns ordered `EngineeringTask[]`; migration layer appears before verification layer.
- `generateExecutionGraph`: topological order respects all edges (for every edge `from→to`, `pos(from) < pos(to)`); `milestones` array present.
- `generateAgentPlan` maps tasks to agent tasks.
- `generateVerificationPlan` reuses EIS verification plan.
- `generateRollbackPlan` reuses EIS rollback plan.
- `generateBlueprint` (async): `EngineeringBlueprint` has all 13 embedded plan fields (`impact`, `change`, `migration`, `tests`, `verification`, `rollback`, `launch`, `executionGraph`, `ownership`, `compliance`, `security`, `readiness`, `operations`); `gates` is non-empty for real domains.
- `generateFullEngineeringPackage` (async): `decision.verdict` is `GO | CONDITIONAL_GO | NO_GO`; money domain → not `GO`.
- `getEngineeringEngine()` / `resetEngineeringEngine()` singleton contract verified.

---

## Layering Architecture

```
Foundation (shared/)           → EngineeringArtifactStore, EvidenceBuilder, ConfidenceCalculator,
                                 SeverityScorer, RuleRegistry [E001-E008], FindingBuilder, envelope

8 Parallel Services            → FeatureIntelligenceService (delegates lcis-execution:eis.analyze)
(pure composition,               ChangeIntelligenceService  (delegates lcis-execution:eis.changeSurface)
 delegation-equality             MigrationIntelligenceService (delegates lcis-execution:eis.migrationPlan)
 enforced by tests)              VerificationIntelligenceService (delegates lcis-execution)
                                 LaunchIntelligenceService  (delegates lcis-execution)
                                 RollbackIntelligenceService (delegates lcis-execution)
                                 TaskIntelligenceService    [net-new: ordered task synthesis]
                                 AgentIntelligenceService   [net-new: agent plan from tasks]

Graph                          → EngineeringGraphService   [net-new: DAG / topo / criticalPath]

Facade                         → EngineeringEngine (composes all above + lcis-governance + lcis-operations)
                                 generateBlueprint / generateFullEngineeringPackage

Access (extensions)            → lcis-cli: 7 engineering commands (engineering/blueprint/tasks/
                                   rollout/rollback/eng-verify/agent-plan)
                                 lcis-mcp: 7 lcis_engineering_* tools (registry total: 42)
                                 lcis-api: 7 POST /engineering/* HTTP routes
                                 lcis-pr-check: analyzeWithEngineering → ## LCIS ENGINEERING
                                   (6 verdicts: readiness/complexity/risk/coverage/rollback/verification)
```

---

*Test runner: `node --test` via `tsx`. All counts are authoritative runtime expansion counts, not static declaration counts.*
