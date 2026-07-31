# LETBUYY — LIQUID V1 FEASIBILITY REPORT

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · **Method:** 5 parallel code-audit agents + direct recon. **Repository evidence only — code wins, no assumptions, no governance theory.**

## VERDICT

> **A. Liquid can launch V1 now → NO (disproven by code).**
> **B. Liquid can launch V1 after ~4–6 focused weeks → YES, but only as a HYBRID** — Liquid powers the *storefront/merchandising* surface (home, product, collection, shop, CMS), and the transactional tail (cart page, checkout, account, order tracking) stays the existing **engine-agnostic React**. This is *exactly Shopify's own architecture* (themeable Liquid storefront + a separate hardened checkout), so it is a legitimate "Liquid on V1."
> **C. A *pure* full-funnel Liquid V1 (cart/checkout/account also Liquid) → must wait until post-V1** (~+6–10 weeks; requires rewriting the bespoke React tail to route through the theme engine).

**Bottom line for "I want Liquid on V1":** you can have it — as a Liquid storefront skin over the React checkout — in ~4–6 weeks of focused work plus an ARB flag lift and a green parity run. You cannot have it *today*, and you cannot make the *entire* funnel Liquid within the V1 window. The plan is in §5.

---

## 1. THE LIQUID ENGINE IS REAL (not theater)

So this verdict isn't mistaken for "Liquid is fake": `liquidjs ^10.27.0` is a genuine dependency (`packages/theme-engine/package.json:23`). `LiquidRenderer.render()` (`theme-renderer.ts:192-300`) really parses + renders layout/sections/blocks with hardened options (`strictFilters`, `outputEscape:'escape'`, parse/render/memory limits), custom filters (`money`, `t`, `asset_url`), DOMPurify sanitization with an `lb-*` island allow-list (`:108-159,786-806`), a real commerce-drop pipeline (`product`/`collection`/`cart`/`customer`, `:443-516`), a ~90% Shopify-style block system (`renderLiquidSectionBlocks`, `:371-441`), and a per-store canary gate (`theme-governance.ts:144-168`). The machinery is well-built. **It is simply never fed a real bundle, never styled, never given page templates for the funnel, and never validated.**

---

## 2. PER-CAPABILITY COMPLETENESS (code-cited)

| # | Capability | Complete % | Liquid / React / Both | Decisive evidence |
|---|---|---|---|---|
| 1 | Liquid rendering engine | **~70% engine / ~40% as a page renderer** | Liquid | Real renderer, but **layout ships ZERO CSS** (`theme-bundle.ts:1819-1835` — no `<style>`/`:root`/stylesheet; DOMPurify strips inline styles) → unstyled HTML |
| 2 | Theme schema system | **~85%** | Liquid-specific (parallel to React) | `{% schema %}` JSON per section + Zod (`theme-bundle.ts:150-197`); bridge to runtime schema (`:1206-1272`); parity is hand-maintained, settings never diffed |
| 3 | Theme editor | **~70%** | **React only** | Editor emits engine-agnostic JSON but **never a `liquidBundle`** (`editor/page.tsx` `buildDraftConfig:581-618`); preview iframe = real storefront, always React |
| 4 | Section system | **~70%** (20/20 by count) | Liquid | 20 real sections (`createLiquidParitySectionFiles`, `theme-bundle.ts:769-1156`) but **shallow** (~8 lines vs React's 234-line `featured-products.tsx`) |
| 5 | Block system | **~90%** (most complete) | Liquid | Real inline/reusable/`@app` blocks, schema'd + rendered + validated (`theme-bundle.ts:125-169,451-502`; `theme-renderer.ts:371-441`) |
| 6 | Storefront runtime | **~50%** | Both (split) | Home/product/collection/shop/CMS route via `StorefrontCompositionEngine` (Liquid-capable); cart/checkout/account/orders are bespoke React, **never call the engine** |
| 7 | Product page | **~50% Liquid-capable** | Liquid chrome + React body | Routes via composition (`product/[productId]/page.tsx:75`), BUT body is `'use client'` `ProductDetailsClient` (React island) AND **no `product` page template exists** → falls back to `index` |
| 8 | Collection page | **~50%** | Liquid | Composition-routed (`collections/[slug]/page.tsx:128`), but the `collection` drop discards real `title/description` (`composition-engine.tsx:301-308`); no `collection` template in any bundle |
| 9 | Cart | **~20% Liquid** | Bespoke React | **No cart template, no `/cart` Liquid page**; `cart/page.tsx:1` is `'use client'` React; the `lb-cart-drawer` island shares localStorage cart but the **cart API `/api/storefront/[subdomain]/cart` does NOT exist → 404** (`liquid-hydration-islands.tsx:101-131`) |
| 10 | Checkout handoff | **0% Liquid (by design)** | Bespoke React (engine-agnostic) | `checkout-client.tsx` posts `/api/orders` + Razorpay/COD; Liquid only *links* to `/checkout` (`liquid-hydration-islands.tsx:334`) |
| 11 | Customer account | **0% Liquid** | Bespoke React (auth-gated) | No `templates/customers/*`; `account/layout.tsx:5` `'use client'` |
| 12 | Order tracking | **0% Liquid** | Bespoke React | `orders/orders-client.tsx`, `account/orders/page.tsx:33-45` timeline — no Liquid template |
| 13 | Theme customization | **~75%** | React path only | Section CRUD wired but only consumed via React `RenderSectionList`; editor never emits a bundle |
| 14 | Appearance settings | **~50%** | **Neither (dead island)** | `site_settings` has **zero references** in storefront/theme-engine; page self-admits "Custom CSS is stored but not executed" (`appearance/page.tsx:424,428`) — LB-9 |
| 15 | Merchant theme controls | **~65%** | Engine not merchant-selectable | No Liquid/React toggle; engine = installed bundle's `renderer.engine` + `liquidRenderingCanary` (default OFF). Only Liquid on-ramp = **import a prebuilt `renderer.engine:'liquid'` package** |

---

## 3. THE COMPOUNDING BLOCKERS (why "now" is impossible)

1. **No store ever loads a Liquid bundle.** `resolveLiquidBundle` reads `store.templateConfig.liquidBundle` (`template-resolver.ts:110-125`) — **never written** by any seed/migration/store-service. The urban-kicks default theme is React/portable-JSON. The Liquid fixtures are **test-only**. So even with the flag on, the resolver returns `undefined` → React.
2. **Flag OFF + validator-pinned + ARB-deferred.** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` (`theme-governance.ts:14`); platform flip `status:'deferred'` (ARB, `:16-21`); `theme-governance-validator.mjs:60-65` **fails the gate** if flipped. Per-store canary `true` only in test fixtures.
3. **Parity 0/200.** Every cell of the 20-section × 10-dimension matrix is `⏳ PENDING` (`LAUNCH_READINESS_2026_06_12/evidence/e-liquid-parity/PARITY_MATRIX.md`) — "any red cell blocks canary." Never run.
4. **No funnel page templates.** Bundles define only `index/header/footer`. No `product`, `collection`, `cart`, `customers/*`, `order`. The product/collection routes feed real data into a pipeline with no template to render it.
5. **The transactional tail is bespoke React that bypasses Liquid.** Cart page, checkout, account, order tracking are standalone `'use client'` pages — flipping the flag does nothing to them.
6. **Cart API missing → not shoppable.** The add-to-cart island's server sync 404s and is silently swallowed; cart is localStorage-only and cannot create a server order.
7. **No CSS pipeline.** The Liquid layout emits no stylesheet → structurally-correct but unstyled pages.
8. **No merchant Liquid authoring.** Visual editor emits portable JSON (no bundle); no Liquid code editor; editing an imported Liquid theme via the editor **strips the bundle** (engine desync).
9. **Tests are grep-theater.** 5 of 7 Liquid tests are source-string greps; the one real render test asserts only XSS escaping — real product data-binding is **never** behaviorally proven; islands have zero behavioral coverage.

---

## 4. LIQUID vs REACT (current production reality)

| Dimension | React (live V1) | Liquid (today) |
|---|---|---|
| Renders production storefront | ✅ yes (default) | ❌ no (flag off, no bundle) |
| Home / product / collection / shop | ✅ full, styled, data-bound | ⚠️ engine-capable, unstyled, index-template-only, body still React |
| Cart page / checkout / account / orders | ✅ full bespoke React | ❌ no templates; React-only by design |
| Add-to-cart → server order | ✅ works (`/api/orders`) | ❌ cart API 404 |
| Styling / theme tokens | ✅ `:root` vars in `layout.tsx:126-160` | ❌ no CSS shipped |
| Merchant authoring/preview | ✅ visual editor + real preview | ❌ no Liquid authoring; import-only |
| Parity validated | ✅ in production | ❌ 0/200 |
| Sections | 20, deep (100–234 lines) | 20, shallow (~8 lines) |
| Block system | n/a (section-based) | ✅ ~90% Shopify-style |

**React is the only engine that renders a styled, shoppable storefront today.** Liquid is a wired-but-unfed, off-by-default, unstyled, untested scaffold.

---

## 5. PATH TO LIQUID ON V1 (the plan you asked for)

The realistic, honest way to get "Liquid on V1" is the **hybrid** — and it's the industry-standard shape (Shopify deprecated `checkout.liquid`; checkout is no longer Liquid). Liquid owns the *themeable storefront*; the hardened React checkout stays. Pure full-funnel Liquid is a post-V1 follow-on.

### Option 1 — Hybrid Liquid storefront (RECOMMENDED) · ~4–6 weeks + ARB sign-off

| Wk | Workstream | Concrete deliverables (code-located) |
|---|---|---|
| 1–2 | **Author the urban-kicks Liquid bundle + CSS** | Build `layout/theme.liquid` that emits the theme `:root` token block + a shipped stylesheet for `lb-*` classes (today it ships none); author `index`, `product`, `collection` page templates (today only `index/header/footer`); deepen the 20 sections toward React parity. |
| 2–3 | **Build the missing cart API + fix islands** | Create `apps/storefront-runtime/src/app/api/shipping`-style `…/api/storefront/[subdomain]/cart` proxy (GET/POST/PATCH) wired to the real cart/`/api/orders` backend (the island's 404 target); add variant→price recompute to `lb-variant-picker`; point home `product-grid`/`featured-products` at `collection.products` instead of demo blocks. |
| 3 | **Persist a Liquid bundle to stores + canary** | Seed/migration writing `templateConfig.liquidBundle` for opt-in stores; plumb `liquidRenderingCanary` per-store (the resolver already supports it, `theme-governance.ts:144-168`). |
| 4 | **Run + green the parity matrix** | Execute `scripts/liquid-parity/run-parity-matrix.mjs` on staging for the ~6 browse templates; turn the relevant PENDING cells green; fix reds. (Tail templates are out of hybrid scope.) |
| 4–5 | **Real tests (replace grep-theater)** | End-to-end render test asserting `{{ product.title }}`/`collection.products` bind real data; island behavioral tests (add-to-cart hits the new API, variant repricing, cart drawer). |
| 5–6 | **ARB flag lift + canary rollout** | Human ARB decision to move `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` off `deferred`; update `theme-governance-validator` expectations in lockstep; canary 1 store → N. |

**Gating items (cannot be skipped):** ARB sign-off (human), parity green for browse templates, the cart API. **Out of hybrid scope (stays React):** cart page, checkout, account, order tracking — and that's fine; it's one hardened checkout regardless of theme.

### Option 2 — Pure full-funnel Liquid (post-V1) · ~+6–10 weeks

Adds: Liquid templates **and** composition routing for `cart`/`customers/*`/`order` (rewriting the bespoke React tail to flow through `StorefrontCompositionEngine`), a merchant Liquid authoring surface (editor must emit `liquidBundle`; today it strips it), and the full 200-cell parity. This conflicts with the V1 "minimum change / foundation frozen" mandate and the 60-day window — defer.

### Interaction with the other V1 blockers

- **LB-8 (announcement bar)** and **LB-9 (appearance bridge)** become Liquid-flavored under Option 1: LB-8's section already has a Liquid file; LB-9's `site_settings` must bridge into the Liquid layout `:root` (today it reaches neither engine). Sequence LB-9's bridge to feed **both** engines.
- The **commit seam (C0)** and the gate's untracked-migration guard still apply to every step here.

---

## 6. ANSWER

**A — no. B — yes, ~4–6 weeks, as a hybrid Liquid storefront (Liquid browse + React checkout), which is the legitimate, industry-standard "Liquid V1." C — a pure full-funnel Liquid is post-V1.** The engine is real and worth shipping on; it is unfed, unstyled, unvalidated, and funnel-incomplete today. Choose Option 1 to put Liquid on V1 honestly.

---

*Every load-bearing claim cites file:line and was confirmed by 5 independent code audits at HEAD `0b8a56e7`. Parity state read from the in-repo matrix. No flag was flipped, no code changed — research only.*
