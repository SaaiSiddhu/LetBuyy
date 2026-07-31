# LCIS Phase 4 — Execution Intelligence System (EIS)

**Phase 4 deliverable.** `@letbuyy/lcis-execution` — the read-only planning layer that sits above `lcis-core` and `lcis-live`.

> **As-built status (2026-06-20):** all 7 services built and exported. No tests directory was found in the package (the test command in `package.json` targets `test/*.test.ts`); runtime deps are `@letbuyy/lcis-core`, `@letbuyy/lcis-live`, and `zod`.

---

## 1. Where EIS Sits

```
@letbuyy/lcis-live           (Phase 3 — live provider adapters)
@letbuyy/lcis-core           (Phase 2 — blast-radius, memory, decision, verification, architecture)
@letbuyy/lcis-execution      (Phase 4 — THIS PACKAGE)
  └── CLI / MCP / PR Intelligence / apps/lcis (consumers)
```

EIS adds no new intelligence engine. Every structural reasoning call — blast radius, impact, relationships, BM25 memory search, graph node lookup — is delegated to `@letbuyy/lcis-core` (`LcisEngine`). EIS composes those results into seven planning artifacts.

---

## 2. The "Plan, Never Execute" Principle

Every class in the package carries the same absolute contract in its file header:

> ABSOLUTE READ-ONLY: plans/analyzes/recommends — NEVER executes/mutates/writes/runs.
> Forbidden: no network, no process spawning, no file mutations, no eval, no DB writes.

This is structural, not aspirational:
- No `fetch`, no `child_process`, no `fs.writeFile`, no `eval`
- No Supabase client, no Cloudflare API calls
- No AI/LLM/embedding calls
- Every output carries `evidence`, `confidence` (0–0.95, never fabricated), `sources`, and `timestamp` via `plan()` in `shared/envelope.ts`

---

## 3. The Foundation Pipeline

Every plan is derived in the same order:

```
ChangeRequest
     │
     ▼
SeedResolver          resolves NL text → graph entities
     │                (no LLM; pure token matching against domain-intel / db-intel)
     ▼
ChangeAnalyzer        composes lcis-core blast/impact/relationships + BM25 memory
     │                → ChangeAnalysis (the single shared spine)
     ▼
┌────────────────────────────────────────────────────────┐
│  derived independently from the same ChangeAnalysis:   │
│                                                        │
│  ExecutionIntelligenceService  → ExecutionPlan         │
│  ExecutionGraphService         → ExecutionGraph        │
│  MigrationIntelligenceService  → MigrationPlan         │
│  TestingIntelligenceService    → TestPlan              │
│  RollbackIntelligenceService   → RollbackPlan          │
│  LaunchIntelligenceService     → LaunchPlan            │
│  VerificationPlanner           → VerificationPlan      │
└────────────────────────────────────────────────────────┘
```

The ChangeAnalysis is computed once in `EisEngine.planAll()` and passed to every service — no service re-resolves seeds independently.

---

## 4. The Six Planning Services (+ the graph builder)

| Service | File | Deliverable | Primary method |
|---------|------|-------------|----------------|
| `ExecutionIntelligenceService` | `execution/ExecutionIntelligenceService.ts` | `ExecutionPlan` | `planImplementation(input)` |
| `ExecutionGraphService` | `execution/ExecutionGraphService.ts` | `ExecutionGraph` | `build(input)` |
| `MigrationIntelligenceService` | `migration/MigrationIntelligenceService.ts` | `MigrationPlan` | `analyzeMigration(input)` |
| `TestingIntelligenceService` | `testing/TestingIntelligenceService.ts` | `TestPlan` | `generateTestPlan(input)` |
| `RollbackIntelligenceService` | `rollback/RollbackIntelligenceService.ts` | `RollbackPlan` | `generateRollbackPlan(input)` |
| `LaunchIntelligenceService` | `launch/LaunchIntelligenceService.ts` | `LaunchPlan` | `evaluateLaunch(input)` |
| `VerificationPlanner` | `launch/VerificationPlanner.ts` | `VerificationPlan` | `buildVerificationPlan(input)` |

Every service accepts `ChangeRequest | ChangeAnalysis` via the `toAnalysis()` helper (`shared/change-analysis.ts`). If a pre-computed `ChangeAnalysis` is passed it is reused directly; a raw `ChangeRequest` is analyzed on the spot.

`LaunchIntelligenceService.evaluateLaunch()` is the only `async` method in the package. The async boundary exists because `calculateLaunchReadiness`, `detectLaunchBlockers`, `generateGoNoGoDecision`, and `generateLaunchChecklist` run concurrently via `Promise.all`.

---

## 5. `EisEngine` — The Facade

`src/engine.ts` wires all services into a single object.

```typescript
interface EisEngine {
  readonly core: LcisEngine;
  readonly analyzer: ChangeAnalyzer;
  readonly execution: ExecutionIntelligenceService;
  readonly executionGraph: ExecutionGraphService;
  readonly migration: MigrationIntelligenceService;
  readonly testing: TestingIntelligenceService;
  readonly rollback: RollbackIntelligenceService;
  readonly launch: LaunchIntelligenceService;
  readonly verification: VerificationPlanner;

  analyze(req: ChangeRequest): ChangeAnalysis;
  planAll(req: ChangeRequest): Promise<FullPlan>;
}
```

`planAll()` produces `FullPlan` — all seven plans in one call:

```typescript
interface FullPlan {
  change: ChangeAnalysis;
  execution: ExecutionPlan;
  executionGraph: ExecutionGraph;
  migration: MigrationPlan;
  tests: TestPlan;
  rollback: RollbackPlan;
  launch: LaunchPlan;
  verification: VerificationPlan;
}
```

Note: `rollback` in `planAll` is produced by `this.rollback.generateRollbackPlan(req)` — it receives the raw `ChangeRequest`, not the pre-computed `ChangeAnalysis`. This is intentional: `RollbackIntelligenceService.detectIrreversibleChanges` uses the `input.text` string directly to pattern-match drop/delete verbs.

Entry points:

```typescript
createEisEngine(opts?: EisOptions): EisEngine   // new instance each call
getEisEngine(opts?: EisOptions): EisEngine      // process-wide singleton (reuses lcis-core singleton)
resetEisEngine(): void                           // test teardown only
```

`EisOptions.core` overrides the underlying `LcisEngine`; `EisOptions.now` injects a deterministic clock.

---

## 6. The Shared Layer (`src/shared/`)

| Module | Purpose |
|--------|---------|
| `types.ts` | Frozen type vocabulary — all plan artifact shapes (`PlanArtifact`, `ChangeAnalysis`, `ExecutionPlan`, `MigrationPlan`, `TestPlan`, `RollbackPlan`, `LaunchPlan`, `VerificationPlan`, `ExecutionGraph`). No service imports here. |
| `seed-resolver.ts` | `SeedResolver` — maps `ChangeRequest` to `ResolvedSeed[]`. Explicit seeds score 1.0; domain key/label token matches score 0.6–0.9; table name matches score 0.7–0.85. No LLM. |
| `change-analysis.ts` | `ChangeAnalyzer` — the change planner. Calls `engine.blast.impact()`, `blast.relationships()`, `blast.blast()`, `engine.memory.search()`, and `engine.graph.search()`. Exposes `toAnalysis()` helper. |
| `scoring.ts` | `assessComplexity()` + `assessRisk()` — pure functions. Complexity is a weighted sum over the affected footprint; risk is elevated by money/tenant flags and async workers. |
| `envelope.ts` | `plan()` — stamps `evidence`, `confidence`, `sources`, `timestamp` onto every output. Confidence = `0.5 + min(evidenceCount, 9) * 0.05`, capped at `0.95`. Zero evidence → confidence `0`. |

---

## 7. Work Item Categories

The `WorkCategory` union defines the taxonomy used throughout `ExecutionPlan` and `ExecutionGraph`:

```
'schema' | 'rpc' | 'api' | 'worker' | 'ui' | 'test' | 'docs' | 'migration' | 'config' | 'verification'
```

`deriveWorkItems()` (in `ExecutionGraphService`) produces work items in this dependency order:

```
schema items (per table)
  ├── rpc items (per RPC, depends on schema)
  │     └── api items (per route, depends on rpc)
  ├── worker items (per worker, depends on schema)
  └── migration item (one, depends on schema)
        └── test item (depends on api + rpc)
              └── verification item (depends on everything)
docs item (no deps — parallelizable from the start)
```

---

## 8. The Reuse-Not-Rebuild Design

Every structural fact in EIS comes from `@letbuyy/lcis-core`:

| What EIS needs | Where it comes from |
|----------------|---------------------|
| Domain blast radius | `engine.blast.impact(domainKey)` |
| Table FK relationships | `engine.blast.relationships(tableName)` |
| Symbol blast | `engine.blast.blast(symbolId)` |
| Graph node search | `engine.graph.search(term, limit)` |
| Governance/runbook docs | `engine.memory.search(text, {limit})` |
| Raw artifact read | `engine.store.tryRead<T>(artifactName)` |

EIS never has its own graph traversal, BM25 index, or JSON loader. `assessComplexity()` and `assessRisk()` in `scoring.ts` are the only pure-computation functions local to EIS.

---

## 9. Access Surface

`@letbuyy/lcis-execution` is a library package. Its public exports (via `src/index.ts`):

- All types from `shared/index` (re-exported)
- `ExecutionIntelligenceService`, `ExecutionGraphService`
- `MigrationIntelligenceService`
- `TestingIntelligenceService`
- `RollbackIntelligenceService`
- `LaunchIntelligenceService`, `VerificationPlanner`
- `EisEngine`, `EisOptions`, `FullPlan`, `createEisEngine`, `getEisEngine`, `resetEisEngine`

EIS is consumed by CLI commands, MCP tools, PR Intelligence gates, and the `apps/lcis` UI. None of these consumers need to reach into service internals — the facade methods are the intended surface.

---

## 10. Provenance Contract

Every plan artifact returned by EIS implements `PlanArtifact`:

```typescript
interface PlanArtifact {
  readonly evidence: readonly Evidence[];   // every fact cited
  readonly confidence: number;              // 0..0.95, never claims certainty
  readonly sources: readonly string[];      // artifact file paths (e.g. graphify-out/domain-intel.json)
  readonly timestamp: string;              // ISO-8601 generation time
}
```

An `unresolved: true` flag on `ChangeAnalysis` means no seed resolved — the analysis is explicitly empty rather than fabricated. Every downstream plan detects this and returns honest empty results.
