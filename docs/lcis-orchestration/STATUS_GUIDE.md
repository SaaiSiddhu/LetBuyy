# EAOS Status Intelligence Guide

**Package:** `@letbuyy/lcis-orchestration`
**Service:** `StatusIntelligenceService`
**Source:** `packages/lcis-orchestration/src/status/StatusIntelligenceService.ts`
**Phase:** EAOS — Phase 8 (Execution & Agent Orchestration System)

---

## Purpose

`StatusIntelligenceService` is a **pure, synchronous, read-only transform** over an
`EngineeringPackage` that produces `ProgressMetric` values and a `StatusReport` across all
execution axes. It answers the question: "how much work is planned, how much is done, and what
is blocked?" — while being fully honest about the boundary between what is structurally
derivable and what requires a live execution-tracking store that does not yet exist.

EAOS **tracks** execution; it never executes. This service contains no fetch, spawn, exec,
eval, file writes, AI, or network calls. All counts come directly from the EINS
`EngineeringPackage` fields.

---

## Questions This Service Answers

| Question | Method |
|---|---|
| How many tasks are planned, ready, and blocked? | `executionProgress(pkg)` |
| How many engineering tasks are planned overall? | `taskProgress(pkg)` |
| How many agent assignments are planned? | `agentProgress(pkg)` |
| How many artifacts are planned (by layer)? | `artifactProgress(pkg)` |
| How many validation gates are planned, and how many have passed (structurally)? | `validationProgress(pkg)` |
| What is the aggregate planned count across all axes? | `overallProgress(pkg)` |
| When will execution complete (ETA)? | `eta(pkg)` — always NOT_CONNECTED |
| What tasks and decisions are blocking progress? | `blockedReasons(pkg)` |
| Full status picture for a feature? | `generateStatusReport(pkg)` |

---

## CONNECTED vs NOT_CONNECTED Signals

The honesty contract is enforced at the type level: `ProgressMetric.completed` is
`number | null`, never a fabricated integer.

| Signal | Connection | Source |
|---|---|---|
| `planned` count for tasks, agents, artifacts, gates | **CONNECTED** | Direct structural count from `EngineeringPackage` fields |
| `READY` sub-count (`graph.parallelizable.length`) | **CONNECTED** | `EngineeringGraph.parallelizable` (Kahn topo, `indegree === 0`) |
| `BLOCKED` sub-count (`graph.blocked.length`) | **CONNECTED** | `EngineeringGraph.blocked` (deps outside task set or cyclic) |
| Static compliance gate results (COMPLIANT/VIOLATED) | **CONNECTED** (partial) | `pkg.blueprint.compliance.evaluations` from `lcis-governance` |
| `completed` count for any axis | **NOT_CONNECTED** → `null` | execution-tracking store (CI / git artifact presence) |
| Live CI test run counts | **NOT_CONNECTED** | `CI run result (live CI gate execution)` |
| `eta.value` | **NOT_CONNECTED** → `null` | `execution-tracking durations` |
| Agent WORKING/FINISHED status | **NOT_CONNECTED** | `live agent execution signal` |
| Artifact on-disk existence | **NOT_CONNECTED** | `git-probe / filesystem artifact presence` |

`liveConnected` on every `StatusReport` is always `false` until an execution-tracking adapter
is wired.

---

## Public API

All methods accept a pre-built `EngineeringPackage`. All are synchronous except
`generateStatusReport` (which uses internal helpers, also synchronous, but the report builder
is called from the async facade).

### `executionProgress(pkg: EngineeringPackage): ProgressMetric`

Progress over `pkg.tasks` (the ordered engineering task list from EINS).

```ts
executionProgress(pkg: EngineeringPackage): ProgressMetric
```

- `planned` = `pkg.tasks.length` — CONNECTED.
- `completed` = `null` — NOT_CONNECTED; no live execution-tracking store.
- `label` includes the READY and BLOCKED sub-counts explicitly (e.g.
  `"Execution: 12 tasks planned (3 ready, 1 blocked — CONNECTED; completed NOT_CONNECTED)"`).
- `liveSource` = `'execution-tracking store (CI / git artifact presence)'`.

### `taskProgress(pkg: EngineeringPackage): ProgressMetric`

The task-dimension progress metric, surfaced separately from `executionProgress` per the spec.

```ts
taskProgress(pkg: EngineeringPackage): ProgressMetric
```

- `planned` = `pkg.tasks.length` — CONNECTED.
- `completed` = `null` — NOT_CONNECTED.
- `liveSource` = `'execution-tracking store'`.

### `agentProgress(pkg: EngineeringPackage): ProgressMetric`

Progress over `pkg.agentPlan.tasks` (the agent fleet assignments from EINS `AgentPlan`).

```ts
agentProgress(pkg: EngineeringPackage): ProgressMetric
```

- `planned` = `pkg.agentPlan.tasks.length` — CONNECTED (ASSIGNED status is structural).
- `completed` = `null` — NOT_CONNECTED; WORKING and FINISHED require a live agent signal.
- `liveSource` = `'live agent execution signal'`.

### `artifactProgress(pkg: EngineeringPackage): ProgressMetric`

Progress over planned artifacts — one artifact per engineering task (inferred from `task.layer`).

```ts
artifactProgress(pkg: EngineeringPackage): ProgressMetric
```

- `planned` = `pkg.tasks.length` — CONNECTED (one artifact planned per task by layer).
- `completed` = `null` — NOT_CONNECTED; on-disk or in-git presence requires a probe.
- `liveSource` = `'git-probe / filesystem artifact presence'`.

### `validationProgress(pkg: EngineeringPackage): ProgressMetric`

Progress over validation gates. This metric has two sub-populations and is explicit about both:

```ts
validationProgress(pkg: EngineeringPackage): ProgressMetric
```

- `planned` = `pkg.tasks.length` (one gate per task) — CONNECTED.
- Static-gate evaluations from `pkg.blueprint.compliance.evaluations`: the count of COMPLIANT
  evaluations is CONNECTED (structural output of `lcis-governance`). This is surfaced in the
  `label` as `"${staticPassed} COMPLIANT"` but does **not** set `completed` (which remains `null`)
  because the live CI gate completion dimension is absent.
- `completed` = `null` — NOT_CONNECTED overall (live CI runs not wired).
- `liveSource` = `'CI run result (live CI gate execution)'`.
- The `label` makes both sub-populations explicit, e.g.:
  `"Validations: 12 task gates planned; static-gate results CONNECTED (8 evaluated, 6 COMPLIANT, 1 VIOLATED); live CI gate runs NOT_CONNECTED"`.

### `overallProgress(pkg: EngineeringPackage): ProgressMetric`

Aggregate planned count across all four axes (tasks + agents + artifacts + gates).

```ts
overallProgress(pkg: EngineeringPackage): ProgressMetric
```

- `planned` = `tasks.length + agentPlan.tasks.length + tasks.length + tasks.length`
  (tasks, agents, artifacts, gates — `tasks.length` used three times: artifacts and gates are
  one-per-task by construction).
- `completed` = `null` — NOT_CONNECTED.
- `liveSource` = `'execution-tracking store (CI / git / live agent signal)'`.

### `eta(pkg: EngineeringPackage): { connection: Connection; value: string | null; liveSource: string }`

ETA is always NOT_CONNECTED. Requires actual execution durations from a live tracker; never fabricated.

```ts
eta(_pkg: EngineeringPackage): {
  connection: Connection;
  value: string | null;
  liveSource: string;
}
```

Always returns:

```ts
{
  connection: 'NOT_CONNECTED',
  value: null,
  liveSource: 'execution-tracking durations',
}
```

This is the correct and honest answer — surfaced as a typed object so downstream consumers
cannot accidentally display a null as an ETA without acknowledging the NOT_CONNECTED state.

### `blockedReasons(pkg: EngineeringPackage): string[]`

CONNECTED blocked reasons from two structural sources:

```ts
blockedReasons(pkg: EngineeringPackage): string[]
```

1. `pkg.graph.blocked` — each entry becomes
   `"task:<id> — blocked by unresolved dependency (EngineeringGraph.blocked)"`.
2. `pkg.decision.blockers` — each entry becomes `"decision-blocker: <text>"`.

Both sources are CONNECTED (structural dependency analysis and engineering decision output from
`lcis-engineering`). Live unblock events are NOT_CONNECTED and are not represented here.

### `generateStatusReport(pkg: EngineeringPackage): StatusReport`

Synthesises all progress axes into a `StatusReport` stamped with provenance via `execution()`.

```ts
generateStatusReport(pkg: EngineeringPackage): StatusReport
```

```ts
export interface StatusReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly metrics: readonly ProgressMetric[];
  readonly overall: ProgressMetric;
  readonly eta: { readonly connection: Connection; readonly value: string | null; readonly liveSource: string | null };
  readonly blockedReasons: readonly string[];
  readonly findings: readonly ExecutionFinding[];
  readonly summary: string;
}
```

- `metrics` = `[executionProgress, taskProgress, agentProgress, artifactProgress, validationProgress]`.
- `overall` = `overallProgress(pkg)`.
- `eta` = `eta(pkg)` — always `NOT_CONNECTED / null`.
- `blockedReasons` = `blockedReasons(pkg)`.
- `liveConnected: false` always.

---

## Findings in the Status Report

`generateStatusReport` produces three categories of `ExecutionFinding`:

| Finding id prefix | Category | Severity | Connection | Source |
|---|---|---|---|---|
| `EO-STATUS-BLOCKED-<taskId>` | `blocked` | high | CONNECTED | `pkg.graph.blocked` (EngineeringGraph) |
| `EO-STATUS-DECISION-<slug>` | `blocked` | high | CONNECTED | `pkg.decision.blockers` (EngineeringPackage) |
| `EO-STATUS-COMPLIANCE-<ruleId>` | `validation` | critical | CONNECTED | `pkg.blueprint.compliance.evaluations` where `status === 'VIOLATED'` |
| `EO-STATUS-NOT-CONNECTED-COMPLETION` | `verification` | info | NOT_CONNECTED | Honest reminder that completed counts and ETA require a live tracker |

The `EO-STATUS-NOT-CONNECTED-COMPLETION` finding is always present and its `confidence` is `0`.
It carries a `notConnected` evidence entry pointing to
`'execution-tracking store (CI / git / live agent signal)'`.

---

## Summary String

The `StatusReport.summary` synthesises all structural signals in one sentence, e.g.:

```
Engineering package: 12 tasks, 12 agents, verdict=GO.
Execution state: 3 READY, 1 BLOCKED (CONNECTED).
Static compliance gates: 6 COMPLIANT, 1 VIOLATED (CONNECTED).
Completed counts and ETA: NOT_CONNECTED (no live execution tracker wired).
```

Every NOT_CONNECTED claim is explicit in the summary — callers can surface it directly to
engineers or dashboard consumers.

---

## How the Facade and Access Layers Expose This Service

### Facade: `ExecutionOrchestrationEngine`

```ts
// packages/lcis-orchestration/src/engine/ExecutionOrchestrationEngine.ts
readonly status: StatusIntelligenceService;

async generateStatusReport(input: OrchestrationInput): Promise<StatusReport>
// resolves the EngineeringPackage, then calls this.status.generateStatusReport(pkg)
```

`blockedReasons` is also composed into the `BlockersReport` alongside blocked-task findings
from the execution service and launch blockers from the rollout service:

```ts
async generateBlockersReport(input: OrchestrationInput): Promise<BlockersReport>
// reasons = this.status.blockedReasons(pkg)
```

In `generateFullExecutionPackage`, `generateStatusReport(pkg)` is called (synchronously,
since the package is already resolved) and its result populates `ExecutionPackage.status`.

### CLI (`packages/lcis-cli`)

Planned surface: `lcis execution status <text...>` — follows the EINS command pattern
(calls `getOrchestrationEngine()`, builds `FeatureRequest`, emits via `emitEins`).
Options: `--json`, `--yaml`, `--table`, `--evidence`, `--export`, `--domain`, `--seed-table`, `--symbol`.

### MCP (`packages/lcis-mcp`)

Planned tool: `lcis_execution_status` — one of 7 `lcis_execution_*` tools in the EAOS tool
group. Handler calls `getOrchestrationEngine().generateStatusReport(req)` and returns
`toText(result, 'execution-status', ms)`. Input schema mirrors the EINS tool input shape
(`request`, `domains?`, `tables?`, `symbols?`).

### API (`services/lcis-api`)

Planned route: `POST /execution/status` — body `{ text, domains?, tables?, symbols? }` validated
by `OrchestrationSchema`. Calls `getOrchestrationEngine().generateStatusReport(...)`, wraps in
`envelope({ data: result, source: 'execution-status', executionTime: t.ms(), ... })`.

### PR-Check V6 (`packages/lcis-pr-check`)

The `execution-readiness` and `execution-health` dimensions of `ExecutionVerdict` draw on status
metrics (planned counts, blocked count, decision blockers). The `## LCIS EXECUTION` section
includes these alongside four other verdicts: `validation-health`, `rollout-health`,
`artifact-health`, `agent-health`.

---

## Composition and Honesty Constraints

**EAOS composes; it does not reimplement.** `StatusIntelligenceService` reads structural counts
from `EngineeringPackage` fields built by `lcis-engineering` (tasks, graph, agentPlan) and
compliance results from `lcis-governance` (via `pkg.blueprint.compliance.evaluations`). It does
not reimplement dependency analysis or compliance evaluation. Evidence entries carry
`reuse('lcis-engineering', ...)` and `reuse('lcis-governance', ...)` citations as proof.

**Honest null, not zero.** `completed: null` is a first-class typed value, not a missing field.
Downstream renderers must handle it explicitly; they cannot accidentally treat it as zero
progress. The `liveSource` field on every NOT_CONNECTED metric names the exact adapter that
would supply the real value.

**ETA is structurally unknowable.** Duration estimates are not derivable from the static
engineering graph. `eta.value` is `null` and `eta.connection` is `'NOT_CONNECTED'` — there is
no fallback heuristic, no estimation, and no fabricated date.

---

## Limitations

- `completed` counts for all axes remain `null` until a real execution-tracking store (CI run
  IDs, git artifact probes, agent completion events) is wired as an adapter and feeds state
  back into a future version of this service.
- `eta.value` is structurally unknowable; actual elapsed durations per task/agent/layer are
  needed and cannot be derived from the `EngineeringPackage`.
- The COMPLIANT count surfaced in `validationProgress.label` is a partial structural signal —
  it reflects `lcis-governance` static gate evaluation only. Live CI gate run results (runtime
  and integration gates) are NOT_CONNECTED and not counted.
- `blockedReasons` is structural — it reflects the graph's BLOCKED set and the engineering
  decision's blocker list at the time the `EngineeringPackage` was built. Real-time unblock
  events (a dependency task completing in CI) are NOT_CONNECTED.
- All `StatusReport` outputs have `liveConnected: false`; the flag becomes `true` only when
  a real execution-tracking adapter is wired.
