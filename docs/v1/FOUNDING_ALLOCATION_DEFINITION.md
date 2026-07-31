# Founding Allocation — Canonical Definition (Single Source of Truth)

> This document is the **one** authority for *when a founding slot is allocated*. Any other wording in specs, research docs, code comments, or reports that conflicts with this is wrong and must be corrected to match this file.

## The canonical eligibility predicate

A founding slot is allocated **if and only if all three are true at the moment of subscription activation**:

```
subscriptions.status = 'active'
AND subscriptions.amount_paid > 0      -- a real payment was captured (server-verified)
AND sites.trial_status = 'paid'
```

Nothing else gates allocation. There is no fourth condition.

## Explicitly NOT part of the predicate

Allocation MUST NOT depend on, wait for, or be triggered by any of:

- `sites.published = true` / "live store" / storefront deployed
- first order / first customer / any GMV
- signup / account creation
- registration
- waitlist join / waitlist position
- email verification, onboarding completion, theme published, custom domain verified

These events are irrelevant to founding allocation. A merchant who has paid is a founding candidate even if their storefront is still a draft.

## Where this predicate is enforced (single chokepoint)

1. **Trigger site:** `SubscriptionExecutionAdapter.activateMerchantSubscription()` (`services/api-gateway/src/execution/subscription-execution.adapter.ts`). This is the only place the call is made, reached by all paid-activation paths (live Razorpay verify `routes/payments.ts`, sandbox autopay `routes/billing.ts`, `routes/internal-billing.ts`). The adapter passes IDs only.
2. **Authority:** the predicate is evaluated **inside** the SECURITY DEFINER RPC `allocate_founding_merchant(p_site_id, p_subscription_id, p_idempotency_key)` — it re-reads `subscriptions` and `sites` from the DB and checks the three conditions itself. The adapter does not decide eligibility (keeps it a thin DB-RPC caller, honoring its runtime-bridge contract).
3. **Plan gate (additional, not part of "activation"):** only `launch` and `growth` consume founding slots; `scale`/`commerce_os` are `coming_soon` + `purchasable=false` and never reach a paid activation.

## Why `amount_paid > 0` and not "store activated"

The earlier spec drift between *"Store Activated"* and *"Subscription Active + Payment Captured + Trial Status Paid"* is resolved permanently here in favor of the latter. Rationale:
- It is the strongest, fraud-resistant signal: on the live path the gateway has already confirmed Razorpay **captured** ≥ the plan price (`payments.ts` capture check) before `amount_paid` is set.
- "Activated"/published is a UI/lifecycle state a merchant may never reach; gating on it would strand paid customers and leak the program window.
- All three conditions are co-located and atomically observable at `activateMerchantSubscription`.

## Idempotency & safety (summary; full design in the RPCs)

- The allocation is **idempotent** on the unique `founding_merchant_allocations.site_id` — a retry/second activation never double-allocates.
- It is **non-fatal**: if allocation fails or the program is full/paused, the paid subscription still succeeds at the regular price. Allocation never blocks billing.

## Cross-references
- Renewal price-lock proof: [`PRICE_LOCK_VERIFICATION.md`](./PRICE_LOCK_VERIFICATION.md)
- Subscription/billing research: [`FOUNDING_MERCHANT_RESEARCH.md`](./FOUNDING_MERCHANT_RESEARCH.md)
- Refund reclaim (≤14 days): see `reclaim_founding_merchant()` in `177_v1_founding_program_rpcs.sql`
