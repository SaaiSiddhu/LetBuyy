# DOCUMENT 5 — MONEY CERTIFICATION PROGRAM

**Scope:** Phase D. Prove **order → payment → capture → ledger → settlement → refund** end-to-end on live rails. This program is the *live certification* layer over the already-executed repo-side work: capture/refund ledgering (migration 168, CAP-C01/C02 repo-side DONE), Route payout client (CAP-C03), settlement executor + dedupe (CAP-C05), reconciliation refresher + dual-control operator resolve (CAP-C04). The design authority is `FINAL_TRUTH_AUDIT_2026_06_11/MONEY_UNIFICATION_IMPLEMENTATION_PLAN.md` — its invariants are restated here as the certification bar, not redesigned.

**Frozen context:** one canonical append-only double-entry ledger = sole money truth; 0% commission (validator-ratcheted); PA-split (Razorpay Route) only; projections are read-only. Validators already enforce the statics; **this phase proves the dynamics on real money.**

## 1. ACCOUNTING INVARIANTS (the bar every scenario must hold)

- **I1 Double-entry:** every money event posts balanced debit/credit lines; sum of lines per entry = 0.
- **I2 Append-only:** no UPDATE/DELETE on posted ledger rows; corrections are reversing entries.
- **I3 Provider conservation:** for any window, provider-captured − provider-refunded − provider-fees = Σ canonical entries for that window ± explained suspense.
- **I4 Merchant conservation:** merchant payable balance = Σ(captures) − Σ(refunds) − Σ(payout releases) per merchant, derivable from ledger alone.
- **I5 Zero rake:** platform commission lines = 0 bps everywhere (AI-credit purchases are merchant-pays-platform product revenue, distinctly accounted — not commission).
- **I6 Idempotency:** replaying any webhook/job produces zero duplicate entries (provider-reference dedupe).
- **I7 Single writer:** only the canonical ledger module writes money truth; projections never written by hand.
- **I8 COD symmetry:** COD remittance follows the same capture→ledger path with carrier-remittance as the provider leg.

## 2. CERTIFICATION SCENARIOS (live, small-value, real rails)

Run each scenario class on staging-against-live-sandbox first, then production with ₹-small real transactions. Every scenario records: provider IDs, ledger entry IDs, projection deltas, reconciliation result.

| # | Scenario | Pass condition (beyond I1–I8) |
|---|---|---|
| S1 | UPI order → auth → capture → ledger | capture entry within SLA; `capture_posted_to_ledger` true *and provably true* |
| S2 | Card order, capture, **full refund** | reversing entries; merchant payable returns to pre-order value |
| S3 | **Partial refund** ×2 then attempted over-refund | over-refund refused; partials sum correctly |
| S4 | COD order → delivery → carrier remittance | I8; remittance reconciles to order |
| S5 | Capture **webhook lost** (suppress endpoint) → recovery via reconciliation | mismatch queue catches it; dual-control resolve posts the entry; zero silent auto-plug |
| S6 | **Duplicate webhook replay** ×3 | exactly one entry set (I6) |
| S7 | Settlement ingest across 2 days incl. cross-source duplicate | dedupe holds (CAP-C05); settlement entries match provider report |
| S8 | Payout release to merchant via Route | release entry; provider transfer idempotent on retry (CAP-C03); merchant payable decremented exactly once |
| S9 | Payout failure (bad beneficiary) → retry after fix | failure does NOT decrement payable; retry releases once |
| S10 | Refund after settlement (cross-window) | I3 holds across windows; suspense explained then cleared |
| S11 | AI-credit purchase via payment link → webhook → credit grant | grant deferred until webhook+ledger evidence (commit `533479cb` behavior); ledger posting distinct from commerce flows |
| S12 | Mid-flow crash injection (kill worker between provider call and ledger post) | recovery job or reconciliation completes the post; no double entry |

## 3. RECONCILIATION PROCEDURES (operational, daily)

1. **Automated daily refresh** (repo-side scheduled job, CAP-C04): provider statement vs ledger vs projections → mismatch queue.
2. **Queue discipline:** every mismatch is resolved by a human through the dual-control resolve/recheck path with a reason code — **the auto-plug pattern is dead and stays dead**; any unexplained item > 24h pages (Document 4 §3).
3. **Daily close:** I3/I4 checked over the day window; suspense ledger lines must be zero or each carry an explanation reference.
4. **Certification soak:** 7 consecutive production days with zero unexplained breaks = reconciliation certified (SKIP-D5-LIVE-MONEY-RECONCILIATION evidence).

## 4. VALIDATION GATES (Phase D exit)

G-D1 all 12 scenarios pass in production with evidence rows · G-D2 7-day clean soak · G-D3 invariant queries I1–I8 run green against the live DB (saved as executable evidence queries) · G-D4 money alert pages tested (S5 must have actually paged) · G-D5 ARB/finance sign-off row; seams CAP-C01…C05, SKIP-D5, HR-PA-SPLIT-LIVE, SKIP-MERCHANT-PSP-LIVE-CREDENTIALS superseded.

## 5. ROLLBACK PROCEDURES

- **Scenario-level:** every live test order is refunded/voided provider-side at scenario end; ledger reflects via normal reversing flow (tests leave zero net balance).
- **Defect found mid-phase:** STOP scenarios; if repo fix needed → fix on branch, gate+tests, deploy via Phase A pipeline; **never** hand-edit ledger rows; correction entries only (I2).
- **Catastrophic (wrong money moved):** freeze payouts (provider console kill-switch — provision this in Phase C), provider-side reversal where possible, reversing entries otherwise, incident row, postmortem before resuming.
- **Phase abort:** payouts frozen state is safe-stop: captures continue accruing to merchant payable honestly; merchants paid manually via provider console against ledger evidence until resumed.
