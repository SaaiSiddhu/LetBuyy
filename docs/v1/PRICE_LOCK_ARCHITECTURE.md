# Lifetime Price Lock — Architecture

> The lifetime price lock is the entire value proposition of the Founding Merchant Program. A founder is buying **permanent pricing protection**, not a badge. This document defines how renewals work today and how the lock is enforced on **every** charge path. The exhaustive per-path proof is in [`PRICE_LOCK_VERIFICATION.md`](./PRICE_LOCK_VERIFICATION.md).

## How renewals/charges work today

A subscription charge amount is computed in exactly one of two billing-core functions, both of which read the **catalog** plan record (`plans.price_monthly_inr` / `promo_price_inr`):

- `planBillingAmountMinor(plan, billing_period)` → `{ amountMinor }`
- `planMerchantRazorpayBillingCheckout({ plan, billingPeriod, ... })` → chooses a Razorpay mode and embeds the amount.

Razorpay is used in **three modes** (`planMerchantRazorpayBillingCheckout`):
1. `free_activation` — ₹0, no provider call.
2. `razorpay_subscription` — **native recurring**, bound to `plans.razorpay_plan_id_monthly/yearly`. *The provider plan holds the catalog price.*
3. `razorpay_order` — one-time **server-authoritative** order (amount computed in-app).

Plus UPI AutoPay mandates (`planSandboxUpiAutopayMandate`) for recurring autopay (sandbox today; `LETBUYY_AUTOPAY_MODE` gates live).

**Today there is no per-merchant price lock**: every path reads catalog pricing. Recurring renewals (native subscription / mandate) would charge a founder the catalog price on cycle 2+. This is the gap the lock closes.

## The core problem with native Razorpay subscriptions

A `razorpay_plan_id` is a **provider-side** object whose amount is fixed to the catalog price. It **cannot** represent a per-merchant locked amount. Therefore:

> **Founding merchants must never be billed via `razorpay_subscription` mode bound to a catalog `razorpay_plan_id`. Founders are billed via server-authoritative `razorpay_order` / UPI-AutoPay-mandate mode, where the app computes the locked amount each cycle.**

This is enforced in `planMerchantRazorpayBillingCheckout`: when a founding lock is present, the chosen mode is forced to order/mandate.

## Enforcement design (single source of truth)

Two new billing-core primitives + one DB RPC, applied at every charge site:

1. **`applyFoundingLockToPlan(plan, foundingLock)`** (billing-core, pure): returns a clone of the catalog `plan` record with `price_monthly_inr` / `price_yearly_inr` / `promo_price_inr` **overridden** to the locked snapshot when `foundingLock.price_lock_enabled` is true (and `promo_*` zeroed so the locked price is the final price). Because the existing amount functions read the plan record, feeding them a lock-applied plan makes **all** of them compute the locked amount with no per-call-site arithmetic.
2. **`resolveMerchantPricing({ plan, foundingLock })`** (billing-core, pure): the display + decision source → `{ monthlyInr, amountMinor, isFounding, savingsInr }`.
3. **`resolve_merchant_locked_price(p_site_id, p_plan_slug)`** (SECURITY DEFINER RPC): server authority returning the effective monthly price (locked snapshot from `sites`/`founding_merchant_allocations` if `price_lock_enabled`, else current catalog). Used by server-side renewal/charge computation and by anything that must not trust client input.

**Charge-site rule:** every site that computes an amount first loads the merchant's founding lock (from `sites`, or `resolve_merchant_locked_price`) and passes a lock-applied plan to `planBillingAmountMinor` / `planMerchantRazorpayBillingCheckout` / `planSandboxUpiAutopayMandate`. This also fixes the **verification threshold** at `payments.ts` (the capture check compares captured ≥ amount; for a founder the amount must be the locked price, else a ₹199 payment would fail a ₹299 check).

## How the lock survives each lifecycle transition

The lock lives on the **tenant** (`sites.{is_founding_merchant, price_lock_enabled, locked_launch_price, locked_growth_price}`) + the immutable `founding_merchant_allocations` snapshot + `pricing_snapshots` audit — **not** on the subscription row. Therefore:

| Transition | What happens | Lock survives? |
|---|---|---|
| **Renewal** | each cycle recomputes amount via lock-applied plan / `resolve_merchant_locked_price` | ✅ amount = locked |
| **Upgrade** (Launch→Growth) | new activation; reads `sites` lock → `locked_growth_price` | ✅ locked target price |
| **Downgrade** (Growth→Launch) | new activation; reads `locked_launch_price` | ✅ locked target price |
| **Cancellation** | `subscriptions.status='cancelled'`; `sites` founding columns untouched | ✅ retained (lifetime) |
| **Reactivation** | re-activation; allocation idempotent on `site_id`; lock re-applied from `sites` | ✅ no new slot, locked price |
| **Catalog price change** | only `plans` mutated + new `pricing_snapshots` row | ✅ founders read snapshot → zero effect |

## Future catalog price change — zero effect on founders (by construction)

A price change is an UPDATE to `plans` (+ an append to `pricing_snapshots`). Founder pricing is read from `sites.locked_*` / `founding_merchant_allocations.locked_*`, which are **written once at allocation and never recalculated** (no code path updates them except the ≤14-day refund reclaim, which clears them). Therefore a future `plans` change is invisible to existing founders. This is verified path-by-path in `PRICE_LOCK_VERIFICATION.md`.
