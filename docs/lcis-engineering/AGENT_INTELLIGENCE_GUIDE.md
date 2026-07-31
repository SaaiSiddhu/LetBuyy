# Agent Intelligence Guide — EINS Phase 7

`packages/lcis-engineering/src/agent/AgentIntelligenceService.ts`

`generateAgentPlan` maps a frozen `EngineeringTask[]` to an `AgentPlan` —
the agent task graph that a fleet of specialized agents would execute.
This service is **decoupled from `TaskIntelligenceService`** — it operates
purely on the frozen `EngineeringTask` type and never re-derives analysis.

---

## How it works

```
AgentIntelligenceService
  └── ev = new EngineeringEvidenceBuilder()

generateAgentPlan(tasks: readonly EngineeringTask[]): AgentPlan
  1.  Build idMap: task.id → agentTaskId(task.id)  ("agent:<taskId>")
  2.  Map each EngineeringTask → AgentTask (1:1)
  3.  Compute byAgentType counts
  4.  Return engineering({ tasks, byAgentType, summary }, { evidence, now })
```

---

## AgentTask — the output type

```ts
interface AgentTask {
  id:         string            // "agent:<sourceTaskId>"
  agentType:  AgentType         // taken directly from task.agentType
  title:      string            // verbatim from EngineeringTask.title
  taskRef:    string            // the source EngineeringTask.id
  dependsOn:  readonly string[] // agent-task ids (not source task ids)
  inputs:     readonly string[] // ["domain:<d>", "layer:<l>", "gate:<g>"]
  acceptance: string            // gate assertion + layer criterion
  evidence:   readonly Evidence[]
}
```

---

## AgentType taxonomy

Seven types; which one an agent task uses is taken from `task.agentType`
(the **frozen field** on `EngineeringTask` — always the final source of truth).
The layer-based mapping below is a secondary cross-check only.

| AgentType | Canonical layers |
|---|---|
| `database` | `migration`, `rpc` |
| `backend` | `gateway`, `proxy`, `worker`, `queue`, `event` |
| `frontend` | `ui` |
| `testing` | `test` |
| `documentation` | `docs` |
| `verification` | `verification`, `launch` |
| `devops` | `launch` (from `LAYER_AGENT` in TaskIntelligenceService) |

Note: `verification` covers both `verification` and `launch` layers per
`agentTypeForLayer`, but `TaskIntelligenceService` assigns `launch` layer
to `devops`. The `task.agentType` field wins — always use it, not the layer.

---

## Acceptance criteria — per layer

The `acceptance` field is: `"gate '<task.gate>' passes; <layer criterion>"`.

| Layer | Layer criterion |
|---|---|
| `migration` | migration runs idempotently and rolls back cleanly |
| `rpc` | RPC executes as SECURITY DEFINER with correct tenant isolation |
| `gateway` | gateway route proxies with correct auth and rate-limit headers |
| `proxy` | proxy forwards requests to the gateway on the canonical /api/* path |
| `worker` | worker processes queue messages without side-effect duplication |
| `queue` | queue job is enqueued and dequeued within the expected latency SLO |
| `event` | event is published and all subscribers receive it exactly once |
| `ui` | UI renders correctly with loading / empty / error states on mobile |
| `test` | tests are green under the full pnpm test run |
| `docs` | documentation is present, accurate, and passes the docs-lint gate |
| `verification` | verification confirms the end-to-end flow passes the acceptance contract |
| `launch` | launch gate is GREEN in the Launch Command Center |

---

## dependsOn — id translation

The source `EngineeringTask.dependsOn` references **source task ids**.
`generateAgentPlan` translates each to the corresponding **agent task id**:

```
source:  TASK-RPC-create-gst-invoice   →  agent:TASK-RPC-create-gst-invoice
source:  TASK-MIGRATION-orders          →  agent:TASK-MIGRATION-orders
```

If a source dependency is **not in the current batch**, it is silently omitted
from `dependsOn` — honest, not fabricated. This handles partial batches.

---

## inputs — the three structural coordinates

Each `AgentTask.inputs[]` contains:
```
["domain:<d>",  "layer:<l>",  "gate:<g>"]
```
`domain` is omitted when `task.domain` is `null`.

---

## byAgentType

A plain `Record<AgentType, number>` counting agent tasks per type.

Example for the GST invoice feature (14 source tasks):
```
{ database: 3, backend: 4, frontend: 2, testing: 2, documentation: 2, verification: 2 }
```

The `summary` field renders this as: `"database×3, backend×4, frontend×2, ..."`.

---

## Honest empty plan

When `tasks` is empty, the plan is:
```ts
{
  tasks: [],
  byAgentType: {},
  summary: "No engineering tasks — agent plan is empty (honest)."
}
```
No fabrication — `generateAgentPlan([])` is a valid and expected call.

---

## Evidence pattern

Two evidence items per agent task:

```ts
ev.task(task.id, `agentType=${task.agentType} layer=${task.layer}`)
ev.field(`agent-type-mapping:${task.layer}`, `layer '${task.layer}' → agentType '...'`, 'EINS:agent-intelligence')
```

Plus one plan-level evidence item:
```ts
ev.field('agent-plan:task-count', `mapped N engineering task(s) to M agent task(s)`, 'EINS:agent-intelligence')
```

---

## Integration in EngineeringEngine

The engine facade provides two access paths:

```ts
// Shortcut (tasks derived on-the-fly):
engine.generateAgentPlan(req)
  = agent.generateAgentPlan(task.generateTasks(req))

// Full package (tasks reused, no double-derivation):
engine.generateFullEngineeringPackage(req)
  →  tasks = task.generateTasks(req)
     agentPlan = agent.generateAgentPlan(tasks)  ← same task list, no re-analysis
```

Always prefer the full-package path when you need both `tasks` and `agentPlan`
— it avoids calling `eis.analyze` twice.
