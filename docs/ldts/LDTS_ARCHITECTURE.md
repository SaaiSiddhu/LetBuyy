# LDTS Architecture — Dependency Twin System (Phase 11)

**Package:** `packages/lcis-twin` (`@letbuyy/lcis-twin`)
**Source of truth for every claim:** `src/shared/types.ts`, `src/algorithms/graph-algorithms.ts`,
`src/builder/TwinBuilderService.ts`, `src/views/*.ts`, `src/engine.ts`,
`test/engine.test.ts` (measured benchmark). Nothing below is invented.

---

## 1. The Twin Model

### 1.1 Node identity — `layer:name`

Every node carries a deterministic, collision-free id of the form `${layer}:${name}`.
This scheme is defined in `TwinNode` (types.ts line 22) and enforced throughout
`TwinBuilderService` — e.g. `domain:payments`, `table:orders`, `rpc:create_checkout_order`,
`worker:queue-worker`. The builder never emits a node without a non-empty `name`; blank
entries are silently skipped (see lines 204, 300, 322 of TwinBuilderService.ts).

```ts
// src/shared/types.ts
export interface TwinNode {
  readonly id: string;          // `${layer}:${name}` — deterministic
  readonly layer: TwinLayer;
  readonly label: string;
  readonly domain: string | null;
  readonly evidence: readonly Evidence[];
}
```

### 1.2 The 21 Layers

Defined verbatim in `TwinLayer` (types.ts lines 15-19):

```
feature | page | api | rpc | worker | queue | cron
database | table | trigger | policy | storage
deployment | infrastructure | test | documentation
domain | service | symbol | owner | secret
```

These 21 literals are the complete, frozen set. No other string is a valid layer;
the TypeScript union enforces exhaustiveness.

### 1.3 The 13 Relations

Defined verbatim in `TwinRelation` (types.ts lines 31-33):

```
depends-on | calls | reads | writes-to | triggers | consumes
publishes-to | owned-by | deployed-by | contains | secures | documents | tests
```

Each edge carries exactly one relation. The builder only assigns relations that
map directly to a field that exists in the source artifact — see section 3 (Artifact
Sources) for the precise mapping.

### 1.4 Edge structure

```ts
// src/shared/types.ts
export interface TwinEdge {
  readonly from: string;      // node id
  readonly to: string;        // node id
  readonly relation: TwinRelation;
  readonly views: readonly TwinView[];   // which views include this edge
  readonly evidence: readonly Evidence[];
}
```

Every edge carries at least one view membership and a provenance `Evidence` record
citing the exact artifact field that justifies it.

---

## 2. The Six Views

Views are thin, pure projections of `TwinGraph`. Each view class (`src/views/`) filters
the already-sorted edge list to those whose `views` array includes the view name, then
collects only the nodes referenced by those edges. Node and edge order is deterministic
because the builder sorts both before returning (TwinBuilderService.ts lines 503-504).

| View name | Edges included | Extra node rule | Source file |
|---|---|---|---|
| `dependency` | `depends-on`, `contains` (domain-intel) | Referenced nodes only | `DependencyView.ts` |
| `ownership` | `owned-by` | Referenced nodes + all `owner`-layer nodes always included | `OwnershipView.ts` |
| `execution` | `triggers`, `calls` | Referenced nodes only | `ExecutionView.ts` |
| `communication` | `consumes`, `publishes-to` | Referenced nodes only | `CommunicationView.ts` |
| `infrastructure` | `secures` (policy→table), `consumes` (worker→queue) | Referenced nodes only | `InfrastructureView.ts` |
| `data-flow` | `contains` (domain→table/rpc), `triggers` (trigger→table) | Referenced nodes only | `DataFlowView.ts` |

The `OwnershipView` is the only view that adds nodes beyond those required by its
filtered edges — it always includes every `owner`-layer node regardless of edge
participation (OwnershipView.ts lines 35-38).

All six return the same `ViewProjection` shape:

```ts
// src/engine.ts
export interface ViewProjection {
  readonly view: TwinView;
  readonly nodes: readonly TwinNode[];
  readonly edges: readonly TwinGraph['edges'][number][];
  readonly summary: string;
}
```

---

## 3. Artifact Sources and Their Contributions

The builder (`TwinBuilderService.buildTwin`) reads exactly three artifacts from
`ArtifactStore`. A missing artifact is never a throw — it produces a `missingSources`
entry and a `notConnected` evidence record (TwinBuilderService.ts lines 188-191).

### 3.1 `domain-intel.json`

Parsed via `DomainIntelSchema` (loose zod, all fields optional). Contributes:

| Artifact field | Node emitted | Edge emitted | Relation | Views |
|---|---|---|---|---|
| `domains[].key` | `domain:<key>` | — | — | — |
| `domains[].tables[]` | (referenced) | `domain:<key>` → `table:<t>` | `contains` | `dependency`, `data-flow` |
| `domains[].rpcs[]` | (referenced) | `domain:<key>` → `rpc:<r>` | `contains` | `dependency`, `data-flow` |
| `domains[].owners[]` | `owner:<o>` | `domain:<key>` → `owner:<o>` | `owned-by` | `ownership` |
| `domains[].dependsOn[]` | — | `domain:<key>` → `domain:<dep>` | `depends-on` | `dependency` |

`dependsOn` entries may be either plain strings or `{ domain: string }` objects —
both shapes are handled by `parseDependsOnKey` (TwinBuilderService.ts lines 125-132).

### 3.2 `db-intel.json`

Parsed via `DbIntelSchema`. The real artifact uses a `functions[]` array; test stubs
may use `rpcs[]`; both are accepted (TwinBuilderService.ts line 322).

| Artifact field | Node emitted | Edge emitted | Relation | Views |
|---|---|---|---|---|
| `tables[].name` | `table:<name>` | — | — | — |
| `functions[].name` (or `rpcs[]`) | `rpc:<name>` | — | — | — |
| `policies[].name` | `policy:<name>` | `policy:<name>` → `table:<t>` (when `table` field present) | `secures` | `infrastructure` |
| `triggers[].name` | `trigger:<name>` | `trigger:<name>` → `table:<t>` (when `table` field present) | `triggers` | `execution`, `data-flow` |

Domain membership is back-filled: the builder builds a `tableDomainMap` and
`rpcDomainMap` from the `contains` edges already produced by domain-intel, then
stamps `domain` on each db node (TwinBuilderService.ts lines 290-319).

### 3.3 `infra-intel.json`

Parsed via `InfraIntelSchema`. Queue names are gathered from two distinct sources:
explicit `queues[]` entries (test stubs) and `summary.queueProducers` /
`summary.queueConsumers` (real artifact) — both are unioned (TwinBuilderService.ts
lines 416-427).

| Artifact field | Node emitted | Edge emitted | Relation | Views |
|---|---|---|---|---|
| `workers[].name` | `worker:<name>` | — | — | — |
| `queues[].name` or `summary.queue{Producers,Consumers}[]` | `queue:<name>` | — | — | — |
| `workers[].queueConsumers[]` | — | `worker:<w>` → `queue:<q>` (only if queue node exists) | `consumes` | `communication`, `infrastructure` |
| `routes[].path` (or `.name`) | `api:<path>` | — | — | — |

Route nodes are emitted only when `routes[]` is present and non-empty (test stubs
only). The real infra-intel has no top-level `routes[]` — the builder emits an
honest `not-connected` evidence record rather than inventing nodes
(TwinBuilderService.ts lines 452-464).

### 3.4 CODEOWNERS

CODEOWNERS is consumed upstream by `lcis-governance` (`OwnershipService`) which
writes its results into `domain-intel.json` as `owners[]` entries. LDTS reads the
already-resolved ownership from that artifact field; it does not parse CODEOWNERS
directly. This is the correct division of responsibility: LDTS is a composition
facade, not a governance parser.

---

## 4. The Never-Invent-Edges Law

Two enforcement mechanisms guard this law:

**4a. Dangling-edge drop in `buildAdjacency`:**
```ts
// src/algorithms/graph-algorithms.ts line 35
if (!known.has(e.from) || !known.has(e.to)) continue; // dangling edges are dropped, never invented
```
Any edge whose `from` or `to` does not refer to a known node is silently discarded
when building the adjacency — it can never influence algorithm results.

**4b. Builder evidence gate:**
Every edge in `TwinBuilderService` is emitted only after reading a real artifact
field. The code comment on worker→queue edges makes this explicit:
```ts
// Only add the edge if the queue node exists (it was added above)
if (queueNames.has(q)) { ... }
```
There is no code path in the builder that emits an edge without a `from` artifact
field. The security scan (`test/security.test.ts`) enforces that no DB mutation
token (`.from(`, `.rpc(`, `.insert(`, `.update(`, `.upsert(`) appears anywhere in
`src/`, ensuring the package cannot even talk to a live database.

---

## 5. The Six Pure Algorithms

All six live in `src/algorithms/graph-algorithms.ts`. All are total functions (unknown
ids yield empty/not-found, never a throw) and IO-free. They operate on the `Adjacency`
structure built by `buildAdjacency`.

### 5.1 `buildAdjacency`

```ts
export interface Adjacency {
  readonly out: ReadonlyMap<string, readonly string[]>;
  readonly in:  ReadonlyMap<string, readonly string[]>;
  readonly ids: readonly string[];
}

export function buildAdjacency(nodes: readonly TwinNode[], edges: readonly TwinEdge[]): Adjacency
```

Both neighbor lists and `ids` are sorted ascending, ensuring every downstream
algorithm is deterministic under the same input (lines 39-41).

### 5.2 BFS Shortest Path — `shortestPath`

```ts
export function shortestPath(adj: Adjacency, from: string, to: string): PathResult
```

Standard BFS over `adj.out`. Tie-break is deterministic because neighbor lists are
pre-sorted ascending (line 39 of buildAdjacency). Returns `{ found: false, path: [], hops: 0 }`
for unknown node ids or unreachable targets. The facade default depth is the graph
diameter; no depth cap is applied (engine.ts line 115).

### 5.3 Iterative Tarjan SCC — `detectCycles`

```ts
export function detectCycles(adj: Adjacency): CycleReport
```

Implements Tarjan's strongly-connected components algorithm with an explicit work-stack
(iterative, not recursive) to avoid call-stack exhaustion on a large graph
(graph-algorithms.ts line 80 comment). SCCs of size >= 2 are cycles; self-loops
(size == 1 but the node appears in its own out-list) are also reported (line 117-118).
Output cycles are sorted: each cycle's member ids are sorted ascending; cycles are
sorted by their first element ascending (lines 118, 125).

### 5.4 Articulation-Point SPOF — `findSpofs`

```ts
export function findSpofs(adj: Adjacency): SpofReport
```

Computes articulation points of the **undirected projection** of the twin — all
directed edges are mirrored to produce an undirected graph (lines 135-143). Uses the
standard DFS discovery-time / low-link algorithm (iterative). The `splitComponents`
field on each `SpofNode` records how many connected components the graph would split
into if that node were removed. Result sorted by `splitComponents` desc then id asc.

```ts
export interface SpofNode {
  readonly id: string;
  readonly splitComponents: number;  // component-split size on removal
}
```

### 5.5 Fan-In / Fan-Out Ranking — `fanReport`

```ts
export function fanReport(adj: Adjacency, top = 20): FanReport
```

Computes `fanIn` (count of `adj.in` entries) and `fanOut` (count of `adj.out` entries)
for every node. Returns the top-N sorted by `fanIn` desc, then `fanOut` desc, then
`id` asc. The engine facade exposes `fan(top = 20)` (engine.ts line 124).

### 5.6 Depth-Bounded Impact Radius — `impactRadius`

```ts
export function impactRadius(
  adj: Adjacency,
  nodesById: ReadonlyMap<string, TwinNode>,
  root: string,
  depth: number,
): ImpactRadius
```

BFS from `root` expanding both in-neighbors and out-neighbors at each hop — capturing
nodes that depend on the root (consumers) and nodes the root depends on (providers).
Results are returned in `rings` (index 0 = nodes at hop distance 1, etc.) and broken
down by layer in `byLayer`. The engine facade default depth is 3
(engine.ts line 127).

```ts
export interface ImpactRadius {
  readonly root: string;
  readonly depth: number;
  readonly rings: readonly (readonly string[])[];
  readonly totalReached: number;
  readonly byLayer: Readonly<Record<string, number>>;
}
```

### 5.7 Critical Path — `criticalPath`

```ts
export function criticalPath(adj: Adjacency): CriticalPathResult
```

Computes the longest dependency chain through the **DAG condensation**. Cycles are
first collapsed by calling `detectCycles`: each SCC is represented by its first member
(lexicographic minimum). A fresh `dagOut` map is built over representatives; then a
DFS post-order topological sort (iterative, deterministic by sorted `ids`) is run.
Longest-path dynamic programming then fills `dist[id]` = longest path from `id` to
a sink. Tie-break between equally long extensions picks the lexicographically smaller
next node (line 315). The final path is reconstructed by following `next` pointers.

```ts
export interface CriticalPathResult {
  readonly path: readonly string[];  // node ids in order, longest chain
  readonly length: number;           // path.length - 1
}
```

---

## 6. The Facade Caching Model

`DependencyTwinEngineImpl` (engine.ts) caches three derived structures per instance:

| Cache field | What it holds | Lazily built on |
|---|---|---|
| `cachedGraph` | The `TwinGraph` from `builder.buildTwin()` | First call to `buildTwin()` |
| `cachedAdj` | The `Adjacency` from `buildAdjacency()` | First call to any algorithm |
| `cachedNodes` | `Map<string, TwinNode>` for O(1) id lookup | First call to `impactRadius()` |

All three are `null` initially and populated at most once per instance. The structural
artifacts are immutable within a process so a single build is correct. `resetTwinEngine()`
(engine.ts line 188) clears the process-wide singleton — exposed for test isolation only.

---

## 7. Honesty — Topology Only; Runtime Weights NOT_CONNECTED

This is a first-class design invariant, not a footnote.

- Every `TwinGraph` and `TwinReport` carries `liveConnected: false` (envelope.ts line 37,
  engine.ts lines 152, 167).
- The `generateTwinReport` summary string always ends with the phrase
  `"Runtime edge weights (traffic/latency) NOT_CONNECTED — topology only."` (engine.ts
  line 149).
- The algorithm results are purely topological: no call counts, no latency, no error
  rates, no live traffic weights influence any result.
- When a structural source is absent, it is recorded in `missingSources[]` and a
  `notConnected` evidence entry is appended — the twin is returned as partial, never thrown.

---

## 8. The Measured Benchmark (Ceilings Asserted in Tests)

Performance numbers are measured in `test/engine.test.ts`, not stated as facts in
documentation. Two benchmarks run over a deterministic synthetic graph:

**Benchmark 1** — all five algorithms over a 2,000-node tree-with-forward-edges twin
(engine.test.ts lines 170-188):

```ts
test('benchmark: adjacency + all five algorithms over 2,000 nodes complete under 3s total', () => {
  // adjacency, detectCycles, findSpofs, fanReport, criticalPath, impactRadius
  assert.ok(elapsedMs < 3000, `...`);
});
```

**Benchmark 2** — `shortestPath` alone over the same 2,000-node graph
(engine.test.ts lines 190-198):

```ts
test('benchmark: shortestPath across the 2,000-node twin under 250ms', () => {
  assert.ok(elapsedMs < 250, `...`);
});
```

The ceilings (3000 ms and 250 ms) are generous upper bounds that ensure CI never
flaps. The actual measured timings are not stated here because they vary by machine —
see the test output for real numbers.
