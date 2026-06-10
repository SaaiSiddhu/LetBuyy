# LETBUYY — CHECKOUT / CART / ORDERS / INVENTORY AUTOPSY
### Phase 9 of the Foundation Autopsy · 2026-06-09 · evidence-only
### Question: what % of the checkout→order→fulfillment pipeline is real, and what breaks at the first real concurrent checkout?

---

## 0. The one thing to internalize

There are **two parallel checkout systems that do not connect**, and the well-engineered one is dead code:

- **System A — "hosted checkout state machine"** (`services/api-gateway/src/routes/checkout.ts`): real HMAC-signed handoff, real named-state machine, idempotent steps, a scoped-compensation write. **But its `confirm` never creates an order, never commits inventory, its payment-intent is a mock string, and it is not wired to the live storefront.** A beautiful scaffold with zero commerce throughput.
- **System B — "order-first, pay-later"** (`storefront/checkout-payment-routes.ts` → `create_checkout_order` → `create_order_with_inventory_reservations`): this is what the live storefront actually calls. It **is genuinely oversell-safe** — but it **mints the order and commits inventory BEFORE payment**, with no cleanup if payment never completes.

The verified ledger/idempotency kernels are wired into System B. They are **not** wired into System A's confirm (which does no money movement at all). Overall pipeline: **~55% real**.

---

## 1. Component-by-component reality

| Component | Status | Evidence |
|---|---|---|
| Server-authoritative cart (re-prices from DB) | **REAL** | `storefront/cart-routes.ts:256-274` re-prices every line from DB `product.price` (client sends only id+qty); persisted `:382-432`; `156_executable_cart_channel_handoff.sql:5-10` adds channel/buyer_email/handoff |
| Signed checkout_url handoff (HMAC) | **REAL** | sign `cart-routes.ts:545-553`; verify `checkout.ts:161-164` (timing-safe) + expiry `:149-152` |
| Client-only React cart (dual source of truth) | **STILL PRESENT** | `apps/storefront-runtime/src/context/cart-context.tsx:48,110` localStorage `lb_cart` is primary; client total from cached prices `:197`; hardcodes `stock:999` `:84` |
| Checkout session state machine (named states) | **REAL but ORPHANED** | states `checkout-core/src/index.ts:72-81`; transition guard `:147-160`; DB CHECK `146_executable_checkout_state_machine.sql:44-45`. In-monolith (no checkout-runtime service ✅). **Unused by live flow** |
| Idempotent confirm | **REAL (both layers)** | route claim `checkout.ts:458`; DB dedupe `000_baseline.sql:1748-1766` |
| `checkout-runtime` service (must be empty) | **CORRECTLY ABSENT** | state machine in monolith; compliant with §9 |
| Inventory oversell-proofing (live path) | **REAL** | `000_baseline.sql:3325` `SELECT … products … FOR UPDATE`; `:3355-3369` `FOR UPDATE OF il`; guard `:3375`; decrement under lock `:3382` |
| Inventory reservation kernel (reserve/commit/release + version) | **REAL but UNUSED** | `141_executable_inventory_reservations.sql:65-173` (`reserve_inventory`, FOR UPDATE `:121`); **no caller in live path** |
| Stale-reservation sweeper | **ORPHANED** | SQL `141:304 expire_inventory_reservations` exists; **zero callers**; no inventory worker in `queue-workers` |
| Orders created only via checkout | **PARTIAL** | all TS paths funnel through `create_checkout_order` (no naked `INSERT INTO orders`), but order is created *before* payment, and admin `PATCH /line-items` mutates items bypassing inventory |
| Order state machine (guarded transitions) | **REAL** | `checkout-core:1336-1380` `VALID_TRANSITIONS`; enforced `OrderExecutionAdapter.transitionStatus:423-451`; DB CHECK `147:34-46` |
| Order immutability | **DORMANT** | trigger `147:125-154` fires only `WHEN order_source='checkout' AND order_locked_at IS NOT NULL`; live RPC sets **neither** (default `order_source='admin'`) → real orders are mutable |
| Scoped compensation (paid→order-fail→auto-refund) | **MISSING (write-only)** | `checkout.ts:311-338` writes `compensation_actions` row `status:'pending'`; **no consumer reads/executes it** anywhere in `queue-workers`/`orchestration` |
| Payment money-IN verify | **REAL** | `checkout-payment-routes.ts:583-617` (razorpay), `:811-816` (cashfree), fail-closed reference binding |
| Discounts (combines_with classes, usage limits) | **REAL** | `checkout-core:1114-1179` (`planDiscountStack`); usage-limit enforce + counter `000_baseline.sql:3974, 2025-2051` |
| Shipping zones/rates + pincode/COD serviceability | **REAL (Shiprocket live, others gated)** | `checkout-core:1774-1831`; adapter wiring `routes/shipping.ts:42-50`, mock fallback `:52-60` |
| FulfillmentOrder-per-location | **REAL** | `OrderExecutionAdapter.fulfillOrder:455-473` → `create_order_fulfillment` |
| Legacy stock "reserve" fallback | **RACE-PRONE SCAFFOLD** | `payment-execution.adapter.ts:97-131` naive read-then-write, no lock/version; gated to JSON-only orders `:93` |

---

## 2. Ranked findings

### S0 — incorrect money/inventory state in normal operation
- **S0-1 — Orders + inventory are committed BEFORE payment, with no cleanup if payment never completes.** The live flow creates the order and decrements `available` at order-create (`000_baseline.sql:3382`), then payment is a *separate later call*. If the buyer abandons after order-create (closes tab, payment fails), the order sits `payment_status='pending'` with **inventory already consumed**, and nothing releases it: the storefront verify routes never call `recordPaymentFailure({releaseInventory:true})`, and there is no abandoned-order sweeper. **Silent stock leakage on every abandoned paid-method checkout.**
- **S0-2 — Scoped compensation is write-only; the flagship "payment captured but order-create failed ⇒ auto-refund" never runs.** `checkout.ts:311-338` logs an intent into `compensation_actions`; **no code reads it** (zero refs outside `checkout.ts` + tests). And this only lives in the dead System A; the live System B has no compensation construct at all.

### S1 — exploitable / integrity holes
- **S1-1 — Order immutability trigger is dormant for all real orders.** It requires `order_source='checkout' AND order_locked_at IS NOT NULL`; the live RPC sets neither (orders default to `'admin'`). The "orders immutable" guarantee is not in force for orders the platform actually creates.
- **S1-2 — Admin `PATCH /orders/:id/line-items` mutates orders with no inventory check and no total recompute** (`orders.ts:1019-1071`). A merchant can add items / inflate quantities past stock (back-office oversell) and desync totals from line items.
- **S1-3 — The hosted-checkout confirm validates reservations that nothing ever creates** (`checkout.ts:282-292`) — `inventory_reservation_ids` is always `[]`, so the check is a no-op and confirm "succeeds" with zero inventory protection. (Moot only because System A is dead.)

### S2 — latent / dead-code
- **S2-1 — The entire hosted-checkout state machine (`checkout.ts`) is orphaned.** The live storefront (`apps/storefront-runtime/.../checkout/checkout-client.tsx:375,427,455`) calls `/api/orders` + `/payments/*`, never `/contact`,`/delivery`,`/payment-intent`,`/confirm`. The state machine, its idempotency, and its compensation are unreachable from production.
- **S2-2 — System A payment-intent is a mock string** (`checkout.ts:435`); live mode hard-blocked `:427-431`.
- **S2-3 — Migration-141 reservation kernel + version column + sweeper are unused**; the live path uses the older direct-decrement instead. Two inventory systems; the safer-by-design one is dormant.

---

## 3. What breaks at the first real concurrent checkout

1. **Two buyers, last unit, both paying online:** **SAFE — exactly one wins.** The order RPC serializes on `FOR UPDATE OF il` (`000_baseline.sql:3369`); the loser gets `insufficient stock` (`:3375`). The classic oversell race is genuinely solved. ✅
2. **Buyer reaches checkout, order created, then abandons / payment fails:** **stock leaks permanently** — order-create already decremented `available`; no release on the storefront fail path; no sweeper. After N abandoned paid checkouts, sellable stock silently drops by N. 🔥 (S0-1)
3. **Payment captured but order-create fails (the exact case compensation targets):** on the live path it can't arise (order created first, so the guarantee is vacuous where it'd matter); on System A the refund is *written but never executed*. **No auto-refund fires.** 🔥 (S0-2)
4. **Merchant edits a paid order's line items during fulfillment:** totals desync, stock can effectively go negative — `PATCH /line-items` ignores inventory and the immutability trigger is off. (S1-1, S1-2)
5. **Idempotency under retry/double-submit:** **holds** — duplicate confirm/order-create returns the same order (`000_baseline.sql:1748-1766`); re-pay on a `paid` order is rejected (`payment-execution.adapter.ts:176-178`). ✅

---

## Verdict

The concurrency primitive everyone fears — last-unit oversell — is **correctly solved on the path that runs**. The real risks are one rung up and architectural: the live checkout **commits inventory before money and never cleans up**, the **auto-refund compensation is a stub that never executes**, **order immutability is off**, and the **elegant reservation/state-machine/compensation architecture from the migrations is built but not plugged into the path that actually runs.** This is the recurring LetBuyy pattern — a correct, sophisticated system sitting *next to* the simpler one that's actually wired, with the gap between them invisible until production. Fix order: (1) release inventory on payment-failure/abandonment + add an abandoned-order sweeper; (2) wire (or delete) the compensation executor; (3) make order immutability fire for real orders; (4) collapse the two inventory systems onto the reservation kernel; (5) retire System A or make it the real path.
