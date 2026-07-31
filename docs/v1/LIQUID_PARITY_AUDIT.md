# Liquid Parity Audit (V1) — Can Liquid replace React?

**Type:** Research / certification — **no implementation, no migration, no deletion.**
**Date:** 2026-06-16
**Method:** LCIS-first (`graphify-out/domain-intel.json` themes/storefront) → source verification. Every claim cites `file:line`.
**Companion docs:** [REACT_DEPENDENCY_INVENTORY.md](REACT_DEPENDENCY_INVENTORY.md) · [LIQUID_GAP_MATRIX.md](LIQUID_GAP_MATRIX.md) · [LIQUID_ONLY_MIGRATION_PLAN.md](LIQUID_ONLY_MIGRATION_PLAN.md) · prior [STOREFRONT_CERTIFICATION_AUDIT.md](STOREFRONT_CERTIFICATION_AUDIT.md)

---

## TL;DR verdict

**Can LetBuyy be Liquid-only today? NO.** Liquid is genuinely strong for **catalog presentation** (home, product, collection, product-grid, header/footer, localization) — but the **transactional, account, content, and discovery surfaces are either React-only routes that never invoke the Liquid renderer, or lack the data drops to function**. React cannot be removed without building 6 blocker-class capabilities (see [§Blockers](#blockers)).

**Liquid completeness (weighted): ≈ 38 / 100.** Catalog ≈ 75–80% Liquid-ready; cart/checkout/account/search/reviews ≈ 10–20%.

---

## 1. The structural fact that frames everything: two page classes

Only **catalog pages route through the Liquid-capable composition engine.** Verified by `grep StorefrontCompositionEngine apps/storefront-runtime/src/app`:

| Liquid-capable (uses `StorefrontCompositionEngine`) | React-only (never invokes Liquid) |
|---|---|
| `store/[subdomain]/page.tsx` (home/index) | `store/[subdomain]/cart/page.tsx` |
| `store/[subdomain]/product/[productId]/page.tsx` | `store/[subdomain]/checkout/page.tsx` (+ `success`, `paypal-return`) |
| `store/[subdomain]/products/page.tsx` | `store/[subdomain]/account/{settings,addresses,orders,wishlist}/page.tsx` |
| `store/[subdomain]/shop/page.tsx` | `store/[subdomain]/orders/page.tsx` |
| `store/[subdomain]/collections/[slug]/page.tsx` | `store/[subdomain]/[...path]/page.tsx` (CMS via `ContentResourceRenderer`) |
| `preview/page.tsx` (editor preview) | `store/[subdomain]/blog/[slug]/page.tsx`, `privacy/terms/shipping/returns` |

**Consequence:** even with `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=true` and a perfect bundle, cart/checkout/account/orders/blog/CMS **still render React**, because those routes don't call `resolveStorefrontTemplate`/`StorefrontCompositionEngine` at all. Liquid-only requires **re-wiring those routes**, not just authoring templates.

---

## 2. Liquid coverage — what the engine + bundle actually provide

**Engine is real:** `liquidjs` (`theme-renderer.ts:2`), `class LiquidRenderer` (`:321`), sanitized per-section (`:313`), header/footer chrome (`:362-388`). Commerce filters registered (`theme-renderer.ts:668-673`): `money`, `money_with_currency`, `json`, `asset_url`, `image_url`, **`t` (i18n)**.

**Section templates in the Urban Kicks bundle** (`theme-bundle.ts`, `createLiquidSectionFile`): announcement-bar, about-section, app-block-slot, banner-carousel, brand-marquee, category-grid, contact-form, cta-section, featured-products, experience-timeline, footer, header, hero-banner, marquee, portfolio-grid, **product-detail** (`:1029`), **product-grid** (`:1047`), rich-content, services-grid, skills-section, testimonials, trust-badges, newsletter-signup — **~23 presentation sections.**

**Page templates in the bundle** (`theme-bundle.ts:1891-2149`): `index`, `product`, `collection`, **`search`**, **`cart`**, plus account markup referencing `customer.orders` (`:2195`) and `order.line_items` (`:2209`). **Important:** the cart/search/account templates exist **but are dormant** — no route renders them (see §1).

**Interactivity islands** (`liquid-hydration-islands.tsx`, custom elements registered `:433-439`): `lb-add-to-cart` (`:223`, localStorage + server `/cart` sync), `lb-cart-drawer` (`:266`, mini-cart + checkout link), `lb-search` (`:354`), `lb-variant-picker` (`:383`).

---

## 3. Section Parity Matrix (React output vs Liquid output)

Legend: **FULL** = Liquid renders + data + interactivity present · **PARTIAL** = renders but missing data/wiring/interactivity · **MISSING** = no Liquid path.

| Section / surface | React | Liquid | Parity | Evidence |
|---|:--:|:--:|:--:|---|
| Header | ✅ `components/layout/dynamic-header.tsx` | ✅ `theme-bundle.ts:965` (search+cart) | **FULL** | header template + nav drop |
| Footer | ✅ `dynamic-footer.tsx` | ✅ `theme-bundle.ts:947` | **FULL** | |
| Hero / banner | ✅ `sections/hero.tsx` | ✅ `theme-bundle.ts:984` | **FULL** | |
| Featured products | ✅ `sections/featured-products.tsx` | ✅ `theme-bundle.ts:906` | **FULL** | bound to real products |
| Product grid | ✅ `sections/product-grid.tsx` | ✅ `theme-bundle.ts:1047` (+add-to-cart) | **FULL** | `collection.products` drop |
| Product detail | ✅ `sections/product-detail-section.tsx` | ✅ `theme-bundle.ts:1029` (gallery/variant/add-to-cart) | **FULL** (variant_id gap) | `:1042-1043` |
| Collection grid | ✅ `collections/[slug]/page.tsx` | ✅ `theme-bundle.ts` collection template | **FULL** (display) | |
| Collection **filter/sort/pagination** | ❌ none | ❌ none | **MISSING (both)** | `collectionFilter` type only `index.ts:31`, no renderer |
| **Search** | ❌ no backend | 🟡 island + template, dest ignores query | **MISSING (backend)** | `lib-search` → `/shop?search=` `:359`; `shop/page.tsx` ignores `search` |
| Blog | ✅ `blog/[slug]/page.tsx` (React) | ❌ no Liquid blog section/route | **MISSING** | grep `type:'blog'` = 0 |
| Reviews | ✅ `api/reviews` + React | ❌ no Liquid section | **MISSING** | grep `type:'reviews'` = 0 |
| Cart | ✅ `cart/page.tsx` (React) | 🟡 drawer island + dormant template | **PARTIAL** | drawer `:266`; full page React; data shell `composition-engine.tsx:279-288` |
| Customer account (login/register/profile) | ✅ `account/*` + `customer-auth-context.tsx` | ❌ no Liquid auth islands; `customer:null` | **MISSING** | `composition-engine.tsx:337` |
| Wishlist | ✅ `account/wishlist` + `wishlist-context.tsx` | ❌ no Liquid section | **MISSING** | grep `type:'wishlist'` = 0 |
| Order history | ✅ `account/orders`, `orders/page.tsx` | 🟡 dormant template, no data drop/route | **PARTIAL→MISSING** | `theme-bundle.ts:2195` unrouted |
| Localization | 🟡 React `localizeThemeTemplateConfig` | ✅ `t` filter + multi-lang tables | **FULL (Liquid stronger)** | `theme-renderer.ts:673`; `theme-bundle.ts:1576-1606` |
| Recommendations | ❌ none | ❌ none | **MISSING (both)** | no section/data |
| Upsells | ❌ none | ❌ none | **MISSING (both)** | no section/data |
| Checkout | ✅ `checkout-client.tsx` (React + Razorpay SDK) | ❌ not in Liquid path | **MISSING (BLOCKER)** | drawer links to React `/checkout` `:347` |

**Parity roll-up:** FULL = 9 (catalog + localization) · PARTIAL = 3 (cart, search, order-history) · MISSING = 7 (filter, blog, reviews, account, wishlist, recommendations/upsells, checkout).

---

## 4. Data Connectivity Certification — what Liquid actually receives

`buildLiquidCommerceContext` (`composition-engine.tsx:299-339`) builds the Liquid drop:

| Drop | Status | Evidence |
|---|:--:|---|
| `shop` (id/name/subdomain/url/locale/currency) | ✅ REAL | `composition-engine.tsx:325-332` |
| `product` / `products` | ✅ REAL (gateway) | `:308-309`, `productToLiquidDrop:229-251` |
| `collection` (+ products) | ✅ REAL | `:310-322` |
| `variants` / `options` | 🟡 PARTIAL — passed to drop but `variant_id:null` to server cart | `productToLiquidDrop:248-249`; island `liquid-hydration-islands.tsx:81` |
| `inventory` | 🟡 PARTIAL — only `available`/`stock` from product (999 default) | `productToLiquidDrop:245-246`; `product-service.ts:126` |
| `cart` | 🟡 SHELL — `browser_hydrated` default (`item_count:0`) unless section provides | `collectLiquidCart:269-288` |
| `customer` | ❌ **NULL — hardcoded** | `composition-engine.tsx:337` `customer: null` |
| `orders` | ❌ not provided | no drop builder |
| `reviews` | ❌ not provided | no drop builder |
| `recommendations` | ❌ not provided | no drop builder |
| `theme settings` | ✅ REAL (merchant-configured) | `plan.themeSettings`, `store-service.ts:592-605` |

**No demo data in the live drop** for real stores (products/collections come from the gateway). The fixture-fixture risk (`store-service.ts:670-673`) and demo store are isolated (see prior audit §15). **The real data gaps are: `customer:null`, no orders/reviews/recommendations drops, and a shell cart.**

---

## 5. Theme Editor & Preview compatibility with Liquid

- **Editor** edits a React-section model but the draft can carry `liquidBundle` + `liquidRenderingCanary` (`api/themes/[themeId]/editor/draft/route.ts:23-36`) → so a merchant can toggle Liquid per theme and persist a bundle. Draft/publish/rollback are gateway-backed (prior audit). **However the editor cannot author Liquid template code** — it edits section settings/order; the Liquid bundle must come from a theme package.
- **Preview** uses the **same dual renderer**: `preview/page.tsx:370` `<StorefrontCompositionEngine ... editorMode>` → Liquid when the (draft) store has a bundle + canary, else React. So merchant preview renders **Liquid or React identically to production** (`composition-engine.tsx:402-403`). **Preview is Liquid-compatible.**
- **React dependency in the editor/preview:** the editor UI itself is React (`editor/page.tsx`, 1897 lines), and the preview shell + `EditorPreviewSectionFrame`/`LiquidHydrationIslands` are React `'use client'`. These are tooling, not storefront output — but they mean the *authoring + preview* experience stays React regardless.

---

## 6. Per-scope compatibility answers (scopes 7–11)

| Scope | Works through Liquid? | Evidence |
|---|---|---|
| **7 Search** | ❌ No — island posts to `/shop?search=` but no page consumes it; no search service | `liquid-hydration-islands.tsx:359`; `shop/page.tsx` ignores `search` |
| **8 Collection filtering** | ❌ No filters/sort/pagination in either renderer | `collectionFilter` type only `index.ts:31` |
| **9 Cart** | 🟡 Add/remove/persist via island (`lb-cart-drawer`/`lb-add-to-cart`); full cart **page** is React; variant_id not synced | `liquid-hydration-islands.tsx:133-352`, `:81` |
| **10 Checkout** | ❌ React-only (Razorpay SDK client); Liquid links out to `/checkout` | `checkout-client.tsx`; drawer `:347` |
| **11 Account (login/register/profile/addresses/orders)** | ❌ React routes; `customer:null` in Liquid; no auth islands | `account/*` pages; `composition-engine.tsx:337` |

---

## Blockers

The exact blockers preventing Liquid-only (detail + severity in [LIQUID_GAP_MATRIX.md](LIQUID_GAP_MATRIX.md)):

1. **Checkout is React + Razorpay SDK**, not in the Liquid render path.
2. **Cart / account / orders / wishlist are standalone React routes** that never invoke the Liquid renderer (route-wiring gap).
3. **`customer: null`** in the Liquid commerce drop — no account/personalization data.
4. **No search backend** (island has nowhere functional to go).
5. **No Liquid sections/data for reviews, recommendations, upsells, wishlist, blog.**
6. **Liquid is off by default**, only Urban Kicks ships a bundle, and the fallback is a demo fixture (carried over from prior audit).

**Conclusion:** Liquid can already render the **storefront catalog** end-to-end (browse → product → add-to-cart island) when enabled, but **React owns the entire purchase + account + content + discovery half** of the storefront. Removing React today would break checkout, cart page, all account pages, order history, blog, CMS pages, and search. See the staged plan in [LIQUID_ONLY_MIGRATION_PLAN.md](LIQUID_ONLY_MIGRATION_PLAN.md).
