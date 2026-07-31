# TIMELINE_GUIDE — TimelineIntelligenceService

**EAOS Phase 8 · `packages/lcis-orchestration/src/timeline/TimelineIntelligenceService.ts`**

> EAOS TRACKS execution timelines; it NEVER drives them. Humans and agents execute.
> Read-only, synchronous, deterministic, no AI, no network, no DB write.

---

## 1. Purpose

`TimelineIntelligenceService` answers: **"What is the planned execution timeline, which milestones land on the critical path, and how does the EAOS state machine transition?"**

It is a pure, synchronous transform over the `EngineeringPackage` from EINS (Phase 7). It maps milestone structure from `pkg.graph.milestones`, intersects with `pkg.graph.criticalPath`, and documents the full planned state machine — labelling each transition edge as CONNECTED (structurally derivable from the DAG) or NOT_CONNECTED (requires a live execution source). It never fabricates timestamps, durations, or completion data.

The `TimelineReport` produced here is the `timeline` sub-report inside the `ExecutionPackage`.

---

## 2. Questions It Answers

| Question | Answer source | Connection |
|---|---|---|
| What are the execution milestones and what tasks are in each? | `pkg.graph.milestones` (MILESTONE_DEFS in EngineeringGraphService) | CONNECTED |
| Which milestones are on the critical path? | Intersection of milestone tasks with `pkg.graph.criticalPath` | CONNECTED |
| Which tasks can start immediately (depth 0)? | `pkg.graph.parallelizable` | CONNECTED |
| Which tasks are currently BLOCKED? | `pkg.graph.blocked` | CONNECTED |
| What are all planned state machine transitions (PLANNED→READY etc.)? | Structural derivation from the graph | CONNECTED |
| Which state transitions require a live signal? | All edges involving RUNNING, REVIEW, VERIFIED_LIVE, COMPLETED, FAILED, WAITING | NOT_CONNECTED |
| How long will the feature take? | Execution-history store (no such store exists) | NOT_CONNECTED |
| What is the team's historical velocity? | `task_runs` table or CI run history | NOT_CONNECTED |
| When did a task actually start or finish? | Execution-history store | NOT_CONNECTED |

---

## 3. State Machine

The full `ExecutionStatus` type:

```ts
type ExecutionStatus =
  | 'PLANNED' | 'READY' | 'RUNNING' | 'BLOCKED' | 'WAITING'
  | 'REVIEW' | 'VERIFIED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
```

### Derivable-initial-state algorithm (CONNECTED)

```
for each EngineeringTask in pkg.tasks:
  if pkg.graph.blocked.includes(task.id)  →  BLOCKED   (CONNECTED)
  elif pkg.graph.parallelizable.includes(task.id)  →  READY   (CONNECTED)
  else  →  PLANNED   (CONNECTED — waiting on a prior task in implementationOrder)
```

All downstream transitions require a live execution source.

### Planned transition table

`stateTransitions()` returns one entry per edge in the model:

| From | To | Connection | Note |
|---|---|---|---|
| `PLANNED` | `READY` | CONNECTED | Tasks in `graph.parallelizable` (indegree 0); count is structural |
| `PLANNED` | `BLOCKED` | CONNECTED | Tasks in `graph.blocked`; count is structural |
| `READY` | `RUNNING` | NOT_CONNECTED | Requires live execution signal (agent/CI start event) |
| `RUNNING` | `REVIEW` | NOT_CONNECTED | Requires PR/review-system event |
| `RUNNING` | `COMPLETED` | NOT_CONNECTED | Requires git/artifact presence or CI completion event |
| `RUNNING` | `FAILED` | NOT_CONNECTED | Requires CI/execution failure event |
| `RUNNING` | `WAITING` | NOT_CONNECTED | Requires live agent/CI poll signal |
| `WAITING` | `RUNNING` | NOT_CONNECTED | Requires dependency-resolved signal |
| `REVIEW` | `VERIFIED` | NOT_CONNECTED | Requires CI gate result (note: structural VERIFIED exists for static governance gates via lcis-governance ComplianceReport — but this edge reflects the live CI path) |
| `VERIFIED` | `COMPLETED` | NOT_CONNECTED | Requires merge/CI acceptance event |

`CANCELLED` is a valid terminal state but has no structural predecessor — it requires a human/agent cancellation signal and is always NOT_CONNECTED.

All NOT_CONNECTED edges name `'execution-history store (task_runs table / CI timeline)'` as the would-be source.

---

## 4. Milestones (M1–M6)

The milestone structure comes from the `MILESTONE_DEFS` constant in `EngineeringGraphService`. EAOS maps them verbatim; milestone structure is CONNECTED. Actual timestamps are NOT_CONNECTED.

| id | Title | Layers | Gate |
|---|---|---|---|
| M1 | Schema & Migration | `migration` | `rollback-integrity-validator` |
| M2 | Backend (RPC → gateway → proxy) | `rpc, gateway, proxy` | `route-ownership-lockstep` |
| M3 | Async (workers/queues/events) | `worker, queue, event` | `queue-tenant-envelope-hmac` |
| M4 | UI | `ui` | `design-system-ratchet` |
| M5 | Test & Verify | `test, verification` | `107-validator-gate` |
| M6 | Docs & Launch | `docs, launch` | `launch-readiness` |

Each `TimelineMilestone` carries `connection: 'NOT_CONNECTED'` and `liveSource: 'execution-history store (task_runs table / CI timeline)'` because actual start/end times are not available structurally — only the task membership and gate name are.

---

## 5. Public API

All methods are synchronous and accept an `EngineeringPackage`. The `now` clock is injected via the constructor and used only for the envelope timestamp — never for duration computation.

### 5.1 `executionTimeline`

```ts
executionTimeline(pkg: EngineeringPackage): TimelineMilestone[]
```

Returns all milestones from `pkg.graph.milestones` mapped to `TimelineMilestone[]`. Each milestone carries its `id`, `title`, `tasks[]`, and `gate` (all CONNECTED), plus `connection: 'NOT_CONNECTED'` and `liveSource` for actual timing.

### 5.2 `milestones`

```ts
milestones(pkg: EngineeringPackage): TimelineMilestone[]
```

Alias of `executionTimeline`. Returns the same result — provided as a named surface matching the natural access pattern for callers who want the milestone list directly.

### 5.3 `criticalMoments`

```ts
criticalMoments(pkg: EngineeringPackage): TimelineMilestone[]
```

Filters the milestone list to those where at least one task id appears in `pkg.graph.criticalPath`. Both the critical-path set and milestone membership are CONNECTED. A milestone is a critical moment even if only one of its tasks is on the path.

### 5.4 `stateTransitions`

```ts
stateTransitions(pkg: EngineeringPackage): PlannedStateTransition[]
```

Internal type:

```ts
interface PlannedStateTransition {
  readonly from: ExecutionStatus;
  readonly to: ExecutionStatus;
  readonly note: string;
  readonly connection: 'CONNECTED' | 'NOT_CONNECTED';
  readonly liveSource: string | null;
}
```

Returns 10 transition entries (see table in section 3). The notes embed structural counts (`readyCount`, `blockedCount`, `totalCount`) from `pkg.graph` and `pkg.tasks.length`. These counts are CONNECTED; the transition events they describe are NOT_CONNECTED where stated.

### 5.5 `durationAnalysis`

```ts
durationAnalysis(pkg: EngineeringPackage): {
  totalTasks: number;
  totalDuration: null;
  averageDurationPerTask: null;
  criticalPathDuration: null;
  connection: 'NOT_CONNECTED';
  liveSource: string;
  note: string;
}
```

`totalTasks = pkg.tasks.length` is CONNECTED. All three duration fields are `null`. `liveSource` is `'execution-history store (task_runs table / CI timeline)'`. The `note` field states plainly that no execution-history store is wired — not an error, an honest gap.

### 5.6 `historicalView`

```ts
historicalView(pkg: EngineeringPackage): {
  taskCount: number;
  previousRuns: null;
  velocityData: null;
  connection: 'NOT_CONNECTED';
  liveSource: string;
  note: string;
}
```

EO06 context: stale-execution detection requires historical data. `taskCount = pkg.tasks.length` (CONNECTED). `previousRuns` and `velocityData` are `null` — the note explains: "Historical execution view requires an execution-history store (e.g. task_runs Postgres table or CI run history). No such store is wired." No fabrication.

### 5.7 `generateTimelineReport`

```ts
generateTimelineReport(pkg: EngineeringPackage): TimelineReport
```

Composes the above into a stamped `TimelineReport`:

```ts
interface TimelineReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly milestones: readonly TimelineMilestone[];
  readonly criticalPath: readonly string[];        // from pkg.graph.criticalPath (CONNECTED)
  readonly stateTransitions: readonly {
    readonly from: ExecutionStatus;
    readonly to: ExecutionStatus;
    readonly note: string;   // prefixed with "[CONNECTED]" or "[NOT_CONNECTED]"
  }[];
  readonly summary: string;
}
```

The `summary` states: milestone count, critical-moment count, how many transitions are CONNECTED vs NOT_CONNECTED, and the explicit NOT_CONNECTED declaration for actual durations, timestamps, and historical execution with the exact source named.

Stamped via `execution()` (from `src/shared/envelope.ts`) with three evidence items: a `reuse` from `lcis-engineering/EngineeringGraphService` for milestone structure and critical path, a `reuse` from `lcis-engineering/EngineeringPackage.graph.milestones` citing counts, and a `notConnected` for `timeline:actual-durations`. `liveConnected: false` always.

---

## 6. CONNECTED vs NOT_CONNECTED Signals

| Signal | Connection | Would-be source |
|---|---|---|
| Milestone structure (M1–M6): id, title, tasks[], gate | CONNECTED | `EngineeringGraphService` `MILESTONE_DEFS` constant |
| Task membership per milestone | CONNECTED | `pkg.graph.milestones[n].tasks[]` |
| Critical path task ids | CONNECTED | `pkg.graph.criticalPath` (DP over topo order) |
| Which milestones are critical moments | CONNECTED | Intersection of above two |
| PLANNED → READY transitions (count) | CONNECTED | `pkg.graph.parallelizable.length` |
| PLANNED → BLOCKED transitions (count) | CONNECTED | `pkg.graph.blocked.length` |
| Total task count | CONNECTED | `pkg.tasks.length` |
| READY → RUNNING (agent/CI start) | NOT_CONNECTED | `execution-history store (task_runs table / CI timeline)` |
| RUNNING → REVIEW (PR event) | NOT_CONNECTED | `execution-history store (task_runs table / CI timeline)` |
| RUNNING → COMPLETED (artifact/git) | NOT_CONNECTED | `execution-history store (task_runs table / CI timeline)` |
| RUNNING → FAILED (CI failure) | NOT_CONNECTED | `execution-history store (task_runs table / CI timeline)` |
| RUNNING → WAITING / WAITING → RUNNING | NOT_CONNECTED | `execution-history store (task_runs table / CI timeline)` |
| REVIEW → VERIFIED (CI gate result) | NOT_CONNECTED | `execution-history store (task_runs table / CI timeline)` |
| VERIFIED → COMPLETED (merge) | NOT_CONNECTED | `execution-history store (task_runs table / CI timeline)` |
| Actual task start/end timestamps | NOT_CONNECTED | `execution-history store (task_runs table / CI timeline)` |
| Total / average / critical-path duration | NOT_CONNECTED | `execution-history store (task_runs table / CI timeline)` |
| Historical velocity / previous runs | NOT_CONNECTED | `execution-history store (task_runs table / CI timeline)` |

---

## 7. Rule EO06 — Stale Execution

`historicalView` and `durationAnalysis` exist to support EO06:

| Field | Value |
|---|---|
| id | `EO06` |
| title | Stale execution |
| description | Execution state is stale / not progressing (live signal). |
| severity | `medium` |
| category | `stale` |

Because both methods return `NOT_CONNECTED`, any EO06 finding would itself need a live signal. The service surfaces the structural context (task count, gap existence) while being explicit that the stale-detection trigger requires the execution-history store to be wired.

---

## 8. Access Layers

### CLI

```
lcis execution timeline   # TimelineReport: milestones, criticalPath, stateTransitions
lcis execution status     # StatusReport with ETA (also NOT_CONNECTED)
lcis execution graph      # ExecutionGraph: DAG, implementationOrder, criticalPath
```

### MCP

Tool `lcis_execution_timeline` — accepts an `OrchestrationInput`, returns `TimelineReport` JSON with per-transition connection flags.

### API

```
POST /execution/timeline   body: { text: string, ...FeatureRequest }
POST /execution/full       body: { text: string }  → ExecutionPackage (timeline sub-report inside)
```

### PR-Check V6

`TimelineReport` does not map to a standalone PR-check verdict but contributes to `execution-readiness` (structural milestone coverage) and `execution-health` (blocking milestone gate failures via `pkg.blueprint.gates`).

---

## 9. How It Fits the Facade

`ExecutionOrchestrationEngine` holds `timeline: TimelineIntelligenceService`. The facade delegates:

```ts
async generateTimelineReport(input: OrchestrationInput): Promise<TimelineReport> {
  return this.timeline.generateTimelineReport(await this.resolvePackage(input));
}
```

In `generateFullExecutionPackage`, the timeline report is composed in as `timeline: timelineReport`. It does not contribute a health score (no `ExecutionHealth` field) — health comes from execution, agent, validation, and rollout areas.

---

## 10. Honest Limitations

- Timeline is structural only. Without a wired execution-history store (`task_runs` table, CI run history, or equivalent), every timing and progress field is `null`.
- The state machine documents the model; it does not drive it. EAOS cannot advance a task from PLANNED to RUNNING — that requires an agent or human to start work and a tracker to observe it.
- EO06 (stale-execution detection) cannot fire today. Detecting staleness requires comparing the current timestamp against a last-seen execution event, which is NOT_CONNECTED.
- `VERIFIED_STRUCTURAL` vs `VERIFIED_LIVE` nuance: `lcis-governance` ComplianceReport can confirm structural gate compliance (e.g. the `107-validator-gate` passed structurally). This is a CONNECTED sub-state. The `REVIEW → VERIFIED` edge in `stateTransitions` refers to the live CI path and is correctly marked NOT_CONNECTED; these are distinct.
- Duration and ETA will remain `null` until a store is wired. There is no estimation heuristic — an unknown is surfaced as `null`, never as a fabricated estimate.
