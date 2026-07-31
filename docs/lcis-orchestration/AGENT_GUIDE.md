# AGENT_GUIDE — AgentIntelligenceService

**Package:** `@letbuyy/lcis-orchestration`
**File:** `packages/lcis-orchestration/src/agent/AgentIntelligenceService.ts`
**Phase:** EAOS Phase 8 — Execution & Agent Orchestration System

---

## Purpose

`AgentIntelligenceService` derives execution-state overlays for the agent task graph inside a
frozen EINS `EngineeringPackage`. It answers the questions:

- Which agents are assigned, and to which tasks?
- Which agent tasks are structurally blocked before a single line of code is run?
- Which tasks lack a declared owner?
- Which agent tasks are orphaned (no backing engineering task, or vice-versa)?
- How is planned work distributed across agent types?
- What is the overall agent-layer health score?

The service is **read-only and deterministic** — no fetch, no exec, no spawn, no writeFile,
no network, no DB mutation. It is a pure synchronous transform over the package. No AI or
embeddings are involved.

> **EAOS principle:** EAOS TRACKS execution; it NEVER executes. Humans/agents execute.
> LCOS observes · LCIS understands · EIS plans · GDIS governs · EINS engineers · EAOS orchestrates/tracks.

---

## Questions Answered

| Question | Method | Connection |
|---|---|---|
| Which agents are assigned to which tasks? | `agentAssignments` | CONNECTED (structural) |
| Which tasks lack a declared domain owner? | `agentOwnership` | CONNECTED |
| What is the agent-layer health score? | `agentHealth` | CONNECTED (score); NOT_CONNECTED (utilization) |
| What utilization is each agent type running at? | `agentUtilization` | NOT_CONNECTED |
| Which agent tasks are structurally blocked? | `agentBlocking` | CONNECTED |
| What are the inter-agent dependency edges? | `agentDependencyGraph` | CONNECTED |
| How is work split across agent types? | `workDistribution` | CONNECTED |
| Which tasks are orphaned (no agent ↔ task pairing)? | `orphanAgents` | CONNECTED |
| Full agent report with health + all findings | `generateAgentReport` | CONNECTED (structural) |

---

## Constructor

```ts
constructor(
  private readonly core: LcisEngine,
  private readonly now = defaultNow,
)
```

`core` is carried for future composition. This service does not query it directly — all data
comes from the `EngineeringPackage` passed to each method.

---

## Public API

### `agentAssignments(pkg: EngineeringPackage): ExecutionAgent[]`

Maps each `AgentTask` in `pkg.agentPlan.tasks` to one `ExecutionAgent`.

- **ASSIGNED** status is CONNECTED (a task existing in the plan is an assignment).
- Live run-state (WORKING / FINISHED) is NOT_CONNECTED; `liveSource` is
  `'agent-execution-tracker (CI/git/fleet dispatcher — not wired)'`.
- `connection: 'CONNECTED'` because the structural fact (this agent task exists and is
  assigned) is derivable from the plan without any live signal.

```ts
agentAssignments(pkg: EngineeringPackage): ExecutionAgent[]
```

### `agentOwnership(pkg: EngineeringPackage): ExecutionFinding[]`

Raises **EO01** findings for agent tasks whose backing engineering task's domain has no entry
in `pkg.blueprint.ownership.coverage`. Also promotes governance gaps from
`pkg.blueprint.ownership.gaps` as additional EO01 findings.

- Reuses `lcis-governance` `OwnershipReport` — does not re-derive ownership; cites the
  source via `ev.reuse('lcis-governance', ...)`.
- All findings carry `connection: 'CONNECTED'` and `rule: 'EO01'`.

```ts
agentOwnership(pkg: EngineeringPackage): ExecutionFinding[]
```

Finding shape (EO01):

| Field | Value |
|---|---|
| `category` | `'ownership'` |
| `kind` | `'agent-task-no-owner'` or `'governance-ownership-gap'` |
| `severity` | `'high'` (from `ExecutionRuleRegistry.get('EO01')`) |
| `rule` | `'EO01'` |
| `connection` | `'CONNECTED'` |

### `agentHealth(pkg: EngineeringPackage): ExecutionHealth`

Returns an `ExecutionHealth` for the `'agent'` area.

- **Score:** `Math.max(0, round(((total - unownedCount) / total) * 100))`. Zero tasks → score
  100, band `'healthy'`. Unowned tasks lower the score.
- `connectedSignals` = total agent tasks (all ASSIGNED — structural).
- `notConnectedSignals` = total agent tasks (utilization/live-activity adds one
  NOT_CONNECTED per agent).
- `band`: `'healthy'` ≥ 80, `'degraded'` ≥ 50, `'failing'` below 50.

```ts
agentHealth(pkg: EngineeringPackage): ExecutionHealth
```

### `agentUtilization(pkg: EngineeringPackage)`

Returns a provenance-stamped object that is **entirely NOT_CONNECTED**. Per-agent load
requires a live fleet dispatcher tracker that is not wired in EAOS Phase 8.

```ts
agentUtilization(pkg: EngineeringPackage): {
  readonly connection: 'NOT_CONNECTED';
  readonly liveSource: string;          // 'per-agent-load-tracker (fleet dispatcher — not wired)'
  readonly confidence: number;          // always 0
  readonly liveConnected: boolean;      // always false
  readonly byAgentType: Readonly<Record<string, number>>;  // CONNECTED — from the plan
  readonly utilization: null;           // NOT_CONNECTED — no tracker
  readonly evidence: readonly Evidence[];
}
```

`byAgentType` is CONNECTED (it is read from `pkg.agentPlan.byAgentType`, a structural
breakdown of planned task counts, not live load).

### `agentBlocking(pkg: EngineeringPackage): ExecutionFinding[]`

Finds agent tasks whose `taskRef` appears in `pkg.graph.blocked`. Raises **EO02** findings.

- CONNECTED — pure structural graph topology.
- `pkg.graph.blocked` is the Kahn residual set from `EngineeringGraphService`: tasks whose
  `dependsOn` reference an id outside the task set, or that are in a cycle.

```ts
agentBlocking(pkg: EngineeringPackage): ExecutionFinding[]
```

Finding shape (EO02):

| Field | Value |
|---|---|
| `category` | `'blocked'` |
| `kind` | `'agent-task-blocked'` |
| `severity` | `'high'` (from `ExecutionRuleRegistry.get('EO02')`) |
| `rule` | `'EO02'` |
| `connection` | `'CONNECTED'` |

### `agentDependencyGraph(pkg: EngineeringPackage)`

Returns the agent-task dependency graph as an adjacency list. CONNECTED — pure transform over
the plan's static `dependsOn` edges.

```ts
agentDependencyGraph(pkg: EngineeringPackage): {
  readonly nodes: readonly { readonly id: string; readonly agentType: string; readonly taskRef: string }[];
  readonly edges: readonly { readonly from: string; readonly to: string; readonly relation: 'depends-on' }[];
  readonly connection: 'CONNECTED';
}
```

Each node is one `AgentTask`. Edges run from the depended-on agent task to the dependent
(`from: dep → to: at.id`).

### `workDistribution(pkg: EngineeringPackage)`

Returns `pkg.agentPlan.byAgentType` directly — the planned count of tasks per agent type.
CONNECTED (structural count from the plan).

```ts
workDistribution(pkg: EngineeringPackage): {
  readonly byAgentType: Readonly<Record<string, number>>;
  readonly connection: 'CONNECTED';
  readonly totalTasks: number;
}
```

### `orphanAgents(pkg: EngineeringPackage): ExecutionFinding[]`

Raises **EO01** findings for two classes of planning gap:

1. **Agent task with no taskRef** — `at.taskRef` is empty or whitespace.
2. **Engineering task with no agent** — `engTask.id` is not referenced by any
   `AgentTask.taskRef`.

```ts
orphanAgents(pkg: EngineeringPackage): ExecutionFinding[]
```

Both finding kinds carry `category: 'ownership'`, `rule: 'EO01'`, `connection: 'CONNECTED'`.

### `generateAgentReport(pkg: EngineeringPackage): AgentReport`

Composes all of the above into a stamped `AgentReport` via the `execution()` envelope
(adds `evidence`, `confidence`, `sources`, `timestamp`, `liveConnected: false`).

```ts
generateAgentReport(pkg: EngineeringPackage): AgentReport
```

Composition: `assignments + ownership findings + blocking findings + orphan findings + health`.

`summary` is generated honestly, e.g.:
> `"5 agent task(s) ASSIGNED across 3 agent type(s). 1 blocked. 2 finding(s): 0 critical, 2 high. Live agent activity: NOT_CONNECTED (agent-execution-tracker ...)."``

---

## CONNECTED vs NOT_CONNECTED Signals

| Signal | Status | Exact source if NOT_CONNECTED |
|---|---|---|
| Agent assignments (ASSIGNED status) | **CONNECTED** | `pkg.agentPlan.tasks` — structural |
| Agent task dependency edges | **CONNECTED** | `AgentTask.dependsOn` — static plan |
| Blocked agent tasks | **CONNECTED** | `pkg.graph.blocked` — Kahn residual |
| Ownership coverage / gaps | **CONNECTED** | `pkg.blueprint.ownership` (lcis-governance) |
| Work distribution by agent type | **CONNECTED** | `pkg.agentPlan.byAgentType` — structural |
| Orphan agent tasks | **CONNECTED** | cross-check between `agentPlan.tasks` and `pkg.tasks` |
| Agent run-state (WORKING / FINISHED) | **NOT_CONNECTED** | `agent-execution-tracker (CI/git/fleet dispatcher — not wired)` |
| Per-agent utilization / load | **NOT_CONNECTED** | `per-agent-load-tracker (fleet dispatcher — not wired)` |
| Acceptance criterion pass/fail | **NOT_CONNECTED** | acceptance-test runner result mapped to each `AgentTask.taskRef` |
| Agent activity timestamps (start / end) | **NOT_CONNECTED** | agent heartbeat/event stream keyed on `AgentTask.id` |

`liveConnected` is always `false` on every report. No live tracker is wired in Phase 8.

---

## Findings Emitted

| Rule | Condition | Severity | Category |
|---|---|---|---|
| EO01 | Agent task's domain not in `ownership.coverage` | `high` | `ownership` |
| EO01 | Governance ownership gap (`ownership.gaps[n]`) | `high` | `ownership` |
| EO01 | Agent task has empty `taskRef` (orphan) | `high` | `ownership` |
| EO01 | Engineering task has no corresponding agent task (orphan) | `high` | `ownership` |
| EO02 | Agent task's `taskRef` is in `pkg.graph.blocked` | `high` | `blocked` |

---

## Access Layers

### CLI

```
lcis execution report   → generateFullExecutionPackage (includes agent report)
lcis execution status   → StatusReport + agent health
lcis execution blockers → agentBlocking findings surfaced
lcis execution health   → agentHealth merged into overall health
```

### MCP

```
lcis_execution_report   → AgentReport (via ExecutionOrchestrationEngine.generateAgentReport)
lcis_execution_blockers → EO02 blocking findings for agent tasks
lcis_execution_health   → agent area in HealthReport
```

### API

```
POST /execution/report     → AgentReport in ExecutionPackage.agent
POST /execution/blockers   → agentBlocking findings
POST /execution/health     → agentHealth in HealthReport.areas
```

### PR-check V6

The `## LCIS EXECUTION` section includes an **agent-health** verdict (one of PASS / WARN / FAIL / UNKNOWN):

- PASS when `agentHealth.band === 'healthy'` and no EO01/EO02 findings
- WARN when band is `'degraded'`
- FAIL when band is `'failing'` or critical/high EO01/EO02 findings are present
- UNKNOWN when `agentHealth.score === null`

### Facade (ExecutionOrchestrationEngine)

```ts
engine.agent.generateAgentReport(pkg)       // direct service access
engine.generateAgentReport(input)           // via facade (resolves pkg first)
engine.generateHealthReport(input)          // agentHealth merged with other areas
engine.generateBlockersReport(input)        // includes EO02 agent blocking
engine.generateFullExecutionPackage(input)  // ExecutionPackage.agent
```

---

## Composition and Reuse

`AgentIntelligenceService` does not re-implement any prior LCIS system:

| Used symbol | From | How used |
|---|---|---|
| `pkg.agentPlan` | lcis-engineering | Agent assignments, dependency graph, work distribution |
| `pkg.graph.blocked` | lcis-engineering | Identifying structurally blocked tasks (EO02) |
| `pkg.blueprint.ownership` | lcis-governance | Ownership coverage and gaps (EO01) |
| `ExecutionRuleRegistry` | EAOS shared | EO01/EO02 rule metadata |
| `execution()` envelope | EAOS shared | Provenance stamping on the report |
| `ExecutionEvidenceBuilder` | EAOS shared | Typed evidence constructors |
| `ExecutionConfidenceCalculator` | EAOS shared | Structural confidence (0..1) |

---

## Honest Limitations

- **No live tracking.** WORKING, FINISHED, agent heartbeats, utilization, and acceptance
  pass/fail are all NOT_CONNECTED. They require an execution-tracking store (e.g. a
  `task_runs` Postgres table or CI webhook event stream keyed on `AgentTask.id`) that does
  not exist in this repository.
- **Score is ownership-based only.** `agentHealth.score` measures ownership coverage, not
  real progress. Two agents with all tasks owned score 100 regardless of how much work
  remains.
- **Orphan detection is static.** It compares `agentPlan.tasks` against `pkg.tasks` at
  plan-build time. If a task is added after the package is frozen, it will not appear until
  `generateFullEngineeringPackage` is re-called.
