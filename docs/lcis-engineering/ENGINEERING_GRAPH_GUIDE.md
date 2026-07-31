# Engineering Graph Guide — EINS Phase 7

`packages/lcis-engineering/src/graph/EngineeringGraphService.ts`

`EngineeringGraphService.build(tasks)` constructs the engineering dependency
DAG over a frozen `EngineeringTask[]`. It is purely deterministic — same input
always produces the same output. No IO, no mutation of inputs.

---

## Output type

```ts
interface EngineeringGraph {
  nodes:               EngineeringGraphNode[]   // one per task
  edges:               EngineeringGraphEdge[]   // intra-set depends-on edges only
  implementationOrder: string[]                 // Kahn topological sort
  criticalPath:        string[]                 // longest chain (task ids)
  parallelizable:      string[]                 // depth-0 nodes (runnable immediately)
  blocked:             string[]                 // dangling dep or cycle member
  milestones:          EngineeringMilestone[]   // only non-empty milestones
}
```

Each `EngineeringGraphNode` adds:
```ts
{ depth: number; onCriticalPath: boolean }
```

---

## Algorithm — step by step

### Step 1: edge collection + blocked detection

For each task, each `dependsOn` entry is checked against the id set:
- In-set → emit `EngineeringGraphEdge { from, to, relation: 'depends-on' }`
- Out-of-set → add `task.id` to `blocked`

Tasks blocked by a dangling dependency never enter the topological sort.

### Step 2: Kahn topological sort with deterministic tie-break

```
indeg[id] = count of intra-set edges pointing TO id
ready     = tasks where indeg=0 AND not blocked
```

At each step, `ready` is sorted by `(priority asc, id alpha)` before
taking the first element. This ensures that when two tasks are equally
ready, the one with the lower priority number (earlier build layer) comes
first, with id as a stable tiebreaker.

Any task not in `order` after the loop is either in a cycle or
transitively blocked → added to `blocked`.

### Step 3: depth + critical path (DP over topo order)

For each task id in `order`:
```
depth[id] = max(depth[dep] + 1 for dep in task.dependsOn if dep in order)
pred[id]  = the dep that achieved the max depth
```

The task with the highest `depth` is `endNode`.
The critical path is reconstructed backwards via `pred[]`.

`onCriticalPath` is set on any node whose id appears in the critical path.

### Step 4: parallelizable tasks

```
parallelizable = order.filter(id => depth[id] === 0)
```

These tasks have no intra-set predecessors and can start immediately.

### Step 5: milestones

Six milestone definitions (all from source):

| Id | Title | Layers | Gate |
|---|---|---|---|
| M1 | Schema & Migration | migration | rollback-integrity-validator |
| M2 | Backend (RPC → gateway → proxy) | rpc, gateway, proxy | route-ownership-lockstep |
| M3 | Async (workers/queues/events) | worker, queue, event | queue-tenant-envelope-hmac |
| M4 | UI | ui | design-system-ratchet |
| M5 | Test & Verify | test, verification | 107-validator-gate |
| M6 | Docs & Launch | docs, launch | launch-readiness |

Only milestones with at least one matching task are included in the output.

---

## Examples

### Linear chain (A → B → C)

Three tasks: migration A, rpc B (dependsOn A), gateway C (dependsOn B).

```
edges:             A→B, B→C
implementationOrder: [A, B, C]
criticalPath:        [A, B, C]
parallelizable:      [A]
blocked:             []
depth:               A=0, B=1, C=2
```

All three are on the critical path. Only A is parallelizable.

### Diamond (A → B, A → C, both → D)

```
edges:             A→B, A→C, B→D, C→D
implementationOrder: [A, B, C, D]   (or [A, C, B, D] — tie-broken by priority+id)
criticalPath:        [A, B, D]      (or [A, C, D] — first max-depth chain found)
parallelizable:      [A]
blocked:             []
depth:               A=0, B=1, C=1, D=2
```

B and C can run in parallel after A; D is the final gate.

### Cycle detection (A → B → A)

```
edges:             A→B, B→A   (both intra-set)
indeg:             A=1, B=1
ready (initial):   []           ← nothing starts at indeg=0
order:             []
blocked:           {A, B}       ← both added in the post-loop pass
implementationOrder: []
criticalPath:        []
parallelizable:      []
```

### Dangling dependency (A depends on X; X not in the task set)

```
A.dependsOn = [X]   ← X not in ids
edges emitted:     none (X is out-of-set)
blocked:           {A}
implementationOrder: []
```

---

## Determinism contract

The output is fully deterministic:

1. **Tie-break**: `(priority asc, id alpha)` — no random shuffle, no
   insertion-order dependency.
2. **Stable ids**: task ids come from `TaskIntelligenceService.taskId()` which
   is a pure slug function. Same request → same task ids → same graph.
3. **Pure function**: no mutable state, no closure over external data,
   no IO. The constructor takes `_core` only as a type anchor (it is
   immediately voided: `void this._core`).

---

## Integration in EngineeringEngine

```ts
// Build graph from tasks:
engine.generateExecutionGraph(req)
  = graph.build(task.generateTasks(req))

// In the full package (tasks reused, not re-derived):
engine.generateFullEngineeringPackage(req)
  →  tasks = task.generateTasks(req)
     graph = graph.build(tasks)
```

The graph is also available on `blueprint` indirectly via `blueprint.executionGraph`
(from `eis.execution.generateExecutionGraph`, the EIS-level version). The
EINS `EngineeringGraph` is built on top of the EINS `EngineeringTask[]`
layer — it is net-new synthesis over the EINS task list, not a repass of
the EIS execution graph.
