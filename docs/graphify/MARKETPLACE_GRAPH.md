# Phase 11 — Marketplace Graph

**From `graph.json`: app marketplace, theme marketplace, developer portal. All FROZEN (not deploy targets per CLAUDE.md) but real, indexed code.**

## Footprint
| Component | Graph nodes | Status |
|---|---|---|
| `apps/app-marketplace` | 679 | FROZEN |
| `apps/theme-marketplace` | 576 | FROZEN |
| `apps/developer-portal` | 277 | FROZEN |
| App-store routes in gateway | within api-gateway (`app-store/*`, `app-api.ts`) | mounted |
| Cross edges `app-marketplace → shared-types` | 107 | contract dependency |
| Cross edges `app-marketplace → typescript` | 88 | UI/client |
| Cross edges `theme-marketplace → typescript` | 148 | UI/client |
| Community c14 | 225 nodes, dominant `apps/app-marketplace` (199) | a coherent cluster |

## Structure
- The three marketplace surfaces are **substantial, self-contained code** (1,532 nodes combined) that depend on the same shared-types/typescript packages as live apps — they are not stubs (unlike the 73-node reserved services).
- **Gateway app-store routes are mounted** (`app-store/apps/:id/oauth/authorize`, `/oauth/token`, `app-api.ts` usage-events/products/orders) — i.e., the marketplace *backend* is reachable, but its only consumers are the frozen `app-marketplace`/`developer-portal` apps. The certification's red-team flagged these as **mounted-but-effectively-dead** in production topology (attack surface with no live first-party client).
- Install flow / publishing flow: app + theme install/publish logic exists in these apps; the persistence tail is SQL (ungraphed).

## Architecture-intelligence read
- Marketplace + developer portal represent **~1,532 graph nodes of frozen capability** — real engineering that is intentionally not a V1 deploy target. In a "central intelligence" view this is *latent surface area*: indexed, dependency-connected, but governance-frozen.
- **Recommendation:** tag these communities as `frozen` in any graph-derived dashboards so impact analysis (`get_pr_impact`) distinguishes "touches live runtime" from "touches frozen marketplace." A change rippling only into c14 (app-marketplace) is lower-risk than one rippling into the api-gateway/shared-types core.

## Verdict
Marketplace and developer-platform are graph-real and contract-connected but frozen. Their mounted gateway OAuth/app-API routes are the one thing to watch (dead-but-reachable surface, cert risk R14). Everything money/tenant-critical lives in the live runtimes, not here.
