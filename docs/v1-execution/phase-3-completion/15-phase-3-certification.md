# 15 — Phase 3 Certification Decision

**Date:** 2026-06-19 · **Branch:** `stepup/main`

## Decision: ⛔ PHASE 3 NOT COMPLETE — denied with evidence.

The end-to-end objective is `Browse → Cart → Pay → Order → Notify → Refund → Settle → **Merchant Paid**` without state/money/inventory divergence or security violation. The **engineering for the customer→order→refund half is sound, money-safe, and was hardened further this phase.** But the "**Merchant Paid**" terminus and "no divergence" *proof* are structurally un-completable in this environment.

## This phase's verified work
- **G7 (FIXED + verified):** `markOrderRefunded` now refuses to refund a never-captured order (out-of-order webhook → no state corruption). Webhook typecheck clean · `lb-webhook-ordering` 2/2 · webhook suite 12/12 · 169/169 launch · canonical-ledger PASS.
- Carried baseline (prior waves, not redone): COD inventory leak fix, gift-card refund restore, shippingRateId propagation, the money-integrity audit.

## Readiness (honest)
| Dimension | Score |
|---|---|
| Checkout | ~80% |
| Payments | ~80% (capture/refund money-safe; G7 closed) |
| Refund | ~85% |
| COD | ~78% |
| Shipping | ~85% (rate propagation fixed; live carrier = V1.1) |
| Security | ~90% |
| Infrastructure | ~15% code / ~85% human-gated |
| **Platform (engineering)** | **~94%** |

## Why NOT COMPLETE — hard, evidenced blockers
1. **Live money certs CAP-C01..C04 — NOT STARTED** (need real Razorpay + staging Supabase). The mission forbids fake certification; these cannot be executed here. (`12-live-money-certification.md`.)
2. **H8 Razorpay Route PA onboarding** (regulatory, weeks) — `/payouts/:id/settle` returns 503 in all envs → "Merchant Paid" is structurally unreachable until onboarded.
3. **Human seams H2–H9** (secrets, DNS, prod Supabase, Resend [also order emails + console login], Turnstile, legal) + WABA WhatsApp.
4. **Code-hardening backlog** (documented; mission rule "every fix must be verified" prevents blind application without a stack): COD queue-auto-expiry parity (chipped), webhook inbound tests + DLQ alerting (G4/G5), refund step-up on orders/returns routes (E2), GST `stateCode` (I-2), FORCE RLS on PII tables, payout double-inclusion race (R-03).
5. **Inherited WIP** (not Phase 3): tenant-isolation registry regen, design-system CSS drift, untracked migrations 186/187.

## What IS true (certified at the code/contract level)
- Money cannot disappear/duplicate/diverge on the audited happy paths (canonical SECURITY DEFINER RPCs + ledger 4-tuple dedup + FOR UPDATE; canonical-ledger validator PASS).
- Cannot double-charge (CAP-C01 design) or over-refund (CAP-C02 design).
- No state corruption from out-of-order refund webhooks (G7, fixed + verified this phase).
- No regressions; governance green except the two inherited-WIP reds.

## Path to PHASE 3 COMPLETE
Land the backlog (item 4) on staging with tests → provision H2–H9 + H8 → execute CAP-C01..C04 on staging with real Razorpay → wire the reconciliation alert (R-04) → re-certify. October 1 is achievable **only if H2/H3/H4/H6/H8 are already in flight** (H8 especially — weeks of regulatory lead time).

## Recommendation
Proceed on two tracks: (a) the human-seam + live-cert track (owner: founder/eng/legal) and (b) the verifiable code-hardening backlog (owner: eng, on staging). Re-evaluate Phase 3 for COMPLETE once CAP-C01..C04 pass on staging and H8 is onboarded. The engineering foundation is strong and money-safe; the gates are operational/regulatory/verification — not unresolved code defects.
