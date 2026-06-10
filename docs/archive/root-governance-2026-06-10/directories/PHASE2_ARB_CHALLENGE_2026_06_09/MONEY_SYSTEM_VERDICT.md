# ARB CHALLENGE — Money & Commerce System Verdict (Phase 2)

**Date:** 2026-06-09
**Reviewers:** Principal FinOps Architect + Commerce Core Architect (ARB Challenge panel)
**Decision context:** ₹10-crore / 2-year commitment. Mandate: confirm / refute / sharpen the prior money verdict (`LETBUYY_MASTER_FORENSICS_AND_FOUNDATION_VERDICT.md` Phase G; `FOUNDATION_FORENSICS_2026_06_09/LETBUYY_FOUNDATION_FORENSICS.md`) and find what was MISSED.
**Method:** READ-ONLY. Trust only code + migrations + runtime wiring. Every claim carries `path:line`.
**Scope audited:** `services/api-gateway/src/routes/{payouts,settlements,commission,wallet,cod-reconciliation,payments,checkout,orders}.ts`, `packages/billing-core/src/index.ts`, `packages/infrastructure/payout-transfer-adapter/index.ts`, `database/supabase/migrations/{119,139,140,151}*.sql`, `services/api-gateway/src/__tests__/money.test.ts`.

---

## Headline

The prior verdict's three pillars are **CONFIRMED** (real append-only double-entry ledger; fabricated payout transfers; capture never posts to the canonical ledger). But the prior verdict **understated the severity** by treating "fabricated payouts" as the headline. The fabricated UTR is the *least* dangerous money bug here because in sandbox no real money moves. **The real headline risks the master missed are runtime-reachable bugs that move or mis-state money even after the rails are made live:**

1. **The merchant payable balance is NOT the canonical ledger.** It is a mutable single-entry sum over `wallet_ledger_entries` (`wallet.ts:70-92`). Two ledgers exist; they are never reconciled to each other in code.
2. **The payout release path has zero locking and no balance check** (`payouts.ts:464-581`) — a concurrent double-release is only *partially* blocked by a unique index, and a merchant can be paid out for money that was never captured or was already refunded.
3. **The platform fee is booked TWICE** into `platform_revenue` (once by payout-statement creation, once by commission reconciliation) off the same `orders.total` rows — the ledger's "platform revenue" is structurally inflated.
4. **Reconciliation is rigged to always net to zero.** `planSettlementLedgerPosting` plugs any discrepancy into the `reserve` account so the posting can never be unbalanced (`billing-core:558,601-615`). "Recon reaches zero" is true only because breaks are auto-absorbed, not because the books are right.
5. **Refunds touch no ledger and corrupt payment state on partial refund** (`payments.ts:763-855`).
6. **The money test-suite is string-matching, not execution** (`money.test.ts`) — it `readFileSync`s the route files and regex-asserts that certain identifiers appear. It proves nothing about correctness, which is why all of the above survived.

**Corrected money/foundation score: 38/100** (down from the master's 58/100 for the money subsystem). Rationale below.

---

## The 7 Phase-G Questions — Answered (YES/NO + evidence)

### Q1. Is the ledger AUTHORITATIVE, or a side-record? What is the source of truth for a merchant's payable balance?
**ANSWER: NO — the canonical ledger is a side-record. The merchant's payable balance is a mutable single-entry projection, not the ledger.**

- The merchant-facing balance (`available_minor`, `pending_minor`, `held_minor`) is computed by summing signed `wallet_ledger_entries` rows in application code: `summarize()` at `wallet.ts:70-92`, `signedAmount()` at `wallet.ts:65-68`. The query reads `wallet_ledger_entries` only (`wallet.ts:124-130`).
- The canonical ledger (`ledger_entries` / `merchant_payable` account) is fetched **separately and informationally** as `canonical_ledger` (`wallet.ts:95-118, 136`) and is **never** used to drive the merchant's spendable balance, and is **never reconciled** against the `wallet_ledger_entries` sum anywhere in the codebase.
- Grep for any route deriving a payable balance from `merchant_payable` / canonical ledger returns nothing in `routes/`. The authoritative number a merchant sees and can draw down is the mutable `wallet_ledger_entries` aggregate.

**Verdict:** Two ledgers. The "real" double-entry ledger (`migrations/139`) is a downstream shadow; the *operative* balance is the single-entry `wallet_ledger_entries`. The master flagged "two ledgers" but did not state the decisive consequence: **the canonical ledger is not the source of truth for the one number that controls money leaving the platform.**

### Q2. Can reconciliation EVER reach zero given capture isn't posted but settlement/payout are? Is the ledger seeded consistently?
**ANSWER: It "reaches zero" trivially and meaninglessly — and the ledger is NOT seeded consistently.**

- Capture never debits `pa_clearing` (no route calls `buildPaymentCaptureLedgerPosting`; confirmed by master, re-confirmed: the only `pa_clearing` debit comes from settlement postings in `billing-core:559-567`). So `pa_clearing` is only ever credited by payout release (`billing-core:657-661`) and debited by settlement ingest — the inbound leg is missing entirely.
- `ledger_balance_breaks()` (`migrations/139:344-356`) will *always* report zero because **every posting is forced to self-balance by construction**: `planSettlementLedgerPosting` computes `reconBreakMinor = grossAmountMinor - declaredCreditMinor` and adds a `reserve` debit/credit line to absorb the remainder (`billing-core:558, 601-615`), then asserts `debit === credit` (`billing-core:623-625`). A posting that *would* be unbalanced is simply re-routed into the reserve suspense — it cannot surface as a break.
- Therefore the ledger can never detect a real reconciliation break against an external feed; "recon = 0" is a tautology, not evidence of correctness. And because the inbound capture leg is absent, the ledger is **not seeded consistently** with the actual money-in events — it is seeded only with synthetic settlement projections computed from `orders.total`.

### Q3. Can payouts be trusted? Idempotency/locking against double-release? Maker-checker (Freeze-mandated) gate?
**ANSWER: NO. No row-lock; partial double-release protection only; maker-checker is dead code on the wrong table.**

- **No locking.** The settle path reads the statement with `.maybeSingle()` and **no `SELECT … FOR UPDATE`** (`payouts.ts:468-473`). Grep confirms **zero** pessimistic locking / advisory locks in `payouts.ts`, `wallet.ts`, `commission.ts`, `cod-reconciliation.ts`.
- **Race window (double-release):** two concurrent `POST /:id/settle` both read `status='pending'`, both pass the guard (`payouts.ts:482-485`), both flip to `processing` with **no status-conditioned WHERE / CAS** (`payouts.ts:499-503`), both call the adapter, both post the release. The canonical release ledger posting dedupes via `ON CONFLICT` on idempotency `payout-release:${id}` (`migrations/139:281-292`), and the `payout_debit` wallet insert is guarded by the unique index `idx_wallet_ledger_site_idempotency` on key `payout-debit:${id}` (`migrations/119:141-143`). **So the *second* request throws a 23505 instead of cleanly being a no-op** — the double-debit is prevented by an unhandled DB error, not by design. The statement row, however, is updated by both writers with no optimistic-version guard, and the provider transfer is *initiated twice* against the real provider in live mode (`payouts.ts:514-521`) before the wallet insert collides. **In live mode this is a real double-send.**
- **No balance check.** The settle path pays `statement.net_amount_minor` (`payouts.ts:517`) with **no check that the merchant's `wallet_ledger_entries` available balance covers it** and no check that the underlying orders are still `paid` / not refunded.
- **Maker-checker is dead.** The `payouts` table (`migrations/151:111-138`) carries `maker_actor_id`, `checker_actor_id`, `requires_step_up`. But: (a) only `maker_actor_id` is ever written (`settlements.ts:292`); `checker_actor_id` is **never written or read anywhere** in `services/` or `packages/`; and (b) the real merchant payout *release* runs on the **different** `payout_statements` table (`payouts.ts`), which has **no maker/checker columns at all**. The Freeze-mandated four-eyes gate exists only as unused schema on an orphaned table. The reachable release path is single-actor with step-up only (`payouts.ts:487-496`).
- **Orphaned payout system:** the `payouts` (151) table is only ever inserted with `status:'scheduled'` (`settlements.ts:280-298`); **no route transitions it to processing/paid**. It is a dead parallel payout subsystem.

### Q4. Is settlement MATHEMATICALLY correct? Audit fee/commission/GST/rounding.
**ANSWER: Mostly integer-safe (no float in the hot path), BUT there is a structural double-count, a rounding leak, and a float crack in COD/storefront.**

- **Integer math is used** for the core split: `platformFeeMinor = Math.round(grossAmountMinor * commissionBps / 10000)`, `taxMinor = Math.round(platformFeeMinor * 1800 / 10000)`, `netAmountMinor = max(0, gross - fee - tax)` (`payouts.ts:344-346`); commission mirrors this (`commission.ts:292-305`). These are minor-unit integers — no float in the split itself.
- **Rounding leak (favours nobody deterministically):** `Math.round` on both the commission and the GST-on-commission can over- or under-collect by up to 1 paisa per order, and **the leak is never reconciled** — there is no residual line to absorb the sub-paisa difference between `gross` and `fee+tax+net` at the per-order level (unlike settlement ingest, which plugs to reserve). Over millions of orders this is a systematic drift in `platform_revenue` vs `merchant_payable`.
- **Float crack at the money boundary:** money enters as `orders.total` (a *major-unit* numeric/string) and is converted with `Math.round(numberValue(total) * 100)` (`payouts.ts:101-103`, `commission.ts:80-82`, `cod-reconciliation.ts:81-82`). `numberValue` does `Number(value)` on a string (`payouts.ts:92-98`) — i.e. **IEEE-754 float** is the carrier across the boundary. `Number('21474836.48') * 100` and similar are exact enough at small scale but the entire payout base is reconstructed from a float multiply, not from a stored minor-unit column. Combined with Q-NEW-1 (integer column overflow) this is a latent correctness hazard.
- **GST direction:** GST is computed *on the commission* (`fee * 1800/10000`), which is correct for a platform-fee invoice, but it is **also re-booked by commission reconciliation** (see Q-NEW-2) so the *aggregate* GST liability is double-stated.

### Q5. Are balances trustworthy? Can `wallet_ledger_entries` diverge from `ledger_entries`? Two ledgers?
**ANSWER: NO, balances are not trustworthy. YES, the two ledgers can and will diverge. There are unambiguously two ledgers.**

- Divergence is structural, not incidental:
  - **COD remittance writes ONLY to `wallet_ledger_entries`** (`cod-reconciliation.ts:305-326`, entry_type `cod_remittance_credit`) and **never posts to the canonical ledger** — `cod_receivable` (`migrations/139`) is never cleared. So every COD order credits the single-entry wallet but leaves the canonical ledger untouched. Immediate divergence.
  - The payout-statement creation posts a `settlement` canonical transaction AND a separate `wallet_ledger_entries` `payout_credit` (`payouts.ts:385-438`) computed from the *same* numbers — so they happen to agree at creation, but nothing keeps them in sync after edits/refunds, and there is no invariant or job asserting `sum(wallet_ledger_entries) == merchant_payable`.
- Because the merchant draws against the `wallet_ledger_entries` sum (Q1) but the "real" ledger is the canonical one, **the number that authorises money-out is the one that is NOT append-only-enforced** (the canonical 139 tables are append-only via `reject_ledger_mutation`; `wallet_ledger_entries` has a normal `update_updated_at` trigger and is freely UPDATE-able — `migrations/119:170-173`).

### Q6. Can MERCHANTS lose money?
**ANSWER: YES — at least three ways.**

- **Partial refund silently voids the rest of the refund** (`payments.ts:773-810`): `refundAmountMinor` may be partial, but the whole payment is set `status:'refunded'`; further refund attempts are then rejected because status≠`captured` (`payments.ts:773`). A merchant who refunds ₹100 of ₹500 can never refund the remaining ₹400 through this endpoint — the customer is owed money the system now refuses to move.
- **COD shortfall handling can shortchange the merchant:** if `deposited < expected` (`short`), the wallet is credited only the lower `deposited_amount_minor` (`cod-reconciliation.ts:311`) yet the entry is marked `short`/closed — the merchant's payable reflects the courier's shortfall as if it were the merchant's loss, with no dispute/claw path.
- **Refund-after-payout double standard:** because the wallet `payout_debit` is permanent and refunds don't reverse anything in the wallet, a refunded sale that was already paid out is never credited back to anyone — the loss simply isn't represented.

### Q7. Can LETBUYY lose money?
**ANSWER: YES — and this is the larger exposure.**

- **Payout with no balance check, on mock-paid orders:** `POST /` builds the payout base from `orders.payment_status='paid'` (`payouts.ts:257-275`). The **default mock capture path drives a payment to `captured` with zero real money** (`payments.ts:600-655`: synthesized `provider_payment_id`, no provider call; mock is the default via `LETBUYY_PAYMENT_MODE || 'mock'`, `payments.ts:130`) and emits `payment.captured`/`payment_status:'paid'` (`payments.ts:659-664`) which projects the order to paid; the same precondition is enforced at `payments.ts:416` (`payment_status === 'paid'` blocks re-session). With no balance check (Q3), a live payout rail would disburse real money against this simulated income.
- **COD over-collection credited to merchant:** if `deposited > expected` (`over`), the wallet is credited the **full** `deposited_amount_minor` (`cod-reconciliation.ts:311`), i.e. LetBuyy credits the merchant for an overage it may not actually hold/owe — a direct platform liability.
- **Double-booked platform revenue masks under-collection:** because `platform_revenue` is credited twice (Q-NEW-2), finance reports show 2× the commission actually owed; the discrepancy with cash will only appear at PA reconciliation, by which point payouts (net of single fee) have already gone out.
- **Refund-after-payout is an uncovered loss** (Q6) with no ledger entry to even detect it.
- **Live double-send window** (Q3): concurrent settle initiates the provider transfer twice before the wallet unique-index collision aborts the second writer.

---

## Checkout / Cart / COD truth

- **Checkout confirm creates NO order and captures NO payment.** `POST /:cartId/confirm` (`checkout.ts:454-509`) revalidates inventory/coupons, flips `checkout_sessions` to `completed`, and sets the cart to `converted` (`checkout.ts:494-509`). There is **no `orders` insert, no payment capture, no inventory commit** in the terminal step. The payment-intent is a fabricated id `${provider}_${mode}_${uuid}` (`checkout.ts:435`), live mode is a 503 (`checkout.ts:427-431`). **Confirmed: the hosted checkout does not materialise an order or move money** — the consumer money-in flow is not wired.
- **Cart server-authoritativeness:** the handoff is HMAC-signed/timing-safe (per master, `checkout.ts:161`) and confirm re-validates reservations server-side, so the cart *contents* are server-checked — but since no order/payment is produced, the question is moot for money: the authoritative money event simply never happens here.
- **COD reconciliation correctness:** entries are backfilled from `orders.payment_method='cod'` (`cod-reconciliation.ts:347`, `ensureEntriesForCodOrders`); collection records `collected_amount_minor` (`cod-reconciliation.ts:354-373`); reconcile computes `difference = deposited - expected` and status short/over (`cod-reconciliation.ts:276-278, 395-403`). **The math is correct; the accounting is not** — it writes single-entry to the wallet only, never to canonical `cod_receivable`, and credits the merchant the *deposited* (not *expected*) amount, baking courier shortfall/overage straight into the payable (Q6/Q7).

## Who writes the migrations/119 integer-overflow tables — are they live?
**LIVE and on the default path.** `payout_statements`, `wallet_ledger_entries`, `commission_reconciliation_entries` use `*_minor integer` (`migrations/119:16-19, 52, 107-112`). Writers are real, reachable routes mounted in `index.ts:717-720`: `payouts.ts` (statements + wallet, `payouts.ts:352-401, 561-577`), `commission.ts` (`commission.ts:314-318`), `cod-reconciliation.ts` (wallet, `cod-reconciliation.ts:305`). Postgres `integer` caps at 2,147,483,647 minor = **₹21,474,836.47**; a single statement or wallet row above that **overflows / errors**. The canonical ledger (139) and `settlements`/`payouts` (151) correctly use `bigint`, so the *operative* compatibility tables are the ones that overflow. The earlier `migrations/109_orders_money_width.sql` widened orders but **not** these mobile tables.

---

## NEW FINDINGS the master MISSED (each: claim — evidence — severity)

**NEW-1 — Merchant spendable balance is the mutable single-entry table, not the append-only ledger.**
The number that authorises money-out (`available_minor`) is summed from freely-UPDATE-able `wallet_ledger_entries` (`wallet.ts:70-92, 124-130`; table has only `update_updated_at`, `migrations/119:170-173`), while the append-only canonical ledger is informational (`wallet.ts:95-118, 136`). The master noted "two ledgers" but not that the *trusted* one is the *un-protected* one.
**Severity: CRITICAL.**

**NEW-2 — Platform fee + GST are double-booked into `platform_revenue` / `gst_payable`.**
`payouts.ts POST /` credits `platform_revenue` (and `gst_payable`) via `planSettlementLedgerPosting` off paid orders (`payouts.ts:404-426`), and `commission.ts /reconcile` independently credits `platform_revenue`/`gst_payable` off the **same** `orders.payment_status='paid'` rows (`commission.ts:288-342`). Both read the same orders; neither excludes the other's coverage. The canonical ledger therefore records platform revenue ~2×.
**Severity: HIGH (financial-statement integrity).**

**NEW-3 — Reconciliation cannot detect a break; it auto-plugs to `reserve`.**
`reconBreakMinor` is computed and then *absorbed* by a reserve line so the posting always balances (`billing-core:558, 601-615, 623-625`). `ledger_balance_breaks()` is structurally always zero. "Recon = 0" is a tautology, not a control.
**Severity: HIGH.**

**NEW-4 — Payout release has no row lock and no balance check; live mode can double-initiate the provider transfer.**
No `SELECT … FOR UPDATE` and no status-CAS in the settle path (`payouts.ts:468-503`); pays `net_amount_minor` with no wallet-balance verification (`payouts.ts:517`). Concurrent requests both call `adapter.initiateTransfer` (`payouts.ts:514-521`) before the wallet unique index aborts the loser. The double-debit is blocked only by an unhandled 23505, not by design.
**Severity: CRITICAL (in live mode = double money-out).**

**NEW-5 — Refunds post nothing to the canonical ledger; `refund_clearing` account is dead; partial refund corrupts state.**
`POST /:paymentId/refund` (`payments.ts:763-855`) updates only `payments.status='refunded'` + a `payment_attempts` row; **no `post_settlement_ledger_transaction`, no `merchant_payable` claw-back, no wallet debit**. The `refund_clearing` ledger account (defined `migrations/139`) is never used by any route. Partial refunds set the whole payment to `refunded` (`payments.ts:796`), blocking the remainder (`payments.ts:773`) while leaving the order in the `paid` payout base.
**Severity: CRITICAL.**

**NEW-6 — The "money" test-suite executes no money logic; it regex-matches source files.**
`money.test.ts` `readFileSync`s the route/migration/adapter files and asserts that identifiers/strings are present (`money.test.ts:5-14, 30-60`). It never invokes a handler, never asserts a balance, never tests concurrency, rounding, or double-release. This is why every finding above is green in CI. It is governance-theater testing, not verification.
**Severity: HIGH (false assurance; it is the reason these bugs shipped).**

**NEW-7 — COD remittance never reaches the canonical ledger and credits *deposited* not *expected*, baking courier shortfall/overage into merchant payable.**
COD reconcile writes a single-entry `wallet_ledger_entries` credit for `deposited_amount_minor` only (`cod-reconciliation.ts:305-326`), with no canonical `cod_receivable` clearing. `over` over-credits the merchant (platform liability); `short` under-credits with no dispute path (merchant loss).
**Severity: HIGH.**

**NEW-8 — Two parallel payout subsystems; the four-eyes (maker-checker) gate guards the dead one.**
`payouts` (151) carries `maker/checker` columns (`migrations/151:126-129`) but is only ever set to `scheduled` (`settlements.ts:280`) and never released by any route. The reachable payout is `payout_statements` (`payouts.ts`), which has no maker/checker columns. `checker_actor_id` is never written/read anywhere. The Freeze-mandated approval control is enforced on a table that never moves money.
**Severity: HIGH (control exists on paper, absent in the live path).**

**NEW-9 (bonus) — `integer` minor-unit overflow is on the live, default tables; canonical layer is safe but unused for balance.**
`payout_statements`/`wallet_ledger_entries`/`commission_reconciliation_entries` are `integer` minor (`migrations/119:16-19, 52, 107-112`), overflow at ₹2.14 cr per row, and are the *operative* tables (mounted at `index.ts:717-720`). Master flagged the width bug but as a "mobile compatibility" footnote; it is in fact the spending-balance path.
**Severity: MEDIUM-HIGH.**

---

## Prior findings REFUTED / re-weighted

- **REFUTED (severity correction, not factual):** The master frames **"fabricated payouts" (fake UTR) as the dominant money risk.** It is real (`payout-transfer-adapter/index.ts:82-103`) but it is the *safest* failure mode: in sandbox (the default, `payouts.ts:116`) no real money moves, so a fake UTR harms no one. The genuinely dangerous bugs are the ones that bite **the moment the rail is made live**: no-balance-check + no-lock double-release (NEW-4), double-booked revenue (NEW-2), refund-with-no-ledger (NEW-5), and the wallet (not ledger) being the source of truth (NEW-1). **Re-rank: the fabricated UTR is a P2 "not wired yet"; the double-release/refund/double-book bugs are P0 design defects that survive go-live.**
- **REFUTED (specific sub-claim):** A naive reading of `cod-reconciliation.ts` suggests the COD wallet insert violates the `wallet_ledger_entries_type_check` constraint (119 lists only payout_*/adjustment/hold/release). **This is NOT a bug** — `migrations/140:7-17` widens the enum to include `cod_remittance_credit`, applied before 151. COD inserts succeed. (Flagging so the panel doesn't chase it.)
- **SHARPENED:** The master's "ledger is a downstream projection of `orders.total`" is correct but soft. The sharper statement: **the ledger is not just downstream — it is non-authoritative for both money-in (capture absent) and money-out-authorisation (wallet sum, not ledger, gates payouts), and is self-balancing by construction so it cannot raise an alarm.** A correctly-built kernel (139) is wired in a way that neutralises every property that made it trustworthy.

---

## Money-flow integrity verdict

**The double-entry ledger kernel (`migrations/139`) is genuine and well-built — and is architecturally bypassed at every point where it would matter.** Money-in (capture) never posts to it; money-out authorisation reads a different, mutable, integer-width, single-entry table; reconciliation is rigged to balance; revenue is double-booked; refunds and COD never touch it; the approval gate guards an orphan table; and the test-suite that "covers" all of this only greps source strings. The platform can *take* money (real inbound webhook HMAC verification is the one production-grade piece) but it cannot correctly *hold*, *reconcile*, or *release* it, and several defects (double-release, refund-state corruption, no-balance-check payout, double-booked revenue) are **runtime-reachable today and will cause real losses the instant live rails are connected** — they are not "unconfigured integration" gaps, they are logic defects.

**Corrected money subsystem score: 38/100.** (Master: 58/100 foundation overall, money rated as the strongest schema with simulated rails.) The downgrade reflects that the prior score gave heavy credit for the *schema* of the ledger and controls while the *wiring* nullifies them, and that ≥6 of the defects found here are correctness bugs (not "mock by default") that the schema-credit masked. For a ₹10-cr money-movement bet, this subsystem is **NOT acquirable/launchable as-is**; it requires: (1) make the canonical ledger the single source of truth for balance; (2) lock + balance-check + four-eyes on the *reachable* payout path; (3) post capture and refund to the ledger; (4) deduplicate fee booking; (5) widen the 119 tables to bigint; (6) replace string-match tests with executing money tests including a concurrency/double-release test.
