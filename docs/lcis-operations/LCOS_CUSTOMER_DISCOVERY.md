# LCOS Customer Discovery

**Source artifacts:** `customer-intelligence.json`, `customer-journey-intelligence.json`
**Generated:** 2026-06-21 (artifacts dated 2026-06-14)
**Absent:** `customer-funnel.json`, `customer-retention.json` (do not exist in graphify-out)
**Reuse points:** `lcis-core` ArtifactStore, `lcis-governance` (drift), `lcis-live` (analytics_event_stream adapter)

---

## 1. Journey Structure — DETECTABLE

Source: `customer-journey-intelligence.json` → `stages`

The customer journey has **8 stages** with a canonical funnel sequence:

```
Landing → Product → Cart → Checkout → Payment → Order → Tracking → Refund
```

**Critical stages (per artifact):** Payment, Refund

**External dependencies across stages:**
- CDN/Vercel (Landing)
- SEARCH_QUEUE (Product)
- Shipping rate providers (Checkout)
- Razorpay HMAC (Payment)
- RUNTIME_QUEUE (Order)
- Resend + shipment events (Tracking)
- Razorpay refund + step-up HMAC (Refund)

### Stage-by-stage topology — DETECTABLE

| Stage | Domains | Risk | Money | Tables | RPCs | External deps | Failure points |
|---|---|---|---|---|---|---|---|
| Landing | storefront | low | no | 21 | 4 | CDN/Vercel | CDN/Vercel unavailability |
| Product | products, collections | low | no | 14 | 5 | SEARCH_QUEUE | SEARCH_QUEUE |
| Cart | orders | medium | **yes** | 10 | 12 | none | payment-provider failure |
| Checkout | orders, discounts, gst, shipping | high | **yes** | 37 | 16 | shipping rate providers | shipping provider, payment-provider failure |
| Payment | payments, gift-cards | **critical** | **yes** | 16 | 25 | Razorpay HMAC | Razorpay HMAC, money/ledger consistency |
| Order | orders, inventory | high | **yes** | 19 | 30 | RUNTIME_QUEUE | RUNTIME_QUEUE, payment-provider failure |
| Tracking | shipping, notifications | medium | **yes** | 25 | 7 | Resend, shipment events | Resend failure, shipment event gap |
| Refund | refunds | **critical** | **yes** | 7 | 2 | Razorpay refund + step-up | Razorpay refund, step-up HMAC, money/ledger consistency |

### Route groups per stage — DETECTABLE

| Stage | Route groups |
|---|---|
| Landing | blog, contacts, custom-domains, domains, form-submissions, pages, reviews, storefront/cart-routes, storefront/customer-engagement-routes, storefront/customer-registration, storefront/public-routes, stores-localization |
| Product | metafields, products, categories |
| Cart | checkout, orders |
| Checkout | checkout, coupons, marketing, order-risk, orders, shipping, shipping-labels, shipping-tax, tax |
| Payment | payments, storefront/checkout-payment-routes, storefront/internal-payment-routes, gift-cards, wallet |
| Order | checkout, order-risk, orders |
| Tracking | email, notifications, shipping, shipping-labels, shipping-tax, whatsapp |
| Refund | returns |

---

## 2. Customer Intelligence Graphs — DETECTABLE model, NOT_CONNECTED rates

Source: `customer-intelligence.json` → `graphs`

8 named graphs covering the full customer intelligence surface. All `value: "live-query-required"`.

### Graph inventory

| Graph | Metric | Source tables | Signal class |
|---|---|---|---|
| `funnel` | stage-to-stage conversion | `analytics_event_stream`, `analytics_events`, `carts`, `checkout_sessions`, `orders` | **NOT_CONNECTED** |
| `conversion` | sessions → orders ratio | `sessions`, `checkout_sessions`, `orders`, `store_customers` | **NOT_CONNECTED** |
| `refund` | orders → refunds rate per customer | `orders`, `refunds`, `refund_transactions`, `return_requests` | **NOT_CONNECTED** |
| `retention` | repeat purchase rate / cohort retention | `store_customers`, `orders`, `customer_activity_log` | **NOT_CONNECTED** |
| `risk` | customer fraud/risk score | `order_risk_assessments`, `risk_scores`, `risk_signals` | **NOT_CONNECTED** |
| `journey` | landing→payment→refund path | `analytics_event_stream`, `orders`, `shipments` | **NOT_CONNECTED** |
| `abandonment` | carts/checkouts not converted | `carts`, `checkout_sessions`, `customer_wishlists` | **NOT_CONNECTED** |
| `loyalty` | repeat + wishlist + gift-card balance | `store_customers`, `customer_wishlists`, `gift_card_accounts`, `product_reviews` | **NOT_CONNECTED** |

**All 8 graphs are structurally backed** (real source tables exist in `db-intel.json`).

---

## 3. Funnel — DETECTABLE model, NOT_CONNECTED rates

The funnel graph sources span both event-stream and transactional tables:

| Funnel level | Source | Signal class |
|---|---|---|
| Sessions (top of funnel) | `sessions` | NOT_CONNECTED — Supabase |
| Page views / product views | `analytics_event_stream` | NOT_CONNECTED — Supabase + Cloudflare Analytics Engine |
| Cart created | `carts` | NOT_CONNECTED — Supabase |
| Checkout initiated | `checkout_sessions` | NOT_CONNECTED — Supabase |
| Order placed | `orders` | NOT_CONNECTED — Supabase |
| Payment captured | `payment_transactions` | NOT_CONNECTED — Supabase |

**Stage dropoff metric for every stage:** `"live analytics (analytics_event_stream / funnel) — not in repo"` — uniform NOT_CONNECTED.

`analytics_event_stream` is the canonical live source for all funnel/conversion/dropoff metrics. It is not a Supabase table — it is a Cloudflare Analytics Engine stream (or equivalent). LCOS cannot read it without a live adapter wired to that provider.

---

## 4. Conversion — DETECTABLE model, NOT_CONNECTED rates

Source: `customer-intelligence.json` → `graphs.conversion`

| Metric | Source tables | Signal class |
|---|---|---|
| Session-to-order conversion % | `sessions`, `checkout_sessions`, `orders`, `store_customers` | NOT_CONNECTED |
| Guest vs. registered conversion | `store_customers`, `checkout_sessions` | NOT_CONNECTED |
| Payment method split (Razorpay vs COD) | `payment_transactions.method` | NOT_CONNECTED |

---

## 5. Abandonment — DETECTABLE model, NOT_CONNECTED rates

Source: `customer-intelligence.json` → `graphs.abandonment`

| Metric | Source tables | Signal class |
|---|---|---|
| Cart abandonment rate | `carts` not converted to `checkout_sessions` | NOT_CONNECTED |
| Checkout abandonment rate | `checkout_sessions` not converted to `orders` | NOT_CONNECTED |
| Wishlist-to-order rate | `customer_wishlists` → `orders` | NOT_CONNECTED |

No cart abandonment recovery system is implemented (noted in checkout research). These are observable signals only.

---

## 6. Retention — DETECTABLE model, NOT_CONNECTED rates

Source: `customer-intelligence.json` → `graphs.retention`

| Metric | Source tables | Signal class |
|---|---|---|
| Repeat purchase rate per `site_id` | `store_customers`, `orders` | NOT_CONNECTED |
| Cohort retention (month over month) | `store_customers`, `orders`, `customer_activity_log` | NOT_CONNECTED |

`customer_activity_log` is the canonical activity signal for retention cohort analysis.

---

## 7. Loyalty — DETECTABLE model, NOT_CONNECTED values

Source: `customer-intelligence.json` → `graphs.loyalty`

| Metric | Source tables | Signal class |
|---|---|---|
| Repeat customer flag | `store_customers`, `orders` | NOT_CONNECTED |
| Wishlist depth | `customer_wishlists` | NOT_CONNECTED |
| Gift-card balance held | `gift_card_accounts` | NOT_CONNECTED |
| Review count | `product_reviews` | NOT_CONNECTED |

---

## 8. Customer Risk — DETECTABLE model, NOT_CONNECTED scores

Source: `customer-intelligence.json` → `graphs.risk`

| Metric | Source tables | Signal class |
|---|---|---|
| Customer fraud/risk score | `order_risk_assessments`, `risk_scores`, `risk_signals` | NOT_CONNECTED |

Risk scoring shares the same `risk_scores` / `risk_signals` / `order_risk_assessments` chain as merchant-level risk (see `merchant-risk.json`). Customer scores are per-order, not per-customer-account.

---

## 9. Critical Payment Stage Deep Dive

Source: `customer-journey-intelligence.json` → `stages[Payment]`

The Payment stage is the highest-risk commerce step:

- **16 tables**, **25 RPCs** — highest RPC count of any stage
- **Failure points:** Razorpay HMAC verification failure, money/ledger consistency (double-entry balance check)
- **External dep:** Razorpay HMAC (`RAZORPAY_KEY_SECRET` env var)
- **Route groups:** `payments`, `storefront/checkout-payment-routes`, `storefront/internal-payment-routes`, `gift-cards`, `wallet`
- **Canonical RPC at this stage:** `confirm_order_payment_with_ledger` (see `LCOS_COMMERCE_DISCOVERY.md`)
- **Server-authoritative:** Razorpay signature verified server-side; totals/tax computed in RPC from DB; amounts never trusted from client

---

## 10. Critical Refund Stage Deep Dive

Source: `customer-journey-intelligence.json` → `stages[Refund]`

The Refund stage is the second critical stage:

- **7 tables**, **2 RPCs** (smallest RPC count, but both are canonical mutators)
- **Failure points:** Razorpay refund webhook, step-up HMAC, money/ledger consistency (ledger reversal must match original capture)
- **External dep:** Razorpay refund API + step-up HMAC (requires step-up token from `identity-platform`)
- **Route group:** `returns`
- **Canonical RPCs at this stage:**
  - `complete_order_refund` — ledger reversal
  - `restore_gift_card_on_refund` — gift-card balance restore
  - `create_order_return_and_refund` — full return + refund atomic path

---

## 11. Missing Artifacts Note

`customer-funnel.json` and `customer-retention.json` are **absent from graphify-out**. Their data is already subsumed by:

- `customer-intelligence.json` → `graphs.funnel` and `graphs.retention`
- `customer-journey-intelligence.json` → per-stage `dropoffMetric`

No gap — the domain is fully modeled across the two present files.

---

## 12. Signal Classification Summary

| Signal | Class | Exact source |
|---|---|---|
| Journey stage taxonomy (8 stages, names, sequence) | **DETECTABLE** | `customer-journey-intelligence.json` → `stages` |
| Stage domain/table/RPC counts | **DETECTABLE** | same |
| Stage failure points and external deps | **DETECTABLE** | same |
| Route group → stage mapping | **DETECTABLE** | same |
| 8 customer intelligence graph models (metric + source tables) | **DETECTABLE** | `customer-intelligence.json` → `graphs` |
| `analytics_event_stream` as canonical funnel source | **DETECTABLE** | both artifacts, `liveDataNote` |
| Funnel conversion rates (landing → order) | **NOT_CONNECTED** | `analytics_event_stream` — Cloudflare Analytics Engine / Supabase |
| Session-to-order conversion % | **NOT_CONNECTED** | `sessions`, `checkout_sessions`, `orders` — Supabase |
| Cart abandonment rate | **NOT_CONNECTED** | `carts`, `checkout_sessions` — Supabase |
| Checkout abandonment rate | **NOT_CONNECTED** | `checkout_sessions` — Supabase |
| Repeat purchase rate / cohort retention | **NOT_CONNECTED** | `store_customers`, `orders`, `customer_activity_log` — Supabase |
| Customer fraud/risk scores | **NOT_CONNECTED** | `risk_scores`, `order_risk_assessments` — Supabase |
| Loyalty metrics (wishlist, gift-card balance, reviews) | **NOT_CONNECTED** | `customer_wishlists`, `gift_card_accounts`, `product_reviews` — Supabase |
| Stage dropoff rates | **NOT_CONNECTED** | `analytics_event_stream` — not in repo; requires live adapter |
| Cart abandonment recovery | **NOT IMPLEMENTED** | No system exists (noted in checkout research) |

---

## 13. Reuse Points

| Layer | Asset | What LCOS hooks into |
|---|---|---|
| `lcis-core` | `ArtifactStore` | Load `customer-intelligence.json` + `customer-journey-intelligence.json` at boot |
| `lcis-core` | `BlastRadiusService` | `blast("checkout_sessions")` → Payment + Order + Abandonment graph |
| `lcis-execution` | Change plans | PRs touching Payment/Refund stage → auto-generate test + rollback plan |
| `lcis-governance` | R004 (external dep coverage) | Enumerate 7 external deps across 8 stages; flag missing circuit-breakers |
| `lcis-live` | Cloudflare Analytics Engine adapter | Wire `CF_ANALYTICS_API_TOKEN` + `CF_ACCOUNT_ID` → connect `analytics_event_stream` → unlock all 8 funnel rates |
| `lcis-live` | Supabase adapter | Wire `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → connect conversion/retention/abandonment/loyalty |
