# EAOS Execution Model Discovery
**Phase 8 — Execution & Agent Orchestration System**
*Discovery only. EAOS tracks/orchestrates/validates execution; humans/agents execute.*
*Date: 2026-06-21 | Author: LCIS discovery scan*

---

## 1. What EAOS Tracks: the EINS Output Model

EAOS is a read-only execution-TRACKING layer that consumes the `EngineeringPackage` emitted by `getEngineeringEngine().generateFullEngineeringPackage(req)` in `packages/lcis-engineering/src/engine.ts`. No live execution-tracking store exists in this repo; EAOS derives all structural state from that package and names the exact source for everything it cannot derive.

---

## 2. Core Type Inventory

All types are frozen in `packages/lcis-engineering/src/shared/types.ts`.

### 2.1 `EngineeringTask` — the atomic unit EAOS tracks

| Field | Type | Provenance |
|---|---|---|
| `id` | `string` | deterministic slug: `TASK-<LAYER>-<entity>` (TaskIntelligenceService) |
| `title` | `string` | human-readable: layer + entity + rule annotation |
| `layer` | `EngineeringLayer` | one of 12: `migration\|rpc\|gateway\|proxy\|ui\|worker\|queue\|event\|test\|docs\|verification\|launch` |
| `domain` | `string \| null` | affected domain from `eis.analyze(req).affected.domains` |
| `dependsOn` | `readonly string[]` | ids of prerequisite `EngineeringTask`s (acyclic; set by TaskIntelligenceService per build-order) |
| `priority` | `number` | layer depth: migration=10 … launch=110 |
| `gate` | `string` | per-layer validator name (e.g. `canonical-ledger-only-validator`, `107+ validator gate`) |
| `agentType` | `AgentType` | `database\|backend\|frontend\|testing\|documentation\|verification\|devops` |
| `evidence` | `readonly Evidence[]` | `ev.reuse('lcis-execution', ...)` + `ev.table/rpc/domain(...)` citations |

### 2.2 `AgentTask` — the agent-fleet execution unit

| Field | Type | Provenance |
|---|---|---|
| `id` | `string` | `agent:<EngineeringTask.id>` (stable, collision-free) |
| `agentType` | `AgentType` | copied from `EngineeringTask.agentType` |
| `title` | `string` | copied from `EngineeringTask.title` |
| `taskRef` | `string` | `EngineeringTask.id` this agent task fulfils (1:1) |
| `dependsOn` | `readonly string[]` | agent-task ids resolving `EngineeringTask.dependsOn` within the batch |
| `inputs` | `readonly string[]` | `[domain:<D>, layer:<L>, gate:<G>]` — the three structural coordinates |
| `acceptance` | `string` | `"gate '<gate>' passes; <layer-criterion>"` (layer-specific) |
| `evidence` | `readonly Evidence[]` | `ev.task(taskRef, ...)` + `ev.field(agent-type-mapping:layer, ...)` |

### 2.3 `AgentPlan`

```
AgentPlan {
  tasks: readonly AgentTask[]
  byAgentType: Record<AgentType, number>   // count per agent type
  summary: string
  // EngineeringArtifact: evidence, confidence (0..1), sources, timestamp
}
```

### 2.4 `EngineeringGraph` — the dependency DAG EAOS navigates

Built by `EngineeringGraphService.build(tasks)` in `packages/lcis-engineering/src/graph/EngineeringGraphService.ts`. Deterministic Kahn topo sort with stable tie-break (priority then id).

| Field | Type | How derived |
|---|---|---|
| `nodes` | `readonly EngineeringGraphNode[]` | one per `EngineeringTask`; carries `{id, title, layer, depth, onCriticalPath}` |
| `edges` | `readonly EngineeringGraphEdge[]` | `{from, to, relation:'depends-on'}` — only intra-set deps |
| `implementationOrder` | `readonly string[]` | Kahn topological sort result |
| `criticalPath` | `readonly string[]` | longest-path chain via DP over topo order |
| `parallelizable` | `readonly string[]` | all nodes at `depth === 0` (no unsatisfied deps) |
| `blocked` | `readonly string[]` | nodes with deps outside the task set OR in a cycle |
| `milestones` | `readonly EngineeringMilestone[]` | 6 fixed milestones (M1–M6) grouping tasks by layer, each with a `gate` |

`EngineeringGraphNode` shape:
```
{ id: string; title: string; layer: EngineeringLayer; depth: number; onCriticalPath: boolean }
```

`EngineeringGraphEdge` shape:
```
{ from: string; to: string; relation: 'depends-on' }
```

`EngineeringMilestone` shape:
```
{ id: string; title: string; tasks: readonly string[]; gate: string }
```

Milestones (fixed, from `MILESTONE_DEFS`):
| id | Title | Layers | Gate |
|---|---|---|---|
| M1 | Schema & Migration | `migration` | `rollback-integrity-validator` |
| M2 | Backend (RPC → gateway → proxy) | `rpc, gateway, proxy` | `route-ownership-lockstep` |
| M3 | Async (workers/queues/events) | `worker, queue, event` | `queue-tenant-envelope-hmac` |
| M4 | UI | `ui` | `design-system-ratchet` |
| M5 | Test & Verify | `test, verification` | `107-validator-gate` |
| M6 | Docs & Launch | `docs, launch` | `launch-readiness` |

### 2.5 `EngineeringBlueprint` — the composed plan EAOS uses as context

```
EngineeringBlueprint {
  request: FeatureRequest
  impact: EngineeringImpact          // domains, services, apis, rpcs, tables, workers, queues,
                                     //   events, tests, docs, complexity, risk, unresolved
  change: ChangeAnalysis             // from lcis-execution
  migration: MigrationPlan           // from lcis-execution
  tests: TestPlan                    // from lcis-execution
  verification: VerificationPlan     // from lcis-execution
  rollback: RollbackPlan             // from lcis-execution
  launch: LaunchPlan                 // from lcis-execution
  executionGraph: ExecutionGraph     // from lcis-execution
  ownership: OwnershipReport         // from lcis-governance
  compliance: ComplianceReport       // from lcis-governance (R001–R008)
  security: SecurityDriftReport      // from lcis-governance
  readiness: ReadinessReport         // from lcis-governance
  operations: OperationsReport       // from lcis-operations
  gates: readonly EngineeringFinding[]  // synthesized blockers/gates/risks/gaps
  summary: string
  // EngineeringArtifact: evidence, confidence, sources, timestamp
}
```

### 2.6 `EngineeringPackage` — the EAOS primary input

```
EngineeringPackage {
  request: FeatureRequest
  blueprint: EngineeringBlueprint
  tasks: readonly EngineeringTask[]
  agentPlan: AgentPlan
  graph: EngineeringGraph
  decision: { verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO'; blockers: readonly string[] }
  summary: string
  // EngineeringArtifact: evidence, confidence, sources, timestamp
}
```

`decision.verdict` derivation (in engine.ts, fully structural):
- `NO_GO` if `launch.decision === 'NO_GO'` OR any `gates` entry is `category:'blocker'` and `severity:'critical'`
- `CONDITIONAL_GO` if any gate is `severity:'high'` or launch is `CONDITIONAL_GO`
- `GO` otherwise

### 2.7 `EngineeringFinding` — gates/risks/gaps/blockers in the blueprint

```
EngineeringFinding {
  id: string
  category: 'gate' | 'risk' | 'gap' | 'blocker'
  kind: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  subject: string
  title: string
  detail: string
  rule?: string            // governance rule R001..R008 or engineering rule E001..
  confidence: number       // 0..1
  evidence: readonly Evidence[]
}
```

### 2.8 `EngineeringImpact` — the structural blast surface

```
EngineeringImpact {
  request: FeatureRequest
  domains: readonly string[]
  services: readonly string[]
  apis: readonly string[]
  rpcs: readonly string[]
  tables: readonly string[]
  workers: readonly string[]
  queues: readonly string[]
  events: readonly string[]
  tests: readonly string[]
  docs: readonly string[]
  complexity: { band: ComplexityBand; score: number }
  risk: { level: Severity; money: boolean; tenant: boolean; drivers: readonly string[] }
  unresolved: boolean      // honest empty when no seeds resolve — never fabricated
  // EngineeringArtifact: evidence, confidence, sources, timestamp
}
```

### 2.9 `FeatureRequest` — the originating request EAOS traces back to

```
FeatureRequest {
  text: string
  domains?: readonly string[]
  tables?: readonly string[]
  symbols?: readonly string[]
  files?: readonly string[]
}
```

---

## 3. Package → Execution-Graph Mapping

```
generateFullEngineeringPackage(req)
  └─ generateBlueprint(req)
       ├─ feature.analyzeFeature(req)              → EngineeringImpact
       ├─ eis.analyze(req)                          → ChangeAnalysis (lcis-execution)
       ├─ migration.planMigration(req)              → MigrationPlan
       ├─ verification.planTests/planVerification   → TestPlan, VerificationPlan
       ├─ rollback.planRollback(req)                → RollbackPlan
       ├─ launch.planLaunch(req)                    → LaunchPlan
       ├─ eis.execution.generateExecutionGraph(req) → ExecutionGraph (lcis-execution)
       ├─ gov.{ownership,compliance,security,readiness}  → governance reports
       ├─ ops.operationsReport()                    → OperationsReport
       └─ gates = change.analyzeChange + migration.migrationGates + ...
  └─ task.generateTasks(req)                       → EngineeringTask[] (ordered, Kahn-sorted)
       └─ source: eis.analyze → affected.{tables,rpcs,apis,workers,queues,domains}
           build order: migration(10)→rpc(20)→gateway(30)→proxy(40)→ui(50)
                        →worker(60)→queue(65)→event(70)→test(80)→docs(90)
                        →verification(100)→launch(110)
  └─ agent.generateAgentPlan(tasks)                → AgentPlan (1 AgentTask per EngineeringTask)
  └─ graph.build(tasks)                            → EngineeringGraph (Kahn DAG)
  └─ decision: {verdict, blockers}                 → derived from gates + launch.decision
```

---

## 4. CONNECTED vs NOT_CONNECTED Table

| State dimension | Status | Source / Would-be source if NOT_CONNECTED |
|---|---|---|
| Task graph topology (`nodes`, `edges`, `implementationOrder`) | **CONNECTED** | `EngineeringGraphService.build(tasks)` — deterministic Kahn, pure structural |
| Critical path | **CONNECTED** | `EngineeringGraphService.build` — DP over topo order |
| Parallelizable set | **CONNECTED** | `graph.parallelizable` — all `depth === 0` nodes |
| Blocked set (dep outside batch or cycle) | **CONNECTED** | `graph.blocked` — Kahn residual + explicit cross-set check |
| Milestones (M1–M6) + gate names | **CONNECTED** | `MILESTONE_DEFS` constant in `EngineeringGraphService` |
| Task READY/BLOCKED-by-dependency (all `dependsOn` satisfied?) | **CONNECTED** | derivable from `graph.blocked` + `implementationOrder` (task absent from order → BLOCKED) |
| Decision verdict (GO/CONDITIONAL_GO/NO_GO) | **CONNECTED** | derived in `engine.ts` from `gates` + `launch.decision` |
| `EngineeringImpact` (domains, tables, rpcs, apis, workers, queues, risk, complexity) | **CONNECTED** | `FeatureIntelligenceService.analyzeFeature` → `eis.analyze(req)` → lcis-core graph |
| `EngineeringFinding` gates/blockers | **CONNECTED** | synthesized from `change.analyzeChange` + `migration.migrationGates` + `rollback.rollbackBlockers` + `launch.launchBlockers` |
| Blueprint governance reports (`ownership`, `compliance`, `security`, `readiness`) | **CONNECTED** | `lcis-governance` engine (structural; `readiness` may carry NOT_CONNECTED dims internally) |
| Blueprint `operations` report | **CONNECTED** (structural topology) | `lcis-operations.operationsReport()` — runtime VALUES within it are NOT_CONNECTED |
| **Live task run state** (RUNNING / COMPLETED / FAILED / SKIPPED) | **NOT_CONNECTED** | Would-be source: an execution-tracking store (e.g. a `task_runs` Postgres table, a Redis key per `EngineeringTask.id`, or a CI/CD webhook event) — none exists in this repo |
| **Real artifact presence on disk** (migration file written, test file written, etc.) | **NOT_CONNECTED** | Would-be source: filesystem probe at each task's expected output path or a CI artifact registry |
| **Real validation pass/fail** (did the gate named in `task.gate` actually pass?) | **NOT_CONNECTED** | Would-be source: CI step exit code mapped to `EngineeringTask.gate`; or `pnpm --filter <app> build` + `node scripts/validate-governance.mjs` exit codes captured per task |
| **Completion percentage** | **NOT_CONNECTED** | Would-be source: `completed_count / total_count` over the live task-run store above |
| **ETA** | **NOT_CONNECTED** | Would-be source: historical velocity from the task-run store (mean cycle time per `AgentType` × remaining tasks on critical path) |
| **Agent activity** (which agent is working, on which `AgentTask.id`, started when) | **NOT_CONNECTED** | Would-be source: agent heartbeat/event stream keyed on `AgentTask.id`; no such stream exists |
| **Real acceptance-criterion pass/fail** (`AgentTask.acceptance`) | **NOT_CONNECTED** | Would-be source: acceptance-test runner result mapped to each `AgentTask.taskRef` |

### Summary: what EAOS can derive TODAY (zero new code)

From a single `generateFullEngineeringPackage(req)` call:
- The complete DAG (nodes, edges, order, critical path, parallelizable, blocked, milestones)
- Whether each task is READY (not in `blocked`, appears in `implementationOrder`) or BLOCKED (in `blocked` or absent from `implementationOrder`)
- Which tasks are on the critical path and which can be parallelized
- The GO/CONDITIONAL_GO/NO_GO verdict with evidence-backed blockers
- The full blast surface (domains, tables, rpcs, apis, workers, queues)
- All governance gates and risks (R001–R008, structural)

None of the live/runtime dimensions (run state, artifacts, gate pass/fail, %, ETA, agent activity) are connected. Each would require a purpose-built tracking store whose schema and update protocol are out of scope for Phase 8 discovery.

---

## 5. EAOS Design Constraints (derived from the above)

1. **Input is immutable.** `EngineeringPackage` is a point-in-time snapshot. EAOS re-calls `generateFullEngineeringPackage` to refresh; it does not mutate the package.
2. **No live state fabrication.** EAOS must display NOT_CONNECTED + exact would-be source for every live dimension above, matching the honesty contract inherited from LCIS.
3. **Graph reuse, not reimplementation.** `EngineeringGraphService` is the topo/critical-path authority. EAOS queries it, never reimplements Kahn or DP.
4. **1:1 AgentTask ↔ EngineeringTask.** EAOS dispatches using `AgentTask.id = agent:<EngineeringTask.id>` and resolves back via `AgentTask.taskRef`.
5. **Acceptance criterion is structural.** `AgentTask.acceptance = "gate '<gate>' passes; <layer-criterion>"` — EAOS surfaces this text; it cannot verify it without the NOT_CONNECTED CI gate results.
6. **Safety.** EAOS is read-only. It tracks and orchestrates; it never executes, deploys, writes migrations, or invokes agents directly.

---

## 6. Files Inspected

| File | Role |
|---|---|
| `packages/lcis-engineering/src/shared/types.ts` | Frozen type contract for all EINS/EAOS types |
| `packages/lcis-engineering/src/engine.ts` | `generateFullEngineeringPackage` composition facade |
| `packages/lcis-engineering/src/graph/EngineeringGraphService.ts` | Kahn DAG + critical path + milestones |
| `packages/lcis-engineering/src/task/TaskIntelligenceService.ts` | `EngineeringTask` generation with build-order deps |
| `packages/lcis-engineering/src/agent/AgentIntelligenceService.ts` | `AgentTask` graph + `AgentPlan` |

---

*No code was written. No existing files were modified. Discovery only.*
