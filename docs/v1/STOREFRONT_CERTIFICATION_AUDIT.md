# LetBuyy Storefront Certification Audit (V1)

**Type:** Research / certification audit — **no implementation, no code changes, no migrations.**
**Date:** 2026-06-16
**Auditor pass:** LCIS-first (graphify-out intel) → source verification (grep + file read). Every verdict below is backed by a `file:line` reference.
**Companion docs:** [THEME_ENGINE_CERTIFICATION.md](THEME_ENGINE_CERTIFICATION.md) · [STOREFRONT_CONNECTIVITY_MATRIX.md](STOREFRONT_CONNECTIVITY_MATRIX.md) · [STORE_FRONT_PRODUCTION_GAPS.md](STORE_FRONT_PRODUCTION_GAPS.md)

---

## 0. Method & honest limitations (read first)

1. **LCIS was queried first.** The graph UI server (`:3333`) was not running, but the generated intel artifacts in `graphify-out/` (refreshed 2026-06-14→16) were read directly: `domain-intel.json` (22 domains), `production-readiness-v2.json`, `connections-intel.json`. These point at topology; **every claim was then verified against source.**
2. **This is a static source audit.** No storefront was rendered in a browser, no order was placed, no Razorpay capture was executed. **0 of 13 live providers are connected from the repo** (`graphify-out/connections-intel.json` → `connected:0, notConnected:13`) because all credentials are deploy-time (`wrangler secret put`). Therefore **runtime behavior is NOT certified** — only the code paths are. Where I say "CONNECTED" I mean *the code path is wired end-to-end to the gateway/DB*, not *proven at runtime*.
3. **LCIS structural scores ≠ this audit.** `production-readiness-v2.json` scores Storefront `100` — but its own scope line reads *"STRUCTURAL readiness (repo evidence)"* and the launch verdict is **`NO-GO`** with 5 open blockers. "14 routes / 4 rpcs / 21 tables exist" is not the same as "the Liquid chain renders a real product end-to-end," which is what this audit tests.

---

## 1. THE CORE QUESTION

> *Can a merchant create a store and operate Product → Collection → Theme → Storefront → Cart → Checkout → Payment → Order → Customer → Fulfillment using **only the current Liquid architecture**?*

### Verdict: **NO — not "Liquid-only." The storefront is a dual-renderer HYBRID in which React is the production default and Liquid is an opt-in canary.** The end-to-end commerce chain *does* work, but predominantly through the **React** renderer wired to a real gateway backend — not through Liquid.

**Evidence (the single most load-bearing finding):**

- The render engine is a flag, and the flag **defaults to React**:
  - `apps/storefront-runtime/src/proxy.ts:175` — `const renderEngine = process.env.THEME_LIQUID_RENDERING_DEFAULT_ENABLED === 'true' ? 'liquid' : 'react';`
  - `packages/theme-engine/src/theme-governance.ts:14` — `export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false;`
- The composition engine is a **dual renderer** that picks Liquid only if it is enabled *and* a valid Liquid bundle resolves; otherwise it renders React:
  - `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:402-403` — `const liquidHtml = await renderLiquidPlan(...); const engine = liquidHtml ? 'liquid' : 'react';`
  - `…/composition-engine.tsx:352` — `if (plan.rendererEngine !== 'liquid' || !plan.liquidBundle) return null;` (→ falls back to React `RenderSectionList`).
  - `…/template-resolver.ts:241-246` — `liquidEnabled = options.liquidEnabled ?? resolveThemeLiquidRenderingEnabled({ templateConfig, defaultEnabled: THEME_LIQUID_RENDERING_DEFAULT_ENABLED })`.
- React is not removed; it is the **default rendering path** with ~20 live React section renderers (`apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx`, `…/components/sections/*.tsx`) and a React layout chrome (`apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:119,218,245` — `liquidPage ? children : <React header/footer>`).
- Only **one** theme is Liquid-first (commit `57760d0c` "make Urban Kicks a first-class Liquid theme"). For every other store/theme, Liquid resolution finds no bundle → React.

**So:** the user's belief that "the React storefront has been removed" is **factually false** (see [§14](#14-react-removal-certification) and [THEME_ENGINE_CERTIFICATION.md](THEME_ENGINE_CERTIFICATION.md)). The Liquid engine is *real and works*, but it is gated **off** by default. The commerce chain is real via React + the canonical gateway.

---

## 2. FINAL SCORES (no optimism; evidence-backed; STRUCTURAL unless noted)

| Score | Value | One-line basis |
|---|---|---|
| **Production Readiness (storefront stack)** | **70 / 100** | Functionally complete end-to-end via React + real gateway, but: "Liquid-only" claim false, **0/13 live integrations connected**, no storefront search, no client analytics, demo fixtures in fallback paths, runtime unverified. LCIS launch verdict = **NO-GO**. |
| **Theme Engine** | **72 / 100** | Liquid renderer is real (`liquidjs`), sanitizer locked, bundle schema + commerce drops + app-block + chrome present and *invoked* — but OFF by default, single Liquid theme, demo-fixture bundle fallback, React/Liquid visual parity unproven. |
| **Theme Editor** | **78 / 100** | Full visual customizer (sections/blocks/settings/versions), schema-driven, draft auto-save + preview + publish + rollback all gateway-backed with optimistic concurrency — minus a non-RPC `local-fallback` publish path and unverified live preview rendering. |
| **Storefront Runtime** | **80 / 100** | Host→site→theme→template→render fully wired to the real gateway; products/collections/cart/customer/domains connected; SEO/JSON-LD; access modes. Minus: no search, no client analytics, demo-theme default, Liquid fixture fallback. |
| **Checkout** | **84 / 100** | Razorpay + COD, server-authoritative amounts, **signature verify** + idempotency + canonical `create_checkout_order` RPC. Minus: Stripe/PayPal deferred, live Razorpay NOT CONNECTED, cart shows no tax/shipping until order. |
| **Merchant ↔ Storefront Connectivity** | **82 / 100** | Products, collections, theme settings/appearance, orders, customers, domains all flow merchant→DB→gateway→storefront. Minus: analytics funnel disconnected, search absent, a few admin reads stubbed. |

> These are **structural** scores from source. Live readiness (load tests + connected Razorpay/Supabase/Resend + the Liquid-default decision) is a separate gate that is currently **NO-GO**.

---

## 3. Storefront Runtime Certification (request chain)

**Verdict: CONNECTED (React-default), real gateway-backed, graceful degradation. Liquid path present but gated.**

Traced chain (each hop verified):

1. **Host → site.** `proxy.ts:235` reads `x-forwarded-host`/`host` → `resolveStorefrontHost(host, NEXT_PUBLIC_STORE_ROOT_DOMAIN)` (`proxy.ts:238`) classifies root/reserved/invalid/subdomain/custom_domain → `resolveAccess(host)` (`proxy.ts:244`) resolves the real site; no site ⇒ 404 (`proxy.ts:252-254`); backend unavailable ⇒ continue, not 500 (`proxy.ts:245-250`).
2. **Access control.** preview-only / unpublished ⇒ holding page (`proxy.ts:288-289`); offline ⇒ 503 (`proxy.ts:292`); password ⇒ signed gate cookie (`proxy.ts:296`, `createGateCookie` `proxy.ts:316`).
3. **Rewrite → store route** `proxy.ts:300` `rewriteToStore(...)`.
4. **Store data.** `store/[subdomain]/page.tsx:40` → `StoreService.getStoreBySubdomainAnyStatus` → `fetchWorkerStore` → `client.storefront.getStore(subdomain)` (`store-service.ts:428-441`) — **real gateway/worker**, not mock.
5. **Theme/template resolution.** `page.tsx:45` `resolveStorefrontTemplate(store, {type:'index'}, devOverride)` (`template-resolver.ts:235`).
6. **Section data.** `page.tsx:50` `buildSectionDataPlan(...)` (`data-binding-engine.ts:66`).
7. **Render.** `page.tsx:57` `<StorefrontCompositionEngine>` → Liquid (`createThemeRenderer('liquid')`, `composition-engine.tsx:354`) **or** React registry (`composition-engine.tsx:426`).

**Mocks/fallbacks in the chain:** default `themeId = 'urban-kicks'` (`store-service.ts:557`); non-renderable template ⇒ default registry template (`store-service.ts:559-573`, real); invalid Liquid bundle ⇒ **demo fixture bundle** `createUrbanKicksLiquidThemeBundleFixture()` (`store-service.ts:670-673`, only reached when Liquid is on). Full detail in [STORE_FRONT_PRODUCTION_GAPS.md](STORE_FRONT_PRODUCTION_GAPS.md).

**Score: 80/100.**

---

## 4. Product Connectivity — **CONNECTED (real DB via gateway)**

- `product-service.ts:41-51` `getProductsByStoreSubdomain` → `client.storefront.listProducts(subdomain,{limit:100})`; `:67-82` `getProductById` → `client.storefront.getProduct`. Errors return `[]` (not demo) (`:35-38,46-50,78-81`).
- `data-binding-engine.ts:92-94` binds real products into sections; gated to `store.siteType === 'store'` (`:77`).
- Field mapping (`product-service.ts:111-136`): variants, price, `compareAtPrice`, images, tags, `seoTitle/seoDescription`, `isActive`, rating/reviewCount — all from DB rows. **Caveat:** `stock` defaults to **999** when null (`:126`) — a soft in-stock default, not real inventory enforcement at the read layer.
- Demo products exist (`product-service.ts:5-19`) but are reachable **only** via `/preview` and `/demo` (`preview/page.tsx:285-286`, `app/demo/urban-kicks/page.tsx:5`) — never the real subdomain path.

**Verdict: storefront renders REAL merchant products.** Demo products are isolated. **CONNECTED.**

---

## 5. Collection Connectivity — **CONNECTED (data); filters/sort/search ABSENT**

- `collections/[slug]/page.tsx:23` → `client.storefront.getCollectionWithProducts(subdomain, slug)` (real); 404 ⇒ `notFound` (`:26,62`); products mapped to `ProductModel` (`:67-92`); rendered through the same composition engine (`:128`).
- **No filtering, no sorting, no in-collection search** — the page lists collection products only. There is a fallback section if the theme lacks a collection template (`:99`, `createProductListingFallbackSection`).

**Verdict: collection pages CONNECTED; filter/sort/search NOT IMPLEMENTED.**

---

## 6. Cart Certification — **PARTIAL (works; client-side totals; no tax at cart)**

- Storage: `localStorage` (`cart-context.tsx:56-57`, keys `lb_cart` / `lb_cart_token`) + **server sync** to the `carts` table via `storefrontBrowserApiFetch(subdomain, '/cart' | '/cart/{token}', POST|PATCH)` (`:142-145`), reconciling server lines back (`:149-161`); degrades to browser cache on gateway failure (`:162-164`).
- Quantity/add/remove implemented (`:182-237`).
- **Totals are computed client-side, untaxed:** `cartTotal = items.reduce((t,i)=>t+i.price*i.quantity,0)` (`:241`). No GST, no shipping at the cart stage (by design — money math is server-authoritative at order creation). Cart line `stock` is hardcoded `999` (`:92`).

**Verdict: cart is functional with server persistence, but tax/shipping/authoritative totals are deferred to checkout. PARTIAL.**

---

## 7. Checkout Certification — **CONNECTED (Razorpay + COD, server-authoritative)**

- `checkout/page.tsx` (server) → `<CheckoutClient ... codEnabled onlinePaymentEnabled>` (`:30-37`).
- Order creation: `checkout-client.tsx:413-414` `createCheckoutOrder(method)` → `fetch('/api/orders')` → `api/orders/route.ts:48-51` `client.storefront.createOrder(subdomain,{paymentMethod})` → gateway `order-execution.adapter.ts:158` `db.rpc('create_checkout_order', …)` — **canonical ledger RPC**.
- **COD:** `checkout-client.tsx:427-429`, "COD order is confirmed server-side" (`:1039`).
- **Razorpay:** create server order `/payments/razorpay/order` with idempotency (`:466-470`) → Razorpay widget → **server signature verify** `/payments/razorpay/verify` with `razorpay_signature` + idempotency (`:494-505`) → failure surfaces "Payment verification failed. Please contact support." (`:512`).
- **Source of truth = the new gateway checkout.** There is no parallel legacy checkout in the storefront; `services/checkout-runtime` is reserved/not implemented (CLAUDE.md). Stripe/PayPal deferred (`checkout/success/page.tsx:1`, "V1 ships Razorpay+COD"). A `paypal-return` route exists but PayPal is deferred (LB-2).

**Verdict: single, modern, server-authoritative checkout. CONNECTED. Live capture unverified (no Razorpay credential).**

---

## 8. Order Pipeline — **CONNECTED (gateway-owned); notifications wired, live-pending**

- Order **creation + payment mutation are gateway-owned**; the storefront `order-service.ts:3` says so, and client-side order lookups intentionally `throw` (`:15,48,57`). Storefront does reads + customer credentials only.
- Order shape mapped from real rows: subtotal/delivery/discount/total, payment method+status, items, **tracking** (`order-service.ts:119-159`).
- **Notifications:** `services/api-gateway/src/lib/order-confirmation-email.ts` + queue worker `sendResendEmail` (`services/queue-workers/src/index.ts:6,503`). **Resend = NOT CONNECTED** (deploy-time key; `connections-intel.json`).
- **Fulfillment → merchant dashboard:** orders are a shared tenant domain (orders domain: `create_checkout_order`, `carts`, `checkout_sessions`, `order_items`, `orders` — `domain-intel.json`); the merchant app reads them. Structurally connected.

**Verdict: end-to-end order pipeline CONNECTED structurally; email + payment capture pending live credentials.**

---

## 9. Customer Account Certification — **CONNECTED (gateway-backed)**

`customer-service.ts` + `app/api/customer/*`:
- Registration / guest auto-create: `findOrCreateCustomer` (`:46-66`).
- Login: `verifyCustomerPassword` **with Turnstile** (`:148-163`).
- Password reset request/confirm (`:99-129`); set-password (`:131-142`).
- Profile/status (`:72-93`), addresses (`storefront.customerAddresses` / `createCustomerAddress`), order history `customerOrders` (`:230-238`), wishlist CRUD + local sync (`:169-224`).
- Storefront customer API routes present: `api/customer/{register,login,logout,session,profile,addresses,orders,wishlist,set-password,check,auto-create}/route.ts`.
- Only the **admin** `getStoreCustomers` is a stub (`:253-255`) — that surface belongs to the merchant app, not the storefront.

**Verdict: storefront customer accounts are production-shaped and gateway-backed. CONNECTED.**

---

## 10. Search Certification — **ABSENT (NOT IMPLEMENTED)**

- `products/page.tsx` and `shop/page.tsx` read only `theme_preview_token` from `searchParams` — no `q`, no filter, no sort.
- No storefront search route, no search service call. `services/search-service` is reserved/not implemented (CLAUDE.md); a `SEARCH_QUEUE` exists for indexing but has no storefront consumer UI.

**Verdict: storefront product/collection search DOES NOT EXIST. This is a real gap.**

---

## 11. Domain Connectivity — **CONNECTED (provider-delegated SSL)**

- Custom-domain host routing, redirect-role 301, subdomain→primary 301 (`proxy.ts:24-25,259-285`).
- Gateway: `routes/custom-domains.ts`, `routes/domains.ts` (purchase), `lib/site-domains.ts`, `lib/vercel-domains.ts` (registration/SSL via Vercel), `lib/custom-domain-health.ts`, `routes/internal-custom-domain-reconcile.ts`.
- SSL/cert issuance is **delegated to the hosting provider** (Vercel domains); health is reconciled. (Corroborated by prior Domain Center research, `docs/v1/DOMAIN_CENTER_RESEARCH.md`.)

**Verdict: custom domains + primary domain + redirects CONNECTED; SSL provider-managed. CONNECTED (live cert issuance unverified here).**

---

## 12. Analytics Connectivity — **PARTIAL → mostly DISCONNECTED at the storefront edge**

- **The storefront runtime emits NO client behavioral analytics** — grep for `trackEvent|recordEvent|emitEvent|/events|/analytics|beacon|sendBeacon` across `apps/storefront-runtime/src` returns **nothing**. The only `console.log` is canary render telemetry (`composition-engine.tsx:405`, `event:'lb:canary:render'`).
- Server-side: a rich event/analytics layer exists in DB (`analytics_events`, `outbox_events`, `analytics_rollups_daily`, `mrr_arr_rollups`, RPCs `increment_analytics_rollup`, `append_distributed_event` — `domain-intel.json` analytics domain), and order/payment events flow server-side. There is gateway `storefront-session-analytics` test coverage.
- **All live analytics sources NOT CONNECTED** (`connections-intel.json`).

**Verdict: commerce/order analytics flow server-side; storefront traffic & funnel analytics (pageview/product-view/add-to-cart) are NOT emitted → merchant dashboard cannot show storefront funnel. PARTIAL.**

---

## 13. Theme Data Sources — inventory

Per-section data classification is in [THEME_ENGINE_CERTIFICATION.md §Per-Section Data Source Table](THEME_ENGINE_CERTIFICATION.md). Summary:
- **Store/theme/nav/appearance** → REAL DB via gateway (`store-service.ts:428-493`); merchant appearance (color/font/radius/logo) bridged in (`store-service.ts:576-605`, LB-9).
- **Products/collections** → REAL DB via gateway (§4, §5).
- **Section settings/blocks** → MERCHANT-CONFIGURED (editor → `theme_*` tables → release snapshot).
- **Fallbacks** → default registry theme template (real) and, when Liquid is on without a bundle, the **Urban Kicks demo Liquid fixture** (`store-service.ts:670-673`).

---

## 14. React Removal Certification — **HYBRID; React NOT removed (it is the default)**

This is the headline. Full inventory in [THEME_ENGINE_CERTIFICATION.md §React Inventory](THEME_ENGINE_CERTIFICATION.md). Evidence summary:
- Default engine = React (`theme-governance.ts:14`, `proxy.ts:175`).
- React section registry alive: `renderer-registry.tsx` maps `core.hero`, `core.product-grid`, `core.product-detail`, `core.featured-products`, `core.testimonials`, `core.newsletter`, `commerce.category-grid`, `commerce.brand-marquee`, `commerce.trust-badges`, `apps.app-block-slot`, … (~20 renderers); dispatch at `renderer-registry.tsx:268-272`.
- 19 React section components in `components/sections/*.tsx`; React layout chrome `layout.tsx:218,245`.
- React hydration islands for the Liquid path (`liquid-hydration-islands.tsx`, `use client`) and an editor preview frame (`editor-preview-section-frame.tsx`, `use client`).

**Verdict: the storefront is a Liquid-capable but React-default HYBRID. Liquid-only is FALSE.**

---

## 15. Mock & Fixture Audit — summary

Full inventory + risk in [STORE_FRONT_PRODUCTION_GAPS.md §Mock & Fixture Inventory](STORE_FRONT_PRODUCTION_GAPS.md). Headlines:
- `lib/demo/urban-kicks-demo.ts` (342 lines): hardcoded store + product catalog (`:17-185`) + reviews + store. Reachable only via `/demo` → `/preview` and demo-store reviews (`api/reviews/route.ts:52`, gated by `URBAN_KICKS_DEMO_STORE_ID`). **Isolated from real stores.**
- **Real-path fixture couplings (the actual risks):** default `themeId='urban-kicks'` (`store-service.ts:557`); Liquid-bundle demo fixture fallback (`store-service.ts:670-673`); cart line `stock:999` (`cart-context.tsx:92`); product `stock` default `999` (`product-service.ts:126`).
- `api/seed/route.ts:20` — **runtime seeding disabled** ("Runtime seed endpoint is disabled"). Not a risk.

---

## 16. Merchant ↔ Storefront Connectivity Matrix

Full matrix in [STOREFRONT_CONNECTIVITY_MATRIX.md](STOREFRONT_CONNECTIVITY_MATRIX.md). One-line roll-up:

| Feature | Status |
|---|---|
| Store / theme settings / appearance | CONNECTED |
| Products / variants / pricing / media | CONNECTED |
| Inventory enforcement (storefront read) | PARTIAL (999 default) |
| Collections | CONNECTED (no filter/sort) |
| Theme editor → publish → storefront | CONNECTED |
| Cart | CONNECTED (client totals) |
| Checkout / Razorpay / COD | CONNECTED (live unverified) |
| Orders / pipeline | CONNECTED |
| Customer accounts | CONNECTED |
| Custom domains / SSL | CONNECTED (provider SSL) |
| Search | DISCONNECTED (absent) |
| Storefront analytics / funnel | DISCONNECTED |
| Notifications (email) | CONNECTED (live-pending) |
| Liquid-only rendering | PARTIAL (off by default) |

---

## Bottom line

LetBuyy's storefront is a **genuinely built, gateway-backed commerce stack** that can run the full Product→…→Fulfillment chain — **through React**, with real data, a real canonical-ledger checkout, and a real visual theme editor. It is **not** a "production-ready Liquid storefront platform": Liquid is off by default, only one theme is Liquid-first, and key live integrations are unconnected. **To claim a Liquid storefront, see the build list in [STORE_FRONT_PRODUCTION_GAPS.md](STORE_FRONT_PRODUCTION_GAPS.md).**
