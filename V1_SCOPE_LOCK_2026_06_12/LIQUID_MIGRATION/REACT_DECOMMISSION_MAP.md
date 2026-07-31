# REACT_DECOMMISSION_MAP.md

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · file-level, code-cited. Line counts via `wc -l`.

Every React-owned storefront capability, its owner files, dependencies, routes, APIs, and tests. Classification (KEEP / MIGRATE / DELETE) and proof are in `REACT_DELETION_PLAN.md`; this map is the inventory.

## A. Section render layer (the 20 React sections)

**Owner:** `apps/storefront-runtime/src/components/sections/*.tsx` — 20 files, **2,604 lines**, mapped in `lib/theme-engine/renderer-registry.tsx:56-203`.

| Section | Lines | rendererKey | Liquid parity fixture |
|---|---|---|---|
| featured-products | 234 | core.featured-products | featured-products `theme-bundle.ts:906` |
| testimonials | 221 | core.testimonials | testimonials `:1109` |
| product-grid | 205 | core.product-grid | product-grid `:1046` |
| hero | 199 | core.hero | hero-banner `:984` |
| contact-form | 173 | core.contact-form | contact-form `:873` |
| banner-carousel | 254 | (parity only, not registry-imported) | banner-carousel `:818` |
| newsletter | 123 | core.newsletter | newsletter-signup `:1139` |
| portfolio-grid / about / category-grid / experience-timeline / skills / trust-badges / services-grid / brand-marquee / cta / rich-content / product-detail-section / marquee | 41–121 | core.*/commerce.* | all present in `theme-bundle.ts` parity fixtures |

- **Deps:** Tailwind utilities + inline `style` + framer-motion + Next `<Image>` (e.g. `hero.tsx:122-159`). **Not** the `lb-*` classes (those style the Liquid markup — see CSS pipeline). → React sections are not portable; the Liquid sections already exist as separate `lb-*` markup.
- **Routes/APIs:** product data via `data-binding-engine.ts` → `ProductService` (gateway-backed).
- **Tests/validators (deletion locks):** `no-new-react-sections-validator.mjs:9-30` (frozen Set of 20); `theme-governance-validator.mjs:69-72,98-101` (parity==20 AND section-file-count==20); `tests/governance/phase-b-validators.test.mjs:108-113`.

## B. React render path (engine switch)

| File | Lines | Role | Routes/APIs | Notes |
|---|---|---|---|---|
| `lib/theme-engine/renderer-registry.tsx` | 276 | section→component map; `renderRegisteredSection`, `UnknownSectionFallback` | — | locked by `theme-governance-validator.mjs:82-83` |
| `lib/theme-engine/composition-engine.tsx` | 444 | React↔Liquid switch (`RenderSectionList` React; `LiquidRenderedHtml` Liquid) | — | **KEEP** (holds the Liquid branch) |
| `lib/theme-engine/editor-preview-section-frame.tsx` | 93 | React section wrapper (editor only) | — | dies with React sections |
| `lib/theme-engine/template-resolver.ts` | 296 | engine-agnostic plan builder | — | **KEEP**; locked by `theme-governance-validator.mjs:85-87` |
| `lib/theme-engine/data-binding-engine.ts` / `product-route.ts` / `content-route.ts` / `types.ts` | 106/40/17/71 | engine-agnostic data + types | ProductService | **KEEP** |
| `lib/theme-engine/liquid-hydration-islands.tsx` | 453 | Liquid islands | proxy `/cart`, `/search` | **KEEP** (Liquid) |

## C. Composition-engine page wrappers (KEEP — engine-agnostic, become Liquid when bundle present)

`page.tsx` (home, 64) · `shop/page.tsx` (63) · `product/[productId]/page.tsx` (78) · `collections/[slug]/page.tsx` (131) · `[...path]/page.tsx` CMS (66) · `blog/[slug]/page.tsx` (52) · `products/page.tsx` (67). All delegate to `StorefrontCompositionEngine`.

**`layout.tsx` (258) — HYBRID:** KEEP the provider + `:root` CSS-var shell (`:123-212`); MIGRATE the two `StorefrontSectionGroupRenderer` header/footer calls (`:214,224`) to Liquid chrome (CAP-C08). Locked by `storefront-seo-access-validator.mjs:12`.

## D. Bespoke commerce pages (MIGRATE → DELETE) + their APIs

| Page | Lines | `/api/*` it calls (all engine-agnostic, KEEP) |
|---|---|---|
| `checkout/checkout-client.tsx` | **1,160** | `/api/orders`, `/api/coupons/validate`, `/api/customer/addresses`, `/api/customer/auto-create`, `/api/shipping/rates`, `/api/payments/razorpay/*` |
| `product/[productId]/product-details-client.tsx` | 555 | (context) — **hard `exists()` lock `typescript-dead-source-validator.mjs:141-144`** |
| `orders/orders-client.tsx` | 447 | `/api/orders/check`, `/api/orders/login`, `/api/orders/set-password` |
| `account/addresses/page.tsx` | 383 | `/api/customer/addresses` |
| `account/settings/page.tsx` | 296 | `/api/customer/profile`, `/api/customer/set-password` |
| `account/orders/page.tsx` | 228 | `/api/customer/orders` |
| `cart/page.tsx` | 199 | (context → proxy `/cart`) |
| `account/wishlist/page.tsx` | 73 | `/api/customer/wishlist` |
| legal: privacy/terms/returns/shipping | 231 | — (candidates for CMS/Liquid pages) |

## E. Contexts (MIGRATE → DELETE if tail goes Liquid; KEEP if tail stays React)

`cart-context.tsx` (265, keys `lb_cart`/`lb_cart_token` — **shared with Liquid islands**, so cart state is already unified) · `customer-auth-context.tsx` (221) · `wishlist-context.tsx` (92).

## F. Lib services + API proxies (KEEP — engine-agnostic, reused by Liquid)

- **Services:** `store-service.ts` (743), `product-service.ts` (136), `order-service.ts` (223), `customer-service.ts` (283), `content-service.ts` (131), `seo.ts` (246), `session.ts` (129), `lib/api/{client,browser-client,base-url}.ts`. Locked: `domain-boundary-validator.mjs:118,244-262`.
- **22 `app/api/*/route.ts` proxies** — all KEEP. Liquid calls `/api/storefront/{sub}/cart` (rewrite→gateway) and `/api/customer/*`. **Deletion lock:** `domain-boundary-validator.mjs:209` asserts repo-wide app-API route count `=== 127`.

## G. Capability → engine-agnostic backend (already shared — the key migration fact)

| Capability | Backend (gateway, engine-agnostic) | Liquid needs |
|---|---|---|
| Products/collections | `/storefront/:sub/products[/:slug][/by-ids]`, `getCollectionWithProducts` | templates only |
| Cart | `cart-routes.ts` (POST/GET/PATCH/buyer-identity/discount-codes/checkout-url/DELETE) | cart template; drops optional |
| Checkout/orders | `/storefront/:sub/orders`, `/payments/razorpay/*` | nothing (engine-agnostic) |
| Account | `/api/customer/{login,session,profile,addresses,wishlist,set-password,orders}` | `customers/*` templates |
| Order tracking | `/api/customer/orders`, `/api/orders/{check,login,set-password}` | order templates |

**Bottom line:** the React decommission target is the **section layer + the bespoke commerce pages + their contexts**. Everything else (composition switch, template resolver, data/services, all API proxies, checkout) is **engine-agnostic and stays**. Backends for cart/account/orders already exist — migration is template authoring, not backend rebuild.
