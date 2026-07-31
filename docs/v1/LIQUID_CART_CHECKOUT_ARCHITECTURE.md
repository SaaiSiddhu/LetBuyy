# Liquid Cart & Checkout Architecture (V2) — Phases 3 & 4

**Type:** Research / design — no implementation. **No billing changes. No payment rewrites. Presentation layer only.** **Date:** 2026-06-16.
Parent: [LIQUID_COMMERCE_ARCHITECTURE.md](LIQUID_COMMERCE_ARCHITECTURE.md).

---

## 1. Shopify reference

**Cart object (Liquid):** `cart.token, item_count, items[], items_subtotal_price, total_discount, total_price, original_total_price, cart_level_discount_applications, currency, note, attributes, requires_shipping`. **Shopify's cart carries NO tax/shipping** — those are computed at checkout. `line_item`: `id, key, product_id, variant_id, title, product_title, variant_title, quantity, price, line_price, final_price, final_line_price, image, url, sku, properties, discount_allocations`.

**Checkout:** **Shopify checkout is NOT Liquid.** Classic `checkout.liquid` is deprecated; modern checkout is a **hosted, server-controlled surface** customized via Checkout UI Extensions (web components/React), not theme Liquid. **A "100% Liquid storefront" in Shopify still has a non-Liquid checkout.**

**Takeaway:** the correct target is **a real Liquid `cart` drop + Liquid cart/checkout-shell templates, with the payment step as a controlled island** — exactly what preserves payment integrity.

---

## 2. LetBuyy cart — audit

### Exists (and is ahead of Shopify on tax)
- **Server cart endpoint** `routes/storefront/cart-routes.ts` returns `{cart_token, lines[ {…, line_total} ], subtotal, discount_total, shipping_total, tax_total, total, coupon_codes }` (`cart-routes.ts:79-89`). **The server already computes discount, shipping, and GST tax + supports coupon codes.**
- **`carts` table** (`:8644`): `items jsonb`, `coupon_code`, `customer_id`, `session_id`, `status(active|abandoned|converted|recovered)`, `abandoned_at`, `expires_at(+30d)`, recovery fields. So abandonment + recovery + customer linkage exist.
- React cart: `cart-context.tsx` (localStorage `lb_cart` + server sync `/cart` POST/PATCH).
- Liquid cart: `lb-cart-drawer` island (`liquid-hydration-islands.tsx:266`).

### Gaps (presentation only)
- **Both renderers ignore the server totals.** `cart-context.tsx:84-96` (`serverCartToItems`) reads only `lines`; client total `:241`. Liquid `collectLiquidCart` returns a **shell** (`item_count:0, browser_hydrated`) (`composition-engine.tsx:269-288`).
- Liquid cart line `variant_id: null` is sent to the server (`liquid-hydration-islands.tsx:81`) — variant not persisted server-side from Liquid.
- No full Liquid cart **page** route (cart page is React, not composition engine).

---

## 3. Designed Liquid `cart` drop (real, no shell)

Sourced from the existing server cart response — **no backend change**:

```liquid
cart = {
  token,                  // cart_token
  item_count,             // Σ line.quantity
  items: [ line_item ],   // server lines
  items_subtotal_price,   // subtotal       (cart-routes.ts:84)
  total_discount,         // discount_total  (:85)
  shipping_total,         // shipping_total  (:86)  ← LetBuyy advantage
  total_tax,              // tax_total       (:87)  ← GST, server-computed
  total_price,            // total           (:88)
  currency,               // 'INR'
  coupon_codes: [...],    // coupon_codes    (:89)
  customer_id,            // carts.customer_id (logged-in linkage)
  requires_shipping
}

line_item = {
  id, key,                // `${product_id}:${variant_id}`  (cart-routes.ts:142)
  product_id, variant_id,
  title,
  quantity,
  price,                  // unit_price
  line_price,             // line_total
  compare_at_price,
  image,                  // image_url / featured
  url,
  currency,
  properties              // selectedVariant
}
```

**Fixes folded in:** surface `total_tax`/`shipping_total`/`total_discount`/`coupon_codes` (already computed); propagate real `variant_id` from `lb-add-to-cart`/`lb-variant-picker` to the server cart (today `null`, `liquid-hydration-islands.tsx:81`).

**Cart page:** wire `cart/page.tsx` through the composition engine using the dormant Liquid `cart` template (`theme-bundle.ts:2149`) fed by this drop + a `lb-cart` island for quantity/remove/coupon (reusing the existing `/cart` PATCH + coupon endpoints).

---

## 4. LetBuyy checkout — audit

### Exists (server-authoritative; do not change)
- `checkout-client.tsx` (React + Razorpay SDK): COD (`:427`) and Razorpay (`:459-512`).
- Order: `/api/orders` → `storefront.createOrder` → `create_checkout_order` RPC (`order-execution.adapter.ts:158`) — **server recomputes totals/tax/shipping from DB; client amounts are never trusted.**
- Razorpay: `/payments/razorpay/order` (idempotent create) → widget → `/payments/razorpay/verify` (**HMAC signature verify, server-side**) with idempotency keys (`checkout-client.tsx:466-505`).
- Ledger: `attach_order_payment_reference_with_ledger` → `confirm_order_payment_with_ledger` (idempotent ledger post).

### Gap
- The entire checkout is a **React page outside the Liquid path**; the Liquid cart drawer just links to `/checkout` (`liquid-hydration-islands.tsx:347`).

---

## 5. Designed Liquid-driven checkout (presentation only, integrity preserved)

Mirror Shopify: **Liquid renders the checkout *shell*; the payment step is a controlled island that reuses the existing flow unchanged.**

```
Liquid `checkout` template (route-wired through composition engine)
  ├─ contact + shipping address form           → Liquid + address island (GST-aware)
  ├─ shipping method / order summary            → cart drop (§3)
  └─ <lb-checkout-payment> ISLAND               → REUSES checkout-client logic verbatim:
        COD:  createCheckoutOrder('cod')         → create_checkout_order RPC
        Razorpay: createCheckoutOrder('razorpay')→ /payments/razorpay/order (idempotent)
                  → Razorpay widget → /payments/razorpay/verify (HMAC, server)
                  → confirm_order_payment_with_ledger
```

**Invariants preserved (NON-NEGOTIABLE):**
- Server-authoritative amounts — `create_checkout_order` recomputes from DB; Liquid/island never sends trusted totals.
- HMAC signature verification stays server-side.
- Idempotency keys stay (`getIdempotencyKey`, `checkout-client.tsx:470,501`).
- No money table writes in TS; no RPC changes. Liquid/island is **pure presentation + the existing fetch calls.**

**Why an island, not raw Liquid:** the Razorpay SDK + payment state must stay in controlled JS (exactly as Shopify keeps checkout off Liquid). The island is the same code path that exists today, mounted inside a Liquid template instead of a React page.

---

## 6. Build checklist (cart + checkout)

| Item | Type | Backend work? |
|---|---|---|
| Real `cart` drop (totals/tax/shipping/coupons) | drop | **No** — already returned by `/cart` |
| `line_item` drop with `key`/`line_price` | drop | No |
| Propagate `variant_id` to server cart from Liquid | island fix | No |
| `lb-cart` island (qty/remove/coupon on cart page) | island | No (reuse `/cart` PATCH + coupon) |
| Cart page → composition engine + Liquid `cart` template | route+template | No |
| `lb-checkout-payment` island (wrap existing Razorpay/COD) | island | **No payment change** |
| Checkout template + route wiring | route+template | No |
| Address form island (GST validation) | island | No |

**Entire cart+checkout completion is presentation wiring over an already server-authoritative, tax-aware backend. Zero billing/payment/ledger changes.**
