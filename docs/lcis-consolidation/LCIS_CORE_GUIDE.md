# LCIS Core Guide

`@letbuyy/lcis-core` is the consolidated, deterministic LCIS engine. It reads
pre-computed `graphify-out/` artifacts and returns evidence-cited answers. No
server, no CLI, no UI. It is a pure library consumed by the CLI, MCP, and PR
Intelligence tooling.

**Package location:** `packages/lcis-core/`
**Runtime dependency:** `zod ^4.3.6` only.
**Module format:** TypeScript ESM (`"type": "module"`).

---

## Foundation

### ArtifactStore

The single IO boundary. All filesystem reads go through it; services receive
already-parsed data and stay pure and testable.

```ts
const store = ArtifactStore.default();      // graphify-out/ in repo root
const fix   = ArtifactStore.fromDir(dir);   // test fixtures
```

`ArtifactStore.default()` walks up from `process.cwd()` for `pnpm-workspace.yaml`
(via `findRepoRoot()` in `src/runtime/paths.ts`), then appends `graphify-out/`.
`ArtifactStore.fromDir(dir)` roots the store at an explicit directory.

| Method | Behaviour |
|--------|-----------|
| `read<T>(name)` | Parses and in-memory-caches the artifact. Throws `ArtifactMissingError` if absent. |
| `tryRead<T>(name)` | Returns `null` (not an error) if the artifact is absent. |
| `has(name)` | `existsSync` check, no cache side-effect. |
| `pathOf(name)` | Returns the resolved `.json` path without reading. |

`ArtifactMissingError` carries `.artifact` (name) and `.path` (resolved path) so
callers can show a targeted error: "generate it with `pnpm graph:db`."

### GraphService

Builds an in-memory adjacency index over `graphify-out/graph.json` (52,246 nodes /
66,761 links) in one O(E) pass. Construction is **lazy**: the index is built on the
first method call and then cached for the lifetime of the instance.

```ts
const store = ArtifactStore.default();
const graph = new GraphService(store);

graph.nodeCount();   // triggers build; returns 52246
graph.edgeCount();   // 66761
graph.commit();      // built_at_commit from graph.json
```

| Method | Description |
|--------|-------------|
| `node(id)` | Single node by exact id. |
| `nodes()` | `IterableIterator<GraphNode>` in load order (deterministic). |
| `outgoing(id)` | Direct outbound edges. |
| `incoming(id)` | Direct inbound edges. |
| `degree(id)` | Total in+out degree. |
| `nodeCount()` | Total nodes after build. |
| `edgeCount()` | Total edges after build. |
| `commit()` | `built_at_commit` value from the raw graph. |
| `resolve(symbol)` | Fuzzy match: exact id → label match (exact/prefix/substring) → `sourceFile` substring. Highest-degree candidate wins. Returns `undefined` if no match. |
| `traverse(startId, depth, dir)` | BFS reachable ids. `dir` is `'out'`, `'in'`, or `'both'`. Excludes start node. |
| `search(query, limit)` | Substring search over id/label, capped at `limit` (default 20). |

---

## Services

### BlastRadiusService

```ts
const svc = new BlastRadiusService(graph, store);
const r = svc.blast('getSupabaseAdmin');   // impactedFiles >= 100
```

| Method | Returns | Description |
|--------|---------|-------------|
| `blast(symbol, depth=3)` | `BlastResult \| null` | Inbound BFS from the resolved node. Returns `impactedNodes`, `impactedFiles`, `layers`, `topImpacted` (top 12 by degree), `artifact` (`graphify-out/graph.json`). |
| `dependencies(symbol)` | `DependencyResult \| null` | Direct outbound neighbours. |
| `consumers(symbol)` | `ConsumerResult \| null` | Direct inbound neighbours. |
| `path(a, b)` | `PathResult \| null` | Shortest directed BFS path a→b over outbound edges. `hops: -1` if no path. |
| `critical(n=20)` | `CriticalResult` | Top-N nodes by total degree. |
| `crossDomain(key)` | `CrossDomainResult \| DomainError` | Domain consumer-edge BFS. Reads `domain-intel.json`. |
| `impact(key)` | `ImpactResult \| DomainError` | `crossDomain` + money/tenant flags from `db-intel.json` + queues + deploy gate string. |
| `relationships(table)` | `RelationshipResult \| DomainError` | FK fan-in/fan-out. Reads `relationship-intel.json`. |
| `resolveId(query)` | `string \| null` | Resolve a symbol to its graph node id. |

`DomainError` is `{ error: string }`. Always check `'error' in r` before reading
a result field.

---

### MemoryService

BM25 retrieval over the LCIS governance corpus. No Qdrant, no embeddings, no
OpenAI. Index is built in-process on first query from markdown corpus files +
`graphify-out/memory-intel.json`.

```ts
const svc = new MemoryService();   // repoRoot defaults to findRepoRoot()
const hits = svc.search('why must money mutations use RPC');
```

| Method | Returns | Description |
|--------|---------|-------------|
| `search(query, opts?)` | `MemoryHit[]` | BM25-ranked. `opts.limit` (default 10), `opts.type` filter. |
| `get(id)` | `MemoryHit \| Decision \| undefined` | By id: `D-016` (decision), `migration-174` (migration), `DOC-<hash>` (prose chunk). |
| `cite(query, limit=5)` | `Citation[]` | Structured citations. Confidence: `high` > 8, `medium` 4–8, `low` < 4 (BM25 score thresholds). |
| `buildContext(query, tokenBudget=4000)` | `ContextPack` | Token-budget-aware pack for an agent. Includes `stale: boolean` and `builtAtMigration`. |
| `decisions(filter?)` | `Decision[]` | All `D-xxx` decisions (not migration pseudo-entries). Optional `{ type }` filter. |
| `decision(id)` | `Decision \| undefined` | Single decision by id (e.g. `'D-016'`, `'migration-174'`). |
| `diagnostics()` | `{ docCount, termCount, latestMigrationN, schemaHash }` | Corpus health check. |

**Staleness:** `buildContext()` returns `stale: true` when
`builtAtMigration < latestMigrationN`. This happens when the index was built
before new migrations were applied. Re-run `pnpm graph:omega` to refresh.

---

### DecisionService

```ts
const svc = new DecisionService(store);
const risks = svc.rankRisks();   // sorted highest score first
```

Reads: `decision-engine-v2.json`, `execution-intel.json`, `production-readiness.json`,
`fix-engine.json`, `production-readiness-v2.json`.

| Method | Returns | Description |
|--------|---------|-------------|
| `rankRisks()` | `RankedRisk[]` | Open blockers + structural risks. Sorted by score desc, tie-break alphabetical by id. |
| `rankFixes()` | `RankedFix[]` | Fix/verify/test/rollback plans ranked by commercial impact. Each item has `fixPlan`, `verificationPlan`, `testPlan`, `rollbackPlan`. |
| `prioritize(items)` | `PrioritizedItem[]` | Ad-hoc ranking of caller-supplied `{ id, severity, domain? }` items. |
| `order(fixes)` | `RankedFix[]` | Re-orders an existing `RankedFix[]` by score (non-destructive — returns a new array). |
| `impactRank()` | `SystemReadiness[]` | Systems sorted by score ascending (lowest = highest priority). |
| `evidence(decisionId)` | `Evidence[]` | All evidence entries for a decision or system key, deduplicated. |
| `trace(decisionId)` | `Decision` | Full explainable trace: inputs → factors → weighted score → rank. |
| `systemReadiness()` | `SystemReadiness[]` | Per-system structural readiness from `production-readiness.json`. |
| `dimensionReadiness()` | `DimensionReadiness[]` | 10-dimension readiness from `production-readiness-v2.json`. |
| `scaleTiers()` | `ScaleTiers` | Scale levers from `decision-engine-v2.json`. Capacity strings carry "requires a load test" — never fabricated numbers. |
| `launchVerdict()` | `LaunchVerdict` | `GO` (0 open blockers), `NO-GO` (any critical open), or `CONDITIONAL-GO`. |

---

### ArchitectureService

All methods are `async` (artifact reads are synchronous but the async surface
allows future extension without a breaking change).

```ts
const svc = new ArchitectureService(store);          // repoRoot inferred from import.meta.url
const svc = new ArchitectureService(store, repoRoot); // explicit
const ex  = await svc.explainDomain('payments');
```

**Note:** `explainService()` and `explainRuntime()` read `package.json` files
directly from the repo filesystem for layer validation. This is an explicit
exception to the ArtifactStore-only IO rule (the ArtifactStore does not index
`package.json` files).

| Method | Primary artifact | Description |
|--------|-----------------|-------------|
| `explainDomain(key)` | `domain-intel.json` | Purpose, criticality, failure impact, tables/rpcs/routes counts, money/tenant flags, consumers/dependencies, owners. Uses the built-in `NARRATIVE` map (22 entries). |
| `explainService(name)` | `infra-intel.json` | Layer, status (canonical/frozen/library), related domains, Worker bindings/queues/crons, package name. Also reads `package.json` directly. |
| `explainDependency(a, b)` | `domain-intel.json` | Cross-domain edge strength and the `via[]` list (each is an RPC→table or route→RPC cross). |
| `explainArchitecture()` | `domain-intel.json` + `db-intel.json` + `infra-intel.json` | Platform-level summary: domain count, table/function/policy/trigger/index counts, Worker/Vercel count, cross-domain edges. |
| `explainRuntime()` | `infra-intel.json` | All Workers with crons/queues/bindings, Vercel apps, layer validation result. |
| `explainOwnership(key)` | `domain-intel.json` + `infra-intel.json` | Owners, workflows, matched CODEOWNERS rules. |
| `explainRisk(key)` | `domain-intel.json` + `db-intel.json` | Money-table intersection (18 MONEY_TABLES), canonical-ledger flag, blast-radius consumer count, SECURITY DEFINER RPCs, sensitive secrets. |

Every `Explanation` carries `evidence: Evidence[]` citing the exact artifact
field or source file that supplied each fact.

---

### VerificationService

```ts
const svc = new VerificationService(store);
const v   = await svc.verifyArchitecture();
// v.status: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED' | 'REFUTED'
// v.confidence: number in [0, 1]
```

**Status rules (from `VerificationEngine.mjs`, preserved verbatim):**

| Status | Condition |
|--------|-----------|
| `REFUTED` | Any evidence item where `corroborates === false` AND source is one of `v1-lcis`, `security-gate`, `107-validators`, `rls-gate`, `canonical-ledger`. Wins unconditionally. |
| `VERIFIED` | ≥2 independent corroborating sources AND weighted confidence ≥ 0.60. |
| `PARTIAL` | 1 corroborating source OR confidence in [0.30, 0.60). |
| `UNVERIFIED` | 0 corroborating sources OR confidence < 0.30. |

Zero evidence → confidence = 0 → `UNVERIFIED`. `REFUTED` requires an explicit
authoritative contradiction, not merely absence of evidence.

**`verifyRuntime()` always returns `PARTIAL`:** the 13 NOT CONNECTED live sources
each apply a `−0.08` confidence penalty (13 × 0.08 = 1.04), which drives
confidence well below 0.60 even when structural evidence is strong.

**Advisory only.** Results must never gate a PR. Only `REFUTED` may surface as
an advisory warning. The 107-validator gate (`scripts/validate-governance.mjs`)
is the sole authoritative merge gate.

| Method | Primary artifacts | Notes |
|--------|-----------------|-------|
| `verifyArchitecture()` | `audit-engine-v2.json` + `production-readiness-v2.json` | Checks hardViolations, auth coverage, validation coverage, RLS candidates, system score. |
| `verifyDomains()` | `domain-intel.json` + `db-intel.json` + `audit-engine-v2.json` | Checks ownership, money-domain RPCs, route presence, 22-domain count, cross-domain edge table resolution. |
| `verifyServices()` | `infra-intel.json` | Checks 4 Workers, no deprecated aliases, migrate gate, RUNTIME_TELEMETRY binding, DLQ. |
| `verifyRuntime()` | `connections-intel.json` + `infra-intel.json` | Always `PARTIAL`. 13 NOT CONNECTED sources penalise confidence. |
| `verifyDependencies()` | `domain-intel.json` + `audit-engine-v2.json` + `db-intel.json` | Checks cycle-free domain graph, canonical-ledger violations, dead RPC/table counts. |
| `verifyProductionReadiness()` | `production-readiness-v2.json` + `launch-command-center.json` + `audit-engine-v2.json` + `connections-intel.json` | Checks overall ≥ 80%, 10 dimensions, per-system scores, open blockers, hard violations. |
