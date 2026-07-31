# 05 — Phase 4.5 Certification Decision

**Date:** 2026-06-19 · **Branch:** `stepup/main` · **Scope:** Merchant Control Plane execution wave

## Decision: ⛔ PHASE 4 NOT COMPLETE — but with the strongest verified progress yet, and the remaining blockers precisely classified.

This was an execution wave (not audit). It closed the #1 gap (customer detail) and three backend gaps, **all compile-verified, contract-tested, and regression-clean**. It is *not* full completion: the objective — a production-grade OS for the entire create-store → launch flow without developer involvement — still has breadth gaps and, fundamentally, **cannot be flow-certified in an environment with no running authenticated merchant stack.**

## Readiness scorecard (Δ vs Phase 4)
| Domain | Phase 4 | Phase 4.5 |
|---|---|---|
| Products | 72% | 72% |
| Collections | 62% | 62% |
| Inventory | 40% | 40% |
| Orders | 62% | 62% |
| **Customers** | **25%** | **~55%** ▲ (detail page built) |
| Discounts | 85% | 85% |
| **Analytics** | 68% | **~72%** ▲ (real revenueByMonth) |
| Domains | 93% | 93% |
| **Shipping** | 75% | **~78%** ▲ (rate-edit proxy) |
| Settings | 84% | 84% |
| **Staff** | 52% | **~53%** (label; enforcement still open) |
| Marketing | 67% | 67% |
| **Merchant Control Plane** | ~65% UI | **~68% UI / ~88% backend** |
| **Shopify parity (est.)** | — | **~62%** |

## This phase — verified
- **Files changed:** 8 (3 new customer files, 4 edits, 1 test file +6 tests).
- **Tests:** merchant-control-plane `tsc --noEmit` EXIT 0 · **177/177** launch · **8/8** merchant-admin contract tests · anti-fabrication PASS · `tsxRawHex` 0 (UI token-clean).
- **Delivered:** customer detail page + detail/notes proxies + clickable list rows; shipping rate-edit PATCH proxy; real analytics monthly revenue; staff permission label.

## Known risks / blockers — classified

### A. Impossible to complete from code alone *in this environment*
1. **Flow/visual verification** — every merchant page (incl. the new customer detail) renders only against a running authenticated app + a real store. "Every flow verified" / "no dead UI" cannot be discharged here. **This is the dominant blocker.**
2. **Staff RBAC enforcement** — a security change (a `requireStaffPermission` middleware) that must be verified against the live auth stack or it risks 403-ing legitimate staff. Chipped (`task_5d9af28f`); not blind-applied.
3. **Analytics conversion/traffic** — depend on storefront telemetry writes (`analytics_rollups_daily`); NOT CONNECTED until the storefront emits.
4. **Deploy seams** — H2/H3 (domains DNS/SSL/Vercel), H6 (Resend email).

### B. Code-completable, not yet done (bounded by the no-flow-verification constraint)
5. Inventory: finish or remove the purchase-orders/transfers stubs; surface history. 
6. Products: delete + bulk-delete buttons. Collections: edit/delete page buttons (proxy exists) + smart collections. Shipping: rate-edit UI + non-flat types.
7. Orders: detail page + timeline + returns UI. Settings: email page, payment toggles, policies-storage path. Marketing: campaign UI + abandoned-cart worker.
   - These are each buildable from code, but building more UI I cannot visually verify trades against the mission's "every flow verified / no fabricated completion" rules. I prioritized the highest-value verifiable slice (customers) + clean backend fixes.

### C. Inherited WIP (not this phase)
8. design-system + tenant-isolation validators (cross-app; identical pre-4.5 numbers).

## Path to PHASE 4 COMPLETE
On a running stack: visually verify the customer detail page + notes round-trip → build the remaining UI (item 6/7) with screenshots → implement + test staff RBAC enforcement (item 2) → wire storefront telemetry (item 3) → provision H2/H3/H6. Then re-certify with interaction proof.

## Recommendation
Merge this phase — it is low-risk, verified, and closes the #1 gap. Continue on a running stack for the UI breadth + RBAC; those are the true remaining blockers, and they are operational/verification limits here, not unresolved code defects. **Maximum verifiable completion for this environment has been reached for the customer flagship + backend fixes; the rest requires live verification the engineering sandbox cannot provide.**
