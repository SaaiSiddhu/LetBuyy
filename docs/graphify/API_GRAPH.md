# Phase 8 — API Intelligence Graph

**From `graph.json`: routes, handlers, middleware, validators, schemas.**

## Counts (graph-measured)
| Element | Graph value |
|---|---|
| api-gateway route nodes | **1,628** across **87** route files (`services/api-gateway/src/routes/**`) |
| `route.ts` API files (Next proxies + gateway) | 140 (install report) |
| `page.tsx` Next pages | 200 (install report) |
| Middleware nodes | 224 (`**/middleware/**`) |
| Validator nodes | 1,085 (`scripts/validators/**`) — 111 validator files |
| Top route hub | `routes/storefront.ts` (degree 124) |
| Gateway entry | `services/api-gateway/src/index.ts` (degree 209) |

## Route → handler → middleware → validator chain (graph-observed)
- **Entry:** `index.ts` (deg 209) mounts routers; `authMiddleware` boundary + global rate-limit bucket (cert Phase E). 224 middleware nodes wrap the chain (auth, rate-limit, observability, tenant-guard, internal-perimeter).
- **Routers:** 1,628 nodes across 87 files — the largest single coherent code surface in the repo, all under `api-gateway`. `storefront.ts` (124) and `payments`/`payouts`/`orders` are the busiest.
- **Validators:** 1,085 nodes across 111 `scripts/validators/*.mjs` — the governance gate. `governance-common.mjs` is a top-degree node (146), i.e. the shared validator core every validator imports — a deliberate single point that the gate depends on.
- **Schemas:** `packages/shared-types` (1,086 nodes, index.ts degree **806 — the #1 node in the whole graph**) is the contract layer every app + the gateway import (553 + 359 cross-runtime edges). The API contract is centralized and pervasively depended upon.

## Architecture intelligence
- **`shared-types/index.ts` (deg 806)** is the single most load-bearing file in LetBuyy: change it and 806 edges feel it. It is the typed API contract between apps and gateway. Treat as a protected interface (any change = wide blast radius — use `graphify get_pr_impact`).
- **`api-client/index.ts` (deg 669)** is #2 — the generated HTTP client. Together (#1 + #2) they ARE the app↔gateway boundary, and their dominance in centrality is the graph's proof that LetBuyy is contract-first.
- **87 route files / 1,628 nodes in one service** confirms the monolith: there is one API surface, not per-app backends.

## Gaps
- **Request/response *schemas* for SQL RPCs** aren't represented (the RPC parameter contracts live in migrations). 
- The graph shows route *structure* but not HTTP method/path strings as first-class attributes — method/path live in the handler bodies; pair the graph with the route audit for a full endpoint inventory.
