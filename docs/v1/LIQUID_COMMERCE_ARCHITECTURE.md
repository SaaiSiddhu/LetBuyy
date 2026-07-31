# Liquid Commerce Architecture (V2) — Phase 1 Runtime Map

**Type:** Research / design — **no implementation, no migration, no renderer removal.**
**Date:** 2026-06-16
**Method:** LCIS-first (`graphify-out/db-intel.json` routeRpc/routeTables, `domain-intel.json`) → source-verified (`file:line`). Shopify references are from its documented Liquid object model, labelled as such.
**Companion docs:** [LIQUID_CUSTOMER_SYSTEM.md](LIQUID_CUSTOMER_SYSTEM.md) · [LIQUID_CART_CHECKOUT_ARCHITECTURE.md](LIQUID_CART_CHECKOUT_ARCHITECTURE.md) · [LIQUID_SEARCH_DISCOVERY.md](LIQUID_SEARCH_DISCOVERY.md) · [LIQUID_THEME_COMPLETION.md](LIQUID_THEME_COMPLETION.md) · [LIQUID_100_PERCENT_PARITY_PLAN.md](LIQUID_100_PERCENT_PARITY_PLAN.md). Prior: [LIQUID_PARITY_AUDIT.md](LIQUID_PARITY_AUDIT.md).

---

## 0. The reframing insight (read first)

**The backend is not the gap. The Liquid presentation layer is.** The API Gateway already exposes a full commerce contract — customer CRUD, addresses, reviews, coupons, a tax-aware server cart, and canonical order/payment/fulfillment/refund RPCs. The storefront's React pages consume it; **Liquid does not, because the drops and route-wiring to feed Liquid don't exist.** V2 is overwhelmingly a *drop + route-wiring + island* effort, not a backend build. The two genuine backend gaps are **search** and **recommendations**.

---

## 1. End-to-end runtime map

```
Merchant App (merchant-control-plane)
  └─ /api/* proxies ───────────────► API Gateway (Hono, /v1)
Storefront Runtime (Next 16)              │
  proxy.ts (host→site)                    │
  store/[subdomain]/* pages ──────────────┤  storefront client (@letbuyy/api-client)
     │                                     │
     ├─ StoreService / ProductService ─────► storefront.ts / public-routes.ts
     ├─ Theme Engine (packages/theme-engine)│
     │    template-resolver ─► composition-engine
     │        ├─ Liquid: createThemeRenderer('liquid') + drops + islands
     │        └─ React: renderer-registry (default)
     ├─ Cart island/context ───────────────► storefront/cart-routes.ts (carts)
     ├─ Checkout client (React+Razorpay) ──► checkout.ts / checkout-payment-routes.ts
     │                                         └─ create_checkout_order RPC
     │                                         └─ confirm_order_payment_with_ledger RPC
     └─ Customer service ──────────────────► customer-registration.ts / customer-engagement-routes.ts
                                               └─ store_customers / customer_credentials / customer_addresses
```

---

## 2. Flow-by-flow map (route → API → RPC → tables → renderer)

### 2.1 Catalog (home / product / collection / products / shop)
| Layer | Detail |
|---|---|
| Storefront route | `store/[subdomain]/{page,product/[productId],collections/[slug],products,shop}/page.tsx` |
| Renderer | **Composition engine (Liquid-capable)** `composition-engine.tsx:390` |
| API | `storefront.getStore/listProducts/getProduct/getCollectionWithProducts/navigation` |
| Gateway route | `routes/storefront.ts`, `routes/storefront/public-routes.ts` |
| RPC | none (direct reads) |
| Tables | `products`, `product_variants`, `product_options`, `collections`, `collection_products`, `smart_collections`, `store_metafield_values` |
| Liquid status | **FULL** (sections + drops) |

### 2.2 Cart
| Layer | Detail |
|---|---|
| Storefront | React `cart/page.tsx` + `cart-context.tsx`; Liquid `lb-cart-drawer` island |
| API | `storefrontBrowserApiFetch('/cart' | '/cart/{token}', POST|PATCH)` |
| Gateway route | `routes/storefront/cart-routes.ts` — returns `{cart_token, lines, subtotal, discount_total, shipping_total, tax_total, total, coupon_codes}` (`cart-routes.ts:79-89`) |
| RPC | none (server cart projection) |
| Tables | `carts` (`items jsonb`, `coupon_code`, `customer_id`, `:8644`) |
| Liquid status | **PARTIAL** — drop is a shell (`composition-engine.tsx:279-288`); server totals ignored |

### 2.3 Checkout + Payment
| Layer | Detail |
|---|---|
| Storefront | React `checkout/page.tsx` → `checkout-client.tsx` (Razorpay SDK + COD) |
| API | `/api/orders` → `storefront.createOrder`; `/payments/razorpay/order`+`/verify` |
| Gateway route | `routes/checkout.ts`, `routes/storefront/checkout-payment-routes.ts`, `internal-payment-routes.ts` |
| RPC | `create_checkout_order` (`order-execution.adapter.ts:158`), `attach_order_payment_reference_with_ledger`, `confirm_order_payment_with_ledger`, `record_order_payment_failure_with_ledger` (`payment-execution.adapter.ts`) |
| Tables | `checkout_sessions`, `orders`, `order_items`, `order_line_adjustments`, `payment_transactions`, `payment_attempts`, `ledger_accounts/transactions/entries`, `payment_webhook_events` |
| Liquid status | **MISSING** — React-only; not in Liquid path |

### 2.4 Orders + Fulfillment + Returns/Refunds
| Layer | Detail |
|---|---|
| Storefront | React `account/orders`, `orders/page.tsx`; reads via `order-service.ts` |
| API | `storefront.orderContactSummary`, `customerOrders` |
| Gateway route | `routes/orders.ts`, `routes/returns.ts`, `routes/order-risk.ts` |
| RPC | `create_order_fulfillment`, `create_order_return_and_refund` (`order-execution.adapter.ts`), `complete_order_refund` (`returns.ts`), `restore_gift_card_on_refund` (`orders.ts`) |
| Tables | `orders`, `order_items`, `order_risk_assessments`, refund/payout ledger tables |
| Liquid status | **PARTIAL** — dormant Liquid order templates (`theme-bundle.ts:2195,2209`), no route/drop |

### 2.5 Customer (register / login / profile / addresses / wishlist)
| Layer | Detail |
|---|---|
| Storefront | React `account/*` + `customer-auth-context.tsx`; `customer-service.ts` |
| API | `storefront.findOrCreateCustomer/verifyCustomerPassword/customerByEmail/customerStatus/{request,confirm}CustomerPasswordReset/customerAddresses/{create,update,remove}CustomerAddress/updateCustomerProfile/customer{Wishlist,Orders}` |
| Gateway route | `routes/storefront/customer-registration.ts`, `customer-engagement-routes.ts`, `routes/customers.ts` |
| RPC | identity RPCs; credential checks |
| Tables | `store_customers` (`:12186`), `customer_credentials`, `customer_addresses` (`:8869`), `customer_wishlists` (`:8914`), `wishlists`, `customer_sessions` |
| Liquid status | **MISSING** — `customer: null` in Liquid drop (`composition-engine.tsx:337`) |

### 2.6 Reviews
| Layer | Detail |
|---|---|
| API | `storefront.productReviews` (read), `storefront.submitProductReview` (write) |
| Gateway route | `routes/storefront/customer-engagement-routes.ts` |
| Tables | `product_reviews` (`rating`, `title`, `body`, `images[]`, `is_verified`, `helpful_count`, `status`, `:10486`) |
| Liquid status | **MISSING** — no Liquid reviews section/drop |

### 2.7 Search & Discovery
| Layer | Detail |
|---|---|
| Storefront | none (island posts to `/shop?search=` which ignores the param) |
| Gateway route | **none** — every `/search` is domains/marketplace/admin, not catalog |
| Liquid status | **MISSING (backend + frontend)** |

---

## 3. Canonical RPC inventory (money-path; do NOT change — presentation only)

| RPC | Purpose | Caller |
|---|---|---|
| `create_checkout_order` | server-authoritative order + totals + inventory reserve | `order-execution.adapter.ts:158` |
| `attach_order_payment_reference_with_ledger` | bind Razorpay order to ledger | `payment-execution.adapter.ts` |
| `confirm_order_payment_with_ledger` | capture + ledger post (idempotent) | `payment-execution.adapter.ts` |
| `record_order_payment_failure_with_ledger` | failure path | `payment-execution.adapter.ts` |
| `create_order_fulfillment` | fulfillment | `order-execution.adapter.ts` |
| `create_order_return_and_refund` / `complete_order_refund` | returns/refunds | `order-execution.adapter.ts` / `returns.ts` |

**Rule (carried from canonical-ledger governance):** Liquid work must NOT touch these RPCs or write money tables in TS. Liquid is a **presentation layer** over the existing server-authoritative flows.

---

## 4. What this means for Liquid completion

| System | Backend exists? | Liquid drop exists? | Work type |
|---|:--:|:--:|---|
| Catalog | ✅ | ✅ | done |
| Cart | ✅ (tax-aware server cart) | 🟡 shell | **wiring** (surface server totals) |
| Checkout | ✅ (RPCs) | ❌ | **island + route** (presentation) |
| Orders/fulfillment | ✅ (RPCs) | ❌ | **drop + route** |
| Customer/addresses/wishlist | ✅ (full CRUD) | ❌ | **drop + islands + route** |
| Reviews | ✅ (read+write) | ❌ | **drop + section** |
| Search | ❌ | ❌ | **backend + drop + section** |
| Recommendations | ❌ | ❌ | **backend + drop + section** |

**Two real backend builds (search, recommendations); everything else is presentation wiring over an existing commerce backend.** Detailed designs follow in the companion docs.
