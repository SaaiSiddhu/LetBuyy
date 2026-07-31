# Founding Merchant Program — Hardening Report

Status of the 8 hardening goals + the final stop conditions. Companion to [`FOUNDING_MERCHANT_IMPLEMENTATION_REPORT.md`](./FOUNDING_MERCHANT_IMPLEMENTATION_REPORT.md).

## 1. Canonical activation definition
Single source of truth: [`FOUNDING_ALLOCATION_DEFINITION.md`](./FOUNDING_ALLOCATION_DEFINITION.md). Eligibility is **exactly** `subscriptions.status='active' AND amount_paid>0 AND sites.trial_status='paid'` — never publish/first-order/signup/registration/waitlist. Enforced inside `allocate_founding_merchant()`; the adapter only delegates. No conflicting wording remains in the founding docs/code.

## 2. Renewal price-lock guarantee
**Proven (I1 + I2)** in [`PRICE_LOCK_VERIFICATION.md`](./PRICE_LOCK_VERIFICATION.md). Every charge path feeds a lock-applied plan to the amount function (single override point); founders are forced off native subscription mode (catalog-priced `razorpay_plan_id` nulled) onto server-authoritative order/mandate mode. Evidence: 8 billing-core unit tests incl. "founder charged locked price, never catalog" and "future catalog change does not affect a founder".

## 3. Reclaim lifecycle (events + recovery)
- Event `founding_slot_reclaimed` emitted **atomically** inside `reclaim_founding_merchant()` (payload: site_id, founding_number, allocation_source, release_reason, released_at).
- Automated: Razorpay subscription-refund webhook → `reclaim_founding_merchant()` (≤14d releases; >14d retains historical founder).
- Full event set (atomic, via `outbox_events`): `founding_slot_allocated`, `founding_slot_reclaimed`, `founding_program_full`, `founding_program_paused`, `merchant_price_locked`, `merchant_upgraded`.

## 4. Admin recovery operations (capabilities + audit)
Super-admin only (console → Founding Merchants, behind the internal-secret perimeter): **Manual allocate, Manual reclaim (force), Repair price lock, Reconcile (repair)**, plus Pause/Resume/Disable, search, and CSV export. Every mutating RPC sets `actor_type='super_admin'` and emits an event; allocation/release lifecycle is recorded on `founding_merchant_allocations` (allocated_at/released_at/release_reason/founding_released) and in `outbox_events`. (Actor-id pass-through from the console session is a noted follow-up.)

## 5. Counter drift protection (integrity proof)
- `remaining_slots` is a **GENERATED column** (`total_slots - used_slots`) — structurally cannot drift.
- `CHECK (used_slots <= total_slots)` + per-pool `CHECK`s — capacity can never be exceeded.
- `reconcile_founding_program(p_repair)` compares stored counters vs `COUNT(active allocations)` and returns **healthy | mismatch | repaired**; surfaced in the admin overview and runnable on demand.

## 6. LCIS founding coverage
`/api/founding-program` (+ `merchant-intelligence.json` `foundingProgram` block) answers: how many slots remain · how slots are allocated · who owns pricing · how renewal pricing works · how refund reclaim works · what breaks if allocation fails · what depends on plan pricing · pool distribution. **Live-data law honored**: structure CONNECTED (`structuralConnected: true`), live counts/revenue/conversion **NOT CONNECTED** with exact sources. Nothing fabricated.

## 7. Governance + build status
- **Governance:** tenant-isolation + foundation + production-safety + session-security + operational-lifecycle **PASS**. Design-system ratchet **RED from pre-existing working-tree drift** (not founding); my contribution is net-zero (verified). Founding tables confirmed outside the canonical-ledger money list.
- **Builds:** billing-core (build+18 tests), api-client (build), api-gateway (typecheck+11 tests), webhook-service (typecheck), merchant-control-plane / platform-console / marketing-site (typecheck + full `next build`) — **all green**.

## 8. Risks remaining (honest)
1. No live Postgres concurrency test (race-safety proven by SQL construction; add pgTAP before public launch).
2. Live UPI AutoPay sandbox-gated; recurring lock verified at code path, not the live provider.
3. Pre-existing design-system ratchet must be resolved for a fully green governance gate.
4. Best-effort welcome emails (no retry).
5. Admin actor-id pass-through not yet wired.

## Final stop conditions
| Condition | Status |
|---|---|
| Activation definition singular & unambiguous | ✅ |
| Lifetime price lock proven across every billing path | ✅ (code-only proof; no live PG) |
| Reclaim lifecycle emits auditable events | ✅ |
| Recovery tooling exists | ✅ |
| Counter drift detectable | ✅ |
| LCIS answers founding questions | ✅ |
| Governance passes | ⚠ green except pre-existing design-system drift (not founding) |
| Builds pass | ✅ |
| No duplicate / parallel billing system | ✅ |
| No fabricated LCIS data | ✅ |
