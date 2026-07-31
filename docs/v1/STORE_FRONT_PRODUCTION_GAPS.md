# Storefront Production Gaps (V1)

**Type:** Research / certification — no code changes, no fixes applied. **Date:** 2026-06-16.
Parent: [STOREFRONT_CERTIFICATION_AUDIT.md](STOREFRONT_CERTIFICATION_AUDIT.md) · [THEME_ENGINE_CERTIFICATION.md](THEME_ENGINE_CERTIFICATION.md) · [STOREFRONT_CONNECTIVITY_MATRIX.md](STOREFRONT_CONNECTIVITY_MATRIX.md).

> Everything below is a finding to be triaged, **not** an instruction that was executed. The 107 deterministic governance validators remain authoritative; these are heuristic/structural findings.

---

## 1. Severity-ranked gaps

### 🔴 Blocker for a "Liquid-only" claim (architecture)
| # | Gap | Evidence | Why it blocks the claim |
|---|---|---|---|
| B1 | Liquid rendering is **OFF by default** | `packages/theme-engine/src/theme-governance.ts:14` (`= false`); `apps/storefront-runtime/src/proxy.ts:175` | The production default renderer is React, not Liquid |
| B2 | **React not removed** — full React registry + chrome is the live default | `lib/theme-engine/renderer-registry.tsx`; `app/store/[subdomain]/layout.tsx:218,245` | "React storefront removed" is false |
| B3 | **Only one Liquid theme** ships a bundle | commit `742192cf`; `resolveLiquidBundle` returns `undefined` → React `template-resolver.ts:110-125` | Other stores can't be Liquid even if enabled |
| B4 | Liquid fallback is the **demo fixture bundle** | `apps/storefront-runtime/src/lib/store-service.ts:670-673` | A real store with Liquid-on but no bundle renders the demo theme |

### 🟠 Major functional gaps (independent of Liquid)
| # | Gap | Evidence | Impact |
|---|---|---|---|
| M1 | **No storefront search** | `products/page.tsx`, `shop/page.tsx` (only read `theme_preview_token`); `services/search-service` reserved | Shoppers cannot search a catalog |
| M2 | **No collection filter/sort** | `collections/[slug]/page.tsx` lists products only | Poor catalog UX at scale |
| M3 | **No storefront client analytics / funnel** | grep `trackEvent\|beacon\|sendBeacon\|/analytics` in `apps/storefront-runtime/src` = empty; only `composition-engine.tsx:405` canary log | Merchant dashboard has no traffic/funnel data |
| M4 | **Inventory not enforced at storefront read** | `product-service.ts:126` (`stock ?? 999`); `cart-context.tsx:92` (`stock: 999`) | Out-of-stock can appear buyable until the order RPC rejects |
| M5 | **Cart shows no tax/shipping** before checkout | `cart-context.tsx:241` (raw `price*qty`) | No GST/total transparency at cart (computed server-side at order) |

### 🟡 Minor / watch-items
| # | Item | Evidence | Note |
|---|---|---|---|
| W1 | Non-canonical `local-fallback` publish path | `services/api-gateway/src/execution/theme-execution.adapter.ts:695,807` | Publishes a release without `publish_theme_release` RPC on RPC error |
| W2 | Admin `getStoreCustomers` stubbed in storefront lib | `apps/storefront-runtime/src/lib/customer-service.ts:253-255` | Returns empty; belongs to merchant app surface |
| W3 | `order-service` reads that `throw` | `apps/storefront-runtime/src/lib/order-service.ts:15,48,57` | Intentional (gateway-owned), but will hard-error if mis-called |
| W4 | Stripe / PayPal deferred | `checkout/success/page.tsx:1`; `paypal-return` route present | V1 = Razorpay + COD only (LB-2) |
| W5 | Default `themeId = 'urban-kicks'` | `store-service.ts:557` | Demo theme is the platform default identity |

---

## 2. Mock & Fixture Inventory (full sweep)

| Artifact | File:line | Reachability | Production risk |
|---|---|---|---|
| Urban Kicks demo store/catalog/reviews (342 lines, hardcoded) | `apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts:17-185,240-263` | `/demo/urban-kicks` → `/preview`; demo-store reviews only | LOW — isolated from real subdomains |
| `/demo/urban-kicks` route | `app/demo/urban-kicks/page.tsx:5` (redirects to `/preview`) | Public route | LOW — preview surface |
| `/preview` demo path | `app/preview/page.tsx:265-286` (`useDemoStore`) | Public preview | LOW — explicit preview |
| Reviews → demo branch | `app/api/reviews/route.ts:52` (gated by `URBAN_KICKS_DEMO_STORE_ID`) | Only demo store id | LOW — gated |
| **Liquid bundle demo-fixture fallback** | `store-service.ts:670-673` | **Real store, Liquid-on, no bundle** | 🟠 MEDIUM — real-path fixture |
| **Default themeId `'urban-kicks'`** | `store-service.ts:557` | All themeless stores | 🟡 LOW–MED — demo identity as default |
| Default theme template fallback (registry, not demo) | `store-service.ts:559-573`; `theme-registry.ts:574` | Non-renderable templates | LOW — real default theme |
| `stock: 999` cart/product defaults | `cart-context.tsx:92`; `product-service.ts:126` | Real path | 🟠 MEDIUM — masks inventory |
| `api/seed` route | `app/api/seed/route.ts:20` | Disabled ("Runtime seed endpoint is disabled") | NONE — safe no-op |
| `UnknownSectionFallback` placeholder text | `renderer-registry.tsx:243-265` | Unmapped section type | LOW — visible graceful fallback |

**No** `Math.random`/lorem-ipsum product generators, hardcoded order totals, or fake payment confirmations were found in the real (non-demo) path. Checkout/payment are server-authoritative.

---

## 3. Live-readiness gate (separate from structural)

`graphify-out/connections-intel.json` → **0 of 13 connected**, all "NOT CONNECTED" because secrets are deploy-time:
- Razorpay (`RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`) — checkout cannot be runtime-verified here.
- Supabase (`SUPABASE_DB_URL/SERVICE_ROLE_KEY`) — all gateway reads/writes runtime-unverified.
- Resend (`RESEND_API_KEY`) — order/confirmation email won't send.
- Turnstile (`TURNSTILE_SECRET_KEY`) — login/registration challenge.
- Upstash, Cloudflare Analytics Engine/Queues/R2/Hyperdrive — telemetry/rate-limit.

`graphify-out/production-readiness-v2.json` → overall **98 structural** but **launchVerdict = `NO-GO`**, 5 open blockers. **Structural completeness ≠ launch readiness.**

---

## 4. Build list — to honestly claim a production-ready Liquid storefront

**Phase 1 — Liquid parity (unblocks B1–B4):**
1. Author/compile Liquid bundles for **all** shipped themes (not just Urban Kicks).
2. Replace the demo-fixture Liquid fallback (`store-service.ts:670-673`) with the store's real bundle or a hard "theme misconfigured" error.
3. Build React↔Liquid **parity tests** (product, collection, cart island, checkout entry, header/footer chrome).
4. Flip `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` to `true` **only after** 1–3, per-theme canary first.
5. Decide the fate of the React registry (retire vs keep as fallback) — it is currently the default and must not be deleted before parity.

**Phase 2 — functional completeness (M1–M5):**
6. Storefront **search** (wire `search-service` or a gateway search endpoint + UI).
7. Collection **filter/sort**.
8. Storefront **analytics emission** (pageview/product-view/add-to-cart/purchase → EVENT_QUEUE → `analytics_events`/rollups → merchant dashboard).
9. Real **inventory** at read (remove `999` defaults; surface out-of-stock).
10. **Tax/shipping preview** in cart (server estimate) for total transparency.

**Phase 3 — live readiness (the NO-GO):**
11. Connect Razorpay/Supabase/Resend/Turnstile via deploy secrets; run a **live** checkout→order→email→refund smoke test.
12. Load tests + telemetry ingestion (close the LCIS launch blockers).
13. Audit `local-fallback` publish path (W1) — confirm it cannot bypass governance for theme releases.

**Phase 4 — verification this audit could not do (no running env):**
14. Browser render of a real store (React and Liquid), order placement, Razorpay capture, email receipt, rollback — to convert every "CONNECTED (code path)" into "CONNECTED (runtime-proven)".

---

## 5. One-paragraph honest summary

The storefront stack is **substantially real**: a gateway-backed runtime, real products/collections/customers/orders, a server-authoritative Razorpay+COD checkout on the canonical ledger RPC, custom domains, and a genuine schema-driven theme editor with draft/preview/publish/rollback. It is **not** a Liquid-only platform — Liquid is built and works but is **off by default**, only one theme is Liquid-first, and the production fallback is a demo fixture. The gaps that matter for launch are: the Liquid-default decision + per-theme bundles (B1–B4), missing search/filter/analytics (M1–M3), inventory/tax presentation (M4–M5), and the fact that **no live integration is connected**, so nothing is runtime-proven yet (NO-GO). Close Phases 1–4 and the "production-ready Liquid storefront" claim becomes defensible.
