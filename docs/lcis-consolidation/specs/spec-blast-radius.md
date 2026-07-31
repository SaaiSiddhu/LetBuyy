# BlastRadiusService — Consolidation Spec

**Target:** `packages/lcis-core/src/blast-radius/index.ts`  
**Status:** SPEC — no code written  
**Artifacts consumed:** `graphify-out/graph.json` · `db-intel.json` · `domain-intel.json` · `relationship-intel.json` · `infra-intel.json`  
**Source files consolidated:** `tools/graph-server/intelligence.mjs` · `tools/graph-server/change-impact.mjs` · `tools/graph-server/cross-domain-engine.mjs` · `tools/graph-server/relationship-intel.mjs`  

---

## 1. Canonical API

```typescript
import { z } from "zod";

// ── Input types ────────────────────────────────────────────────────────────────

export type GraphIndex = {
  nodes: GraphNode[];
  links: GraphEdge[];
  byId: Map<string, GraphNode>;
  /** outbound adjacency (source → targets) */
  out: Map<string, AdjEntry[]>;
  /** inbound adjacency (target → sources) */
  inc: Map<string, AdjEntry[]>;
  /** degree (in + out) per node id */
  deg: Map<string, number>;
};

export type GraphNode = {
  id: string;
  label: string;
  file_type: string;
  source_file: string;
  source_location: string;
  _origin: string;
  community: number;
  norm_label: string;
};

export type GraphEdge = {
  source: string;
  target: string;
  relation: RelationType;
  confidence: string;
  confidence_score: number;
  weight: number;
  source_file: string;
  source_location: string;
};

// All relation types present in graph.json (as of 2026-06-20):
export type RelationType =
  | "contains" | "imports_from" | "imports" | "calls"
  | "references" | "method" | "inherits" | "re_exports"
  | "defines" | "rationale_for" | "implements" | "exports"
  | "navigates" | "mixes_in" | "extends";

export type AdjEntry = { id: string; rel: RelationType };

// ── Node view (provenance-annotated) ──────────────────────────────────────────

export type NodeView = {
  id: string;
  label: string;
  file: string;           // source_file
  loc: string;            // source_location
  degree: number;
  community: number;
  /** Provenance: graph node id */
  provenance: string;
};

// ── Method output types ────────────────────────────────────────────────────────

/** blast(symbol) — "what files/nodes break if this symbol changes?" */
export type BlastResult = {
  node: NodeView;
  impactedNodes: number;
  impactedFiles: number;
  /** Number of impacted nodes per BFS depth layer */
  layers: number[];
  /** Top impacted nodes sorted by degree descending, max 12 */
  topImpacted: NodeView[];
  /** Provenance: derived from inc adjacency in graphify-out/graph.json */
  artifact: "graphify-out/graph.json";
};

/** dependencies(symbol) — "what does this symbol import/call?" */
export type DependencyResult = {
  node: NodeView;
  dependsOn: (NodeView & { rel: RelationType })[];
  artifact: "graphify-out/graph.json";
};

/** consumers(symbol) — "what imports/calls this symbol?" */
export type ConsumerResult = {
  node: NodeView;
  consumedBy: (NodeView & { rel: RelationType })[];
  artifact: "graphify-out/graph.json";
};

/** path(a, b) — shortest directed path between two symbols */
export type PathResult = {
  from: NodeView;
  to: NodeView;
  /** Ordered list of nodes from `a` to `b`; empty if unreachable */
  path: NodeView[];
  hops: number;
  artifact: "graphify-out/graph.json";
};

/** crossDomain(domain) — "what breaks if this domain changes?" */
export type CrossDomainResult = {
  domain: string;
  label: string;
  directConsumers: { domain: string; strength: number }[];
  blastRadius: {
    domains: number;
    layers: number[];
    affected: string[];
  };
  owners: string[];
  services: { apps: string[]; workers: string[] };
  routes: string[];
  rpcs: string[];
  tables: string[];
  artifact: "graphify-out/domain-intel.json";
};

/** impact(domain) — full composite impact: domains + routes + rpcs + tables + workers + queues + risk */
export type ImpactResult = {
  domain: string;
  label: string;
  breaks: {
    domains: { count: number; list: string[]; layers: number[] };
    routes: string[];
    rpcs: string[];
    tables: string[];
    workers: string[];
    queues: string[];
    deployments: {
      workers: string[];
      apps: string[];
      gate: string;
    };
    merchants: string;
    owners: string[];
  };
  risk: {
    money: boolean;
    tenant: boolean;
    note: string;
  };
  artifacts: ["graphify-out/domain-intel.json", "graphify-out/db-intel.json"];
};

/** critical(n?) — top-N highest-degree nodes */
export type CriticalResult = {
  nodes: NodeView[];
  artifact: "graphify-out/graph.json";
};

/** relationships(table) — FK fan-in / fan-out for a DB table */
export type RelationshipResult = {
  table: string;
  references: string[];     // tables this table FK-references
  referencedBy: string[];   // tables that FK-reference this table
  fanIn: number;
  fanOut: number;
  artifact: "graphify-out/relationship-intel.json";
};

// ── Service class ─────────────────────────────────────────────────────────────

export class BlastRadiusService {
  /**
   * Load graph index from graphify-out/graph.json.
   * Uses streaming JSON parse + in-memory adjacency maps.
   * Must be called once before any method; result is cached on the instance.
   */
  async load(): Promise<void>;

  /**
   * Resolve a human-friendly symbol string to a graph node id.
   * Matching priority: exact id > exact label > label prefix > label contains > source_file contains.
   * Tie-break: highest degree (most connected node wins).
   */
  resolveId(query: string): string | null;

  /**
   * BFS over the inbound adjacency (inc map) up to `depth` layers.
   * Returns all nodes that transitively depend on `symbol`.
   * @param depth default 3
   */
  blast(symbol: string, depth?: number): BlastResult | null;

  /**
   * Direct outbound neighbours of `symbol` in the code graph.
   * Uses the out adjacency map — single hop only.
   */
  dependencies(symbol: string): DependencyResult | null;

  /**
   * Direct inbound neighbours of `symbol` in the code graph.
   * Uses the inc adjacency map — single hop only.
   */
  consumers(symbol: string): ConsumerResult | null;

  /**
   * BFS shortest path from node `a` to node `b` over outbound edges.
   * Returns null if either node is not found; returns empty path if unreachable.
   */
  path(a: string, b: string): PathResult | null;

  /**
   * Transitive consumer closure over domain-intel.json cross-domain edges.
   * "What breaks if domain `key` changes?" — walks consumedBy edges.
   */
  crossDomain(key: string): CrossDomainResult | { error: string };

  /**
   * Composite impact for a domain: crossDomain + db-intel money/tenant flags
   * + infra queues/workers + deployment gate annotation.
   * Supersedes the separate changeImpact() function in change-impact.mjs.
   */
  impact(key: string): ImpactResult | { error: string };

  /**
   * Top-N nodes by total degree (in + out).
   * @param n default 20
   */
  critical(n?: number): CriticalResult;

  /**
   * FK graph lookup for a table from relationship-intel.json.
   */
  relationships(table: string): RelationshipResult | { error: string };
}
```

---

## 2. Deterministic Algorithm per Method

### 2.1 `load()` — Graph index construction

**Artifact:** `graphify-out/graph.json` (52 246 nodes, 66 761 edges, ~45 MB)

**Efficient loading approach — indexed parse, not streaming:**

The file must be parsed once at startup. At 45 MB, a standard `JSON.parse(readFileSync(...))` takes ~200 ms and produces a ~110 MB in-memory object. The adjacency maps are built in a single O(E) pass over the edge array and cached on the service instance. Full streaming (e.g. `JSONStream`) is not necessary because the file is loaded once per process and the in-memory footprint is acceptable for a server-side intelligence service. The service must NOT re-read the file on every call.

```
graph = JSON.parse(readFileSync('graphify-out/graph.json'))
nodes = graph.nodes                        // GraphNode[]
links = graph.links ?? graph.edges         // GraphEdge[] (alias)
byId  = new Map(nodes.map(n => [n.id, n]))
out   = new Map<string, AdjEntry[]>()
inc   = new Map<string, AdjEntry[]>()
deg   = new Map<string, number>()

for each edge e in links:
  out[e.source].push({ id: e.target, rel: e.relation })
  inc[e.target].push({ id: e.source, rel: e.relation })
  deg[e.source]++
  deg[e.target]++
```

Secondary artifacts (`db-intel.json`, `domain-intel.json`, `relationship-intel.json`, `infra-intel.json`) are small (<5 MB each) and loaded synchronously at construction time; missing files produce `null` (graceful degradation, not an error, for methods that use only the code graph).

### 2.2 `resolveId(query)` — Symbol resolution

```
if byId.has(query) → return query                        // exact id match
ql = query.toLowerCase()
best = null, bestDeg = -1
for each node n in nodes:
  l = n.label.toLowerCase()
  if l === ql OR l.startsWith(ql) OR l.includes(ql)
     OR n.source_file.toLowerCase().includes(ql):
    d = deg.get(n.id) ?? 0
    if d > bestDeg: bestDeg = d; best = n.id
return best   // null if no match
```

No fuzzy matching; exact string operations only. Highest-degree node wins ties (the "most-connected" interpretation is the useful one for blast analysis).

### 2.3 `blast(symbol, depth=3)` — Inbound BFS

**Algorithm:** BFS over `inc` (inbound adjacency = "who depends on me?").

```
id = resolveId(symbol)
if !id → return null

seen = Set([id])
frontier = [id]
layers = []

repeat depth times:
  next = []
  for cur in frontier:
    for e in inc[cur] ?? []:
      if !seen.has(e.id):
        seen.add(e.id)
        next.push(e.id)
  if next is empty: break
  layers.push(next.length)
  frontier = next

impacted = [...seen].filter(x => x !== id)
files = Set(impacted.map(x => byId[x]?.source_file).filter(Boolean))

return {
  node: view(id),
  impactedNodes: impacted.length,
  impactedFiles: files.size,
  layers,
  topImpacted: impacted
    .map(x => view(x))
    .sort((a,b) => b.degree - a.degree)
    .slice(0, 12),
  artifact: "graphify-out/graph.json"
}
```

**Important:** The blast walks `inc` (inbound), not `out`. This correctly captures "who breaks if I change X" (consumers), not "what X depends on".

### 2.4 `dependencies(symbol)` — Direct outbound (single hop)

```
id = resolveId(symbol)
return { node: view(id), dependsOn: (out[id] ?? []).map(e => ({ ...view(e.id), rel: e.rel })).filter(Boolean) }
```

### 2.5 `consumers(symbol)` — Direct inbound (single hop)

```
id = resolveId(symbol)
return { node: view(id), consumedBy: (inc[id] ?? []).map(e => ({ ...view(e.id), rel: e.rel })).filter(Boolean) }
```

### 2.6 `path(a, b)` — BFS shortest path

**Not in the current `.mjs` exports** — this is a new method synthesized from the CLI description. Algorithm:

```
idA = resolveId(a), idB = resolveId(b)
if !idA || !idB → return null

queue = [[idA]]
visited = Set([idA])

while queue not empty:
  pathSoFar = queue.shift()
  cur = pathSoFar[pathSoFar.length - 1]
  if cur === idB:
    return { from: view(idA), to: view(idB), path: pathSoFar.map(view), hops: pathSoFar.length - 1 }
  for e in out[cur] ?? []:
    if !visited.has(e.id):
      visited.add(e.id)
      queue.push([...pathSoFar, e.id])

return { from: view(idA), to: view(idB), path: [], hops: -1 }  // unreachable
```

### 2.7 `crossDomain(key)` — Domain consumer BFS

**Artifact:** `graphify-out/domain-intel.json` (22 domains, 49 cross-domain edges)

```
d = di.domains.find(x => x.key === key)
if !d → return { error, available: di.domains.map(x.key) }

consumersOf(k) = di.domains.find(x => x.key === k)?.consumedBy.map(c => c.domain) ?? []

seen = Set([key])
frontier = [key]
layers = []

while frontier:
  next = []
  for cur in frontier:
    for c in consumersOf(cur):
      if !seen.has(c): seen.add(c); next.push(c)
  if !next: break
  layers.push(next.length)
  frontier = next

impacted = [...seen].filter(k => k !== key)
impactedDomains = impacted.map(k => di.domains.find(x => x.key === k))

return {
  domain: key, label: d.label,
  directConsumers: d.consumedBy,
  blastRadius: { domains: impacted.length, layers, affected: impacted },
  owners: dedupe([...impactedDomains.flatMap(x => x.owners), ...d.owners]),
  services: {
    apps: dedupe([...impactedDomains.flatMap(x => x.apps), ...d.apps]),
    workers: dedupe([...impactedDomains.flatMap(x => x.workers), ...d.workers])
  },
  routes: dedupe([...impactedDomains.flatMap(x => x.routes), ...d.routes]),
  rpcs: dedupe([...impactedDomains.flatMap(x => x.rpcs), ...d.rpcs]),
  tables: dedupe([...impactedDomains.flatMap(x => x.tables), ...d.tables]),
  artifact: "graphify-out/domain-intel.json"
}
```

### 2.8 `impact(domain)` — Composite domain impact

**Artifacts:** `domain-intel.json` + `db-intel.json` (optional) + `infra-intel.json` (optional)

```
b = crossDomain(key)               // calls the method above
if b.error → return b

d = di.domains.find(x => x.key === key)

moneyTouched = b.tables.some(t => db?.tables.find(x => x.name === t)?.money)
tenantTouched = b.tables.some(t => db?.tables.find(x => x.name === t)?.tenant)

queues = dedupe([
  ...([d, ...b.blastRadius.affected.map(k => di.domains.find(x => x.key === k))])
    .filter(Boolean)
    .flatMap(x => x.queues)
])

return {
  domain: key, label: b.label,
  breaks: {
    domains: { count: b.blastRadius.domains, list: b.blastRadius.affected, layers: b.blastRadius.layers },
    routes: b.routes, rpcs: b.rpcs, tables: b.tables,
    workers: b.services.workers, queues,
    deployments: {
      workers: b.services.workers, apps: b.services.apps,
      gate: "production-deploy.yml: migrate-production → workers → Vercel; rollback via production-rollback.mjs"
    },
    merchants: tenantTouched
      ? "ALL tenants — shared multi-tenant schema (RLS + verifySiteOwnership isolate, not physical separation)"
      : "platform-internal (no tenant table touched)",
    owners: b.owners
  },
  risk: {
    money: moneyTouched, tenant: tenantTouched,
    note: moneyTouched
      ? "touches money tables — canonical-ledger-only-validator + step-up apply; run blast on the RPCs before merge"
      : "no money table in blast radius"
  },
  artifacts: ["graphify-out/domain-intel.json", "graphify-out/db-intel.json"]
}
```

### 2.9 `critical(n=20)` — Top-N by degree

```
return nodes
  .map(nd => view(nd.id))
  .sort((a,b) => b.degree - a.degree)
  .slice(0, n)
```

### 2.10 `relationships(table)` — FK graph

**Artifact:** `graphify-out/relationship-intel.json` (705 FK edges, 367 tables)

```
ri = relationship-intel.json
t = ri.tables.find(x => x.name === table)
if !t → return { error: `table '${table}' not in relationship graph`, note: "may have no foreign keys" }
return { table, references: t.references, referencedBy: t.referencedBy, fanIn: t.fanIn, fanOut: t.fanOut }
```

---

## 3. Source-Logic Consolidation

| `BlastRadiusService` method | Source function(s) | Action |
|---|---|---|
| `load()` | `load()` in `intelligence.mjs` | **Carry over** verbatim; add lazy-cache guard |
| `resolveId()` | `resolveId()` in `intelligence.mjs` | **Carry over** (private helper) |
| `blast()` | `findBlastRadius()` in `intelligence.mjs` | **Rename + typed** |
| `dependencies()` | `findDependencies()` in `intelligence.mjs` | **Rename + typed** |
| `consumers()` | `findConsumers()` in `intelligence.mjs` | **Rename + typed** |
| `path()` | Not exported (CLI help text mentions it) | **New method** — BFS over `out` |
| `crossDomain()` | `blastDomain()` in `cross-domain-engine.mjs` + `domainDependencyClosure()` | **Rename `blastDomain` → `crossDomain`**; `domainDependencyClosure` becomes a private helper used if `impact()` needs it |
| `impact()` | `changeImpact()` in `change-impact.mjs` | **Rename + inline the `blastDomain` import** |
| `critical()` | `findCriticalSystems()` in `intelligence.mjs` | **Rename + typed** |
| `relationships()` | `relationshipsFor()` in `relationship-intel.mjs` | **Rename + typed** |

### Dropped / not consolidated

| Function | Reason |
|---|---|
| `tracePaymentFlow()`, `traceTenantFlow()`, `traceFlow()`, `traceRPC()`, `traceTable()`, `tracePolicy()`, `traceRefund()`, `tracePayout()` | SQL-lineage layer — belongs in a separate `DBLineageService` (out of scope for this spec) |
| `findOwnership()`, `infraSummary()` | Ownership/infra layer — belongs in `OwnershipService` |
| `buildRelationshipIntel()` (in `relationship-intel.mjs`) | Build-time artifact generator — belongs in a `graph:build` script, not the runtime service |
| `couplingMatrix()` (in `cross-domain-engine.mjs`) | UI-facing coupling matrix — re-expose via a thin wrapper in the graph server if still needed; not part of blast-radius semantics |
| CLI `if (import.meta.url === ...)` blocks | All four source files have CLI entry points — drop entirely; replaced by the `pnpm graph:intel` CLI which imports from the package |

### Duplicated logic eliminated

- **BFS closure**: `findBlastRadius` (intelligence.mjs) and `blastDomain` (cross-domain-engine.mjs) both implement BFS over different adjacency structures (code graph `inc` vs domain `consumedBy`). Both are kept but as separate methods operating on separate data — they are NOT merged into one BFS because the input graphs differ.
- **`resolveId` in `intelligence.mjs`** is the only symbol-resolution implementation. `change-impact.mjs` delegates to `cross-domain-engine.mjs` which uses domain key exact match — no fuzzy resolution needed there. No duplication.
- **JSON loading**: All four files each call `readFileSync` independently. Consolidated into a single `ArtifactStore` singleton that loads each artifact once and is injected into `BlastRadiusService`.

---

## 4. Inputs — Artifacts and Fields Used

### `graphify-out/graph.json` (~45 MB)
- `nodes[]`: `id`, `label`, `file_type`, `source_file`, `source_location`, `community`, `norm_label`
- `links[]` (alias `edges[]`): `source`, `target`, `relation`, `confidence`, `confidence_score`, `weight`, `source_file`, `source_location`
- **Fields NOT used by BlastRadiusService:** `_origin`, `norm_label` (only needed by graph UI)

### `graphify-out/db-intel.json` (~2 MB)
- `tables[]`: `name`, `money`, `tenant` (for money/tenant risk flags in `impact()`)
- `functions[]`: `name`, `touches`, `securityDefiner`, `hasIdempotency`, `forUpdate`, `callers` (used by DBLineageService, not BlastRadiusService — listed for completeness)
- `routeRpc`, `routeTables`: used by DBLineageService

### `graphify-out/domain-intel.json` (~200 KB)
- `domains[]`: `key`, `label`, `money`, `tenant`, `routes`, `rpcs`, `tables`, `queues`, `apps`, `workers`, `secrets`, `owners`, `dependsOn[]`, `consumedBy[]`
- `edges[]`: `from`, `to`, `via`, `strength` (used by `couplingMatrix`, not BlastRadiusService directly)

### `graphify-out/relationship-intel.json` (~400 KB)
- `tables[]`: `name`, `references[]`, `referencedBy[]`, `fanIn`, `fanOut`
- `edges[]`: `from`, `to`, `columns[]`
- `summary`: `tenantRoot`, `mostReferenced`, `mostDependent`

### `graphify-out/manifest.json`
- **Not used by BlastRadiusService.** Contains file mtime/hash registry used by the incremental graph builder. Out of scope.

### `graphify-out/infra-intel.json`
- `ownership[]`: `path`, `owners` (used by `impact()` → indirectly via domain owners; direct ownership lookup belongs in `OwnershipService`)

---

## 5. Output Types — Zod Schemas

```typescript
import { z } from "zod";

export const NodeViewSchema = z.object({
  id: z.string(),
  label: z.string(),
  file: z.string(),
  loc: z.string(),
  degree: z.number().int().nonnegative(),
  community: z.number().int(),
  provenance: z.string(),
});

export const BlastResultSchema = z.object({
  node: NodeViewSchema,
  impactedNodes: z.number().int().nonnegative(),
  impactedFiles: z.number().int().nonnegative(),
  layers: z.array(z.number().int().nonnegative()),
  topImpacted: z.array(NodeViewSchema).max(12),
  artifact: z.literal("graphify-out/graph.json"),
});

export const DependencyResultSchema = z.object({
  node: NodeViewSchema,
  dependsOn: z.array(NodeViewSchema.extend({ rel: z.string() })),
  artifact: z.literal("graphify-out/graph.json"),
});

export const ConsumerResultSchema = z.object({
  node: NodeViewSchema,
  consumedBy: z.array(NodeViewSchema.extend({ rel: z.string() })),
  artifact: z.literal("graphify-out/graph.json"),
});

export const PathResultSchema = z.object({
  from: NodeViewSchema,
  to: NodeViewSchema,
  path: z.array(NodeViewSchema),
  hops: z.number().int(),
  artifact: z.literal("graphify-out/graph.json"),
});

export const CrossDomainResultSchema = z.object({
  domain: z.string(),
  label: z.string(),
  directConsumers: z.array(z.object({ domain: z.string(), strength: z.number() })),
  blastRadius: z.object({
    domains: z.number().int(),
    layers: z.array(z.number().int()),
    affected: z.array(z.string()),
  }),
  owners: z.array(z.string()),
  services: z.object({ apps: z.array(z.string()), workers: z.array(z.string()) }),
  routes: z.array(z.string()),
  rpcs: z.array(z.string()),
  tables: z.array(z.string()),
  artifact: z.literal("graphify-out/domain-intel.json"),
});

export const ImpactResultSchema = z.object({
  domain: z.string(),
  label: z.string(),
  breaks: z.object({
    domains: z.object({ count: z.number().int(), list: z.array(z.string()), layers: z.array(z.number().int()) }),
    routes: z.array(z.string()),
    rpcs: z.array(z.string()),
    tables: z.array(z.string()),
    workers: z.array(z.string()),
    queues: z.array(z.string()),
    deployments: z.object({ workers: z.array(z.string()), apps: z.array(z.string()), gate: z.string() }),
    merchants: z.string(),
    owners: z.array(z.string()),
  }),
  risk: z.object({ money: z.boolean(), tenant: z.boolean(), note: z.string() }),
  artifacts: z.tuple([z.string(), z.string()]),
});

export const RelationshipResultSchema = z.object({
  table: z.string(),
  references: z.array(z.string()),
  referencedBy: z.array(z.string()),
  fanIn: z.number().int().nonnegative(),
  fanOut: z.number().int().nonnegative(),
  artifact: z.literal("graphify-out/relationship-intel.json"),
});
```

---

## 6. Test Cases — Real Data

All expected values are from actual artifact data as of 2026-06-20 graph build.

### TC-01 `blast("getSupabaseAdmin")`
```
symbol resolves to: "lib_supabase_getsupabaseadmin"
source file: "services/api-gateway/src/lib/supabase.ts"  L17
degree: 170
impactedNodes: 197
impactedFiles: 115
layers: [169, 26, 2]          // 3 BFS layers
topImpacted[0].label: "index.ts"   // services/api-gateway/src/index.ts, degree 209
```
Assertion: `impactedFiles >= 115` and `layers.length === 3`.

### TC-02 `blast("create_checkout_order")`
```
symbol resolves to governance doc node (no TS import graph representation)
impactedNodes: 3
impactedFiles: 1
note: the RPC exists only in db-intel.json; the code graph picks up the
      governance markdown reference. TS callers (api-gateway routes) are
      captured via traceRPC (DBLineageService), not blast.
```
Assertion: `impactedNodes < 10` — confirms the code-graph blast on an RPC name
resolves the governance doc, not the gateway callers. The correct tool for RPC
callers is `DBLineageService.traceRPC("create_checkout_order")`.

### TC-03 `consumers("getSupabaseAdmin")`
```
consumedBy.length: 169    // direct inbound edges, single hop
```
Assertion: `consumedBy.length >= 100`.

### TC-04 `dependencies("getSupabaseAdmin")`
```
dependsOn.length: 1      // supabase.ts has 1 outbound edge
```

### TC-05 `crossDomain("payments")`
```
blastRadius.domains: 11
blastRadius.affected includes: ["refunds","operations","orders","authentication",
  "notifications","analytics","payouts","inventory","shipping","themes","storefront"]
blastRadius.layers: [3, 6, 2]
services.workers: ["letbuyy-api","letbuyy-queue-workers","letbuyy-webhook"]
```
Assertion: `blastRadius.domains === 11` and `blastRadius.layers.length === 3`.

### TC-06 `impact("payments")`
```
risk.money: true
risk.tenant: true   (payment_transactions.hasSiteId = true)
breaks.domains.count: 11
breaks.merchants: "ALL tenants — shared multi-tenant schema..."
```

### TC-07 `critical(5)`
```
result.nodes.length === 5
result.nodes[0] has the highest degree in the graph
// Based on blast data: packages/checkout-core/src/index.ts has degree 227;
// services/api-gateway/src/index.ts has degree 209
```
Assertion: `nodes[0].degree >= nodes[1].degree` for all consecutive pairs.

### TC-08 `relationships("sites")`
```
fanIn: 260       // most-referenced table in the repo
fanOut: 3        // sites references: theme_releases, users_custom, users
references: ["theme_releases", "users_custom", "users"]
referencedBy.length: 260+  (many tenant tables)
```
Assertion: `fanIn === 260` and `references.length === 3`.

### TC-09 `path("getSupabaseAdmin", "checkout.ts")`
```
// Should find a path via the gateway index
hops >= 1
path[0].id === "lib_supabase_getsupabaseadmin"
```

### TC-10 `blast("supabase.ts")` (file-level resolution)
```
// resolves to the file's highest-degree node (same as getSupabaseAdmin)
node.id: "lib_supabase_getsupabaseadmin"
impactedNodes: 197
impactedFiles: 115
```
Confirms that file-path queries work via `source_file.includes(query)` match.

---

## 7. ArtifactStore — Loading Strategy

```typescript
// packages/lcis-core/src/artifact-store.ts

export class ArtifactStore {
  private static instance: ArtifactStore | null = null;
  private readonly cache = new Map<string, unknown>();
  private readonly root: string;

  private constructor(root: string) { this.root = root; }

  static get(root: string): ArtifactStore {
    if (!ArtifactStore.instance) ArtifactStore.instance = new ArtifactStore(root);
    return ArtifactStore.instance;
  }

  /**
   * Load artifact synchronously (first call) then return from cache.
   * The 45 MB graph.json is ~200 ms to parse; it is loaded once and held.
   */
  load<T>(filename: string): T | null {
    if (this.cache.has(filename)) return this.cache.get(filename) as T;
    const p = join(this.root, 'graphify-out', filename);
    if (!existsSync(p)) { this.cache.set(filename, null); return null; }
    const v = JSON.parse(readFileSync(p, 'utf8')) as T;
    this.cache.set(filename, v);
    return v;
  }

  /** Invalidate to force re-read (e.g. after pnpm graph:update) */
  invalidate(filename?: string): void {
    if (filename) this.cache.delete(filename);
    else this.cache.clear();
  }
}
```

The `BlastRadiusService` constructor receives a pre-built `GraphIndex` (from `ArtifactStore`) rather than reading files itself. This separates IO from computation and makes the service unit-testable with in-memory fixture data.

---

## 8. Package Layout

```
packages/lcis-core/
  src/
    blast-radius/
      index.ts              ← BlastRadiusService (this spec)
      types.ts              ← All TS types + Zod schemas
    artifact-store.ts       ← ArtifactStore singleton
  package.json              ← name: @letbuyy/lcis-core
  tsconfig.json             ← ESM, strict
```

**Exports from `@letbuyy/lcis-core`:**
```typescript
export { BlastRadiusService } from "./blast-radius/index.js";
export type {
  BlastResult, DependencyResult, ConsumerResult, PathResult,
  CrossDomainResult, ImpactResult, CriticalResult, RelationshipResult,
  NodeView, GraphIndex
} from "./blast-radius/types.js";
export { ArtifactStore } from "./artifact-store.js";
```

---

## 9. Citations

Every `NodeView` carries `provenance: string` = the graph node `id` (e.g. `"lib_supabase_getsupabaseadmin"`). Every result carries `artifact: "graphify-out/<filename>"` to identify which pre-computed artifact the result was derived from. When a result is derived from multiple artifacts (e.g. `impact()`), `artifacts` is a tuple of all artifact filenames consumed.

---

*Spec produced 2026-06-20. Re-validate test case expected values after any `pnpm graph:update` that rebuilds `graph.json` or `domain-intel.json`.*
