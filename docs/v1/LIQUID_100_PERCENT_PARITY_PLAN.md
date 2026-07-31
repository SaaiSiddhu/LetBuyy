# Liquid 100% Parity Plan (V2) — Final Verdict

**Type:** Research / design — **no implementation. Research only.** **Date:** 2026-06-16.
**Companion docs:** [LIQUID_COMMERCE_ARCHITECTURE.md](LIQUID_COMMERCE_ARCHITECTURE.md) · [LIQUID_CUSTOMER_SYSTEM.md](LIQUID_CUSTOMER_SYSTEM.md) · [LIQUID_CART_CHECKOUT_ARCHITECTURE.md](LIQUID_CART_CHECKOUT_ARCHITECTURE.md) · [LIQUID_SEARCH_DISCOVERY.md](LIQUID_SEARCH_DISCOVERY.md) · [LIQUID_THEME_COMPLETION.md](LIQUID_THEME_COMPLETION.md). Prior: [LIQUID_PARITY_AUDIT.md](LIQUID_PARITY_AUDIT.md).

---

## 1. Final verdict

> **Liquid storefront presentation parity ≈ 40% complete; ≈ 60% remains.**
> **But the underlying commerce backend is ≈ 90% complete** — so of the remaining 60%, roughly **50 points are presentation wiring** (drops + islands + templates + route-wiring over an existing, server-authoritative backend) and only **~10 points are net-new backend** (catalog search, an analytics events endpoint, recommendations).

**React still cannot be removed** — it owns checkout, cart, accounts, orders, wishlist, reviews, blog, and CMS at the presentation layer. **But the path is far shorter than the 38% number implies, because the backend already exists.**

### The single most important V2 finding
The API Gateway already exposes the full commerce contract — customer CRUD, addresses (GST-aware), reviews (read+write), a **tax-aware server cart** (`subtotal/discount/shipping/tax/total/coupons`, `cart-routes.ts:79-89`), and canonical order/payment/fulfillment/refund RPCs. **LetBuyy's Liquid gap is a presentation gap, not a commerce-engine gap.**

---

## 2. Completion by system (evidence-backed)

| System | Backend | Liquid presentation | System % | Remaining work | Backend build? |
|---|:--:|:--:|:--:|---|:--:|
| Catalog (home/product/collection) | ✅ | ✅ | **80%** | default flip + per-theme bundles | No |
| Localization | ✅ | ✅ (`t` + tables) | **90%** | per-theme strings | No |
| Cart | ✅ (tax-aware) | 🟡 shell | **45%** | real `cart` drop + page route + variant_id fix | No |
| Checkout | ✅ (RPCs) | ❌ | **30%** | `lb-checkout-payment` island + template route | No |
| Customer/account/addresses | ✅ (full CRUD) | ❌ `customer:null` | **30%** | `customer` drop + auth island + account routes | No |
| Orders/fulfillment/refunds | ✅ (RPCs) | ❌ | **30%** | order drop + account/order routes | No |
| Wishlist | ✅ | ❌ | **30%** | `customer.wishlist` drop + toggle island + route | No |
| Reviews | ✅ (read+write) | ❌ | **25%** | reviews drop + section + form island | No |
| CMS / blog / policies | ✅ (data + `ContentService`) | ❌ | **30%** | page/blog/article/policy templates + drops + routes | No |
| Collection filter/sort/pagination | 🟡 (data) | ❌ | **15%** | filter drops + section | partial |
| **Search** | ❌ | ❌ | **5%** | search endpoint + index + drops + template | **YES** |
| **Analytics funnel** | 🟡 (server events) | ❌ (no client emit) | **10%** | events endpoint + `lb-analytics` beacon | **YES** |
| **Recommendations** | ❌ | ❌ | **0%** | recommendation engine + drop + section | **YES** |

**Weighted storefront presentation parity ≈ 40%.** **Backend completeness ≈ 90%** (only search/analytics-events/recommendations are net-new).

---

## 3. Exact systems to build before React removal

### 🔴 React-removal BLOCKERS (React currently owns these surfaces)
Presentation-only (no backend build) unless marked:
1. **Cart** — real `cart` drop (surface existing `tax_total`/`shipping_total`/`coupon_codes`), cart page route, `variant_id` propagation. → [cart-checkout doc §3](LIQUID_CART_CHECKOUT_ARCHITECTURE.md)
2. **Checkout** — `lb-checkout-payment` island wrapping the existing Razorpay/COD flow **unchanged** + checkout template route. **No payment/ledger/idempotency changes.** → [cart-checkout doc §5](LIQUID_CART_CHECKOUT_ARCHITECTURE.md)
3. **Customer + auth** — `customer` drop (from session), `lb-customer-auth` island, account templates + routes. → [customer doc §3-5](LIQUID_CUSTOMER_SYSTEM.md)
4. **Orders** — order drop (line_items/fulfillments/payments/refunds), account/order routes. → [theme-completion doc A](LIQUID_THEME_COMPLETION.md)
5. **Wishlist** — `customer.wishlist` drop + `lb-wishlist-toggle` island + route. → [customer doc §4](LIQUID_CUSTOMER_SYSTEM.md)
6. **Reviews** — `product.reviews/rating/review_count` drops + section + form island. → [search-discovery doc B](LIQUID_SEARCH_DISCOVERY.md)
7. **CMS / blog / policies** — page/blog/article/policy templates + content drops + route-wiring. → [theme-completion doc B](LIQUID_THEME_COMPLETION.md)
8. **Per-theme coverage** — author required templates for **every** theme, add a **theme-contract validator**, **remove the demo-fixture fallback** (`store-service.ts:670-673`) and `'urban-kicks'` default (`:557`). → [theme-completion doc C](LIQUID_THEME_COMPLETION.md)

### 🟠 Platform-completeness gaps (missing in BOTH renderers — not strictly React-removal blockers, but required for a complete Liquid commerce platform)
9. **Search** — **backend** endpoint + index + drops + template. → [search-discovery doc A](LIQUID_SEARCH_DISCOVERY.md)
10. **Collection filter/sort/pagination** — filter data + drops + section.
11. **Analytics funnel** — **backend** events endpoint + `lb-analytics` beacon (makes funnels CONNECTED). → [search-discovery doc C](LIQUID_SEARCH_DISCOVERY.md)
12. **Recommendations** — **backend** engine + drop + section.

### Net-new backend builds (only three): **search, analytics events endpoint, recommendations.** Everything else is presentation + validation over the existing backend.

---

## 4. Sequencing (extends the V1 5-phase plan — no direct deletion)

| Stage | Goal | Scope | Exit |
|---|---|---|---|
| **1a. Drop layer** | Feed Liquid real data | Build `customer`, real `cart`, `order`, `product.reviews`, `wishlist` drops; session resolve in composition engine | drops populated; 0 `customer:null` for authed |
| **1b. Island layer** | Interactivity parity | `lb-checkout-payment`, `lb-customer-auth`, `lb-wishlist-toggle`, `lb-review-form`, `lb-cart`, `lb-analytics`; variant_id fix | islands functional |
| **1c. Route wiring** | Surfaces render Liquid | Route cart/checkout/account/orders/blog/CMS/policy/search through composition engine | every surface has a Liquid path |
| **1d. Backend builds** | Close net-new gaps | search endpoint+index, analytics events endpoint, recommendations | search/analytics/recs live |
| **1e. Theme contract** | No special-casing | required-template validator; author per-theme templates; remove demo fallback | every theme passes contract |
| **2. Shadow** | Prove parity | shadow Liquid vs React on real traffic; synthetic end-to-end incl. checkout/order (needs live Razorpay/Supabase — prior NO-GO gate) | parity diff < threshold |
| **3. Liquid default** | Flip default | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=true` staged by theme | sustained no-regression |
| **4. Fallback off** | Stop React renders | `renderLiquidPlan==null` → error, not React fallback (`composition-engine.tsx:426`) | zero React renders in telemetry |
| **5. React deletion** | Remove renderers | delete registry/components/contexts/React pages; **keep** islands + editor | Liquid-only build green |

---

## 5. Guardrails (carried from governance + prior audits)

- **Money paths untouched:** no changes to `create_checkout_order`, `confirm_order_payment_with_ledger`, signature verify, idempotency, or money-table writes. Checkout/orders are **presentation over existing RPCs**.
- **Liquid islands are not deletion targets** — they are the Liquid interactivity runtime (`liquid-hydration-islands.tsx`).
- **Editor/preview stay React** (merchant tooling); preview already renders Liquid (`preview/page.tsx:370`).
- **No mocks/fixtures/demo dependencies** in the completed surfaces — remove the demo-bundle fallback; demo store stays isolated to `/preview`.
- **Live readiness gate** (Razorpay/Supabase/Resend connected + load tests; prior **NO-GO**) must close before Stage 2 can be *proven*, not just coded.

---

## 6. One-paragraph answer

**Liquid is ~40% complete as a storefront presentation layer and ~90% complete as a commerce backend.** React still owns checkout, cart, accounts, orders, wishlist, reviews, blog, and CMS — so it cannot be removed yet — but the remaining work is overwhelmingly **presentation wiring** (drops + hydration islands + Liquid templates + route-wiring) over an already server-authoritative, GST/tax-aware, ledger-backed commerce engine. Only **three net-new backend builds** remain: catalog **search**, an **analytics events endpoint**, and **recommendations**. Build the drop/island/route/template layer (Stage 1), prove parity by shadowing (Stage 2), default to Liquid (Stage 3), disable the React fallback (Stage 4), and only then delete React (Stage 5) — never a direct deletion, and never a change to the payment/ledger paths.
