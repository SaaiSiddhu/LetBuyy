# @letbuyy/lcis-core

The consolidated, canonical **LCIS engine** — one deterministic library over LetBuyy's pre-computed `graphify-out/*.json` artifacts.

> Consolidation of 202 engine files / 2 runtimes into one package. **No runtime AI/vector dependencies** (no Qdrant/embeddings/OpenAI/GraphRAG). **No server, no UI, no dashboards.** Consumed by CLI, MCP, PR Intelligence, and (later) `apps/lcis`.

## Principles
- **Deterministic.** Same artifacts → same answers, in-memory, <10ms. No network at query time.
- **Evidence-cited.** Every result carries provenance (`Evidence[]`) or an explicit `NOT CONNECTED` / `UNVERIFIED` label. Never fabricates.
- **Advisory.** The 108-validator gate + Constitution stay authoritative; this engine informs, never gates or mutates.
- **No generations.** No `V1/V2/OMEGA/INFINITY` naming — capabilities are named for what they do.

## Layout
- `src/contracts` — canonical types (the shared vocabulary).
- `src/runtime` — `ArtifactStore` (loads + caches `graphify-out` artifacts).
- `src/graph` — `GraphService` (structural foundation: adjacency, traversal).
- `src/blast-radius` · `src/memory` · `src/decision` · `src/architecture` · `src/verification` — the consolidated crown-jewel services.
- `src/lineage` · `src/ownership` · `src/execution` — supporting services.

## Scripts
- `pnpm --filter @letbuyy/lcis-core typecheck`
- `pnpm --filter @letbuyy/lcis-core test`

Design: `docs/lcis-consolidation/LCIS_CORE_ARCHITECTURE.md`. Type system: `docs/lcis-consolidation/LCIS_TYPE_SYSTEM.md`.
