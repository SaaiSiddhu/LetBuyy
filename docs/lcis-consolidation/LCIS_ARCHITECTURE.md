# LCIS Core Architecture

## Layer Diagram

```
contracts/         ← canonical types only; imports nothing
runtime/           ← ArtifactStore + path resolution; imports node:fs, node:path only
graph/             ← GraphService; imports contracts + runtime
blast-radius/      ─┐
memory/             ├─ service layer; each imports contracts + runtime + graph only
decision/           │  services never import each other
architecture/       │
verification/      ─┘
```

No cycles. The dependency order is strict and tested by `contract.test.ts`.

---

## Package Layout

| Module path | Contents |
|-------------|----------|
| `src/contracts/` | Canonical types: `GraphNode`, `GraphEdge`, `Explanation`, `Evidence`, `Verification`, `VerificationStatus`, `Gap`, capability/assessment/memory/architecture/verification contracts. The `evidence()` and `notConnected()` factory functions. |
| `src/runtime/` | `ArtifactStore` (single IO boundary), `ArtifactMissingError`, `findRepoRoot()`, `graphifyOutDir()`. Only imports `node:fs` and `node:path`. |
| `src/graph/` | `GraphService` (adjacency index over `graph.json`). `Direction` type. |
| `src/blast-radius/` | `BlastRadiusService`, result types (`BlastResult`, `ConsumerResult`, `DependencyResult`, `PathResult`, `CriticalResult`, `CrossDomainResult`, `ImpactResult`, `RelationshipResult`, `DomainError`, `NodeView`, `NodeViewRel`). |
| `src/memory/` | `MemoryService`, `BM25Index` (`bm25.ts`), corpus loader (`corpus.ts`), memory types. |
| `src/decision/` | `DecisionService`, scoring functions (`scoring.ts`), artifact loaders (`artifacts.ts`), decision types. |
| `src/architecture/` | `ArchitectureService`, `NARRATIVE` map (22 domains), `MONEY_TABLES` (18 entries), `KNOWN_CRITICAL` packages (6 entries), `CANONICAL_RUNTIMES` (9), `FROZEN_APPS` (4), `LAYER_MAP`, `PACKAGE_LAYER_MAP`, `FORBIDDEN_LAYER_DEPS`. |
| `src/verification/` | `VerificationService`, `AUTHORITATIVE_SOURCES`, `sourceWeight()`, `InternalEvidence`, raw artifact types. |
| `src/index.ts` | Barrel: re-exports all 8 modules. |

---

## ArtifactStore as Single IO Boundary

Services receive **parsed data objects**, not file paths. The pattern:

1. Service constructor accepts `store: ArtifactStore` (and optionally `graph: GraphService`).
2. Service methods call `store.read<T>(name)` or `store.tryRead<T>(name)`.
3. Parsed objects are pure values — no file handles, no streams.
4. The in-memory cache (`Map<string, unknown>`) is on the store, not on the service.

**Exception:** `ArchitectureService` reads `package.json` files directly from the
repo filesystem using `node:fs.readFileSync` for layer violation detection
(`#validateLayering()`). This is noted in the spec as a deliberate exception
because `package.json` files are not graphify-out artifacts — they are live repo
files. The exception is bounded to the `#validateLayering` private method.

---

## Artifacts the Engine Reads

### Required for graph operations

| Artifact | Description |
|----------|-------------|
| `graph.json` | 52,246 nodes / 66,761 links code graph. Required by `GraphService`. |

### Domain and DB intelligence

| Artifact | Required by |
|----------|-------------|
| `domain-intel.json` | `BlastRadiusService.crossDomain/impact`, `ArchitectureService.explainDomain/Dependency/Architecture/Ownership/Risk`, `VerificationService.verifyDomains/Dependencies` |
| `db-intel.json` | `BlastRadiusService.impact`, `ArchitectureService.explainArchitecture/Risk`, `VerificationService.verifyDomains/Dependencies/ProductionReadiness` |
| `infra-intel.json` | `ArchitectureService.explainService/Architecture/Runtime/Ownership`, `VerificationService.verifyServices/Runtime` |
| `memory-intel.json` | `MemoryService` (decisions + migrations). Falls back to `{ decisions: [], migrations: [] }` if absent — corpus still loads from markdown files. |

### Optional — used by specific methods

| Artifact | Required by |
|----------|-------------|
| `relationship-intel.json` | `BlastRadiusService.relationships()` — returns `DomainError` if absent |
| `decision-engine-v2.json` | `DecisionService.rankRisks()`, `scaleTiers()` |
| `execution-intel.json` | `DecisionService.rankRisks()`, `rankFixes()`, `launchVerdict()` |
| `fix-engine.json` | `DecisionService.rankFixes()` |
| `production-readiness.json` | `DecisionService.rankRisks()`, `rankFixes()`, `systemReadiness()`, `impactRank()`, `evidence()`, `trace()`, `launchVerdict()` |
| `production-readiness-v2.json` | `DecisionService.dimensionReadiness()`, `launchVerdict()`; `VerificationService.verifyArchitecture()`, `verifyProductionReadiness()` |
| `audit-engine-v2.json` | `VerificationService.verifyArchitecture()`, `verifyDomains()`, `verifyDependencies()`, `verifyProductionReadiness()` |
| `connections-intel.json` | `VerificationService.verifyRuntime()`, `verifyProductionReadiness()` |
| `launch-command-center.json` | `VerificationService.verifyProductionReadiness()` |

---

## GraphService Lazy-Build Pattern

```ts
export class GraphService {
  private built = false;

  private build(): void {
    if (this.built) return;      // idempotent
    const g = this.store.read<RawGraph>('graph');
    for (const n of g.nodes) this.nodesById.set(n.id, toNode(n));
    const links = g.links ?? g.edges ?? [];
    for (const l of links) {
      // populate outEdges, inEdges, deg in a single O(E) pass
    }
    this.built = true;
  }

  nodeCount(): number { this.build(); return this.nodesById.size; }
  // all public methods call this.build() first
}
```

The graph is never rebuilt across the lifetime of a single `GraphService` instance.
Multiple services sharing one `GraphService` instance share the same adjacency index.

---

## What Was Specified vs What Was Built

`LCIS_CORE_ARCHITECTURE.md` in `docs/lcis-consolidation/specs/` listed additional
modules in the planned source tree:

| Planned module | Status |
|---------------|--------|
| `src/lineage/` | Not built. SQL lineage belongs to a future `DBLineageService`. |
| `src/ownership/` | Not built. Ownership coverage is handled inside `ArchitectureService.explainOwnership()`. |
| `src/execution/` | Not built. Execution-intel artifact loading is done inside `DecisionService` via `artifacts.ts`. |
| `src/utils/` | Not built. Shared utilities live in `contracts/` (factory functions). |
| `src/catalog/` | Not built. |

The five services (`BlastRadius`, `Memory`, `Decision`, `Architecture`,
`Verification`) plus the two foundation modules (`ArtifactStore`, `GraphService`)
are the complete set of what was actually built.
