# LCIS Execution Intelligence

`ExecutionIntelligenceService` + `ExecutionGraphService` — Deliverables 1 and 8 of the EIS.

**Files:**
- `packages/lcis-execution/src/execution/ExecutionIntelligenceService.ts`
- `packages/lcis-execution/src/execution/ExecutionGraphService.ts`
- `packages/lcis-execution/src/execution/work-graph.ts`

---

## 1. Responsibilities

`ExecutionIntelligenceService` is the full implementation planner. It composes:

1. A `ChangeAnalysis` (from `ChangeAnalyzer`)
2. A work breakdown (`WorkItem[]`) derived from the analysis footprint
3. Five milestone groups
4. An `ExecutionGraph` (topological + critical path, from `ExecutionGraphService`)
5. An ordered checklist
6. The full `ExecutionPlan` artifact

`ExecutionGraphService` is the graph builder. It derives the `WorkItem[]` independently (via shared `deriveWorkItems()`) and applies Kahn's topological sort + critical-path DP from `work-graph.ts`.

Neither service calls the network, spawns processes, or writes files. Both are deterministic given the same input and `now()`.

---

## 2. Public API

### `ExecutionIntelligenceService`

| Method | Input | Returns | Notes |
|--------|-------|---------|-------|
| `analyzeChange(req)` | `ChangeRequest` | `ChangeAnalysis` | Delegates to `ChangeAnalyzer` |
| `estimateComplexity(input)` | `ChangeRequest \| ChangeAnalysis` | `ComplexityAssessment` | Returns `analysis.complexity` directly (avoids double-weighting cross-domain-depth) |
| `estimateRisk(input)` | `ChangeRequest \| ChangeAnalysis` | `RiskAssessment` | Calls `assessRisk()` from `shared/scoring.ts` |
| `estimateDependencies(input)` | `ChangeRequest \| ChangeAnalysis` | `string[]` | `analysis.dependencies + analysis.suggestedSequence`, deduped |
| `generateWorkBreakdown(input)` | `ChangeRequest \| ChangeAnalysis` | `WorkItem[]` | Delegates to `deriveWorkItems()` |
| `generateMilestones(input)` | `ChangeRequest \| ChangeAnalysis` | `Milestone[]` | Groups work items into up to 5 milestones |
| `generateExecutionChecklist(input)` | `ChangeRequest \| ChangeAnalysis` | `ExecutionChecklistItem[]` | Ordered by topo sort; blocked items appended at end |
| `generateExecutionGraph(input)` | `ChangeRequest \| ChangeAnalysis` | `ExecutionGraph` | Delegates to `ExecutionGraphService.build()` |
| `planImplementation(input)` | `ChangeRequest \| ChangeAnalysis` | `ExecutionPlan` | The primary composed artifact (all sub-plans included) |
| `buildExecutionPlan(input)` | `ChangeRequest \| ChangeAnalysis` | `ExecutionPlan` | Alias for `planImplementation` |

### `ExecutionGraphService`

| Method | Input | Returns |
|--------|-------|---------|
| `build(input)` | `ChangeRequest \| ChangeAnalysis` | `ExecutionGraph` |

---

## 3. Work Breakdown — Categories and `dependsOn`

`deriveWorkItems()` (exported from `ExecutionGraphService`) builds `WorkItem[]` from a `ChangeAnalysis`. The item IDs follow the pattern `wb-<category>-<index>`.

```
Category    ID pattern          dependsOn
──────────────────────────────────────────────────────────
schema      wb-schema-{n}       []
rpc         wb-rpc-{n}          [all schema ids]
api         wb-api-{n}          [all rpc ids]
worker      wb-worker-{n}       [all schema ids]
migration   wb-migration-0      [all schema ids]   (only when affected.tables.length > 0)
test        wb-test-0           [all api ids, all rpc ids]
docs        wb-docs-0           []                 (parallelizable from day 0)
verification wb-verification-0  [all schema, rpc, api, worker, migration ids, wb-test-0]
```

Items carry the `risk` of the overall change analysis (`RiskLevel`), except `test`, `docs`, and `verification` which are always `'low'`.

Each `WorkItem` also carries its domain (`affected.domains[0] ?? null`) and one `Evidence` entry citing the relevant graphify-out artifact.

---

## 4. Milestones

`generateMilestones()` groups work items into up to 5 phases. Each milestone has a `gate` string that must be satisfied before proceeding.

| Milestone | `id` | Categories included | Gate |
|-----------|------|---------------------|------|
| Schema & Migration | `milestone-1` | `schema`, `migration` | all migrations applied + schema diff reviewed |
| Backend RPC/API | `milestone-2` | `rpc`, `api` | typecheck passes + unit tests green for affected RPCs/routes |
| Workers/Async | `milestone-3` | `worker` | worker idempotency verified + queue throughput tested |
| Test & Verify | `milestone-4` | `test`, `verification` | all tests green + blast re-check passes + production-readiness verify |
| Docs & Launch | `milestone-5` | `docs` | documentation updated + launch checklist signed off |

Milestones 1, 2, and 3 are omitted when the affected footprint contains no items in their categories (e.g. a change with no tables skips M1).

---

## 5. Execution Graph — Structure and Algorithms

### `ExecutionGraph` type

```typescript
interface ExecutionGraph extends PlanArtifact {
  nodes: readonly ExecutionGraphNode[];        // one per WorkItem
  edges: readonly ExecutionGraphEdge[];        // depends-on relationships
  implementationOrder: readonly string[];      // topologically sorted ids
  criticalPath: readonly string[];             // longest dependency chain (ids)
  parallelizable: readonly string[];           // ids at layer 0 with no blocked ancestors
  blocked: readonly string[];                  // ids in cycles or with missing deps
}
```

### Topological sort (`work-graph.ts — topoSort`)

Uses Kahn's algorithm with a stable alphabetical tie-break within each layer. Each node gets a `layer` depth (0 = no prerequisites). The `blocked` set is any node whose `dependsOn` references an id not in the node set, or is part of a cycle.

```
Layer 0: docs, schema items               (no prerequisites)
Layer 1: rpc, worker, migration items     (depend on schema)
Layer 2: api items                        (depend on rpc)
Layer 3: test item                        (depends on api + rpc)
Layer 4: verification item                (depends on all of the above)
```

`parallelizable` = ids at layer 0 that are not in `blocked`.

### Critical path (`work-graph.ts — criticalPath`)

DP over topo order: longest path ending at each node (by hop count). Ties broken by lexicographically smallest terminal node id. The path is reconstructed by following `prev` pointers from the terminal.

### `onCriticalPath` flag

Each `ExecutionGraphNode` carries `onCriticalPath: boolean` — derived from the critical-path id set.

---

## 6. Execution Checklist

`generateExecutionChecklist()` produces `ExecutionChecklistItem[]` in `implementationOrder`. Each item is:

```typescript
interface ExecutionChecklistItem {
  step: string;       // "[CATEGORY] title" — or appended "— BLOCKED (unresolved dependency)"
  category: WorkCategory;
  done: false;        // always false — LCIS never marks anything done
  evidence: readonly Evidence[];
}
```

Blocked items are appended at the end. The `done: false` literal is structural: LCIS plans, it does not track execution state.

---

## 7. Complexity and Risk Scoring

`scoring.ts` provides two pure functions used by both `ExecutionIntelligenceService` and `ChangeAnalyzer`.

### Complexity

```
score = domains × 3 + tables × 2 + rpcs × 2 + apis × 1 + workers × 2 + queues × 2 + crossDomainLayers × 4
```

| Band | Score |
|------|-------|
| `trivial` | 0 |
| `low` | 1–8 |
| `moderate` | 9–20 |
| `high` | 21–40 |
| `severe` | > 40 |

### Risk

```
score = (money ? 40 : 0) + (tenant ? 25 : 0) + workers × 3 + min(complexityScore, 30)
```

| Level | Score |
|-------|-------|
| `low` | < 8 |
| `medium` | 8–19 |
| `high` | 20–39 |
| `critical` | ≥ 40 |

Risk drivers: `money-ledger` (critical), `multi-tenant` (high), `async-workers` (medium), `broad-blast` (high when ≥ 4 domains).

---

## 8. `ExecutionPlan` Summary String

`planImplementation()` computes a human-readable `summary`:

- When `unresolved: true`: `"No matching entities found for "<text>" — plan is honestly empty."`
- Otherwise: `"Implementation plan for "<text>": N domain(s), N table(s), N rpc(s) affected. Complexity: <band>. Risk: <level>[money-ledger][multi-tenant]."`

---

## 9. Evidence Chain

`planImplementation()` collects evidence from three sources:

1. `analysis.evidence` — every fact gathered during seed resolution and blast-radius computation
2. `workBreakdown.flatMap(it => it.evidence)` — one evidence entry per work item
3. `graph.evidence` — graph construction summary (node/edge/order counts, critical path)

Confidence is computed by `planConfidence(ev, 0.5)` from `envelope.ts` — base 0.5 plus 0.05 per evidence entry (up to 9), capped at 0.95.
