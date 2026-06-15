# Liquid Data-Binding Report — Phase 4

> Mission Phase 4. Verifies `buildSectionDataPlan()` + the Liquid commerce context provide store/products/collections/inventory/pricing/cart/customer to the Liquid runtime. **Evidence-only.**

## Verdict

Products, pricing, and inventory bind correctly. **Cart and customer are intentionally client-hydrated (empty/null on the server).** One genuine **broken binding**: collection *metadata* (title/description) is degraded in Liquid mode.

## Two binding paths feed the same `SectionRenderData` map

1. **Generic** — `buildSectionDataPlan()` (`data-binding-engine.ts:66`): used by homepage/products/shop. Detects product sections by type/rendererKey (**including `liquid.section.*`**, `:14-21`), fetches via `ProductService`. Returns empty for `store.siteType !== 'store'` (`:77`).
2. **Route-specific** — e.g. the collection page builds its own map from `getCollectionWithProducts(subdomain, slug)` (real collection membership) (`collections/[slug]/page.tsx:57-108`).

Both feed `SectionRenderData`, which the Liquid path reads in `buildLiquidCommerceContext` (`composition-engine.tsx:290`).

## Binding matrix (what actually reaches the Liquid runtime)

| Resource | Bound? | Source | Evidence |
|----------|--------|--------|----------|
| store / shop | ✅ | `buildLiquidCommerceContext.shop` from `StoreModel` | `composition-engine.tsx:311-318` |
| products | ✅ | `collectLiquidProducts(sectionData)` | `:253-267` |
| product (single) | ✅ | `products[0]` for `product` route | `data-binding-engine.ts:101` |
| pricing | ✅ | `product.price` / `compareAtPrice` (INR) | `composition-engine.tsx:239-241` |
| inventory | ✅ | `product.stock` → `available` / `stock` | `:245-246` |
| collection — products | ✅ | real collection products via `getCollectionWithProducts` | `collections/[slug]/page.tsx:64,105` |
| collection — **metadata** | ⛔ **BROKEN in Liquid** | `buildLiquidCommerceContext` ignores `SectionRenderData.collection`; re-derives `{ title: slug, no description }` from the route | `composition-engine.tsx:301-308` |
| cart | ⛔ server-empty **(by design)** | `collectLiquidCart` → default empty; client-hydrated | `:269-287` |
| customer | ⛔ `null` **(by design)** | hardcoded `customer: null`; client-hydrated | `:323` |

## Missing / broken / unreachable bindings (the Phase 4 ask)

- **BROKEN (fixable integration):** collection title/description in Liquid. The page already supplies correct metadata in `SectionRenderData.collection`; `buildLiquidCommerceContext` should consume it instead of re-deriving from the route slug. Not a redesign — a one-function fix.
- **BY DESIGN (not broken):** cart (empty SSR) and customer (`null` SSR) are client-hydrated. Any Liquid section depending on server cart/customer state renders empty/logged-out until the hydration islands run — **validate in Phase 5**.
- **Scope guard:** `store.siteType !== 'store'` short-circuits all product binding (`data-binding-engine.ts:77`) — intended for portfolio/resume site types.

## Recommendation

One concrete integration fix (collection metadata). Cart/customer SSR-empty is acceptable for a hydrating storefront but is unverified until Phase 5 confirms the islands populate them without mismatch.
