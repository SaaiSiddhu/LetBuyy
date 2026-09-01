# MONEY UNIFICATION IMPLEMENTATION PLAN

**Program:** LetBuyy Final Convergence · **Document 2 of 5** · **Status:** PLAN ONLY — no code changes authorized by this document
**Goal:** ONE financial reality — every path money can move posts canonical double-entry ledger lines; no balance, settlement, wallet, or commission system exists outside it.
**Authority:** Strategic winner = **canonical ledger as money SSOT** (ratified, `letbuyy-convergence-audit-2026-06-10`). This plan does not invent a new ledger; it makes the existing one total.
**Evidence base:** FINAL_TRUTH_AUDIT_2026_06_11 Payments audit (Money Integrity 4/10) + direct code re-verification.

---

## 0. WHY THIS IS PRIORITY 2

The ledger kernel is the best-built component in the repository — but the audit proved it governs only the **settlement side**. The dominant money inflow (buyer capture, every storefront + hosted + webhook path) and a refund path write order/payment status with **zero ledger entries**, and the system stamps a false `capture_posted_to_ledger: true` into data. Five money stores coexist. Real loss is impossible *today* only because every live provider rail is a fail-closed stub — which means Money Unification can be done **before** money is real, with zero financial blast radius. That is the window this plan exploits.

**Accounting truth being restored:** every rupee that enters, leaves, or moves inside LetBuyy must appear as a balanced (debit == credit) entry in the canonical ledger, and every merchant-visible balance must be a *projection* of that ledger, never a mutable stored column.

---

## PHASE 0 — FINANCIAL INVENTORY (ownership map)

**Goal:** the complete, evidence-backed map of every place money can move, and which reality owns it. Read-only; produces the canonical money map that Phases 1–5 execute against.

### 0.1 The strategic winner (verified real)

**Canonical ledger** — `database/supabase/migrations/139_executable_foundation_ledger_core.sql:163-382` + `160` + `165`:
- Append-only: BEFORE UPDATE/DELETE triggers on `ledger_transactions` and `ledger_entries` raise `'ledger is append-only; use reversing entries'`.
- Balanced: DEFERRED constraint trigger enforces per-transaction debit == credit; `amount_minor > 0`; ≥2 lines; INR-only.
- Tenant-owned: FORCE RLS + GUC policy.
- Idempotent: `ON CONFLICT (site_id, source_type, source_id, idempotency_key) DO NOTHING`.
- Grant-locked: migration 165:463-464 `REVOKE UPDATE, DELETE … FROM PUBLIC, anon, authenticated, service_role, app_tenant` (binds even BYPASSRLS roles — privileges ≠ RLS).
- Double-release-protected: `claim_payout_statement_release` (160:357-421) uses `FOR UPDATE` + idempotency + ledger-derived balance check.

### 0.2 The money map — every path, current ledger status

| # | Money path | Entry point | Posts ledger today? | Owner reality |
|---|---|---|---|---|
| M1 | Merchant-initiated capture (V1) | `payments.ts:289` `/payments/:id/capture` | **YES** | Winner |
| M2 | Storefront razorpay/cashfree capture | `storefront/checkout-payment-routes.ts:620/860/1187` | **NO** | Legacy (M-store) |
| M3 | Hosted checkout confirm | `checkout.ts:654` | **NO** (+ false `capture_posted_to_ledger:true` at `:673`) | Legacy |
| M4 | All provider webhooks → confirm | `internal-payment-routes.ts:163` ← `webhook-service/gateway-order-transitions.ts:48-59` | **NO** | Legacy |
| M5 | Legacy razorpay verify | `payments.ts:1097` | **NO** | Legacy |
| M6 | Refund (V1) | `payments.ts:516` `/payments/:id/refund` | **YES** | Winner |
| M7 | Refund (returns flow) | `returns.ts:279` → `complete_order_refund` (`000_baseline.sql:1039-1190`) | **NO** | Legacy |
| M8 | Payment-failure → refunded | `internal-payment-routes.ts:195` → `record_order_payment_failure_with_ledger` | **NO** (name lies) | Legacy |
| M9 | COD remittance | `cod-reconciliation.ts:290` → `reconcile_cod_remittance_with_ledger` (165:267-461) | **YES** | Winner |
| M10 | Commission reconcile | `commission.ts:322-342` | **YES** (but full-net per order) | Winner (w/ dedupe gap) |
| M11 | Settlement ingest | `settlements.ts:238` | **YES** | Winner |
| M12 | Payout release | `payouts.ts:533` | **YES** (ledger-derived) | Winner |
| M13 | Gift card redemption | `create_checkout_order` `000_baseline.sql:1836` `UPDATE gift_card_accounts SET balance = balance - …` | **NO** | Stored-value reality |
| M14 | AI credit purchase | `ai.ts:1112-1142` `ai_credits.balance = balance + …` | **NO** | Stored-value reality |

### 0.3 Strategic losers (the alternate realities to eliminate)

1. **`confirm_order_payment_with_ledger`** (`000_baseline.sql:1590-1709`) — "with_ledger" in name only; **0 ledger references** (re-verified). The hub of M2–M5. **LOSER → must be made to post, or replaced by a ledgering RPC.**
2. **`complete_order_refund`** (`000_baseline.sql:1039-1190`) — un-ledgered refund. Hub of M7. **LOSER → must reverse through the ledger.**
3. **`record_order_payment_failure_with_ledger`** — un-ledgered refund-on-failure. **LOSER.**
4. **Mutable balance columns** — `gift_card_accounts.balance`, `ai_credits.balance`. **LOSER → ledger-projected stored value.**
5. **`wallet_ledger_entries`** "compatibility" table — currently written alongside COD as `compatibility_only:true`. **Tolerated transitional**, must be retired once readers move to the canonical projection.
6. **`partner_payout_ledger_entries`** (app-store, mutated in `queue-execution.adapter.ts:483/539`) — validator-**exempt** money path. **LOSER or formally ring-fenced** (decide: is app-store partner payout in scope of the canonical ledger, or a separate certified subsystem? ARB call).
7. **The false attestation** `capture_posted_to_ledger: true` (`checkout.ts:673`) — not a system, but a **data lie**; must be deleted the moment M3 actually posts.

### 0.4 Validator blind spots to close (these let the losers survive)

- `canonical-ledger-only-validator`: scans only `services/`+`packages/` (**never `database/`** → can't see M-hub functions); accepts whole-file substring as evidence (a *comment* mentioning a ledger column passes a naked write — mutation-proven); exempts 9 files including the `partner_payout_ledger_entries` mutator; `moneyMutationTables` omits `gift_card_accounts`/`ai_credits`.
- `commission-bps-zero-validator`: catches only literal `300`; a `500` default passes (mutation-proven); excludes all migrations except 162.

**Exit gate MG0:** the money map above is ratified by ARB; every loser has an assigned disposition (post / reverse / project / retire / ring-fence); the validator blind spots are scheduled for closure in the matching phase.

---

## ACCOUNTING INVARIANTS (the rules every phase must preserve)

- **INV-1 Conservation:** for every state change that moves money, Σ debits == Σ credits in the same transaction.
- **INV-2 Append-only:** no UPDATE/DELETE of ledger rows; corrections are reversing entries. (Already enforced by triggers + grants — do not weaken.)
- **INV-3 Balance-as-projection:** every merchant-/buyer-visible balance is `ledger_account_balance_minor(site, account)`, never a stored mutable column.
- **INV-4 Idempotency:** each money event posts at most once; cross-flow events for the same underlying money dedupe on a shared key (closes the M10/M11/M9 `merchant_payable` triple-credit).
- **INV-5 Atomicity:** capture/refund/settlement post their ledger lines in the **same DB transaction** as the order/payment status change — no "status now, ledger later" window.
- **INV-6 Fail-closed:** if a ledger post cannot complete, the money-state change rolls back; no order is marked paid without its ledger entry.
- **INV-7 Provenance:** every entry carries `source_type`+`source_id`+`idempotency_key` tracing to the originating event (capture, refund, settlement, COD, gift-card, ai-credit).

---

## PHASE 1 — CAPTURE LEDGERING (CAP-C01)

**Goal:** M2–M5 post canonical entries atomically; the false attestation dies.

Approach (no new services, no event sourcing — a SQL + route change inside the monolith):
1. Make `confirm_order_payment_with_ledger` actually post. Inside the existing function's transaction, add the canonical posting (debit cash/PSP-receivable, credit merchant_payable or the correct accounts per the ledger chart) with idempotency key = provider payment id. This is the single highest-leverage change — it fixes M2, M3, M4, M5 at once because all four route through this function (verified). Pair with a rollback migration.
2. Delete the `capture_posted_to_ledger` literal at `checkout.ts:673`; the attestation becomes a *read* of ledger existence, not a hardcoded boolean.
3. Enforce INV-5/INV-6: the order-paid transition and the ledger post share one transaction; failure rolls both back.
4. Close the validator blind spot: extend `canonical-ledger-only-validator` to **scan `database/supabase/migrations/`** for money-mutating functions and require call-adjacent (not whole-file-substring) ledger evidence.

**Validation matrix — Phase 1:**

| Test | Asserts |
|---|---|
| capture-ledger unit (per route M2–M5) | each capture produces a balanced ledger txn with provider-id idempotency |
| double-capture replay | second identical capture posts 0 new entries (INV-4) |
| capture-then-crash | order not marked paid if ledger post fails (INV-6) |
| attestation truth | `capture_posted_to_ledger` reflects actual ledger row, never a constant |
| validator mutation | injecting a naked `UPDATE payment_transactions` into the hub function now FAILS the validator (closes substring loophole) |

**Rollback:** paired migration reverses the function to its prior body; route/validator changes revert by commit. Safe because no live capture money has moved (rails fail-closed).

---

## PHASE 2 — REFUND LEDGERING (CAP-C02)

**Goal:** M7, M8 reverse through the ledger; cross-source `merchant_payable` dedupe (INV-4).

Steps:
1. Make `complete_order_refund` and `record_order_payment_failure_with_ledger` post **reversing** entries (not UPDATEs — INV-2) in-transaction with the refund status change.
2. Introduce a shared dedupe key for `merchant_payable` credits so commission-reconcile (M10), settlement-ingest (M11), and COD (M9) cannot triple-credit the same order's money (the audit's P0-when-live seam; repo admits it as SKIP rows 32/35). The fix is a canonical `source_id` derivation shared across the three flows, enforced by the ledger's existing `ON CONFLICT` idempotency.
3. Extend the validator's table awareness so refund tables are covered.

**Validation matrix — Phase 2:**

| Test | Asserts |
|---|---|
| refund-reverses (both paths) | refund posts a balanced reversing txn; net of capture+refund == 0 |
| over-refund guard | cannot refund more than captured (ledger-derived) |
| triple-credit prevention | commission + settlement + COD for one order credit `merchant_payable` once total (INV-4) |
| failure-refund | payment-failure path reverses through ledger |

**Rollback:** paired migrations; safe pre-live.

---

## PHASE 3 — SETTLEMENT LEDGER CONVERGENCE (CAP-C05)

**Goal:** confirm the settlement side (M11/M12) is the *same* ledger as capture/refund — one chart of accounts, not a parallel settlement ledger.

Steps:
1. Verify (already mostly true) settlement ingest and payout release post to the same `ledger_transactions`/`ledger_entries` tables with the same account taxonomy as capture/refund now do — no separate "settlement ledger" schema. The audit confirmed `post_settlement_ledger_transaction` derives tenant from source-row ownership (165:214-265) and payout release is ledger-derived (160:357-421); this phase makes the *accounts* consistent end-to-end so a capture credit and a settlement debit net correctly.
2. Ring-fence decision for `partner_payout_ledger_entries` (loser #6): either fold app-store partner payouts into the canonical ledger or formally declare it a separate certified subsystem with its own invariants and remove its silent validator exemption (replace exemption with an explicit, ARB-recorded boundary).
3. Retire the `wallet_ledger_entries` compatibility writes once balance readers consume the canonical projection (INV-3).

**Validation matrix — Phase 3:**

| Test | Asserts |
|---|---|
| end-to-end net | capture → settlement → payout for one order nets to 0 residual in `merchant_payable` |
| single chart | no money path writes a ledger table outside the canonical schema |
| app-store boundary | partner payout is either canonical or explicitly ring-fenced (no silent exemption) |

**Rollback:** schema-paired; pre-live safe.

---

## PHASE 4 — RECONCILIATION VALIDATION (CAP-C04)

**Goal:** the books can be certified zero-break-or-explained-suspense, on a schedule, with operator resolution.

Steps:
1. Wire `refresh_money_ledger_site_reconciliation` (exists; nothing calls it on a schedule) into `services/queue-workers` as a scheduled job (no new service — queue-workers is an active runtime).
2. Build the operator break-resolution flow (currently `recon_breaks` rows open but no resolve path) in `platform-console` (the ops survivor).
3. Keep the merchant balance endpoint fail-closed (`wallet.ts:163-185` already returns `409 LEDGER_RECONCILIATION_REQUIRED` until verified zero-variance) — do not relax it.

**Validation matrix — Phase 4:**

| Test | Asserts |
|---|---|
| scheduled refresh | reconciliation runs on cadence; variance computed |
| break lifecycle | a seeded break opens, surfaces to operator, resolves, closes |
| balance gating | merchant balance refuses to display until variance == 0 verified |

**Rollback:** scheduler/flag revert; no schema risk.

---

## PHASE 5 — LEGACY MONEY REMOVAL

**Goal:** delete the loser realities now that the winner is total. **Proof-gated — nothing deleted without a passing replacement.**

Disposition table:

| Loser | Disposition | Proof required before action |
|---|---|---|
| `confirm_order_payment_with_ledger` un-ledgered body | **Replaced** (Phase 1) | capture-ledger tests green + validator sees it |
| `complete_order_refund` / failure-refund un-ledgered | **Replaced** (Phase 2) | refund-reverses tests green |
| `capture_posted_to_ledger:true` literal | **Delete** | Phase 1 attestation-truth test green |
| `gift_card_accounts.balance` / `ai_credits.balance` mutable | **Convert to projection** (INV-3) | stored-value-as-ledger tests green; readers migrated |
| `wallet_ledger_entries` compatibility writes | **Retire** | all balance readers consume canonical projection |
| `partner_payout_ledger_entries` exemption | **Remove silent exemption** | Phase 3 boundary decision recorded |
| `razorpayx` in 3 DB CHECK constraints (`000_baseline.sql:8282/8284/10252`) | **Drop from enum** | SKIP-RAZORPAYX-ENUM-PURGE closed; no code emits it |
| `commission-bps-zero` literal-300 / migration-exclusion | **Harden** | mutation test: `500` default now fails |
| `canonical-ledger-only` 9-file exemption (`legacyAllowedUntilD5`) | **Sunset** | each exempted file proven ledger-correct or ring-fenced |

**Validation matrix — Phase 5:** every removal preceded by a green replacement test; full money test suite green; `canonical-ledger-only-validator` (now migration-aware, call-adjacent, no substring loophole, full table list) passes with the exemption set empty or explicitly justified.

**Rollback:** each removal is an independent reviewed migration/commit with a paired reverse; never batch-delete.

---

## PHASE 6 — PRODUCTION CERTIFICATION

**Goal:** live proof, not just repository proof (this is where the provider seams finally close — but only after the unification above).

Steps (depend on Reality Promotion G4 + provider secrets):
1. Provision payout provider client (CAP-C03), live PSP credentials (SKIP-MERCHANT-PSP-LIVE-CREDENTIALS), Razorpay Route/Cashfree split secrets.
2. Run the SKIP-D5 live reconciliation smoke: capture → refund → COD remit → settlement ingest → payout release, then `refresh_money_ledger_site_reconciliation` + provider-statement probe; record **variance 0** with provider references.
3. Real cryptographic step-up (CAP-C06) for refund/payout approval — replace the `recorded-gap-step-up-` placeholder; the decorative gate becomes real.
4. Certify: no `…_MODE="live"` money subsystem returns success without a provider reference; provider-mode badge honest end-to-end.

**Validation matrix — Phase 6:** live variance-0 evidence stored; step-up rejects a forged challenge; every money surface badges sandbox vs live truthfully; SKIP-D5/CAP-C01..C05 rows removed only with live evidence attached.

---

## SAFETY RULES (program-wide for money)

- Execute Phases 1–5 **while rails are fail-closed** (pre provider secrets) so no real money can move during ledger surgery — zero financial blast radius.
- Never weaken INV-2 (append-only) or the grant revocation to "make a fix easier" — corrections are reversing entries.
- Every schema change is paired with a rollback file (the repo's existing discipline — all of 160–167 have pairs).
- No new service, no event-store, no CQRS read-model — all changes live in the existing monolith functions, routes, and queue-workers.

## DEPENDENCIES

- **In:** Reality Promotion G1 (clean converged tree). Phases 1–5 can be authored/tested pre-promotion; Phase 6 needs Promotion G4 + provider secrets.
- **Out:** the corrected `canonical-ledger-only-validator` (migration-aware) is reused by Duplicate Elimination's validator-convergence phase. Money certification is a prerequisite for any "real merchants" launch claim.

## MONEY INTEGRITY TARGET

From **4/10** (kernel excellent, settlement-only) to **8–9/10** at Phase 5 (one reality in repo) and **certified** at Phase 6 (one reality, live-proven). 10/10 is reserved for post-live operation with sustained zero-variance reconciliation history.
