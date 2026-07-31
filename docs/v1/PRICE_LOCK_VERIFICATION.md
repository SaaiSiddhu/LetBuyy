# Lifetime Price Lock — Verification & Proof

> Proves two invariants:
> - **I1:** a founding merchant can never accidentally be charged catalog pricing on any path.
> - **I2:** future plan-catalog price changes have **zero** effect on existing founders.
>
> Method: enumerate **every** code path that computes a subscription charge amount (from a full source sweep), and show each is routed through the lock. If any path cannot be proven, implementation STOPS for that path.

## Complete charge-amount path inventory

Source sweep (`grep planBillingAmountMinor | planMerchantRazorpayBillingCheckout | planSandboxUpiAutopayMandate | amount_paid` across `services/api-gateway/src`):

| # | Path (file:line) | Trigger | Current price source | Locked price source (after) | Mode | Migration strategy | Risk |
|---|---|---|---|---|---|---|---|
| 1 | `lib/subscription-checkout.ts:60` `planMerchantRazorpayBillingCheckout` | Initial purchase (UI checkout) | catalog `plan.price_monthly_inr` | `applyFoundingLockToPlan(plan, lock)` before checkout; **force `razorpay_order` mode** for founders | order/sub | load `sites` lock → lock-applied plan; reject native-sub mode if locked | **HIGH** |
| 2 | `routes/payments.ts:902` `planBillingAmountMinor` | Live Razorpay **verify+activate** | catalog | lock-applied plan ⇒ `amountPaid` = locked; capture check compares captured ≥ **locked** | order | apply lock before line 902 (fixes charge **and** verification threshold) | **HIGH** |
| 3 | `routes/billing.ts:229` `planBillingAmountMinor` | Sandbox UPI-AutoPay `/subscribe` (recurring) | catalog | lock-applied plan ⇒ locked each cycle | mandate | apply lock before line 229 | **HIGH** (recurring) |
| 4 | `routes/billing.ts:183` `planSandboxUpiAutopayMandate` | Mandate registration amount | catalog | lock-applied plan ⇒ mandate amount = locked | mandate | apply lock before line 183 | **HIGH** (recurring authority) |
| 5 | `routes/internal-billing.ts:115` `planBillingAmountMinor` (or `body.amountPaid` override) | Internal/admin activation | catalog or explicit override | lock-applied plan when no override; admin override audited | order | apply lock when override absent | **MED** |
| 6 | `execution/subscription-execution.adapter.ts:88` `amount_paid: input.amountPaid` | Persists amount (all callers) | value passed in (paths 1–5) | inherits locked value from caller | — | no change (sink, not a source) | **LOW** |
| 7 | `createRazorpaySubscription` `subscription-checkout.ts:108` | Native recurring provider object | `plans.razorpay_plan_id_*` (catalog, provider-side) | **N/A for founders — disabled** (can't carry per-merchant price) | sub | founders never use this mode | **HIGH (excluded)** |

There are no other charge-amount computation sites (themes/app-store `createRazorpayOrder` calls are unrelated domains: theme purchases / app billing, not merchant subscriptions).

## Proof of I1 (no accidental catalog charge)

Every founder charge funnels through paths 1–5. Each path is modified to first load the merchant's founding lock and pass a **lock-applied plan** to the amount function. Two structural guarantees back this:
- **Single override point:** `applyFoundingLockToPlan` is the only transform; the amount functions are unchanged, so there is no second arithmetic path that could bypass the lock.
- **Native-subscription exclusion (path 7):** the one mode that cannot carry a per-merchant price is disabled for founders in `planMerchantRazorpayBillingCheckout`, so a founder is never bound to a catalog-priced `razorpay_plan_id`.
- **Verification threshold (path 2):** because the live capture check compares `captured ≥ amountPaid` and `amountPaid` is now the locked amount, a founder paying the locked price passes verification (and a non-founder still must pay catalog). This closes the only place where a "lower locked payment" could have been rejected.

A contract test asserts each of paths 1–5 calls the lock resolver before the amount function (source-level), plus a billing-core unit test asserts `resolveMerchantPricing(founder) = lockedPrice` and `≠ catalogPrice`.

## Proof of I2 (catalog changes don't affect founders)

- Founder prices are read **only** from `sites.locked_*` and `founding_merchant_allocations.locked_*`.
- Those columns are **written once** by `allocate_founding_merchant()` (snapshot from `founding_merchant_program.launch_price/growth_price` at allocation time) and are **never updated** by any path except `reclaim_founding_merchant()` (≤14-day refund), which clears them entirely (the merchant is no longer a founder).
- A catalog price change is an UPDATE to `plans` (+ append-only `pricing_snapshots`). No catalog-change path writes `sites.locked_*` or `founding_merchant_allocations.locked_*`.
- Therefore the set of writers to founder-price columns is disjoint from the set of catalog-change writers ⇒ catalog changes are invisible to founders. ∎

A test changes a `plans` price after a simulated allocation and asserts `resolve_merchant_locked_price` (and `resolveMerchantPricing`) for the founder is unchanged.

## Residual risks (honest)
- **R1 — live verify idempotency:** `payments.ts` verify is not idempotency-keyed; rapid double-submit could create two subscription rows (allocation itself is idempotent on `site_id`). Mitigation: add an idempotency key on the verify path (recommended) + allocation no-op on existing `site_id`.
- **R2 — live UPI AutoPay not yet enabled:** mandates are sandbox (`LETBUYY_AUTOPAY_MODE`). When live AutoPay ships, path 3/4 must be re-verified to apply the lock at the real provider charge (HUMAN-REQUIRED gate already present in `billing.ts`).
- **R3 — Razorpay native subscription dunning:** since founders use order/mandate mode, native-subscription dunning does not apply to them; non-founders unaffected.

**Verdict:** I1 and I2 are provable given the single-override-point design + native-sub exclusion. Implementation may proceed.
