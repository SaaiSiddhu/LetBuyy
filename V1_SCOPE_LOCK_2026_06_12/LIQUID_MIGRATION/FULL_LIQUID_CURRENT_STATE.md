# FULL_LIQUID_CURRENT_STATE.md

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · code-verified (5-turn audit body + this turn's recon). Target = **Full Liquid V1** (Constitution ART-17). No code changed.

## Constitutional frame (this is not opinion — it's law)

- **ART-17 (`LETBUYY_CONSTITUTION.md:253-256`):** "**Liquid / portable-theme (OS-2.0-shaped) is the canonical renderer.** React is kept as a **first-party compatibility fast-path, frozen at parity, and deleted-or-frozen by data at the hardening wave**." **Forbids:** crowning React; new React-per-section capability after the freeze; flipping the Liquid default platform-wide **without the parity/security/perf gate**; **deleting React before the data decision at the hardening wave.**
- **ART-18 (`:259-262`):** one `storefront-runtime` hosting Liquid; the dormant `runtime-composition` package unwired then deleted.
- **R-15 (`:414`):** exactly one canonical renderer at end-state → Full Liquid is the compliant end-state; React must be deleted-or-frozen.

→ Full Liquid is the mandated target; the program's job is to reach it through the constitutional gates (parity/security/perf harness, then the hardening-wave data decision for deletion).

## What already WORKS today (Liquid)

| Area | Evidence |
|---|---|
| LiquidJS render engine | `liquidjs ^10.27.0`; `LiquidRenderer.render` `theme-renderer.ts:192` — layout+sections+blocks, DOMPurify `:108-159`, filters `money`/`t`/`asset_url` `:564-571` |
| Block system (~90%) | inline/reusable/`@app` blocks `theme-bundle.ts:125-169`; `renderLiquidSectionBlocks` `theme-renderer.ts:371-441` |
| Commerce drops pipeline | `product`/`collection`/`cart`/`customer` `theme-renderer.ts:443-516`; `productToLiquidDrop` `composition-engine.tsx:229` |
| Islands (interactivity) | `liquid-hydration-islands.tsx` — add-to-cart/variant/cart-drawer/search; **share `lb_cart`/`lb_cart_token` with React**; proxy `/cart` to the real gateway cart |
| Render switch | `composition-engine.tsx:338-384` (Liquid iff `rendererEngine==='liquid' && liquidBundle`) |
| Per-store canary gate | `resolveThemeLiquidRenderingEnabled` `theme-governance.ts:144-168` |
| Engine-agnostic commerce backends | cart `services/api-gateway/src/routes/storefront/cart-routes.ts`; account `/api/customer/*`; orders `/api/orders/*`; checkout `/api/orders`+Razorpay — all reachable from Liquid |
| 20 Liquid section fixtures (by count) | `createLiquidParitySectionFiles` `theme-bundle.ts:769-1156` |
| `navigation_menus` data | table `000_baseline.sql:9855`; consumed by React `dynamic-header.tsx` |

## What is PARTIALLY complete

| Area | State |
|---|---|
| Liquid sections | exist as **strings**, shallow (~8 lines vs React 234); **zero `.liquid` files on disk** |
| Commerce drops | `product` binds; **`collection` discards title/desc `composition-engine.tsx:301-308`, `cart` stubbed `item_count:0` `:279-287`, `customer:null` `:323`** |
| CMS pages `[...path]` | composition-routed (Liquid-capable) `[...path]/page.tsx:58` → `ContentResourceRenderer` |
| Search | client-side filter + `lb-search` island → `?search=`; **no storefront product-search backend route** (gateway `search` routes are internal-console/developer only) |
| Theme editor | emits portable JSON; routes accept `liquidBundle` but UI never sends one; **no portable→Liquid compiler** |

## What is MISSING (blocks Full Liquid)

| Missing | Evidence |
|---|---|
| Any store shipping a `liquidBundle` | urban-kicks seeded React/`theme-engine-v1` (`urban-kicks-theme.sql`); no seed/migration writes a bundle |
| Liquid CSS | layout ships none `theme-bundle.ts:1819-1835`; `lb-*` CSS lives in React `globals.css:554-710`; `/assets/*` has no backend |
| Page templates | only `index/header/footer`; **no `product`/`collection`/`cart`/`customers/*`/`order`/`search`/`page`/`404`** |
| Liquid chrome | `layout.tsx:214,224` renders **React** header/footer over Liquid bodies (CAP-C08) + nav-menu binding |
| Liquid wishlist | `/api/customer/wishlist` exists; no Liquid wishlist template/island |
| Liquid policies/404 | privacy/terms/returns/shipping are bespoke React; 404 = Next not-found |
| Merchant Liquid authoring | no portable→Liquid compiler; editor never emits a bundle |
| Canary writer | flag read-only; no DB column / writer / operator endpoint |
| Parity proof | `PARITY_MATRIX.md` 0/200 executed; tests grep-only |

## Production path today

100% React. Liquid is fully plumbed on the **read** side but unfed (no bundle), unstyled (no CSS), funnel-incomplete (no page templates), and validator-pinned OFF (`theme-governance.ts:14`; flip ARB-deferred per ART-17 gate). Foundation guarantees (money/identity/tenancy/governance) live entirely in `api-gateway`+`database`+validators — outside the render layer — so the migration cannot regress them.
