# ExecutionIntelligenceService Guide
**EAOS Phase 8 — `src/execution/ExecutionIntelligenceService.ts`**

---

## Purpose

`ExecutionIntelligenceService` is the first of EAOS's seven intelligence services. Its job is to
overlay EXECUTION STATE onto the `EngineeringPackage` produced by EINS (Phase 7). It answers:

- What is the structural state of the work right now (PLANNED / READY / BLOCKED)?
- Which tasks are on the critical path?
- Which tasks can start in parallel today?
- What is blocked and why (EO02)?
- What is the overall execution health?
- How much work is planned? (Completion is NOT_CONNECTED — no tracker wired.)

It is a pure, synchronous, read-only transform. It never executes, deploys, or mutates anything.
Every output carries evidence, confidence, a timestamp, and honest `liveConnected: false`.

---

## Questions This Service Answers

| Question | Method |
|----------|--------|
| What is the full execution graph with status overlays? | `buildExecutionGraph(pkg)` |
| What are the PLANNED / READY / BLOCKED counts right now? | `currentExecutionState(pkg)` |
| Which tasks are structurally blocked (EO02 findings)? | `blockedWork(pkg)` |
| Which task ids form the critical path? | `criticalPath(pkg)` |
| Which tasks can start in parallel (no unsatisfied deps)? | `parallelizableWork(pkg)` |
| What is the structural completion metric? | `completionPercentage(pkg)` |
| What work remains? | `remainingWork(pkg)` |
| What is the execution health score and band? | `executionHealth(pkg)` |
| Combine all of the above into one report? | `generateExecutionReport(pkg)` |

---

## Constructor

```ts
// src/execution/ExecutionIntelligenceService.ts
constructor(
  private readonly core: LcisEngine,
  private readonly now: () => string = defaultNow,
)
```

The facade constructs this service as:

```ts
this.execution = new ExecutionIntelligenceService(core, now);
```

The service uses four shared utilities internally: `ExecutionEvidenceBuilder`,
`ExecutionConfidenceCalculator`, `ExecutionSeverityScorer`, and `ExecutionRuleRegistry`.
The live run source constant used throughout is:

```ts
const LIVE_RUN_SOURCE = 'execution-tracking store (CI / git)';
```

---

## Public API

### `buildExecutionGraph(pkg: EngineeringPackage): ExecutionGraph`

Maps every node in `pkg.graph.nodes` to an `ExecutionNode` with a structurally-derived status,
then wraps the result in the full `ExecutionGraph` type.

**Status derivation algorithm:**

```
if   blockedSet.has(node.id)     → status = 'BLOCKED'
elif parallelSet.has(node.id)    → status = 'READY'
else                             → status = 'PLANNED'
```

Where `blockedSet = new Set(pkg.graph.blocked)` and `parallelSet = new Set(pkg.graph.parallelizable)`.

All three derived statuses carry `connection: 'CONNECTED'`. The `liveSource` field names
`'execution-tracking store (CI / git)'` on every node — that is the source that would provide
live run-state (RUNNING/COMPLETED/FAILED) once wired.

The graph's `implementationOrder`, `criticalPath`, `parallelizable`, and `blocked` arrays are
passed through verbatim from `pkg.graph`. No re-computation of the DAG is performed; the service
cites `lcis-engineering:EngineeringGraphService` as the authority.

The summary line always states: `"Execution graph: N tasks — R READY, B BLOCKED; live run-state NOT_CONNECTED (source: execution-tracking store (CI / git))."`.

**CONNECTED signals:** derived status, graph topology, node count, ready count, blocked count.
**NOT_CONNECTED signals:** live run-state, completion, ETA.

---

### `currentExecutionState(pkg: EngineeringPackage)`

Returns a plain object (not stamped with `OrchestrationArtifact`) summarising the three structural
state buckets:

```ts
{
  planned: number;
  ready: number;
  blocked: number;
  connection: 'CONNECTED';
  liveRunStateNote: string;
  liveSource: string;
}
```

`planned = total - ready - blocked`. The `liveRunStateNote` is:
`'Live run-state (RUNNING / COMPLETED / FAILED) is NOT_CONNECTED — no execution-tracking store wired.'`

This is a building block used inside `generateExecutionReport`. It is not exposed directly through
the facade but is accessible on the service instance.

---

### `blockedWork(pkg: EngineeringPackage): ExecutionFinding[]`

Generates one `ExecutionFinding` per entry in `pkg.graph.blocked`, tagged with rule EO02
("Blocked tasks", severity `high`, category `blocked`).

Each finding has:
- `id`: `EO02-<1-based index>`
- `connection: 'CONNECTED'` — the blocked set is structurally derived by the EINS Kahn sort
- `detail`: names the task title, id, layer, and gate, plus explains that dependencies are outside
  the batch or form a cycle

```ts
blockedWork(pkg: EngineeringPackage): ExecutionFinding[]
```

This is also the source of blocked-task findings surfaced by the facade's `generateBlockersReport`.
EO02 is the only EO rule this service evaluates; ownership (EO01) is the concern of
`AgentIntelligenceService`.

---

### `criticalPath(pkg: EngineeringPackage): string[]`

Returns a copy of `pkg.graph.criticalPath`. This is a CONNECTED signal — the critical path is
computed by `EngineeringGraphService` via dynamic programming over the topological order.
No re-derivation is performed.

```ts
criticalPath(pkg: EngineeringPackage): string[]
```

---

### `parallelizableWork(pkg: EngineeringPackage): string[]`

Returns a copy of `pkg.graph.parallelizable`. These are all nodes with `depth === 0` in the DAG
(no unsatisfied intra-batch dependencies). CONNECTED — derived by `EngineeringGraphService`.

```ts
parallelizableWork(pkg: EngineeringPackage): string[]
```

---

### `completionPercentage(pkg: EngineeringPackage): ProgressMetric`

```ts
completionPercentage(pkg: EngineeringPackage): ProgressMetric
```

Returns a `ProgressMetric` where:
- `planned = pkg.tasks.length` — CONNECTED (total planned tasks is structural)
- `completed = null` — NOT_CONNECTED (no live tracker wired; never fabricated)
- `connection = 'NOT_CONNECTED'`
- `liveSource = 'execution-tracking store (CI / git)'`

This is the honest acknowledgement that no execution-tracking store has been wired. The would-be
source for `completed` would be `completed_count / total_count` over a live `task_runs` store or
CI run history.

---

### `remainingWork(pkg: EngineeringPackage): ExecutionNode[]`

Because `completionPercentage` reports `completed = null` (NOT_CONNECTED), all planned tasks are
treated as remaining. This method calls `buildExecutionGraph(pkg)` and returns all nodes:

```ts
remainingWork(pkg: EngineeringPackage): ExecutionNode[]
```

When a live tracker is wired in the future, this method would filter out nodes with
`status === 'COMPLETED'` from the live source.

---

### `executionHealth(pkg: EngineeringPackage): ExecutionHealth`

Computes a health score and band for the `'execution'` area:

```ts
executionHealth(pkg: EngineeringPackage): ExecutionHealth
```

**Score derivation:**
```
blockedFraction = blockedCount / totalTasks
rawScore = round((1 - blockedFraction) * 100)
score = clamp(rawScore, 0, 100)
```

Band mapping: `>= 80 → healthy`, `>= 50 → degraded`, `< 50 → failing`, `totalTasks === 0 → unknown`.

The returned `ExecutionHealth` always carries:
- `area: 'execution'`
- `connectedSignals: 3` (total tasks, blocked count, ready count — all CONNECTED)
- `notConnectedSignals: 3` (live run-state, completion %, ETA — all NOT_CONNECTED)

This score is consumed by `ExecutionOrchestrationEngine.mergeHealth()` when computing the overall
`ExecutionPackage` health.

---

### `generateExecutionReport(pkg: EngineeringPackage): ExecutionReport`

The primary composition method called by the facade:

```ts
generateExecutionReport(pkg: EngineeringPackage): ExecutionReport
```

Calls internally (in order):
1. `this.buildExecutionGraph(pkg)` → `graph`
2. `this.blockedWork(pkg)` → `findings`
3. `this.executionHealth(pkg)` → `health`
4. `this.completionPercentage(pkg)` → `completion`
5. `this.currentExecutionState(pkg)` → state counts for the summary

Stamps the result with three evidence citations:
- `eb.reuse('lcis-engineering', 'EngineeringPackage', ...)` — primary input consumed verbatim
- `eb.reuse('lcis-engineering', 'EngineeringGraphService', ...)` — graph topology reused
- `eb.notConnected('execution:live-run-state', LIVE_RUN_SOURCE)` — honest absence

Summary format:
```
Feature: "<text>". N tasks total. Structural: R READY, B BLOCKED, P PLANNED.
Critical path: C task(s). [blocked note or "No structurally blocked tasks."]
Decision: <GO|CONDITIONAL_GO|NO_GO>.
Live run-state (RUNNING/COMPLETED/FAILED) NOT_CONNECTED — source: execution-tracking store (CI / git).
```

`liveConnected` is always `false`.

---

## CONNECTED vs NOT_CONNECTED Signal Table

| Signal | Status | Source |
|--------|--------|--------|
| Total task count (`pkg.tasks.length`) | CONNECTED | `EngineeringPackage.tasks` |
| Graph topology (nodes, edges, order) | CONNECTED | `EngineeringGraphService.build(tasks)` |
| Critical path task ids | CONNECTED | `EngineeringGraph.criticalPath` |
| Parallelizable task ids | CONNECTED | `EngineeringGraph.parallelizable` (depth 0 nodes) |
| Blocked task ids | CONNECTED | `EngineeringGraph.blocked` (Kahn residual + cycle check) |
| Derived PLANNED / READY / BLOCKED status | CONNECTED | `blocked` / `parallelizable` set membership |
| EO02 findings (blocked tasks) | CONNECTED | structural DAG finding |
| Execution health score | CONNECTED | blocked fraction × 100 |
| `planned` count in `ProgressMetric` | CONNECTED | `pkg.tasks.length` |
| Live run-state (RUNNING/COMPLETED/FAILED) | NOT_CONNECTED | execution-tracking store (CI / git) |
| `completed` count in `ProgressMetric` | NOT_CONNECTED | task-run store completion count |
| ETA | NOT_CONNECTED | mean cycle time × remaining critical-path tasks |
| Real artifact presence | NOT_CONNECTED | filesystem probe or CI artifact registry |
| Live CI gate pass/fail | NOT_CONNECTED | CI step exit codes mapped to `task.gate` |

---

## EO02 — Blocked Tasks (the rule this service enforces)

```ts
// src/shared/rules.ts
{ id: 'EO02', title: 'Blocked tasks', description: 'Tasks blocked by unmet or cyclic dependencies.', severity: 'high', category: 'blocked' }
```

A finding is generated for each id in `pkg.graph.blocked`. The finding's `connection` is
`'CONNECTED'` because the blocked set is determined structurally by the Kahn sort in
`EngineeringGraphService`: any node whose `dependsOn` references an id outside the task batch, or
that participates in a cycle, lands in `blocked`. EAOS does not reimplement this logic — it reads
`pkg.graph.blocked` directly.

To clear an EO02 finding: either add the missing dependency to the task batch (so it resolves
inside the DAG), or remove the dependency from `EngineeringTask.dependsOn` if it is out of scope.
These are engineering decisions, not EAOS decisions.

---

## How the Facade and Access Layers Expose This Service

### Via the facade

```ts
// generateExecutionReport wraps this service:
await eaos.generateExecutionReport(input)
// generateFullExecutionPackage also calls it:
const executionReport = this.execution.generateExecutionReport(pkg);
```

The facade also calls `this.execution.blockedWork(pkg)` and `this.execution.executionHealth(pkg)`
directly in `generateBlockersReport` and `generateHealthReport`.

### CLI

```
lcis execution graph <feature text>
  → generateExecutionReport → ExecutionReport (graph + findings + health + completion)

lcis execution report <feature text>
  → generateFullExecutionPackage → ExecutionPackage (includes ExecutionReport)

lcis execution blockers <feature text>
  → generateBlockersReport (calls blockedWork internally)

lcis execution health <feature text>
  → generateHealthReport (calls executionHealth internally, merges areas)
```

### MCP

```
lcis_execution_graph   { request, domains?, tables?, symbols? }  → ExecutionReport
lcis_execution_report  { request, domains?, tables?, symbols? }  → ExecutionPackage
lcis_execution_blockers { request, ... }                         → BlockersReport
lcis_execution_health  { request, ... }                          → HealthReport
```

### HTTP API

```
POST /execution/graph    { request: string, ... }  → ExecutionReport
POST /execution/report   { request: string, ... }  → ExecutionPackage
POST /execution/blockers { request: string, ... }  → BlockersReport
POST /execution/health   { request: string, ... }  → HealthReport
```

### PR-check V6

The `execution-readiness` verdict is derived from `rollout.launchVerdict`, not directly from this
service. However, `execution-health` is derived from the overall package health which includes
`execution.health` via `mergeHealth`. The blocked-task count from `blockedWork` contributes to the
`execution-readiness` FAIL signal when `launchVerdict === 'NO_GO'`.

---

## Honest Limitations

- **No live state.** The service cannot tell you whether a task is RUNNING or COMPLETED. That
  requires an execution-tracking store (e.g. a `task_runs` table or a CI webhook) that does not
  exist in this repository. Every call returns `liveConnected: false`.
- **completionPercentage always returns `completed: null`.** This is not a bug; it is the honest
  representation of no tracker being wired. Do not treat `null` as 0.
- **remainingWork returns all tasks.** Because completion is NOT_CONNECTED, all tasks are treated
  as remaining. This is a conservative, safe representation.
- **executionHealth is CONNECTED but conservative.** The score is purely blocked-fraction based.
  A project with 0 blocked tasks will score 100 even if none of the tasks have started — because
  start-state is NOT_CONNECTED.
- **Refresh required.** The `EngineeringPackage` is a point-in-time snapshot. Call
  `getOrchestrationEngine().generateExecutionReport(req)` again to get an updated view.
