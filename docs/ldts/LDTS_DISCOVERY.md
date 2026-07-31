# LDTS Discovery — Dependency Twin System (Phase 11)

**Date:** 2026-07-04 · Verified against the real repository. **No coding before this discovery.**

## 1. What already exists (LDTS composes)

| Capability | Where (verified) | LDTS reuse |
|---|---|---|
| Raw code graph access | `lcis-core` `GraphService`: `node/nodes/outgoing/incoming/degree/traverse(start,depth,dir)/search/resolve` over `graphify-out/graph.json` | The dependency-edge substrate — LDTS never re-parses the graph |
| Blast radius | `lcis-core` `BlastRadiusService.blast(symbol, depth)` | Impact-radius primitive (symbol level) |
| Domain topology | `lcis-core` `ArchitectureService` over `domain-intel.json` (per-domain `dependsOn`/`consumedBy`/tables/rpcs/secrets/owners/money/tenant) | Domain-level edges + criticality |
| DB structure (FKs, triggers, policies) | `graphify-out/db-intel.json` via `ArtifactStore` | Data-flow + table edges |
| Infrastructure (workers/queues/secrets/deploy) | `graphify-out/infra-intel.json` | Infrastructure graph nodes/edges |
| Ownership | `lcis-governance` `OwnershipService` (CODEOWNERS) | Ownership graph edges |
| Engineering task DAG | `lcis-engineering` `EngineeringGraphService` (per-feature task DAG with critical path) | Execution-graph pattern reference — LDTS's execution graph is the *system* call-flow, not the per-feature task DAG |

**Net-new in LDTS (verified absent everywhere):** graph *algorithms* over the composed twin — shortest path between arbitrary entities, cross-layer critical path, cycle detection, single-point-of-failure detection, fan-in/fan-out ranking, bounded impact radius — and the six composed *views* (dependency, ownership, execution/call-flow, communication (API/queue/webhook edges), infrastructure, data-flow). `GraphService.traverse` is raw BFS reachability only; no existing package computes paths/cycles/SPOF.

## 2. Phase 11 scope

**New package `packages/lcis-twin`** (LDTS), lcis-orchestration conventions (frozen contract → services → facade → tests → security scan).

Foundation: `TwinNode` `{ id, layer: feature|page|api|rpc|worker|queue|cron|database|table|trigger|storage|deployment|infrastructure|test|documentation, label, domain|null, evidence }`, `TwinEdge` `{ from, to, relation, graph, evidence }`, `TwinGraph` (typed, provenance-stamped), plus algorithm result types (`PathResult`, `CycleReport`, `SpofReport`, `FanReport`, `ImpactRadius`).

Services:
1. **TwinBuilderService** — assembles the unified twin from the five artifact sources (+ optional injected extras); deterministic node-id scheme `layer:name`.
2. **GraphAlgorithms** (pure functions, no IO): BFS shortest path, Tarjan SCC cycle detection, articulation-point SPOF, fan-in/fan-out, depth-bounded impact radius, cross-layer critical path (longest path through layer ordering on the DAG condensation).
3. **Six view services** (thin projections of the twin): DependencyView, OwnershipView, ExecutionView, CommunicationView, InfrastructureView, DataFlowView.
4. Facade: `DependencyTwinEngine` (`createTwinEngine`/`getTwinEngine`/`resetTwinEngine`) → `buildTwin`, `shortestPath(a,b)`, `criticalPath()`, `cycles()`, `spof()`, `fan(top)`, `impactRadius(entity, depth)`, `generateTwinReport` (flagship).

Honesty: nodes/edges derivable from artifacts are CONNECTED; runtime call counts / live traffic weights are NOT_CONNECTED with named sources. Performance benchmark = deterministic op-count/time bounds asserted in tests over a generated N-node fixture (no fabricated timings in docs — measured in the test run).

## 3. Verification plan

`pnpm typecheck test --filter=@letbuyy/lcis-twin`. Target ≥400 tests: algorithms ~120 (exact expected paths/cycles/SPOF on hand-built fixtures), builder ~60, six views ~120, facade ~40, security scan ~40, graph validation (invariants: no dangling edges, stable ids, deterministic ordering) ~30.
