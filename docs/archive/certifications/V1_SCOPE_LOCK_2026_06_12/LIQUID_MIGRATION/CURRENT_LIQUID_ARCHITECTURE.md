# CURRENT_LIQUID_ARCHITECTURE.md

**Date:** 2026-06-13 · **HEAD:** `140a73db` · **Method:** code-verified (feasibility report + 4 fresh file-level agents). **Code wins.**

> **Correction to the prior feasibility report (code re-verified):** the cart API is **not** missing. `apps/storefront-runtime/next.config.ts:107-115` rewrites `/api/storefront/:subdomain/:path*` → `${gateway}/storefront/:subdomain/:path*`, and a full server-cart backend exists at `services/api-gateway/src/routes/storefront/cart-routes.ts` (mounted `public-routes.ts:201` → `storefront.ts:1296` → `index.ts:686`). The "cart 404" claim was an artifact of looking for a local Next route file and missing the rewrite. This materially shrinks the migration.

## 1. The one fact that decides rendering

The storefront renders **Liquid iff the published `template_config` carries a schema-valid `liquidBundle` AND the per-store canary is on; else React.**

- `composition-engine.tsx:384` — `const engine = liquidHtml ? 'liquid' : 'react'`
- `composition-engine.tsx:338` — `if (plan.rendererEngine !== 'liquid' || !plan.liquidBundle) return null;` (→ React `RenderSectionList`)
- `template-resolver.ts:229-234` — `liquidEnabled = resolveThemeLiquidRenderingEnabled({templateConfig, defaultEnabled:false}); liquidBundle = liquidEnabled ? resolveLiquidBundle(store) : undefined`
- `theme-governance.ts:14` — `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (validator-pinned, `theme-governance-validator.mjs:60`)

**Today: zero stores carry a `liquidBundle`** (grep: no seed/fixture/migration writes one; urban-kicks is seeded React/`theme-engine-v1` in `database/supabase/seeds/urban-kicks-theme.sql`, 756 lines, no bundle). So production is 100% React.

## 2. Rendering path (request → HTML)

```
request → app/store/[subdomain]/<route>/page.tsx
  → resolveStorefrontTemplate(store, route)            template-resolver.ts:223
     ├─ liquidEnabled? + resolveLiquidBundle(store)?    :229-234   ── default NO ──┐
     │     └─ coerceLiquidTemplate(bundle, key)         :139        (key→index fallback :127-137)
     └─ else React plan (section listから renderer-registry)                       │
  → StorefrontCompositionEngine                          composition-engine.tsx:371 │
     ├─ renderLiquidPlan → LiquidRenderer.render         theme-renderer.ts:192  ◄───┘ (Liquid)
     │     → layout/theme.liquid + sections + blocks → DOMPurify → dangerouslySetInnerHTML
     │     → LiquidHydrationIslands (lb-add-to-cart, lb-cart-drawer, lb-variant-picker, lb-search)
     └─ RenderSectionList → renderRegisteredSection      renderer-registry.tsx:267  (React, default)
  ALL pages wrapped by app/store/[subdomain]/layout.tsx (providers + :root CSS vars + React header/footer)
```

**CAP-C08 chrome gap:** `layout.tsx:214,224` renders **React** header/footer via `StorefrontSectionGroupRenderer` **even over a Liquid body**. So a "Liquid" page today still gets React chrome (`theme-governance-validator.mjs:114` tracks this).

## 3. React ownership (default production)

| Surface | Owner | Routes via composition engine? |
|---|---|---|
| Home / shop / product / collection / CMS / blog | thin server `page.tsx` → `StorefrontCompositionEngine` (React sections) | **YES** (Liquid-capable) |
| 20 section components | `apps/storefront-runtime/src/components/sections/*.tsx` (2,604 lines) via `renderer-registry.tsx` | YES (React branch) |
| Product page body | `product-details-client.tsx` (555 lines, `'use client'`) — a React island inside the composed page | partial (chrome composed, body React) |
| **Cart page** | `cart/page.tsx` (199, `'use client'`, `useCart()`) | **NO — bespoke React** |
| **Checkout** | `checkout-client.tsx` (1,160, `'use client'`) → `/api/orders` + Razorpay/COD | **NO — bespoke, engine-agnostic** |
| **Account** (orders/addresses/settings/wishlist) | `account/*` (`'use client'`, auth-gated) → `/api/customer/*` | **NO — bespoke React** |
| **Order tracking** | `orders/orders-client.tsx` (447) + `account/orders` → `/api/customer/orders`, `/api/orders/*` | **NO — bespoke React** |
| Cart/customer state | `context/cart-context.tsx` (265), `customer-auth-context.tsx` (221), `wishlist-context.tsx` (92) | React contexts |

## 4. Liquid ownership (built, dormant)

| Capability | State | Evidence |
|---|---|---|
| LiquidJS engine | REAL | `liquidjs ^10.27.0`; `LiquidRenderer.render` `theme-renderer.ts:192`; hardened opts, DOMPurify `:108-159`, `money`/`t`/`asset_url` filters `:564-571` |
| 20 sections (parity by count) | REAL but shallow + fixture-only | `createLiquidParitySectionFiles` `theme-bundle.ts:769-1156`; **zero `.liquid` files on disk** |
| Block system | ~90% (most complete) | inline/reusable/`@app` blocks `theme-bundle.ts:125-169`; `renderLiquidSectionBlocks` `theme-renderer.ts:371-441` |
| Commerce drops | REAL pipeline, partial fill | `product`/`collection`/`collections`/`cart`/`customer` `theme-renderer.ts:443-516`; `productToLiquidDrop` `composition-engine.tsx:229`; **`cart` stubbed item_count:0 `:279-287`, `customer:null` `:323`** |
| Islands (interactivity) | REAL, shared state | `liquid-hydration-islands.tsx`; share `lb_cart`/`lb_cart_token` with React cart; proxy `/cart` to gateway (works) |
| Page templates | only `index`/`header`/`footer` | no `product`/`collection`/`cart`/`customers`/`order` template in any bundle |
| CSS | NONE shipped | layout `theme-bundle.ts:1819-1835` has no `<style>`/`:root`/stylesheet; `lb-*` CSS lives in React `globals.css:554-710` |
| Canary flag | read-only, default off | `resolveThemeLiquidRenderingEnabled` `theme-governance.ts:144-168`; no DB column; no writer surface |

## 5. The production path (how Liquid could reach a store today)

The **read/render half is fully plumbed; every authoring/seeding/flip surface is missing.** The only producer of a `liquidBundle` is `buildBundleTemplateConfig` (`schema-registry-execution.adapter.ts:164-187`) via theme-package **upload** (`POST /themes/packages/upload`, `routes/themes.ts:628`). It writes `themes.default_template`/`themes.config`; on publish, `buildReleaseArtifacts` (`theme-execution.adapter.ts:601-607`) re-detects the bundle and writes `theme_releases.template_snapshot`/`release_manifest` + `sites.template_config`. **Crucially: if `themes.default_template` contained a `liquidBundle`, install would carry it to the live store automatically** — so re-seeding urban-kicks is the lever (see Migration Program L1).

## 6. Foundation guarantees (unchanged by any of this)

Money (double-entry DB-enforced), identity (asymmetric ES256 + JWKS), tenancy (RLS FORCE), and the 123-validator gate are all in `services/api-gateway` + `database/` + `scripts/validators/` — **entirely outside the storefront render layer.** Liquid migration touches `apps/storefront-runtime` + `packages/theme-engine` + theme seeds only; it cannot regress money/identity/tenancy. Checkout/payments are engine-agnostic (a separate React surface on `checkout.` origin via signed handoff), so they are preserved verbatim under any engine.
