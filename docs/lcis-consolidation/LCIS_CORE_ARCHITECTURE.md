# LCIS Core Architecture (`packages/lcis-core`)

**Phase 2 deliverable — the design contract for the consolidated canonical engine.** Consolidation, not expansion.

> Reconciles the five crown-jewel consolidation specs (`docs/lcis-consolidation/specs/spec-*.md`) + `LCIS_MIGRATION_PLAN.md` + `LCIS_CAPABILITY_MATRIX.json`. `lcis-core` is a pure **library/engine** — no server, no UI, no dashboards. It is consumed by CLI, MCP, PR Intelligence, and (later) `apps/lcis`.

> **⚠ Build status — this document is the TARGET design.** As of 2026-06-20, **BUILT & tested (134 tests):** the foundation (`contracts/`, `runtime/`, `graph/`) + the 5 crown-jewel services (`blast-radius/`, `memory/`, `decision/`, `architecture/`, `verification/`). Reality differs from the layout below in three ways: **`zod` is the only runtime dependency** (no `@letbuyy/shared-types`); `graph/` holds its adjacency maps as **private fields on `GraphService`** (there is no separate `GraphIndex.ts`); and the `lineage/`, `ownership/`, `execution/`, `catalog/`, `search/`, `utils/` modules shown below are **TARGET (future migration phases** per `LCIS_MIGRATION_PLAN.md`)**, not yet built**. See `LCIS_ARCHITECTURE.md` for the accurate as-built state.

---

## 1. Principles (non-negotiable)

1. **Deterministic only.** Reads pre-computed `graphify-out/*.json` artifacts; same input → same output, <10ms. **No Qdrant, no embeddings, no OpenAI, no GraphRAG, no vector DBs, no network at query time.**
2. **Zero runtime AI/heavy deps.** Runtime deps: `@letbuyy/shared-types` (workspace) + `zod` (validation) only — the house convention (`packages/commerce-core`). TypeScript is build-time.
3. **No generations.** No `V1/V2/.../OMEGA/INFINITY` names anywhere — in files, classes, or identifiers. Capabilities are named for what they do.
4. **No duplicated logic.** Each capability has exactly one home. The 202→32 consolidation is enforced structurally.
5. **Evidence-cited.** Every answer carries provenance (graph node / file path / artifact field) or an explicit `NOT CONNECTED` / `UNVERIFIED` label. No naked assertions, no fabrication.
6. **Advisory, not authoritative.** The 108-validator gate (`scripts/validate-governance.mjs`) + the Constitution remain supreme. `lcis-core` informs; it never gates or mutates.
7. **Read-only.** The engine never writes to production, never mutates money/OAuth/RLS. The migrated `SafetyGuard` (read-only execution) preserves its 28-banned-verb + hash-chain-audit posture.
8. **Additive & transitional.** `lcis-core` is built alongside the working `:3333` `.mjs` engines (which stay in place); cutover/archival is a separate, gated step (verify-before-destroy).

## 2. Package layout

```
packages/lcis-core/
  package.json            # @letbuyy/lcis-core — ESM, type:module, main ./src/index.ts, build tsc -b
  tsconfig.json           # extends the workspace base
  README.md
  src/
    index.ts              # public surface (re-exports services + types)
    contracts/            # canonical TYPES + zod schemas (Phase 4) — the shared vocabulary
      index.ts
      domain.ts service.ts dependency.ts risk.ts finding.ts decision.ts
      incident.ts verification.ts recommendation.ts architecture.ts capability.ts
    runtime/              # ArtifactStore: load + cache graphify-out/*.json (incl. 45 MB graph.json)
      ArtifactStore.ts    # readArtifact(name) → parsed+cached; presence-gated; honest on missing
      paths.ts            # artifact path resolution (graphify-out root)
    graph/                # GraphService — the structural foundation everything reuses (Phase 5)
      GraphService.ts     # GraphIndex (out/inc/deg adjacency, O(E) build), nodes/edges/traverse
      GraphIndex.ts
    blast-radius/         # BlastRadiusService (Phase 3) — blast/deps/consumers/path/crossDomain/impact/critical/relationships
    memory/               # MemoryService (Phase 6) — deterministic BM25 + decisions; NO Qdrant
      bm25.ts MemoryService.ts corpus.ts
    decision/             # DecisionService (Phase 7) — explainable risk/fix/readiness ranking
      scoring.ts DecisionService.ts artifacts.ts
    architecture/         # ArchitectureService (Phase 9) — explain* with evidence; drift; layers
    verification/         # VerificationService (Phase 8) — verify* → VERIFIED|PARTIAL|UNVERIFIED|REFUTED
    lineage/              # DBLineageService — SQL table/rpc lineage (split out of blast per spec)
    ownership/            # OwnershipService — CODEOWNERS + infra ownership (split out of blast per spec)
    execution/            # SafetyGuard (migrated, read-only) — 28 banned verbs, hash-chain audit
    utils/                # tokenize, scoring helpers, evidence builders — shared, pure
  test/                   # unit + integration + contract tests (per service, real artifact fixtures)
```

(Modules `catalog`, `search`, `runtime` from the mission's list: `catalog` = a thin read view over GraphService+ArchitectureService domain/entity data; `search` = MemoryService BM25 + GraphService node search; `runtime` = the ArtifactStore + environment/connection status. They are **composições over the foundation**, not new engines.)

## 3. The foundation (built first; all services depend on it)

- **`contracts/`** — the canonical TS types + zod schemas (Phase 4). The single source of type truth. Services import from here; nothing in contracts imports a service (no cycles).
- **`runtime/ArtifactStore`** — loads `graphify-out/<name>.json` once, caches in-memory, returns parsed data or an honest "artifact missing" signal (never fabricates). The 45 MB `graph.json` is parsed once at first use (synchronous `readFileSync`+`JSON.parse`) and held; this is correct for a long-lived library consumer. IO is isolated here so services are unit-testable with in-memory fixtures.
- **`graph/GraphService` + `GraphIndex`** — builds `out`/`inc`/`deg` adjacency in one O(E) pass from `graph.json`; provides `node(id)`, `edges(id)`, `traverse(id, depth)`, `search(q)`. **This is the substrate BlastRadius, Architecture, and Catalog reuse** — built once, injected.

## 4. Service layer (the consolidated crown jewels)

| Service | Module | Consolidates (source) | Reads |
|---|---|---|---|
| **GraphService** | `graph/` | intelligence.mjs graph core + graph.json loader | `graph.json` |
| **BlastRadiusService** | `blast-radius/` | intelligence.mjs + cross-domain-engine + change-impact + relationship-intel | graph/db/domain-intel |
| **MemoryService** | `memory/` | memory-intel + memory-v2 → **deterministic BM25** (Qdrant engine archived) | memory-intel.json + governance corpus |
| **DecisionService** | `decision/` | decision-engine-v5 (canonical) + fix-engine + production-readiness | decision/fix/readiness JSON |
| **ArchitectureService** | `architecture/` | explain-intel + domain-intel + architecture-intelligence/ (migrated, dep-free) | domain/db/infra-intel |
| **VerificationService** | `verification/` | verification-engine/ (migrated, dep-free) + audit-engine-v2 + readiness + launch + connections | audit/readiness/launch/connections JSON |
| DBLineageService | `lineage/` | trace* SQL-lineage (split from blast) | db-intel.json |
| OwnershipService | `ownership/` | findOwnership + infraSummary (split from blast) | infra-intel + CODEOWNERS |
| SafetyGuard | `execution/` | execution-engine/SafetyGuard (migrated, read-only) | n/a |

**Dependency rule (no cycles):** `contracts` ← `runtime` ← `graph` ← {blast-radius, architecture, lineage, ownership}; `memory`/`decision`/`verification` depend on `runtime`+`contracts` (+ artifacts) only; services never import each other except through the graph/artifact layer. Enforced by a contract test (`test/architecture.test.ts`) asserting no service-to-service imports.

## 5. Public surface (`src/index.ts`)

Exports the services + the canonical types. Two consumption modes (both later, not in this package):
- **CLI** (`lcis blast <symbol>`, `lcis explain <domain>`, `lcis verify`) — thin wrapper instantiating services.
- **MCP** — 5–7 named tools (`lcis_blast`, `lcis_explain`, `lcis_runbook`, `lcis_verify`, `lcis_cite`) over the same services (per the AI panel).

`lcis-core` itself ships **no** CLI/MCP/server — only the engine + types. Those adapters are separate packages/follow-ups.

## 6. Relationship to the existing `:3333` runtime (transitional)

`lcis-core` consolidates the *logic*; the `:3333` `.mjs` engines **stay in place and keep serving** until `lcis-core` is proven (typecheck + tests green) and a gated cutover migrates `graph:*` scripts + the server to consume `lcis-core`. This is the conservative, verify-before-destroy posture from the migration plan. During the transition the two coexist by design; no working capability is removed in this phase.

## 7. Build/verify gate for this package

- `pnpm --filter @letbuyy/lcis-core typecheck` (tsc --noEmit) must pass.
- Unit + integration + contract tests must pass against real `graphify-out` fixtures.
- `node scripts/validate-governance.mjs` after adding the package to `pnpm-workspace.yaml` (topology change) — the 108-gate stays green.
- No file imports Qdrant/OpenAI/GraphRAG/Crawl4AI (a contract test asserts this).

---
*Next: `LCIS_TYPE_SYSTEM.md` (Phase 4) defines the `contracts/` types; then scaffold + foundation + services per spec.*
