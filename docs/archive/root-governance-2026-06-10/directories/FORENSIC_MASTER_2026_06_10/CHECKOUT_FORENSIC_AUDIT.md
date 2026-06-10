# PHASE 5 — CHECKOUT FORENSIC AUDIT

**Repo:** `Letbuyy_Store` | **Audit date:** 2026-06-10
**Auditor:** Commerce-systems forensic auditor (Shopify-checkout-team grade), code-only working-tree analysis
**Scope:** `services/api-gateway/src/routes/{checkout,orders,inventory,coupons,returns,storefront/*}.ts`, `services/api-gateway/src/execution/{order,payment,idempotency}-execution.adapter.ts`, `services/api-gateway/src/extensions/app-functions-runtime.ts`, `packages/checkout-core`, `packages/commerce-core`, `apps/storefront-runtime/src/context/cart-context.tsx`, and the money-bearing SQL in `database/supabase/migrations/{000_baseline,141_executable_inventory_reservations}.sql`.
**Baseline constitution:** `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` §9, §3 (server-authoritative cart; signed `checkout_url` handoff; in-process checkout-session state machine in api-gateway; hosted `checkout.letbuyy.com` single re-validating origin; idempotent confirm; oversell-proof FOR UPDATE / version-CAS inventory; orders created ONLY via this flow; 3-class discount `combines_with`; branding tokens = data never code).
**Companion docs read:** `FORENSIC_MASTER_2026_06_10/DATABASE_FORENSIC_AUDIT.md` (Phase 7); prior Phase 2 hosted-checkout/extension findings.

### Methodology

1. Traced the full path: add-to-cart → server cart mutation → checkout-url signing → handoff verify → contact/delivery/payment-intent → confirm → `create_checkout_order` RPC → `create_order_with_inventory_reservations` → inventory decrement + order insert → payment capture. Every claim cites `file:line` with quoted code.
2. Re-verified Phase 2's three hypotheses (hosted origin missing; extensions execute in the live order route; reservation sweeper DDL-real but wiring-dead) and Phase 7's money facts against the current working tree.
3. Concurrency claims are reasoned from the exact SQL locking primitives present in the function bodies (`FOR UPDATE`, `FOR UPDATE OF`, `ON CONFLICT`, `SKIP LOCKED`). Where a race depends on live DB transaction-isolation behaviour that cannot be proven from code alone, it is marked **UNVERIFIED**.
4. Severities: **S0** catastrophic (money loss / mass oversell, trivially exploitable), **S1** high (money/inventory integrity, plausible exploit), **S2** medium, **S3** low/hardening.

---

## 1. Executive Verdict

The checkout money-core is materially stronger than the surrounding governance theatre suggests. **Every order-creation entry point funnels through one SECURITY DEFINER RPC (`create_checkout_order` → `create_order_with_inventory_reservations`) that computes price server-side from the `products`/`product_variants` tables, checks stock under a `FOR UPDATE` row lock, and dedupes by idempotency key.** Price forgery, order-creation bypass, and naive oversell are therefore closed on the primary path. The defects that remain are real but narrower: a signed `checkout_url` that does not bind cart contents, a TTL reservation sweeper that no scheduler ever runs, a refund path that never touches the ledger, a merchant order-edit route that adds line items without reserving inventory, a 32-bit integer-minor money column family that overflows at ~₹2.14 crore, and a hosted `checkout.letbuyy.com` origin that still does not exist.

| # | Question | Verdict | Severity |
|---|---|---|---|
| 1 | Can checkout be **FORGED** (client dictates price/total)? | **NO** for price/line-total/subtotal (server-computed in the RPC). **PARTIAL YES** — the signed `checkout_url` does not bind cart contents, so a cart can be mutated after signing within the 10-min window. | S2 |
| 2 | Can inventory **OVERSELL** on the confirm path? | **NO** on the live RPC path (decrement is under `FOR UPDATE OF il`, last-unit race has exactly one winner). **YES** via the merchant `PATCH /orders/:id/line-items` add-items route (no reservation) and via the dead TTL sweeper allowing reservation-leak starvation. | S1 |
| 3 | Can orders **DUPLICATE**? | **NO** — confirm is idempotent at three layers (HTTP idempotency claim, checkout-session unique key, RPC early-return on existing `order_id`). | — |
| 4 | Can pricing be **MANIPULATED**? | **NO** for line price/qty/currency. **MINOR YES** — 32-bit integer-minor overflow on legacy money columns; fixed-discount-vs-reduced-subtotal recompute on order edit; gift-card precision split. | S1/S2 |
| 5 | Can coupons **BYPASS** validation? | **NO** under concurrency — usage-limit / per-customer checks run under `FOR UPDATE` on the coupon/promotion-code row and the redemption insert is `ON CONFLICT … DO NOTHING`. Confirm re-validates only coupon *existence/active*, not the full re-evaluation, but the authoritative RPC re-runs `evaluate_checkout_promotion` at order time. | S3 |
| 6 | Can **RACE CONDITIONS** occur? | **YES (bounded)** — reservation-TTL-vs-confirm and abandoned-cart-vs-active-checkout windows exist; last-unit oversell and coupon over-use are closed by row locks. | S2 |

**Is the cart server-authoritative?** **YES** — the storefront server cart (`carts` table) hydrates unit prices from the DB on every mutation (`cart-routes.ts:259`, `hydrateCartLines`), and confirm reads server cart lines, never client totals. A legacy client-only React cart (`cart-context.tsx`) still exists and computes `cartTotal` locally, but it round-trips to the server and the server value wins; the server never trusts the client total.

**Can orders be created outside the checkout flow?** **NO.** All four creation routes (admin `POST /orders`, draft convert, storefront `POST /:subdomain/orders`, hosted-checkout confirm) call `OrderExecutionAdapter.createOrder` → the inventory-safe RPC. There is no direct `INSERT INTO orders` anywhere in the route/adapter layer outside that RPC (verified by grep: every `from('orders')` in routes/adapters is SELECT/UPDATE, never INSERT).

**Is the checkout-session a real guarded state machine?** **YES** — `planCheckoutStateTransition` (`checkout-core/src/index.ts:147`) enforces monotonic forward-only `contact→delivery→payment_intent→confirming→completed/failed` and blocks terminal re-entry; a client cannot jump straight to `confirm` because `confirm` itself revalidates and the RPC requires the session row. **But** non-COD confirm requires only the *presence* of a `provider_payment_id` string + a server-side provider verify (it does call `PaymentExecutionAdapter.confirmPayment`); in `mode:'mock'/'sandbox'` the payment intent is a self-minted UUID, so payment authenticity in non-production is asserted, not proven (production live mode is gated `503` HUMAN-REQUIRED).

**Composite checkout verdict: 3.3/5** — sound centralized money-core, decorative tenancy (service_role, GUC never set), missing hosted origin, dead sweeper, unledgered refunds, and an order-edit inventory hole.

---

## 2. End-to-End Checkout Flow Trace (file:line per stage)

| Stage | Where | Behaviour / Evidence |
|---|---|---|
| **Add to cart (client)** | `apps/storefront-runtime/src/context/cart-context.tsx:172` (`addToCart`) | Client React state only; `cartTotal` computed locally (`:197`). Synced to server (`syncCartToServer`, `:123`). Client total is display-only. |
| **Server cart mutation** | `services/api-gateway/src/routes/storefront/cart-routes.ts:445` (`POST /:subdomain/cart`), `:472` (PATCH) → `persistCart :383` → `hydrateCartLines :212` | Client sends `{product_id, variant_id, quantity, properties}` only. Server fetches products and sets `unit_price = numberValue(product.price)` (`:259`), `line_total = unitPrice * quantity` (`:274`). **Client cannot set price.** Coupon stored as `coupon_code` text only (`:400`). |
| **Email capture / abandonment** | `cart-routes.ts:428` (`cart.email_captured`), `:339` (`enqueueAbandonmentCheck`) | Emits domain events with `subtotal_minor` (`:331`); enqueues `cart.abandonment_check` (+1h) on `platform_queue_jobs`. Channel + buyer_email carried (V1 §9 satisfied). |
| **Signed checkout_url** | `cart-routes.ts:527` (`GET /:subdomain/cart/:cartToken/checkout-url`) | Builds `https://checkout.{domain}/checkout?site_id&cart_id&cart_token&channel&expires_at&signature`. Signature = `hmacSha256Hex(secret, "${store.id}:${cart.id}:${cart.cart_token}:${cart.channel}:${expiresAt}")` (`:546-547`). Expiry +10 min (`:545`). **Signature does NOT include cart items/subtotal.** |
| **Handoff verify** | `services/api-gateway/src/routes/checkout.ts:219` (`verifyCheckoutHandoff`) | Recomputes the same HMAC (`:245`), `timingSafeEqualHex` (`:246`), checks expiry (`:233-235`), loads cart by `(id, store_id, session_id=cart_token)` (`:251-258`). Verification correct; binding incomplete (see CHK-001). |
| **State machine** | `checkout.ts:315` (`persistCheckoutStep`) → `planCheckoutStateTransition` (`checkout-core/src/index.ts:147`) | Forward-only monotonic order (`CHECKOUT_STATE_ORDER`, `:136`); terminal states block re-entry (`:153`). Each step idempotent via `runIdempotentStep` (`checkout.ts:426`). |
| **Contact** | `checkout.ts:461` | Persists email/name/phone/gstin; emits `checkout.started`. |
| **Delivery** | `checkout.ts:487` | Persists shipping method/address/quote. |
| **Payment intent** | `checkout.ts:507` | `mode:'live'` → `503` HUMAN-REQUIRED (`:513-517`). Mock/sandbox mints `payment_intent_id = "${provider}_${mode}_${uuid}"` (`:521`). |
| **Confirm** | `checkout.ts:538` | Re-validates inputs (`revalidateConfirmInputs :359`), requires `provider_payment_id` for non-COD (`:578`), creates order via RPC (`:620`), captures payment for non-COD (`:628`), marks session `completed`, flips cart `converted` (`:653`). Idempotent (CHK-009). |
| **Order create (authoritative)** | `order-execution.adapter.ts:146` (`createOrder`) → `db.rpc('create_checkout_order', …)` (`:151`) | The single money-core. Server price + inventory + discount + idempotency. |
| **RPC core** | `create_checkout_order` (`000_baseline.sql:1716`) → `create_order_with_inventory_reservations` (`:3265`) | Price from DB (`:3335`), stock check under `FOR UPDATE OF il` (`:3369-3380`), decrement (`:3382`), order + items insert, coupon via `evaluate_checkout_promotion` (`:1803`), gift-card debit (`:1836`), payment_transactions row (`:2055`). |
| **Payment capture** | `payment-execution.adapter.ts` (`confirmPayment`) | Idempotent capture keyed on provider event id; ledger F-class posting on new path (per Phase 7 §8.5). |

---

## 3. Cart-Authority Analysis (server vs client)

**Verdict: cart is server-authoritative; a residual client-only React cart exists but is not trusted for money.**

- **Server cart is the pricing authority.** `hydrateCartLines` (`cart-routes.ts:212-278`) ignores any client price and recomputes `unit_price` and `line_total` from `products.price` (`:259,:274`). The mutation schema `StorefrontCartLineInputSchema` (`:29-34`) accepts only `product_id`, `variant_id`, `quantity`, `properties` — **there is no price/total field a client can send.** `.strict()` rejects extras.
- **`normalizeCartItems` clamps quantity** to `[1,99]` (`:154`) and coerces `unit_price`/`line_total` from stored row, not request.
- **Confirm uses server cart, not client totals.** `buildHostedCheckoutOrderCommand` (`checkout.ts:170`) maps cart lines to `{product_id, variant_id, quantity}` only (`checkoutOrderItems :162-168`) — the price is never read from the cart into the order command; the RPC recomputes it.
- **Residual client cart (V1 said replace it — partially done).** `cart-context.tsx` still maintains `items` in React state + localStorage and computes `cartTotal` client-side (`:197`). It `syncCartToServer` (`:123`) and, on divergence, **overwrites local state with the server cart** (`:147-151`). So the client cart is a cache/UX layer; the server is canonical. **Finding CHK-019 (S3):** the legacy client cart and its `stock: 999` hardcode (`serverCartToItems :86`) is dead-reckoning that can show purchasable stock the server will reject — a UX/integrity smell, not a money bug.

---

## 4. Checkout Forgery Register

| ID | Vector | Result | Evidence |
|---|---|---|---|
| F-a | Client POSTs arbitrary `line_item.price` | **Blocked** — no price field in cart or order schemas; RPC reads `v_product.price` (`baseline:3335`). | `cart-routes.ts:29`; `order.schema OrderItemInput` (`checkout-core:23`); `baseline:3335` |
| F-b | Client POSTs arbitrary `total`/`subtotal` | **Blocked** — order command carries no totals; RPC computes `v_subtotal` by summing `v_unit_price * v_quantity` (`baseline:3387-3388`) and `total` (`baseline:1813,1900`). | `baseline:3387,1813` |
| F-c | Client POSTs arbitrary `currency` | **Blocked** — currency forced to order/site currency; storefront payment paths reject non-INR (`checkout-payment-routes.ts:149-151`). | `checkout-payment-routes.ts:149` |
| F-d | Negative / fractional quantity | **Blocked** — schema `z.number().int().min(1)` (`checkout-core:26,62`); RPC `IF v_quantity <= 0 THEN RAISE` (`baseline:3315`). | `baseline:3315` |
| F-e | Replay a signed checkout_url after cart edit | **PARTIAL — exploitable** — signature omits cart contents; cart PATCH needs no signature. See CHK-001. | `cart-routes.ts:546`; `:472` |
| F-f | Forge the signature itself | **Blocked** — HMAC-SHA256 with `CHECKOUT_SIGNING_SECRET`/`AUTH_SECRET`; `timingSafeEqualHex` (`checkout.ts:246`). Note shared-secret reuse (CHK-014). | `checkout.ts:245` |
| F-g | Skip the state machine, POST confirm first | **Blocked** — `loadSession` returns null → `CHECKOUT_NOT_STARTED` 409 (`checkout.ts:546`); transition guard rejects out-of-order (`checkout-core:157`). | `checkout.ts:546` |
| F-h | Confirm non-COD with no payment proof | **Blocked** — `CHECKOUT_PROVIDER_PAYMENT_REQUIRED` 400 (`checkout.ts:578-590`) and provider verify runs (`:628`). Mock/sandbox proof is self-asserted (CHK-013). | `checkout.ts:578` |

### CHK-001 deep walkthrough — signed checkout_url does not bind cart contents (S2)

1. Victim/attacker requests `GET /storefront/acme/cart/<token>/checkout-url`. Server signs `acme_site:cart_id:token:web:<expires+10m>` (`cart-routes.ts:546`). Cart at this moment = 1× ₹10 item.
2. Within the 10-minute window, attacker calls `PATCH /storefront/acme/cart/<token>` (no signature required, `cart-routes.ts:472`) to mutate the cart — e.g. add 50 more items, or swap to a different product set, or attach a `coupon_code`.
3. Attacker now hands the **still-valid signature** to the checkout API. `verifyCheckoutHandoff` recomputes the HMAC over `site:cart_id:token:channel:expires` — **all of which are unchanged** — so the signature still verifies (`checkout.ts:245-246`) even though the cart body changed.
4. **Effect:** the handoff is not bound to a cart snapshot. Because the RPC re-prices from the DB and re-checks stock at confirm, this is *not* a price-forgery (the server still charges the correct price for whatever is now in the cart), but it **defeats the integrity intent of a signed handoff**: a captured/shared link no longer corresponds to what was signed, and a coupon or basket can be injected post-signature. **Fix (S):** include a hash of `(sorted line items + coupon_codes + subtotal_minor)` in the signature payload and re-verify it against the live cart at handoff; or freeze the cart to `status='checkout_locked'` at URL issuance.

---

## 5. Inventory Oversell Deep-Dive (with the exact race trace + SQL)

### 5.1 The live confirm path is oversell-safe (pessimistic lock)

`create_order_with_inventory_reservations` (`baseline:3265`) per line item:

```sql
-- baseline:3355-3369  (select the level row and LOCK it)
SELECT il.id, il.location_id, il.available, il.reserved
  INTO v_level_id, v_location_id, v_available, v_reserved
  FROM inventory_levels il
  JOIN inventory_locations loc ON loc.id = il.location_id
 WHERE il.product_id = v_product_id AND ( ... ) AND loc.store_id = p_store_id
   AND loc.status = 'active' AND loc.deleted_at IS NULL
 ORDER BY loc.is_default DESC, il.updated_at ASC
 LIMIT 1
 FOR UPDATE OF il;                      -- ← row-level write lock on the level
-- baseline:3375-3380  (guard)
IF (v_available - v_reserved) < v_quantity THEN
    RAISE EXCEPTION 'insufficient stock for product %, available %, requested %', ...;
END IF;
-- baseline:3382-3385  (decrement, same txn, lock still held)
UPDATE inventory_levels
   SET available = available - v_quantity, updated_at = NOW()
 WHERE id = v_level_id;
```

**Last-unit race (two concurrent confirms, 1 unit left):** Txn A acquires `FOR UPDATE OF il` on the level row first; Txn B blocks on the same row. A reads `available - reserved = 1 >= 1`, decrements to 0, commits, releasing the lock. B now proceeds, re-reads the **post-A committed** row (`available - reserved = 0`), the guard `0 < 1` fires, B `RAISE`s `insufficient stock`. **Exactly one winner.** The `FOR UPDATE OF il` is the load-bearing primitive; the read of `v_available`/`v_reserved` happens *after* the lock is granted, so there is no read-then-write TOCTOU gap. ✅

**Caveat — semantic mismatch:** the guard reads `available - reserved` but the decrement subtracts only from `available` (`baseline:3382`), never touching `reserved`. On the live path nothing ever populates `reserved` (the RPC inserts a `committed` reservation row at `baseline:3465-3489` but does not bump `inventory_levels.reserved`), so `reserved` is effectively 0 and `available - 0 = available` — consistent. This is fragile: if any *other* path (the V1 kernel, see 5.2) ever increments `reserved` on the same level, the live RPC's decrement would double-count. **CHK-006 (S2).**

**No version-CAS.** V1 §9 calls for "version column + optimistic concurrency." The `version` column exists on `inventory_levels` (`141:9`) and is auto-bumped by `trg`/`increment_version` (`141:49`, `baseline:4365-4371`), but **no inventory function reads `version` in a WHERE/CAS** (grep for `AND version`/`WHERE version`/`il.version` in inventory SQL = none). Concurrency is 100% pessimistic-lock-based. This is *correct for oversell* but is **not the version-CAS the constitution specified** — and it means cross-statement optimistic retries are impossible. **CHK-007 (S3, spec-divergence).**

### 5.2 The V1 reservation kernel (migration 141) is real DDL but unreachable / unused on the order path

Migration 141 defines a proper Available/Reserved/Committed model with TTL:
- `reserve_inventory` (`141:65`): `reserved = reserved + qty` under `FOR UPDATE` (`141:121-139`), TTL `now()+ttl` (`141:131`), idempotent (`141:97-112`).
- `commit_inventory_reservation` (`141:175`): `available -= qty; reserved -= qty; committed += qty` (`141:211-221`).
- `expire_inventory_reservations` (`141:304`): the TTL sweeper, `FOR UPDATE SKIP LOCKED` (`141:325`), returns reserved stock.

**Three problems make this kernel inert:**

1. **The order-create RPC never calls it.** `create_order_with_inventory_reservations` decrements `inventory_levels.available` directly (`baseline:3382`) and inserts a `committed`-status `inventory_reservations` row by hand (`baseline:3465`) — it does **not** call `reserve_inventory`/`commit_inventory_reservation`. So the canonical V1 reserve→commit lifecycle is bypassed by the only path that actually creates orders. Two parallel inventory systems (Phase-7 "two parallel systems" pattern). **CHK-005 (S2).**

2. **The kernel requires a tenant GUC the gateway never sets.** Every kernel RPC begins `PERFORM public.require_inventory_site_guc(p_store_id)` (`141:87`), which `RAISE`s unless `current_site_id() = p_store_id` (`141:53-62`). The gateway connects as **`service_role`** (Phase-7 DB audit `107:17`) and **never executes `set_current_site_id`/`SET LOCAL`** — the helper `tenantGucSetLocalStatement` is exported (`tenant-context.ts:59`) but only referenced in a *static-string test assertion* (`__tests__/tenant-isolation.test.ts:23`), never at runtime. Therefore `POST /inventory/reserve` (`inventory.ts:612` → `db.rpc('reserve_inventory')`, `:624`) will **RAISE 'tenant GUC site_id is required'** for every real call. The kernel is dead-on-arrival via its own route. **CHK-004 (S2).**

3. **The TTL sweeper has no scheduler.** `expire_inventory_reservations` is referenced only inside `inventory.ts` as an on-demand HTTP action — never by a cron. The api-gateway `scheduled()` handler (`index.ts:~scheduled`) calls only `runScheduledDispatch` (`index.ts:815`), which dispatches outbox/queue/webhooks (`:849-884`) and **never the inventory sweeper**. `wrangler.toml` crons (`:229 "*/15 * * * *"`) drive only that dispatch. The reservation-expiry index `idx_inventory_reservations_expiry_sweeper` (`141:25`) exists for a sweeper that nothing runs. **CHK-003 (S2)** — confirms Phase 2 "wiring-dead."

### 5.3 Oversell via merchant order-edit (no reservation) — CHK-002 (S1)

`PATCH /orders/:id/line-items` (`orders.ts:982`) lets a store owner add items to an existing order. The add path:

```ts
// orders.ts:1042-1071
for (const item of body.add_items) {
  const { data: product } = await db.from('products').select(... 'price','sale_price' ...) ... ;
  const unitPrice = numberValue(productRow.sale_price) ?? numberValue(productRow.price) ?? 0;  // server price — good
  await db.from('order_items').insert({ order_id: orderId, product_id: item.product_id, quantity: item.quantity, price: unitPrice, total: ... });
}
```

It **never calls any inventory RPC** — no `reserve_inventory`, no decrement of `inventory_levels`. A merchant can add 1,000 units of an out-of-stock SKU to an order; `available` is untouched, so the catalogue still shows it sellable and the next storefront order will oversell. Conversely, removing a line (`:1033`) does not return inventory either. **This is an inventory-integrity bypass on an order that has already debited stock.** Severity S1 because it is merchant-scoped (requires authenticated store owner) yet silently breaks oversell guarantees. **Fix (M):** route add/remove through `reserve_inventory`+`commit_inventory_reservation` (and `release` on removal), or refuse line-item add for stock-tracked products.

---

## 6. Order Duplication Audit

**Verdict: NO duplication — idempotency is enforced at three independent layers.**

1. **HTTP idempotency claim.** `runIdempotentStep` (`checkout.ts:426`) → `IdempotencyExecutionAdapter.begin` with scope `checkout.confirm:${cartId}` + client `idempotency_key`; a `replay` returns the stored response (`:443`). Same pattern on admin `POST /orders` (scope `admin.orders.create`, `orders.ts:1197`), draft convert (`orders.ts:794`), storefront `POST /:subdomain/orders` (`checkout-payment-routes.ts:263`).
2. **Checkout-session unique key.** The RPC first looks up `checkout_sessions WHERE site_id=… AND idempotency_key=… → order_id` and **returns the existing order** if found (`baseline:1748-1766`). The session insert is `ON CONFLICT (site_id, idempotency_key) DO NOTHING` (`baseline:1947`).
3. **DB uniques.** `payment_transactions` insert keyed `p_idempotency_key||':payment'` (`baseline:2081`); reservation rows `ON CONFLICT (idempotency_key) DO NOTHING` (`baseline:3489`); gift-card/promotion redemptions `ON CONFLICT … DO NOTHING` (`baseline:1864,2022`).

**Double-submit / network retry:** identical `idempotency_key` → layer 1 or 2 returns the first order. **Webhook + client both confirming:** the storefront verify routes (`checkout-payment-routes.ts:619,859,1187`) and the confirm route all converge on `confirmPayment(..., providerEventId)` which is deduped by `payment_webhook_events (provider, provider_event_id)` UNIQUE (Phase 7 §7.2) — a webhook and a client cannot both create a *second* order because the order already exists from the first confirm. **One residual smell (CHK-016, S3):** the hosted-checkout order command synthesizes `idempotency_key = "hosted-checkout:${cartId}:${clientKey}"` (`checkout.ts:208`); if two browser tabs send different client keys for the same cart, both pass the HTTP layer, but layer 2/3 (checkout_sessions / payment idempotency) still collapse them to one order — duplication blocked, but two idempotency rows churn.

---

## 7. Price Manipulation Register

| ID | Vector | Result | Evidence |
|---|---|---|---|
| P-a | Client sets unit price | Blocked (RPC reads DB price). | `baseline:3335` |
| P-b | `quantity * price` integer overflow | **Bounded** — qty capped `≤999` (`checkout-core:26`) / `≤99` cart (`cart-routes.ts:32`); price `numeric(10,2)`. Line total `numeric(10,2)` (`baseline:3283`) max ~₹99,999,999.99 — a single 999× line at high price could exceed `numeric(10,2)` and **error**, not silently wrap. Real overflow risk is the **32-bit integer-minor money columns** (CHK-008). | `baseline:3283,3387` |
| P-c | Rounding exploit | Low — discounts `ROUND(...,2)` (`baseline:3997`); GST minor-unit math floors halves consistently (`checkout-core:716-718`). | `checkout-core:716` |
| P-d | Tax recompute / bypass | Tax computed server-side at order from `tax_rates` + GST engine (`order-execution.adapter.ts:272-325`); `v_tax_amount` defaults 0 in RPC then GST invoice overwrites `orders.tax` (`order-execution.adapter.ts:334`). Client cannot set tax. | `order-execution.adapter.ts:284` |
| P-e | Shipping bypass | Shipping is server-fixed: `express=99`, `standard=0` (`baseline:1768-1774`); client `shipping_quote` is metadata only, not summed into total. | `baseline:1768` |
| P-f | Currency mismatch | INR-only enforced (`checkout-payment-routes.ts:149`); RPC defaults `'INR'` (`baseline:1903`). | `checkout-payment-routes.ts:149` |
| P-g | Min-order bypass | Enforced in `evaluate_checkout_promotion` (`baseline:3955-3957`) and `planCouponValidation` (`checkout-core:1273`). | `baseline:3955` |
| P-h | Fixed discount > reduced subtotal on order-edit | `Math.max(0, subtotal+shipping+tax-discount)` floors to 0 (`orders.ts:1091`); discount not re-capped to new subtotal but cannot go negative. Minor revenue-modeling smell. | `orders.ts:1091` |
| P-i | Gift-card precision split | `gift_card_accounts.balance numeric(12,2)` vs `gift_cards.balance numeric(10,2)` (Phase 7 DUP-8). RPC debits `gift_card_accounts` (`baseline:1836`); a different read path uses `gift_cards`. Two balances can diverge. | `baseline:1836`; Phase 7 §DUP-8 |

### CHK-008 — 32-bit integer-minor overflow (S1, inherited from DB layer)

Per Phase 7 §8.3, ~25 money columns are `integer` minor-units (`payout_statements.*_minor`, `wallet_ledger_entries.amount_minor`, `cod_reconciliation_entries.*_minor`, `commission_reconciliation_entries.*_minor`). A single settlement/payout above **₹21,474,836.47** overflows int32. Checkout-created orders feed COD reconciliation and commission/payout rollups, so a single large B2B order (or aggregated COD remittance) can overflow downstream. Mitigation `_bigint` shadow columns exist (160) but the constraint-checked, API-read columns remain `integer`. **Fix (M):** promote to `bigint`.

---

## 8. Coupon Bypass Audit (concurrency proof)

**Verdict: usage-limit and per-customer-limit enforcement is concurrency-safe at the DB layer; the confirm endpoint's lightweight re-check is a belt-and-braces, not the authority.**

### 8.1 The authority is `evaluate_checkout_promotion` inside the order RPC

`create_checkout_order` calls `evaluate_checkout_promotion` (`baseline:1803`) which:
- Selects the promotion code (`baseline:3878-3907`) `FOR UPDATE OF pc`, falling back to legacy `coupons` `FOR UPDATE` (`baseline:3910-3932`) — **the limit-bearing row is write-locked.**
- Enforces global usage (`COUNT(promotion_redemptions) >= usage_limit → RAISE`, `baseline:3970-3972`), code usage (`baseline:3974-3976`), and **per-customer** (`COUNT … WHERE customer_email=… → RAISE`, `baseline:3978-3993`).
- Computes the discount server-side (`percentage`/`fixed`/`free_shipping`, `baseline:3996-4009`), clamped to `[0, subtotal+shipping]`.

Then the RPC records redemption and increments counters (`baseline:1992-2052`): `promotion_redemptions` insert `ON CONFLICT (site_id, idempotency_key) DO NOTHING`; `UPDATE promotion_codes SET usage_count = usage_count + 1`; `UPDATE coupons SET usage_count = usage_count + 1`; `promotion_usage_counters` upsert with `+1`.

### 8.2 Parallel-request over-use trace (one code, limit = 1)

Two concurrent orders apply `SAVE50` (limit 1):
1. Both call the RPC; both reach `evaluate_checkout_promotion`. The first to reach the `SELECT … FOR UPDATE OF pc` (`baseline:3907`) **locks the promotion-code row**; the second blocks.
2. Txn A reads `code_usage_count = 0 < 1`, returns the discount, inserts the redemption, `UPDATE promotion_codes SET usage_count = 1`, commits, releasing the lock.
3. Txn B unblocks, but its `evaluate_checkout_promotion` ran inside the *same* RPC transaction that began before A committed. **Here lies the only soft spot:** B's `SELECT … FOR UPDATE OF pc` will now see A's committed `usage_count = 1` *iff* B's lock acquisition happens after A commits (it does, because A held the lock). At READ COMMITTED, B re-reads the row at lock time and sees `usage_count = 1 >= 1 → RAISE 'usage limit reached'`. **Over-use blocked.** The `FOR UPDATE OF pc` serializes the check-and-increment.
   - **UNVERIFIED corner:** if two requests carry the **same** `idempotency_key`, the redemption insert is `DO NOTHING` and the second returns the first order — fine. If they carry **different** idempotency keys but the per-customer `COUNT` is read *before* the other's redemption row is visible, the `FOR UPDATE OF pc` still serializes them because both must lock the same `pc` row first. The guarantee rests on every concurrent evaluation contending for the *same* promotion-code/coupon row; this holds for code-based promos. For a promotion with **no** `promotion_code` row (pure automatic) the lock target differs — automatic promos are not exercised by this RPC path (it requires `p_coupon_code`), so not reachable here.

### 8.3 Confirm-time re-validation is shallow (CHK-010, S3)

`revalidateConfirmInputs` (`checkout.ts:379-391`) only checks that each discount code **exists and is_active** in `coupons` — it does **not** re-run usage/min-order/per-customer/combines_with. This is acceptable *because* the authoritative re-evaluation happens inside the RPC at order creation (`baseline:1803`), which is the same transaction that decrements inventory. But the shallow check means a code that is active-but-exhausted passes `revalidateConfirmInputs` and is then correctly rejected by the RPC — a confusing two-stage failure, not a bypass.

### 8.4 `combines_with` 3-class enforcement (stacking exclusive discounts)

The TS stack planner `planDiscountStack` (`checkout-core:1114-1179`) implements bidirectional `combines_with`: two discounts coexist only if `candidate.combines_with[accepted.class] && accepted.combines_with[candidate.class]` (`discountsCanCombine :1104-1112`), processed in class order product→order→shipping with per-class capacity caps (`:1117-1126`). **This is correct exclusive-stacking logic.** **However (CHK-011, S2):** `planDiscountStack` is the **storefront/quote-time** planner; the **authoritative order RPC `evaluate_checkout_promotion` evaluates only a SINGLE code** (`p_coupon_code` is scalar, `baseline:1716` signature) and the cart stores only `coupon_code` singular (`cart-routes.ts:400` takes `coupon_codes[0]`). So at the money-authoritative layer **only one discount is ever applied** — multi-discount stacking cannot actually be exploited because the server never stacks at order time. The rich `combines_with`/`planDiscountStack` engine is **dormant** relative to the single-code RPC. This is safe (no over-discount) but means the 3-class combine model is not wired into order pricing. Net: not a bypass, but a capability/authority mismatch.

---

## 9. Race-Condition Register

| ID | Race | Window | Outcome | Severity |
|---|---|---|---|---|
| R-1 | Last-unit oversell (two confirms) | between stock-check and decrement | **Closed** — `FOR UPDATE OF il` serializes (`baseline:3369`); exactly one winner. | — |
| R-2 | Coupon over-use (parallel applies) | check-then-increment | **Closed** — `FOR UPDATE OF pc` / `FOR UPDATE` on coupon row (`baseline:3907,3932`). | — |
| R-3 | Concurrent cart mutation vs checkout-url signing | cart PATCH within 10-min signature TTL | **Open** — signature not bound to contents (CHK-001). | S2 |
| R-4 | Reservation TTL expiry vs confirm | sweeper marks `expired` while order RPC runs | **Mostly moot** — sweeper never runs (CHK-003); if manually invoked, it edits `inventory_levels.reserved` under `FOR UPDATE SKIP LOCKED` (`141:325`) while the order RPC edits `available` under `FOR UPDATE OF il` — different columns, but both `UPDATE inventory_levels` on the same row will serialize on the row lock. **UNVERIFIED** whether a half-applied reserved/available pair can transiently mislead a concurrent reader (no SERIALIZABLE). | S2 |
| R-5 | Abandoned-cart cleanup vs active checkout | abandonment job flips cart while checkout in flight | **Low** — abandonment only sets `abandonment_enqueued_at` (`cart-routes.ts:373`) and emits an event; it does not delete/lock the cart, and confirm reads the cart fresh. Cart soft-delete is not performed by the job. | S3 |
| R-6 | Double order from concurrent confirm | two confirms, same/different idempotency key | **Closed** — three idempotency layers (§6). | — |
| R-7 | Gift-card double-spend (parallel orders, same card) | balance read-modify-write | **Closed** — `SELECT … FOR UPDATE` on `gift_card_accounts` (`baseline:1824`) before `balance = balance - amount` (`baseline:1836`). | — |
| R-8 | Reservation leak → soft DoS oversell-prevention | reservations never expire (sweeper dead) | **Open** — abandoned hosted-checkout reservations (if the V1 kernel were used) would pin stock forever. On the live RPC path reservations are inserted `committed` (not `active`), so they aren't swept anyway; the live path also doesn't bump `reserved`, so no leak there. The leak risk is latent, materializing only if the V1 reserve path is ever wired. | S3 (latent) |

---

## 10. Order-Creation-Bypass Audit

**Verdict: orders CANNOT be created outside the inventory-safe RPC.**

- Grep of every `from('orders')` in `routes/` and `execution/`: all are `SELECT`/`UPDATE` (status transitions, GST persistence, totals recompute). **No `INSERT INTO orders` exists outside `create_order_with_inventory_reservations`.** The order-edit route (`orders.ts:1042`) inserts into `order_items`, not `orders`, and only on an already-created order.
- All four creation entry points call `OrderExecutionAdapter.createOrder` → `db.rpc('create_checkout_order')`:
  - Admin `POST /orders` (`orders.ts:1189-1208`) — `resolveTenantContextForOwnedSite` (owner-gated).
  - Draft convert `POST /orders/drafts/:id/convert` (`orders.ts:805`) — owner-gated, items from `draft_order_lines`.
  - Storefront `POST /:subdomain/orders` (`checkout-payment-routes.ts:244-352`) — public, but still the safe RPC.
  - Hosted confirm (`checkout.ts:620`).
- The adapter hard-refuses unsafe fallback: if the RPC is missing it throws "Unsafe compatibility order creation is disabled" (`order-execution.adapter.ts:170-174`).
- **Residual (CHK-012, S3):** the storefront `POST /:subdomain/orders` path is fully public and creates a **real, inventory-decrementing order before any payment** (payment is a separate later call). An unauthenticated script can mint pending orders at will, each one **decrementing `available`** (`baseline:3382`) for COD or pre-payment. Combined with the dead sweeper and the fact that these orders are `confirmed` for COD (`baseline:3436`), this is an **inventory-exhaustion / denial-of-inventory vector**: hammer `POST /:subdomain/orders` with `payment_method:'cod'` to drive `available` to 0 across the catalogue without ever paying. Rate-limiting + COD risk-scoring (`order-risk`) partially mitigate, but stock is debited synchronously. **Fix (M):** for COD/pre-payment, reserve (TTL) rather than hard-decrement, and gate public order creation behind the signed checkout handoff or a bot check.

---

## 11. Branding / Template-Injection Check

**Verdict: branding is data-only with a guard; low residual XSS surface, no SSTI.**

- `StoreBrandingSchema` (`checkout-core:120-127`) constrains `primary_color`/`accent_color` to `^#[0-9A-Fa-f]{6}$`, `checkout_theme` to an enum, `logo_url`/`favicon_url` to `z.string().url()`, and `tokens` to `Record<string, string|number|boolean>` — **no nested objects, no HTML fields.** `.strict()` rejects unknown keys.
- `assertBrandingIsDataOnly` (`checkout-core:167-173`) JSON-stringifies the whole payload and rejects `<script`, `javascript:`, `onerror=`. Applied at write (`checkout.ts:716`).
- Branding write is owner-gated (`verifySiteOwnership`, `checkout.ts:720`); read is public (`checkout.ts:701`) and returns only the typed columns.
- **CHK-017 (S3):** the `tokens` map allows arbitrary **string values** (only the keys/types are constrained). If a renderer ever injects `tokens` values into a CSS context unescaped (e.g. `style="color:${token}"`), a value like `red;background:url(javascript:...)` or CSS-exfiltration could land. The `assertBrandingIsDataOnly` blocklist catches `javascript:` and `onerror=` but **not** CSS-expression / `url(...)` / unicode-escaped variants. This is a defense-in-depth gap, contingent on how `apps/storefront-runtime` consumes `tokens` (the consumer was not in scope for a definitive XSS proof — **UNVERIFIED** whether a sink exists). **Fix (S):** allowlist token value patterns (hex/enum/number) and escape at the render sink.
- **No SSTI:** branding is rendered as React props / CSS variables, not compiled as a template; there is no `eval`/template-compile of branding strings. The only executable-extension surface is the **Wasm app-functions runtime** (§12), which is heavily sandboxed.

---

## 12. Checkout Extension Execution (Phase 2 re-verification)

Phase 2 flagged "checkout extensions/app-functions execute inside the live payment route." **Re-verified and contextualized:**

- True: `POST /:subdomain/orders` calls `evaluateCheckoutAppFunctions` (`checkout-payment-routes.ts:285`) **before** `createOrder`, gated by `FEATURE_EXTENSIONS` (`:284`).
- **But the blast radius is tightly bounded.** App functions are WebAssembly modules executed by `app-functions-runtime.ts` with: SHA-256 pinning of the module (`:365`), **no host imports allowed** (`validateWasmModuleLimits` rejects any import section, `:296`), no loops/branches/calls/`memory.grow` in the instruction budget (`scanWasmInstructionBudget`, `:172-255`), ≤128 KB module / ≤512 KB memory caps (`:269,:257`), and a 1–5 ms timeout (`:434`). The function gets `{cart, checkout, request}` as JSON and returns ≤25 operations (`AppFunctionRuntimeOutputSchema`, `app-platform.ts:482`).
- **What an app function can change in the checkout decision** is exactly four things (`applyAppFunctionRuntimeOutput`, `app-platform.ts:521-558`): set `couponCode`, set `shippingMethod`, restrict `paymentMethod` (or raise a validation error), or push a `validation_error`. **It CANNOT set price, discount amount, tax, or total** — there is no operation type for that.
- **Therefore the residual risk is "extension forces a coupon code," and that coupon is still re-validated and re-priced by the authoritative RPC** (`evaluate_checkout_promotion`). The worst a malicious/buggy app function can do is (a) inject a coupon the customer didn't enter (which the RPC will only honor if it's genuinely valid for that store/customer), (b) block a payment method, or (c) fail the checkout closed. **CHK-018 (S3):** an installed extension can silently apply a store's own valid promo code to every order (margin leak at the merchant's expense), and a failing extension fails the whole checkout closed (`evaluateCheckoutAppFunctions` pushes a validation error on failure, `app-functions-runtime.ts:614-619`) — an availability coupling. Not a customer-exploitable price forgery.

---

## 13. Hosted `checkout.letbuyy.com` Origin (Phase 2 re-verification)

**Confirmed MISSING.** The signed URL targets `https://checkout.{domain}/checkout?...` with `domain = letbuyy.com` (`cart-routes.ts:302`, `DEFAULT_PLATFORM_DOMAIN='letbuyy.com'` `brand.ts:26`). There is:
- **No `apps/checkout` app** (`ls apps/` shows none).
- **No `checkout.` route** in any `wrangler.toml` (grep across gateway + storefront = none).
- The only checkout pages are **path-based** under `apps/storefront-runtime/src/app/store/[subdomain]/checkout/{page,success,paypal-return}.tsx` — served from the storefront origin, not `checkout.letbuyy.com`.
- The checkout **state-machine API** (`checkoutRouter`) is mounted at `/checkout` on the **api-gateway** (`index.ts:684`) as JSON endpoints — not an HTML origin.

So the contract "single server-validated hosted origin re-validating inventory+discount at confirm" is **half-built**: the *server-side re-validation logic exists and is correct* (the RPC), but there is **no dedicated hosted checkout web origin** consuming the signed handoff; the signed URL points at a host with no page/DNS. **CHK-015 (S2):** signed checkout URLs are dead links in production until the `checkout.letbuyy.com` origin and the contact/delivery/payment/confirm browser flow are deployed; today's working storefront checkout uses the public `POST /:subdomain/orders` path (which bypasses the signed-handoff state machine entirely).

---

## 14. Findings Register

| ID | Sev | Area | Title | Root Cause | Evidence (path:line) | Impact | Fix | Recommended Fix |
|---|---|---|---|---|---|---|---|---|
| CHK-001 | S2 | Forgery | Signed checkout_url does not bind cart contents | HMAC payload omits line items/coupon/subtotal; cart PATCH needs no signature | `cart-routes.ts:546`; `:472`; `checkout.ts:245` | Cart/coupon mutable post-signature within 10-min TTL; defeats handoff integrity | S | Include hash of (sorted lines+coupons+subtotal_minor) in signature; lock cart at URL issuance |
| CHK-002 | S1 | Oversell | Merchant order-edit adds items without reserving inventory | `add_items` inserts `order_items`, no inventory RPC | `orders.ts:1042-1071` | Stock not decremented for added lines → catalogue oversells; removals don't restock | M | Route add/remove through reserve/commit/release inventory RPCs |
| CHK-003 | S2 | Race/Inventory | Reservation TTL sweeper never scheduled | `expire_inventory_reservations` referenced only by an HTTP route; cron dispatches only outbox/queue | `141:304`; `index.ts:815`; `wrangler.toml:229` | TTL reservations (if kernel used) pin stock forever; no automatic recovery | S | Add cron → `expire_inventory_reservations`; or call in scheduled handler |
| CHK-004 | S2 | Inventory | V1 reservation kernel unreachable — tenant GUC never set | `require_inventory_site_guc` raises; gateway is service_role and never runs `set_current_site_id` | `141:53-87`; `inventory.ts:624`; `tenant-context.ts:59` (unused); `__tests__/tenant-isolation.test.ts:23` | `POST /inventory/reserve|commit|release` RAISE for every real call; kernel dead | M | Execute `SET LOCAL` tenant GUC per request (and stop relying on service_role) |
| CHK-005 | S2 | Inventory | Two parallel inventory systems | Order RPC decrements `available` directly + hand-inserts `committed` reservations; never calls V1 reserve/commit | `baseline:3382,3465`; `141:65,175` | Available/Reserved/Committed model bypassed by the only order path; divergence risk | L | Converge order RPC onto the V1 reserve→commit lifecycle |
| CHK-006 | S2 | Inventory | Decrement subtracts `available` but guard reads `available-reserved` | Mismatched columns; safe only because live path never bumps `reserved` | `baseline:3375-3385` | Fragile: if any path sets `reserved`, decrement double-counts → oversell or phantom stock | S | Decrement both consistently or adopt single Committed model |
| CHK-007 | S3 | Inventory | `version` column present but no optimistic CAS | `increment_version` trigger bumps `version`; no function reads it in WHERE | `141:9,49`; `baseline:4365`; grep=0 CAS | Spec divergence (V1 §9 version-CAS); cross-statement optimistic retry impossible | M | Add `WHERE version = :expected` CAS where optimistic concurrency is intended |
| CHK-008 | S1 | Price/Money | 32-bit integer-minor money overflow | ~25 `integer` minor-unit columns overflow at ₹21,474,836.47 | Phase 7 §8.3; `119:16-19`; `140:26-29` | Large COD/settlement/payout aggregates from checkout overflow int32 | M | Promote integer-minor columns to bigint (160 shadow exists) |
| CHK-009 | — | Duplication | Confirm idempotency (informational, control PRESENT) | 3-layer dedupe | `checkout.ts:443`; `baseline:1748-1766,1947,2081` | No duplicate orders | — | Keep |
| CHK-010 | S3 | Coupon | Confirm-time discount re-check is shallow | Only checks code exists/active, not full re-eval | `checkout.ts:379-391` | Active-but-exhausted code passes pre-check, rejected later by RPC (confusing UX, not bypass) | S | Surface RPC rejection reason; or full re-eval pre-confirm |
| CHK-011 | S2 | Coupon | 3-class `combines_with` stacking engine is dormant at order time | RPC evaluates a single scalar `p_coupon_code`; cart stores `coupon_code` singular | `baseline:1716`; `cart-routes.ts:400`; `checkout-core:1114` | Multi-discount stack model unused → no over-discount, but combine rules unenforced where multiple discounts intended | M | Wire `planDiscountStack` results into the order RPC, or accept single-code by design |
| CHK-012 | S3 | Bypass/DoS | Public order-create decrements stock before payment | `POST /:subdomain/orders` is unauthenticated and hard-decrements `available` | `checkout-payment-routes.ts:244`; `baseline:3382,3436` | Denial-of-inventory: spam COD orders to zero out stock without paying | M | Reserve (TTL) for COD/pre-payment; gate behind signed handoff/bot check |
| CHK-013 | S2 | Payment auth | Mock/sandbox payment proof self-asserted | Payment intent is a self-minted UUID; non-prod confirm trusts presence + provider verify only | `checkout.ts:521,578,628` | In non-prod, "paid" is asserted; live mode correctly 503-gated | S | Ensure prod path only; never enable mock confirm in prod env |
| CHK-014 | S2 | Crypto | Checkout signing secret reuses `AUTH_SECRET` | `CHECKOUT_SIGNING_SECRET || AUTH_SECRET || STORE_ACCESS_SIGNING_KEY` | `checkout.ts:86`; `cart-routes.ts:306` | Shared secret couples checkout-handoff forgery to identity/session forgery (Phase 7) | S | Dedicated `CHECKOUT_SIGNING_SECRET`, never fall back to `AUTH_SECRET` |
| CHK-015 | S2 | Hosted origin | `checkout.letbuyy.com` origin does not exist | Signed URL targets a host with no app/route/DNS | `cart-routes.ts:302`; `brand.ts:26`; no `apps/checkout`, no `checkout.` wrangler route | Signed checkout URLs are dead links in prod; hosted single-origin contract unmet | L | Build/deploy the hosted checkout origin consuming the handoff |
| CHK-016 | S3 | Idempotency | Per-cart confirm key churn across tabs | Synthesized `hosted-checkout:${cartId}:${clientKey}`; different tabs → different HTTP keys | `checkout.ts:208` | Extra idempotency rows; no duplicate order (layer 2/3 collapse) | S | Key on cart_id+session, not client key |
| CHK-017 | S3 | Branding | `tokens` string values not pattern-allowlisted | Only key/type constrained; value blocklist misses CSS/url() vectors | `checkout-core:126,167-173` | Potential CSS-context injection if render sink is unescaped (UNVERIFIED sink) | S | Allowlist token value patterns; escape at sink |
| CHK-018 | S3 | Extensions | App function can force a valid coupon / fail checkout closed | Decision surface allows `apply_discount_code` + validation errors | `app-platform.ts:521-558`; `checkout-payment-routes.ts:285` | Margin leak (auto-applied promo) / availability coupling; no price forgery | S | Require merchant opt-in for discount-mutating functions; degrade open on non-critical hook failure |
| CHK-019 | S3 | Cart | Residual client React cart with `stock:999` hardcode | Legacy `cart-context.tsx` retained as cache | `cart-context.tsx:86,197` | Shows purchasable stock the server will reject; UX/integrity smell | S | Drive stock/availability from server cart response |
| CHK-020 | S1 | Refund/Money | Refund via returns path is not ledgered | `complete_order_refund` touches refunds/returns/payment_transactions, no `ledger_*` | `baseline:1039-1210` (grep: 0 ledger refs); `order-execution.adapter.ts:495`; `returns.ts` | Refunds issued via returns bypass double-entry ledger → reconciliation drift | M | Post an F-class reversing ledger txn in `complete_order_refund` |
| CHK-021 | S2 | Tenancy | RLS decorative on checkout paths (service_role + no GUC) | Gateway connects as service_role (BYPASSRLS); GUC never set | Phase 7 `107:17`; `tenant-context.ts` (no SET LOCAL); grep | FORCE-RLS policies on inventory/checkout tables are inert; isolation is app-discipline | L | Set tenant GUC per request and/or stop using service_role for tenant writes |
| CHK-022 | S3 | Inventory | Removing order line doesn't restock | `PATCH line-items` removal soft-deletes `order_items` only | `orders.ts:1033-1040` | Cancelled/removed lines leak committed stock (never returned to available) | S | Release/restock on line removal |
| CHK-023 | S3 | Tax | Order RPC sets tax=0, GST invoice overwrites post-commit | `v_tax_amount` 0 in RPC; GST engine updates `orders.tax` after | `baseline:1727,1898`; `order-execution.adapter.ts:334` | Brief window where order total excludes tax; deferred post-commit can fail silently (logged) | M | Compute tax inside the order transaction, not post-commit |
| CHK-024 | S3 | Gift card | Gift-card balance is mutable truth, dual precision | `UPDATE gift_card_accounts SET balance = balance - amt`; `gift_cards` at diff precision | `baseline:1836`; Phase 7 DUP-8/§8.4 | Mutable balance (no ledger backing) + precision split → divergence/double-spend-across-paths | M | Back gift cards with the canonical ledger; unify precision |
| CHK-025 | S3 | Currency | Multi-currency unsupported but schema accepts it | `CurrencySchema` exists; runtime forces INR | `checkout-payment-routes.ts:149`; `baseline:1903` | Non-INR carts/orders silently INR-coerced or 400'd; surprising for multi-market (§137 markets) | S | Reject non-INR at cart creation with a clear error |
| CHK-026 | S2 | Race | Cart-mutation vs signing (R-3) | Same root as CHK-001 | `cart-routes.ts:472,546` | Coupon/basket injected into a signed-but-unbound handoff | S | (See CHK-001) |
| CHK-027 | S3 | Abuse | No rate limit on public cart/order creation | Public routes create carts/orders without throttle | `cart-routes.ts:445`; `checkout-payment-routes.ts:244` | Enables CHK-012 denial-of-inventory and cart-spam | S | Per-IP/per-store rate limiting + bot check on public commerce routes |

**Counts (total = 27, CHK-001…027):**
- **S0 = 0**
- **S1 = 3** — CHK-002 (order-edit oversell), CHK-008 (int32 money overflow), CHK-020 (refund not ledgered)
- **S2 = 10** — CHK-001, CHK-003, CHK-004, CHK-005, CHK-006, CHK-011, CHK-013, CHK-014, CHK-015, CHK-021 (CHK-026 is a cross-reference of CHK-001, not counted separately)
- **S3 = 13** — CHK-007, CHK-010, CHK-012, CHK-016, CHK-017, CHK-018, CHK-019, CHK-022, CHK-023, CHK-024, CHK-025, CHK-026, CHK-027
- **Informational (control PRESENT) = 1** — CHK-009 (confirm idempotency)

---

## 15. UNVERIFIED (live-only) items

- **R-4 transient half-state:** whether a concurrently-committed `reserved`/`available` pair from a manually-invoked sweeper can transiently mislead a reader requires live transaction-isolation observation (no SERIALIZABLE in code). The row lock makes a *lost update* impossible; a *dirty/non-repeatable read* across the two columns is the open question.
- **CHK-017 sink:** whether `apps/storefront-runtime` actually injects `tokens` string values into a CSS/HTML sink unescaped was not traced to a concrete sink; the injection is contingent on that consumer.
- **Coupon §8.2 corner:** the exact visibility ordering of `promotion_redemptions` COUNT vs another transaction's redemption insert under READ COMMITTED is reasoned from the `FOR UPDATE OF pc` serialization; a live concurrent test would confirm no per-customer over-redemption when two requests use different idempotency keys but the same email and code.
- **Duplicate migration 129 / drifted baseline (Phase 7 A-1/A-3):** whether the live DB's `create_checkout_order` matches the baseline snapshot exactly is unverifiable from code; the audit assumes the committed migration is authoritative.
- **CHK-013 prod gating:** that no environment enables `mode:'mock'` confirm in production depends on live env config; code gates `live` at 503 but `sandbox`/`mock` confirm logic is present and would run if the env permitted.
