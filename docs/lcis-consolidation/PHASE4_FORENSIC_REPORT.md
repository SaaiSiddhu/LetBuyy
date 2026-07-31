# LCIS Phase 4 Forensic Report

**Date:** 2026-06-20  
**Scope:** `@letbuyy/lcis-execution` + Phase 4 extensions to `lcis-cli`, `lcis-mcp`, `services/lcis-api`, `lcis-pr-check`  
**Sources verified against:** actual source files on disk + test runs

---

## 0. Mandate

Phases 1–3 delivered the lcis-core structural engine, a live adapter layer, and a CLI/MCP/HTTP access surface. The gap was: given a change request, what should be done, in what order, with what safeguards?

Phase 4 adds a read-only planning layer — the Execution Intelligence System (EIS) — over lcis-core. It answers seven engineering questions for any change:

1. What domains/tables/symbols does this touch? (change analysis)
2. In what order should the work be done? (execution plan + graph)
3. What database/schema/worker steps are required? (migration plan)
4. What tests must run / are missing? (test plan)
5. What security tests are needed? (security test plan)
6. How do we roll back? (rollback plan)
7. Is this ready to launch? (launch plan + verification plan)

It never executes, mutates, migrates, deploys, or writes files.

---

## 1. What Was Built

### New Package: `@letbuyy/lcis-execution`

One new workspace package at `packages/lcis-execution/`. Declares `@letbuyy/lcis-core` and `@letbuyy/lcis-live` as `workspace:*` dependencies. Uses `zod` for the API body schema in the access layer (the EIS types themselves do not use zod).

```
packages/lcis-execution/
  src/
    shared/
      types.ts          — frozen type vocabulary (PlanArtifact + 8 plan types)
      seed-resolver.ts  — NL → graph entity mapping (deterministic, no LLM)
      change-analysis.ts — ChangeAnalyzer (composes blast + BM25; the backbone)
      envelope.ts        — plan() factory: stamps evidence/confidence/sources/timestamp
      scoring.ts         — assessComplexity() + assessRisk() (pure functions)
      index.ts
    execution/
      ExecutionIntelligenceService.ts
      ExecutionGraphService.ts
      work-graph.ts      — topoSort() + criticalPath() utilities
      index.ts
    migration/
      MigrationIntelligenceService.ts
      index.ts
    testing/
      TestingIntelligenceService.ts
      index.ts
    rollback/
      RollbackIntelligenceService.ts
      index.ts
    launch/
      LaunchIntelligenceService.ts
      VerificationPlanner.ts
      index.ts
    engine.ts            — EisEngine facade (createEisEngine / getEisEngine)
    index.ts
  test/
    foundation.test.ts   (12 tests)
    execution.test.ts    (47 tests)
    migration.test.ts    (46 tests)
    testing.test.ts      (42 tests)
    rollback.test.ts     (56 tests)
    launch.test.ts       (50 tests)
    engine.test.ts       (12 tests)
```

### Extended Packages (Additive)

Four Phase 3 packages were extended. No existing commands, exports, tests, or behaviors changed.

| Package | Addition |
|---------|---------|
| `@letbuyy/lcis-cli` | `plan` command group: 8 subcommands (`change`, `execution`, `migration`, `tests`, `security`, `rollback`, `launch`, `release`) |
| `@letbuyy/lcis-mcp` | 7 plan tools registered in `TOOLS` array (`lcis_plan_change` through `lcis_plan_release`) |
| `services/lcis-api` | 7 `POST /plan/*` routes |
| `@letbuyy/lcis-pr-check` | `analyzeWithVerdicts()` function + `ReviewVerdict[]` on `PrReport` + `renderVerdicts()` in `comment.ts` + `verdicts.test.ts` |

---

## 2. Build Sequence (Multi-Agent Execution Order)

The build followed a layered dependency order: no service could be built before the types it consumed.

**Layer 0 — Foundation (must exist before anything else):**
- `shared/types.ts` — the frozen type vocabulary (`PlanArtifact` contract, 8 plan types, `ChangeRequest`, `ResolvedSeed`, etc.)
- `shared/seed-resolver.ts` — `SeedResolver` (NL → graph entities, deterministic)
- `shared/change-analysis.ts` — `ChangeAnalyzer` (the single backbone every plan derives from)
- `shared/envelope.ts` — `plan()` factory
- `shared/scoring.ts` — `assessComplexity()` + `assessRisk()` (pure functions, no engine dependency)
- `test/foundation.test.ts` — 12 tests verifying the contract before any service is written

**Layer 1 — 5 Intelligence Services (parallel after foundation):**
Each service is independently buildable once `shared/` exists.

| Service | File | Key method |
|---------|------|-----------|
| Execution Intelligence | `ExecutionIntelligenceService.ts` | `planImplementation(req)` |
| Execution Graph | `ExecutionGraphService.ts` + `work-graph.ts` | `build(analysis)` |
| Migration Intelligence | `MigrationIntelligenceService.ts` | `analyzeMigration(req)` |
| Testing Intelligence | `TestingIntelligenceService.ts` | `generateTestPlan(req)` |
| Rollback Intelligence | `RollbackIntelligenceService.ts` | `generateRollbackPlan(req)` |
| Launch Intelligence | `LaunchIntelligenceService.ts` | `evaluateLaunch(req)` |
| Verification Planner | `VerificationPlanner.ts` | `buildVerificationPlan(analysis)` |

Each service received its own test suite verifying the PlanArtifact contract, read-only source scan, money/tenant elevation, and determinism.

**Layer 2 — EIS Facade:**
- `engine.ts` — `EisEngineImpl` wires all services; exposes `analyze()` and `planAll()`
- `test/engine.test.ts` — end-to-end integration: all 8 plans, provenance, determinism, singleton

**Layer 3 — Access Extensions (parallel after facade):**
- CLI plan command group (`cli.ts` extension)
- MCP plan tools (`tools.ts` extension)
- API plan routes (`app.ts` extension)
- PR check verdicts (`analyze.ts` + `comment.ts` + `types.ts` extension + `verdicts.test.ts`)

---

## 3. Key Decisions and Tradeoffs

### Deterministic seed resolution — no LLM

The `SeedResolver` maps natural-language text to graph entities by:
1. Explicit seeds at score 1.0 (caller-provided `domains`, `tables`, `symbols`, `files`)
2. NL token matching: lowercase tokens ≥3 chars, stopwords removed, matched against domain `key`/`label` and table `name` fields from the live `graphify-out` artifacts

No embeddings, no generation, no LLM call. Every match is evidence-cited and carries a match score (`0.6`–`0.9` for fuzzy, `1.0` for explicit). A STOPWORDS set covers common instruction words (`add`, `implement`, `build`, `create`, `migrate`, `launch`, etc.). This keeps the system reproducible and auditable: the same input always produces the same output.

Tradeoff: limited NL coverage. Words that don't tokenize to domain/table substrings produce `unresolved: true`. The resolution is: provide explicit seeds, not a more complex resolver.

### Structural-only reasoning + honesty boundaries

Confidence is derived from evidence breadth (`base + min(n, 9) * 0.05`) and capped at `0.95`. LCIS never claims certainty. When no evidence exists, confidence is 0 — the plan is honestly empty, not fabricated. The `unresolved` flag surfaces this explicitly. UNKNOWN blockers in the launch plan are never promoted to PASS.

The `simulatedImpact` field on `MigrationPlan` always includes a note that the impact is NOT executed by LCIS, to prevent the plan text from being mistaken for an execution log.

### Read-only by construction

Every service tests its own source for forbidden patterns: `fetch(`, `child_process`, `spawn(`, `exec(`, `eval(`, `writeFile`, `appendFile`. These are in-process assertions run as part of the normal test suite, not a separate lint step. The `ReadOnlyHttpClient` interface (from lcis-adapters) was extended with an enforcement test in Phase 3; Phase 4 applies the same pattern at the EIS service level.

### Single-analysis backbone (`planAll` design)

`EisEngine.planAll()` calls `ChangeAnalyzer.analyze()` once and passes the resulting `ChangeAnalysis` to all six services. Each service accepts either a `ChangeRequest` or a pre-computed `ChangeAnalysis` (via the `toAnalysis()` helper in `change-analysis.ts`). This prevents the blast-radius query from running 7 times for one release plan request.

### Folding execution graph into execution service

`ExecutionGraphService` is a thin projection over `ExecutionIntelligenceService` (both operate on a `ChangeAnalysis`; the graph is derived from the work breakdown). It exists as a separate class because the facade exposes both `execution` and `executionGraph` as distinct fields in `FullPlan`, allowing callers to use the graph independently without requiring a full execution plan context.

### Folding verification into launch service

`VerificationPlanner` lives in `src/launch/` alongside `LaunchIntelligenceService`. The launch evaluation calls `buildVerificationPlan()` internally but both are exposed independently on the `EisEngine` interface. This keeps the two artifacts (launch readiness vs verification checks) independently accessible while acknowledging their tight conceptual relationship.

### `RollbackIntelligenceService` accepts `ChangeRequest` directly

Unlike most services which work best with a pre-computed `ChangeAnalysis`, `generateRollbackPlan` accepts a raw `ChangeRequest`. This is intentional: rollback planning re-derives the analysis internally via `toAnalysis()`. The tradeoff is a second analysis pass when rollback is requested in isolation — but this keeps the rollback API simple for callers who only need a rollback plan without the rest.

### PR verdicts use a stub EIS engine in tests

The `verdicts.test.ts` builds a minimal stub EIS engine that returns deterministic plans, avoiding the graphify-out artifact dependency in the pr-check test suite. This is the only place in the Phase 4 test suite that does not run against real artifacts — all seven `lcis-execution` test files use `createEngine()` with real data. The tradeoff was accepted because the pr-check package's purpose is to test the verdict logic (dimension/verdict/summary structure), not re-test the EIS engine internals which have their own 265-test suite.

### `plan security` CLI subcommand uses a synthetic envelope

`generateSecurityPlan()` returns `TestTarget[]`, not a full `PlanArtifact`. The CLI `plan security` subcommand wraps the array in a synthetic plan object (with hardcoded `confidence: 0.8` when targets found, `0.3` when empty, and `sources: ['graphify-out/graph.json']`) to keep the envelope pattern consistent with all other plan subcommands. This is a known approximation — the MCP `lcis_plan_tests` tool runs `generateTestPlan()` (which returns a full `TestPlan` including security) instead.

---

## 4. Type System

The `shared/types.ts` file is the frozen type contract. It imports only from `@letbuyy/lcis-core` (the `Evidence` type) and nothing else — no service imports, no cycles.

Eight plan types, all extending `PlanArtifact`:
- `ChangeAnalysis` — the shared backbone
- `ExecutionPlan` — work breakdown + milestones + graph + checklist
- `ExecutionGraph` — topological projection (nodes + edges + criticalPath + parallelizable)
- `MigrationPlan` — migration steps + data-loss risks + reversibility + readiness
- `TestPlan` — required/missing/recommended/regression/smoke/load/security/acceptance
- `RollbackPlan` — readiness + steps + irreversible changes + estimated recovery
- `LaunchPlan` — readiness score + GO/NO_GO decision + blockers + checklist
- `VerificationPlan` — checks + pre-merge gates + post-deploy checks

The `FullPlan` interface on `EisEngine` is the composite output of `planAll()`.

The `ReviewVerdict` type is defined in `shared/types.ts` and re-exported. It is consumed by `lcis-pr-check` — this is the only cross-package type reference introduced in Phase 4.

---

## 5. Evidence: Test Counts

Confirmed by running `pnpm --filter "@letbuyy/lcis-*" test` on 2026-06-20:

| Package | Tests | Pass | Fail |
|---------|-------|------|------|
| `@letbuyy/lcis-core` | 140 | 140 | 0 |
| `@letbuyy/lcis-adapters` | 172 | 172 | 0 |
| `@letbuyy/lcis-live` | 67 | 67 | 0 |
| `@letbuyy/lcis-execution` | **265** | **265** | **0** |
| `@letbuyy/lcis-pr-check` | 128 | 128 | 0 |
| `services/lcis-api` | 96 | 96 | 0 |
| `@letbuyy/lcis-cli` | 89 | 89 | 0 |
| `@letbuyy/lcis-mcp` | 89 | 89 | 0 |
| **Total** | **1046** | **1046** | **0** |

---

## 6. Read-Only Enforcement

The read-only constraint is enforced at three levels:

1. **Source scans in tests** — `execution.test.ts`, `testing.test.ts`, `rollback.test.ts`, `launch.test.ts` each scan their corresponding `src/` directory for forbidden patterns before any other assertion runs. If any forbidden pattern is found, the test suite fails entirely.

2. **Type system** — `EisEngine` exposes only plan-producing methods (`analyze`, `planAll`). There are no mutation methods, no `execute` methods, no file-write methods on the public interface.

3. **Zero external I/O** — services use only `this.engine.*` (blast, graph, memory, store) which read pre-computed artifacts. The underlying `LcisEngine` from lcis-core is itself structurally read-only (no network, no disk writes). `lcis-live` is a declared dependency but is not called by any EIS service at plan time.

---

## 7. What Phase 4 Does NOT Include

- **`lcis-api` package** — there is no `packages/lcis-api` package. The HTTP server lives at `services/lcis-api`. This is unchanged from Phases 1–3.
- **`apps/lcis`** — reserved per the master architecture verdict; not built in Phase 4.
- **Live data wiring** — EIS plans are structural-only. No live adapter is called during planning. The `@letbuyy/lcis-live` dependency is declared for future use.
- **GitHub PR Action integration** — `analyzeWithVerdicts()` is built and tested; wiring it into the GitHub Action workflow is deferred.
- **LLM-backed reasoning** — all planning is deterministic, graph-derived, evidence-cited. No LLM calls.
