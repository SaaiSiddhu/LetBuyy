# Phase 13 — Technical Debt Analysis

**Graph-derived debt signals from `graph.json` + cert findings. Each is evidence-backed.**

## Dead / archived code (graph-visible)
- **`docs/archive/firebase-legacy/` is still indexed and connected** — community **c0 = 1,378 nodes** (largest non-doc cluster) is dominated by `docs/archive`, and `docs/archive/firebase-legacy/functions/src/index.ts` has **degree 132** (a top-130 node). A legacy Firebase Functions codebase lives under `docs/archive/` and is being parsed as live graph surface. **Debt:** archived runtime code retained in-tree; clearly delineated under `docs/archive/` but inflates the graph and could mislead impact analysis.
- **Community c4 = 391 nodes, also `docs/archive`** — more archived material.

## Unused / stub services (graph-confirmed)
- **6 reserved services are 73-node stubs** (analytics-pipeline, checkout-runtime, event-bus, media-service, notification-service, search-service) — identical boilerplate, **no implementation**. Not debt per se (intentional placeholders) but **dead topology** if referenced as if live.
- Reserved mobile roots (shopper-app, operator-app) absent.

## Orphans (graph-measured)
- **127 orphan nodes (degree 0)** — 124 code, 2 concept, 1 doc. Low (0.24%), but each is a symbol nothing imports/calls/references → candidate dead code. Enumerate via `deg==0` filter for cleanup.

## Duplication signals
- Many top-degree nodes are `index.ts` **barrel exports** (shared-types, api-client, checkout-core, ui, commerce-core, auth-core, billing-core, theme-engine). Barrels are intentional, but the count (10+ high-degree barrels) means a single re-export change fans out widely — *coupling debt*, manage with `get_pr_impact`.
- Two `client.ts` nodes in merchant-control-plane (`createMerchantApiClient` 187, `merchantApiErrorResponse` 182) — central client logic concentrated in one file (acceptable).

## Unused routes / APIs (cert-corroborated)
- **Stripe/PayPal payment routes are live but non-V1** (secret-gated) — `payments.ts:1160`, `checkout-payment-routes.ts:946/1051`.
- **Frozen marketplace OAuth/app-API routes mounted with no live first-party client** (app-store, app-api.ts) — dead-but-reachable surface (cert R14).

## Unused tables (cannot assess from graph)
- **The SQL layer is ungraphed (2 DB nodes)** → unused-table/RPC analysis is **not possible from Graphify**. Use Postgres catalog queries or migration review instead.

## Orphaned packages
- All 20 packages have inbound edges (smallest cores ~52–57 nodes still consumed by gateway/apps). **No fully orphaned package** found — the `*-core` split is real and used.

## Debt scorecard
| Signal | Severity | Action |
|---|---|---|
| firebase-legacy archived code indexed (1,378+391 nodes) | Med | exclude `docs/archive/**` from extraction; consider repo removal |
| 6 reserved-service stubs as "topology" | Low | tag `reserved`, don't reference as live |
| 127 orphan symbols | Low | enumerate + prune |
| barrel-export coupling (10+ high-degree index.ts) | Low | use impact analysis before edits |
| non-V1 Stripe/PayPal + frozen marketplace routes live | Med | guard/remove for V1 surface |
| **SQL layer ungraphed** | **High (graph debt)** | re-index with SQL — unblocks DB debt analysis entirely |

**Net:** code debt is low and well-contained; the dominant "debt" is **graph debt** — archived code inflating the graph and the SQL blind spot hiding any database-level debt.
