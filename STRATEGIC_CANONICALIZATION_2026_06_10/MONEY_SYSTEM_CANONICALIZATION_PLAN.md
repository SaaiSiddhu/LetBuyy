# LETBUYY MONEY SYSTEM CANONICALIZATION PLAN

**Program:** Strategic Canonicalization 2026-06-10 — Domain deliverable: Money / Ledger / Settlement / Payout
**Date:** 2026-06-10
**Author:** Architecture Review Board — Principal Payments Architect (Stripe-grade money-systems review)
**Status:** Canonical money-system roadmap. Binding on every money-bearing change until superseded by ARB.
**Decision rule (inherited from `_ANCHOR_DECISIONS_SPINE.md`):** the Strategic Winner is the implementation that should still exist at 10,000 India merchants — not the oldest, the most complete, or the easiest. No production merchants and no legacy money burden ⇒ move directly to the intended architecture; preserve nothing for its own sake.

---

## 0. Methodology

1. **Authoritative inputs read in full and honored:**
   - `_ANCHOR_DECISIONS_SPINE.md` **A3** (the load-bearing money spine — canonical double-entry ledger is the single source of truth; balance always derived; legacy capture/refund/COD/wallet/gift-card become adapters or LEGACY/DEAD; bigint paise everywhere; PA-split never self-custody; 0% commission; real crypto step-up; append-only by trigger AND `REVOKE`).
   - `FORENSIC_MASTER_2026_06_10/PAYMENTS_FORENSIC_AUDIT.md` (PAY-001..032, full code-traced evidence with `path:line`).
   - `FORENSIC_MASTER_2026_06_10/DATABASE_FORENSIC_AUDIT.md` (DB-001..034, schema/migration evidence with `path:line`).
   - `FORENSIC_MASTER_2026_06_10/CHECKOUT_FORENSIC_AUDIT.md` (cross-linked: gift-card precision/double-spend, money columns feeding checkout).
   - `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` **§7** (ledger model, single-writer settlement, deferred partitioning) and **§8** (money-in merchant-of-record, money-out PA-split no custody, double-entry ledger, reconciliation, safety) and **§15** Risk Register (R1/R2/R3/R6/R7).
   - `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` **§3** (double-entry settlement ledger, PA-split disbursement mirror, transactional outbox) and §7 (0% transaction-fee recommendation).
2. **Every `path:line` cited below was re-verified against the live working tree** (`database/supabase/migrations/`, `services/api-gateway/src/`, `services/webhook-service/src/`) on 2026-06-10. The 8 canonical accounts, the canonical RPC line numbers, the `commission_bps DEFAULT 300`, and the `gift_card_accounts SET balance = balance - amt` mutation were each opened and confirmed at source, not taken on trust.
3. **Classification legend (verbatim from the spine):** **CANONICAL** (the winner — build/finish it) · **TRANSITIONAL** (real today, kept only until the winner lands) · **LEGACY** (superseded; freeze, then delete after migration proves zero drift) · **DEAD** (no value or actively wrong; SAFE_DELETE) · **FROZEN** (rejected-for-envelope but keep an empty seam; reconsider at a named trigger).
4. **Sequencing law (inherited):** security S0s and the deploy meta-blocker come first (separate deliverables); **money-correctness is the highest non-security priority** — latent today only because live PSP/Route keys are `[HUMAN-REQUIRED]`-gated, but a hard go-live blocker. Ledger-the-capture/refund/COD + reconciliation-closure precede *trusting* payouts. razorpayx→PA-split and commission=0 are Wave-1/2. Waves map to 0–8.
5. **Money rigor rule (inherited):** no money system is deleted until the reconciliation harness proves zero drift on the path it replaces. Backfill is gated by a zero-loss proof.

---

## 1. Executive Verdict (single source of truth + adapters)

LetBuyy already owns a genuinely Stripe-grade double-entry kernel — migrations **139/151/160**: `ledger_accounts`/`ledger_transactions`/`ledger_entries`, `post_ledger_transaction` (139:223, balanced, idempotent, append-only-by-trigger), `claim_payout_statement_release` (160:357, `FOR UPDATE` + ledger-balance-gated), and a settlement ingest that records `recon_breaks` with **no auto-plug** — and the **single, undisputed money source of truth is this canonical append-only double-entry ledger**, with merchant balance forever *derived* via `ledger_account_balance_minor` (160:173) and never a mutable column. The platform's actual failure is not its primitives but its **wiring**: the legacy money-in path every real buyer hits (`confirm_order_payment_with_ledger`, `000_baseline.sql:1590`) captures money and posts **zero** ledger entries despite its name, the returns-refund path (`complete_order_refund`, `000_baseline.sql:1039`) and the COD remittance path (`cod-reconciliation.ts:305`) are likewise un-ledgered, money is stored in **four incompatible representations** (bigint-paise / int32-paise / numeric-rupee / numeric(16,4)), money-out is hardcoded to the **self-custody `razorpayx` rail** (payouts.ts:119) in direct violation of R-6 while metadata falsely stamps `no_custody:true`, and the second factor on payouts/refunds is a **forgeable string-length check** (security-controls.ts:27). Therefore every legacy capture/refund/COD path becomes an **adapter that must post to canonical** (TRANSITIONAL → fixed), the four compat "ledger" tables + `wallet_ledger_entries` + mutable `gift_card_accounts.balance`/`store_credit`/`ai_credits` become **adapters-onto-canonical or LEGACY**, the int32/numeric money columns become **LEGACY → bigint-paise**, and `razorpayx` + the forgeable step-up + the 3% rake (`commission_bps DEFAULT 300`, 119:81) become **DEAD**. The endgame: one ledger, one money representation (bigint paise), one money-out rail (PA-split, never custody), one writer (the settlement module), reconciliation to zero-break-or-explained-suspense, 0% commission, and a second factor that is real cryptography — with the entire six-S1 set treated as a single non-negotiable "do-not-go-live" gate that Waves 1–3 close.

---

## 2. Money Source-of-Truth Decision (the central call)

| | Decision |
|---|---|
| **Single source of truth (SSOT)** | The **canonical append-only double-entry ledger** — `ledger_transactions` + `ledger_entries` over the **8 fixed accounts** (`pa_clearing`, `merchant_payable`, `platform_revenue`, `gst_payable`, `cod_receivable`, `reserve`, `vendor_payable`, `refund_clearing`; CHECK at `139:79-95`). Classification: **CANONICAL**. |
| **Balance** | **Always derived** — `ledger_account_balance_minor(site, account)` (160:173) sums posted entries. **No mutable balance column is ever the truth.** `gift_card_accounts.balance`, `gift_cards.balance`, `store_credit`, `ai_credits.balance`, and the displayed wallet "available" become projections of the ledger, not authorities. |
| **Single writer** | The **settlement module** (per V1 §7: "settlement is the sole writer"). Concretely: all ledger posting flows through one server-side authority (`postLedger` / `post_settlement_ledger_transaction`) called only by capture-adapter, refund-adapter, COD-adapter, settlement-ingest, payout-release, and the fee-assessment authority — never directly from route handlers, never from two competing fee paths. |
| **Money representation** | **`bigint` minor units (paise) everywhere.** Canonical kernel already is. The int32-paise columns (overflow at ₹2,14,74,836.47) and the numeric-rupee / numeric(16,4) columns are **LEGACY → migrate to bigint-paise** with expand/contract + zero-loss backfill (Part 8). |
| **Money-out rail** | **PA-split mirror (Razorpay Route / Cashfree split-instruction).** LetBuyy **never custodies**. The licensed PA disburses out of the merchant's own funds; LetBuyy posts a thin split-instruction + statement + reconciliation. The `razorpayx` self-custody rail is **DEAD** (R-6). |
| **Append-only enforcement** | **Trigger AND `REVOKE UPDATE,DELETE`** on `ledger_entries`/`ledger_transactions` from `service_role`/`PUBLIC`, table owned by a no-login role. Today: trigger-only, zero `REVOKE` in the corpus (one `DISABLE TRIGGER` from bypass). |
| **Tenant isolation on the ledger** | Derive the posting tenant from an **authenticated principal/claim inside the RPC**, not from a caller-supplied `p_site_id` parameter. Today `post_settlement_ledger_transaction` does `set_config('app.site_id', p_site_id, true)` (151:23), neutralizing the inner cross-tenant guard (139:251). |
| **Commission/fees** | **0% transaction fee, permanent** (`commission_bps=0`). The 3% GMV rake default (`commission_bps DEFAULT 300`, 119:81 + 119:108; fallback `300` at commission.ts:202) and the 18% GST-on-fee are **DEAD**. Subscription is the monetization spine (Freeze §7). |
| **Step-up on money-out** | **Real cryptographic / stored-challenge step-up** (HMAC + DB challenge lookup + actor+action binding + single-use), backed by the existing `step_up_challenges` / `sensitive_action_approvals` tables (migration 153). The current `verifySensitiveActionStepUp` string-length check (security-controls.ts:27) is **DEAD**. |

**Why the ledger wins (not the legacy paths, despite their volume):** the legacy `confirm_order_payment` / `complete_order_refund` / COD paths are *complete and live* — exactly the trap the decision rule warns against. They are single-entry, numeric-rupee or int32, mutable-balance, tenant-by-trigger, and cannot model COD cash-in-transit, reserves, reversing entries, or a balanced settlement. The canonical ledger is the only representation that survives to 10k merchants, supports PA-split reconciliation to zero-break, and gives an auditable, immutable book. We make the volume paths *feed* the survivor; we do not crown the volume path because it is busy.

---

## 3. Adapter / Legacy / Dead Map — every money table & path → classification → where it posts

### 3.1 Money tables

| Table / store | Today | Classification | Target (where it posts / becomes) | Evidence |
|---|---|---|---|---|
| `ledger_accounts` / `ledger_transactions` / `ledger_entries` | Canonical double-entry, bigint paise, append-only by trigger | **CANONICAL** | The SSOT. Harden with `REVOKE` + RESTRICT FKs + in-RPC tenant derivation. | 139:75-142; 139:223; 139:358-376 |
| `payments` (V1 session) | bigint paise; capture/refund post canonical via `postPaymentLedger` | **CANONICAL** | Stays; becomes the *only* payment-truth row after `payment_transactions` is demoted. | 142:43; payments.ts:262; 160:9-10 |
| `payment_transactions` (legacy capture) | Capture record written by legacy confirm RPC; dual provider-payment-id unique | **TRANSITIONAL → LEGACY** | Demote to a compat/audit shadow of `payments`; the capture adapter posts canonical. Delete after backfill+recon. | baseline:1618; 142:81; DUP-5 |
| `settlements` / `reserves` / `payouts` / `payout_items` / `recon_breaks` | bigint paise; settlement ingest posts canonical, no auto-plug | **CANONICAL** | Stay; fix `recon_breaks` sign (signed variance), int→bigint serializer reads, GUC-from-param. | 151:84-191; settlements.ts:237-283 |
| `payout_statements` | int32 `*_minor`; release gated by `claim_payout_statement_release` | **CANONICAL (logic) / LEGACY (representation)** | Keep the release gate; migrate `*_minor integer` → bigint (160 `_bigint` shadows become authoritative). | 119:16-19; 160:28-40; 160:357 |
| `wallet_ledger_entries` (compat) | int32; single-entry; `BEFORE UPDATE` sync trigger; the live mobile money write target | **TRANSITIONAL → LEGACY** | Becomes a **read-only projection of canonical**; all writes redirect to `post_ledger_transaction`. Attach reject trigger meanwhile; delete after backfill. | 119:52; 160:137; DUP-4; PAY-003/009 |
| `gift_card_ledger_entries` (compat) | Single-entry, no reject trigger | **LEGACY → adapter onto canonical** | Gift-card spend posts to a ledger account (gift-card liability); table becomes projection. | 139→DUP-4; DB-010 |
| `store_credit_ledger_entries` (compat) | Single-entry, no reject trigger | **LEGACY → adapter onto canonical** | Store-credit posts to a ledger account; projection only. | 153:54; DB-010 |
| `partner_payout_ledger_entries` (compat) | int32 + numeric(10,2) dual scale; no reject trigger | **LEGACY → adapter onto canonical** | Reseller payout posts canonical (`vendor_payable`); projection only. P2 capability. | baseline:10225-10227; 091:127 |
| `gift_card_accounts.balance` | **Mutable** `numeric(12,2)`; `UPDATE … SET balance = balance - amt` in checkout | **LEGACY (mutable truth) → DEAD column** | Liability modeled as a ledger account; balance becomes `ledger_account_balance_minor`. | **baseline:1836** (verified); 9361; PAY-027/CHK-024 |
| `gift_cards.balance` | **Mutable** `numeric(10,2)` — *second* gift-card balance at different precision | **DEAD (duplicate)** | Unify onto the single ledger-backed gift-card liability; drop the precision split. | baseline:9438; DUP-8/DB-020 |
| `store_credit.balance_minor` | bigint paise but mutable | **TRANSITIONAL → projection** | Becomes derived from `store_credit_ledger` → canonical. | 153:39 |
| `ai_credits.balance` | **Mutable** `integer` | **LEGACY (non-money-critical)** | Move onto ledger as an AI-credit tender account when AI Studio ships (P2); not a go-live blocker. | baseline:8152; DB §8.4 |
| `orders.{subtotal,total,…}` | `numeric(12,2)` rupee-major | **LEGACY (representation)** | Add `*_minor bigint`; derive all amounts from minor units; demote numeric to generated/compat. | 109:7-13; DB-003; PAY-006 |
| `refunds.amount` | `numeric(12,2)` | **LEGACY (representation)** | `amount_minor bigint`; refund adapter posts canonical. | baseline:11123; DB-003 |
| `usage_meter_entries.amount` | `numeric(16,4)` — a *fourth* money scale | **LEGACY (representation)** | Standardize billing usage to bigint paise (or a documented sub-paise scale isolated from the ledger). | baseline:13057; DB-003 |
| `commission_schedules` / `commission_reconciliation_entries` | `commission_bps DEFAULT 300`; int32 `*_minor` | **DEAD (rake) / LEGACY (representation)** | Set `commission_bps=0`; if fee logic survives at all, single fee-authority + bigint. | **119:81,108** (verified); commission.ts:202; PAY-008/028 |
| `cod_reconciliation_entries` | int32 `*_minor`; collection/remittance idempotency uniques present | **TRANSITIONAL (adapter) / LEGACY (representation)** | COD adapter posts canonical (`cod_receivable` debit on collect, relieve on remittance, short/over → break). Migrate int→bigint. | 140:26-29; PAY-003 |
| `money_ledger_site_reconciliations` | Compares wallet "available" to ledger `merchant_payable`, flags variance, **no auto-plug** | **CANONICAL (reconciliation authority)** | Keep; it is the honesty gate that *surfaces* drift. After adapters land it should read `verified`/zero-variance. | 160:212-254; wallet.ts:163 |
| `idempotency_keys` + per-table `(site_id, idempotency_key)` uniques | Comprehensive dedupe lattice | **CANONICAL** | Keep. Extend to cover the redirected legacy writes. | baseline:14200; 151:84 |

### 3.2 Money paths / RPCs / routes

| Path / RPC | Today | Classification | Target (where it posts / becomes) | Evidence |
|---|---|---|---|---|
| `post_ledger_transaction` (139:223) | Balanced, idempotent, append-only, tenant-GUC-checked *(when not bypassed)* | **CANONICAL** | The posting primitive. Keep; remove the GUC-from-param bypass at the wrapper. | 139:223-342; 139:251 |
| `post_settlement_ledger_transaction` (151:6) | Sets `app.site_id` **from its own parameter** (151:23) → defeats the cross-tenant guard | **CANONICAL (role) / DEAD (the GUC-from-param behavior)** | Derive site from authenticated principal inside the RPC; assert caller authorization; never `set_config` from a raw param. | **151:23** (verified); PAY-020/DB-011 |
| `claim_payout_statement_release` (160:357) | `FOR UPDATE` + idempotency replay + status gate + ledger-balance gate | **CANONICAL** | The payout-double-release fix done right. Keep; add post-transfer reconciliation around it. | 160:373-419; PAY-013 |
| `ledger_account_balance_minor` (160:173) | Derives balance by summing entries | **CANONICAL** | The balance authority; every "balance" read routes here. | 160:173-196 |
| `confirm_order_payment_with_ledger` (baseline:1590) | Captures money; **posts no `ledger_*`** despite the name; live storefront + every webhook | **TRANSITIONAL (must post) → adapter** | Post the F6 capture ledger inside it (debit `pa_clearing` / credit `merchant_payable`) idempotently, OR route all captures through the V1 capture API. Then rename to drop the lie. | **baseline:1590-1709** (grep `INSERT INTO ledger_`=0); PAY-001/DB-005 |
| `complete_order_refund` (baseline:1039) | Refunds the buyer; flips order; **posts no `ledger_*`**; the live returns path | **TRANSITIONAL (must post) → adapter** | Add `post_ledger_transaction` (debit `merchant_payable` / credit `refund_clearing`) idempotent on refund id; unify cumulative-refund cap onto the ledger. | baseline:1039-1208; returns.ts:279; PAY-002/DB-006 |
| COD remittance (`cod-reconciliation.ts:305`) | Writes only `wallet_ledger_entries`; canonical `cod_receivable`/`cod_remittance` never move | **TRANSITIONAL (must post) → adapter** | COD adapter: debit `cod_receivable` at collect; at remittance relieve `cod_receivable` / debit bank-or-`pa_clearing`; short/over → signed `recon_breaks`. | cod-reconciliation.ts:305-326; PAY-003 |
| Settlement ingest (`settlements.ts:185`) | Correct: posts canonical when balanced & zero-break; `recon_breaks` + alert, **no auto-plug** | **CANONICAL** | Keep. After capture is ledgered, `pa_clearing` it debits will finally be funded by capture. | settlements.ts:237-283; billing-core:633 |
| Commission per-order posting (`commission.ts:337`) | Posts a full settlement ledger for every paid order | **DEAD (with 0% fee) / DUP (vs payout fee)** | With `commission_bps=0` there is no fee leg. If any fee survives, collapse to a single fee-assessment authority sharing one idempotency namespace. | commission.ts:288-348; PAY-008 |
| Payout per-statement fee posting (`payouts.ts:466`) | Independently posts a fee-assessment ledger for the statement | **DEAD (with 0% fee) / DUP** | Same: single fee authority; payout consumes commission entries, never re-derives. | payouts.ts:386-483; PAY-008 |
| `verifySensitiveActionStepUp` (security-controls.ts:27) | String ≥12 chars + fresh timestamp = "valid" second factor | **DEAD** | Replace with HMAC/stored-challenge verification against `step_up_challenges`/`sensitive_action_approvals`, actor+action-bound, single-use. | security-controls.ts:20-83; PAY-018 |
| `payoutRail()` → `'razorpayx'` (payouts.ts:119) | Hardcoded self-custody rail; metadata claims `no_custody:true` | **DEAD** | Return `razorpay_route`/`cashfree` split; assert the rail is a split product; derive `no_custody` from the rail. | payouts.ts:119-121; settlements.ts:249,298; PAY-014 |
| `emitDomainEvent` (event-execution.adapter.ts:60) | Separate Supabase call after the money mutation; swallows missing-table errors | **TRANSITIONAL → fix (transactional outbox)** | Write the outbox row in the **same transaction** as the money mutation (in the RPC); never swallow. | event-execution.adapter.ts:60-85; PAY-007 |
| `compensation_actions` (written at checkout.ts:409) | Rows written; **zero readers/executors** | **TRANSITIONAL → build executor** | A `queue-workers` consumer claims `(status=pending, action=refund_payment_intent)` and runs an idempotent refund via the canonical refund adapter. | checkout.ts:409; PAY-026 |
| `backfill_wallet_ledger_to_canonical` (160:279) | SECURITY DEFINER mass cross-tenant write | **TRANSITIONAL (migration tool) → DEAD after backfill** | Use once under the backfill, gated break-glass; drop the function post-cutover. | 160:279-355; DB-012 |
| Webhook ingest dedupe (`index.ts:75`) | HMAC + `(provider, provider_event_id)` unique dedupe; **no timestamp window**; retry suppressed after failure | **CANONICAL (logic) / TRANSITIONAL (replay hardening)** | Add timestamp-window rejection (signature+timestamp+nonce per V1 §8); only mark dedup `processed` after side effects so a failed capture re-runs on redelivery. | index.ts:75-85,714-719,733; PAY-016/017 |
| Storefront verify (`checkout-payment-routes.ts:534`) | HMAC + order binding; **no server-side capture/amount confirm; no replay assert** | **TRANSITIONAL → harden** | Add `fetchRazorpayPayment` capture+amount check + `assertProviderPaymentNotReplayed` (parity with subscription verify). | checkout-payment-routes.ts:534-617; PAY-022 |
| Internal payment-mutation secret (`webhook index.ts:543`) | Falls back to `AUTH_SECRET` (shared with identity/session signing) | **DEAD (the fallback)** | Dedicated `INTERNAL_API_SECRET`; never fall back to `AUTH_SECRET`; rotate independently. | webhook index.ts:543; internal-secret.ts:15; PAY-023 |

### 3.3 Classification counts (money domain)

| Classification | Count | What |
|---|---|---|
| **CANONICAL** | **11** | ledger core (3 tables) + `payments` + settlement set (`settlements`/`reserves`/`payouts`/`payout_items`/`recon_breaks`) + `post_ledger_transaction` + `claim_payout_statement_release` + `ledger_account_balance_minor` + `money_ledger_site_reconciliations` + settlement-ingest + idempotency lattice + (the *role* of) `post_settlement_ledger_transaction`. |
| **TRANSITIONAL** | **10** | legacy capture/refund/COD paths (must-post adapters) + `payment_transactions` + `payout_statements` representation + `wallet_ledger_entries` + `store_credit.balance_minor` + outbox dual-write fix + compensation executor + webhook replay hardening + storefront-verify hardening + `cod_reconciliation_entries` representation. |
| **LEGACY** | **10** | gift-card-ledger / store-credit-ledger / partner-payout-ledger (adapters-onto-canonical) + `gift_card_accounts.balance` + `ai_credits.balance` + `orders.*` numeric + `refunds.amount` numeric + `usage_meter_entries.amount` numeric(16,4) + int32-paise money columns (whole class) + commission representation. |
| **DEAD** | **8** | `razorpayx` rail + forgeable step-up + 3% rake default (`commission_bps DEFAULT 300`) + GST-on-fee + `gift_cards.balance` duplicate + GUC-from-param behavior + double commission/payout fee duplication + `AUTH_SECRET` internal-secret fallback. |
| **FROZEN** | **2** | reseller/`partner_payout_ledger` *capability* (P2 seam, posts `vendor_payable` when built) + `ai_credits`-as-tender *capability* (P2, AI Studio). |

(Counts are of money-domain components/paths the plan classifies; a single physical table can carry both a representation-LEGACY and a logic-CANONICAL aspect — e.g. `payout_statements` — and is listed under its dominant action.)

---

## 4. End-to-End Target Money Flow

The destination is one balanced book fed by every money event. All postings are **bigint paise**, **idempotent**, **tenant-derived-from-principal**, and **append-only**.

```
MONEY-IN (merchant is merchant-of-record on their own Razorpay; LetBuyy never custodies money-in)
  Buyer pays (storefront / webhook / admin)
    → CAPTURE ADAPTER (single authority)
        verify: order+payment+signature+provider-order bound; provider capture+amount confirmed; replay-asserted
        → post_ledger_transaction  [DEBIT pa_clearing (gross) / CREDIT merchant_payable (net)]   (fees deferred-or-zero)
        → payments.status = captured, capture_ledger_transaction_id set
        → outbox row written IN THE SAME TRANSACTION (order.paid / payment.captured)
  COD order placed
    → COD ADAPTER: on confirm  [DEBIT cod_receivable / CREDIT merchant_payable]
    → on rider collect: tracked; on remittance/deposit:
        [CREDIT cod_receivable / DEBIT pa_clearing-or-bank]; short/over → SIGNED recon_breaks (no auto-plug)

MONEY-OUT (PA-split; the licensed PA disburses out of the merchant's own funds; LetBuyy mirrors)
  Settlement ingest (PA statement / COD remittance fixtures)
    → if balanced && recon_break == 0: post_settlement_ledger_transaction (tenant derived in-RPC)
        [DEBIT pa_clearing / CREDIT merchant_payable, reserve]    (platform_revenue/gst = 0 at 0% fee)
    → else: INSERT recon_breaks (signed) + alert; POST NOTHING (zero-break-or-explained-suspense)
  Payout
    → step-up: REAL crypto/stored-challenge (HMAC + DB challenge + actor+action bound + single-use)
    → permission check: payout:release; maker_actor_id ≠ checker_actor_id
    → claim_payout_statement_release  (FOR UPDATE + idempotency replay + status gate + ledger-balance gate)
    → PA SPLIT-INSTRUCTION (razorpay_route / cashfree)  — NEVER razorpayx; rail asserted to be a split product
    → on released: post_settlement_ledger_transaction [DEBIT merchant_payable / CREDIT pa_clearing]
    → RECONCILE-ON-UNCERTAINTY: query PA status; ambiguous → suspense/break + idempotent retry (no stranded money)

REFUNDS (one accounting, on the ledger)
  Refund adapter (returns path AND V1 path unified)
    → cumulative cap derived from refund_clearing/merchant_payable (NOT per-table columns)
    → post_ledger_transaction [DEBIT merchant_payable / CREDIT refund_clearing]
    → provider refund; idempotent on refund id

GIFT CARD / STORE CREDIT / AI CREDIT (tenders on the ledger)
  Issue:   [DEBIT <tender>_expense-or-liability-funding / CREDIT <tender>_liability]
  Redeem:  [DEBIT <tender>_liability / CREDIT merchant_payable-or-order-settlement]
  Balance: ledger_account_balance_minor(<tender>_liability) — never a mutable column

RECONCILIATION (the honesty spine)
  money_ledger_site_reconciliations sums posted entries vs derived merchant_payable → variance_minor
    → zero variance ⇒ wallet displays; non-zero ⇒ LEDGER_RECONCILIATION_REQUIRED (surface, never hide)
  Reconciliation harness replays PSP + COD fixtures and asserts the book ties to provider reality
    → zero break or aged-and-explained suspense; maker-checker + step-up to resolve a break

INVARIANTS (enforced, not asserted)
  • Σdebit = Σcredit per transaction (trigger 139:172-198 + post-check 139:336)
  • append-only: trigger 139:358-376 AND REVOKE UPDATE,DELETE; ledger FKs RESTRICT (not CASCADE)
  • one representation: bigint paise end-to-end; no numeric-rupee / int32-paise on any money path
  • one writer: the settlement module; one fee authority; one refund accounting
  • commission_bps = 0, permanent
```

---

## 5. Money-Representation Cutover Plan (4 reps → bigint paise) — overview

Detailed migration/validation lives in the per-decision block **MNY-002** and the testing section **Part 11**. Strategy = **expand → backfill → verify → contract**, never a destructive in-place type change (validators forbid `DROP COLUMN`/`ALTER TYPE` on the hot path; we add columns, dual-write, prove equality, then retire reads).

1. **Expand:** add `*_minor bigint` columns alongside every legacy `numeric`-rupee money column (`orders.*`, `refunds.amount`, `gift_card_accounts.balance`, `gift_cards.balance`, `usage_meter_entries.amount`); the int32-paise columns already have `_bigint` shadows from migration 160 (160:28-40).
2. **Backfill:** `*_minor = round(numeric_rupee * 100)::bigint` and `*_bigint = integer_minor::bigint`, batched, idempotent, re-runnable.
3. **Dual-write + verify:** application and sync triggers write both; a verification job asserts `*_minor == round(numeric*100)` and `*_bigint == integer_minor` for **100% of rows** (zero tolerance — any mismatch halts the cutover). The `½-paisa` rounding hazard on `orders.total` (PAY-006: `Math.round(total*100)` on `numeric(12,2)` where discount math can yield `100.005`) is *resolved by* deriving amounts from minor units henceforth and flagged on any historical row where `round(total*100) != total*100`.
4. **Contract:** flip API serializers and constraint checks to the bigint columns; demote the legacy `numeric`/`integer` columns to generated/compat (read-only) for one release; then drop in a paired-rollback migration once recon proves zero drift.

**Zero-loss gate:** the cutover does not proceed past step 3 unless the verification job reports `0` rows with any representation mismatch, **and** the reconciliation harness shows the ledger balance is byte-identical before and after the contract step.

---

## 6. PA-Split Payout Canonicalization (kill razorpayx)

| | Decision |
|---|---|
| **Kill** | `payoutRail()` hardcoded `'razorpayx'` (payouts.ts:119-121) and the adapter default `normalizeRail(...) || 'razorpayx'` (payout-transfer-adapter:73). **DEAD** — RazorpayX disburses from LetBuyy's **own** RazorpayX balance, which is self-custody and a direct R-6 / V1 §8 ("PA-split, no custody, ever") violation. |
| **Build** | The rail returns `razorpay_route` / `cashfree` and the execution path issues a **split-instruction** out of the buyer-merchant's own funds. The code already *names* `razorpay_route` in the scheduled payout row (settlements.ts:292) — the execution path must match it. |
| **Assert** | At payout time, assert the configured rail is a **split product** (not a disbursement-from-own-balance product); refuse otherwise. Derive `metadata.no_custody` / `instruction_only` **from the rail**, not as a hardcoded literal (today falsely `true` while the rail is razorpayx — settlements.ts:249,298). |
| **Reconcile** | Add **reconcile-on-uncertainty** for money-out (absent today; V1 §8 requires it): after `claim_payout_statement_release` flips to `processing`, query PA status; if the transfer succeeded at the PA but the local write failed (payouts.ts:590), post to a suspense/break and retry idempotently — never strand money with the book saying "still owed" (PAY-013). |
| **Authorize** | Enforce `payout:release` permission (today ownership-only, PAY-015) and `maker_actor_id ≠ checker_actor_id` (the schema has `requires_step_up`/`maker_actor_id` at settlements.ts:296-297 but the settle route never enforces a distinct checker). |
| **Gate** | Live Route keys / onboarding stay `[HUMAN-REQUIRED]`; mock by default (payouts.ts:123-130). The *designed* rail must be the sanctioned one before any live key is connected. |

**Classification:** rail = **DEAD → replaced by CANONICAL PA-split**. The payout *gate* (`claim_payout_statement_release`) is already CANONICAL and is retained verbatim.

---

## 7. Reconciliation / Settlement Ownership

- **Owner:** the **settlement module** is the single writer of the ledger (V1 §7) and the owner of `settlements`/`reserves`/`payouts`/`payout_items`/`recon_breaks` and the reconciliation authority (`money_ledger_site_reconciliations`, 160:212).
- **Settlement ingest is already correct** (no auto-plug): posts canonical only when balanced and `recon_break == 0`; otherwise records a `recon_breaks` row and posts nothing (settlements.ts:237-283; the planner literally states "no reserve auto-plug" — billing-core:633). This is exactly V1 §8 ("zero break or explained suspense"). **Keep it; do not weaken it.**
- **The drift that must close first:** settlement debits `pa_clearing` on the assumption capture credited it, but the live capture path (Flow B) never credits `pa_clearing` (PAY-001/PAY-019) → `pa_clearing` drifts negative and the wallet locks on `variance != 0` (wallet.ts:163-176). **Ledgering capture (MNY-003) is the precondition for settlement reconciliation to be possible at all.**
- **`recon_breaks` must carry the sign** of the variance (today `CHECK amount_minor > 0` + `Math.abs`, so short vs over are indistinguishable — PAY-004/DB-027): add a signed `variance_signed_minor` / `direction` so a resolver cannot plug the wrong way.
- **Reconciliation harness** (V1 §8) replays PSP + COD remittance fixtures and asserts the ledger ties to provider reality with zero break or an aged, explained suspense; break resolution requires **maker-checker + step-up** (real step-up per MNY-008).

---

## 8. Commission = 0 + Append-Only Hardening

**Commission = 0% (permanent).** Set `commission_bps = 0`; the live defaults `commission_bps DEFAULT 300` (119:81 and 119:108, verified) and the in-code fallback `commission_bps: 300` (commission.ts:202) are **DEAD**, as is the 18% GST-on-fee leg. With zero fee there is no fee-assessment leg, which *also* dissolves the double-posting bug (PAY-008: per-order at commission.ts:337 vs per-statement at payouts.ts:466) and the under-recognition gap (PAY-005). The `commission_bps ≤ 10000` (100%) CHECK (119:95) is moot at 0 but should be tightened to a sane business max if any non-zero schedule is ever reintroduced (PAY-028/DB-033). Monetization is subscription (Freeze §7).

**Append-only hardening (trigger AND REVOKE).** Today the canonical ledger is append-only **by trigger only** (`reject_ledger_mutation`, 139:358-376) with **zero `REVOKE` statements in the entire corpus**, and the gateway runs as `service_role` which is typically the table owner — one `ALTER TABLE … DISABLE TRIGGER` from mutating immutable history (PAY-021/DB-009). Harden by:
1. `REVOKE UPDATE, DELETE ON ledger_entries, ledger_transactions FROM PUBLIC, service_role;`
2. Own the ledger tables by a **no-login role**; the runtime connects as a non-owner that cannot disable triggers.
3. Attach `reject_ledger_mutation` to the compat `*_ledger_entries` tables until they are demoted to projections, and replace the `wallet_ledger_entries` `BEFORE UPDATE` sync trigger (160:137) with insert-only (DB-010).
4. Change ledger/audit FKs from `ON DELETE CASCADE` to `ON DELETE RESTRICT` so a `sites` deletion can never target immutable ledger history (today only accidentally protected by the reject trigger — CI-3/DB-014/DB-030); soft-delete sites instead of hard delete.

---

## 9. Per-Decision Detail Blocks (all 13 fields)

> Field set for every block: Current State · Strategic State · Reasoning · Migration Plan · Validation Plan · Deletion Plan · Rollback Plan · Risk Level · Complexity (XS/S/M/L) · Timeline (Wave) · Owner · Dependencies · Success Criteria · Classification.

### MNY-001 — Canonical ledger is the single money source of truth; balance always derived

- **Current State:** Canonical double-entry ledger exists and is excellent (139/151/160), but it is *fed by the new admin/settlement APIs and starved by the legacy capture/refund/COD paths* that carry real volume; merchant "balance" appears in mutable columns (`gift_card_accounts.balance`, wallet "available") in parallel.
- **Strategic State:** The ledger is the **only** money truth; every balance is `ledger_account_balance_minor` (160:173); the displayed wallet, gift-card, store-credit, and ai-credit balances are projections.
- **Reasoning:** Only an immutable, balanced, double-entry book survives to 10k merchants, reconciles to PA reality, and is auditable. Mutable balances are "arithmetic on fiction" (Freeze §3.1).
- **Migration Plan:** Land MNY-003/004/005 (capture/refund/COD adapters) so the ledger is *complete*; redirect every "balance" read to `ledger_account_balance_minor`; demote mutable balance columns to derived/compat.
- **Validation Plan:** Property test Σdebit=Σcredit on every posting; reconciliation harness proves the ledger ties to provider+COD fixtures; wallet GET returns `verified` zero-variance for a fully-ledgered store.
- **Deletion Plan:** None for the ledger; the *mutable balance columns* are deleted per their own blocks after backfill+recon.
- **Rollback Plan:** Adapters are additive (post alongside existing writes first); if a posting defect appears, disable the adapter's posting flag and fall back to the legacy write while keeping the ledger frozen — no destructive change to history.
- **Risk Level:** Medium (the kernel is sound; risk is in wiring breadth). **Complexity:** L. **Timeline:** Waves 1–3 (definitional now; complete when adapters land). **Owner:** Finance/Payments squad. **Dependencies:** MNY-003/004/005/008/010. **Success Criteria:** zero mutable-balance authorities remain; every money read derives from the ledger; reconciliation `verified`.
- **Classification:** **CANONICAL.**

### MNY-002 — Money representation: 4 reps → bigint paise (the data-migration)

- **Current State:** Four representations: bigint-paise (new kernel, correct), int32-paise (overflow at ₹2,14,74,836.47; ~25 columns), numeric-rupee (`orders.*`, `refunds.amount`, gift cards), numeric(16,4) (`usage_meter_entries`). Conversions via `::bigint` casts; a missed cast = 100× error (DB-003).
- **Strategic State:** **bigint minor units (paise) everywhere** on every money path; legacy reps demoted to compat then dropped.
- **Reasoning:** One representation removes the cast-error class, the int32 overflow, and the precision-split bugs (gift cards at 12,2 vs 10,2 — DUP-8).
- **Migration Plan:** **Expand/contract** (Part 5): add `*_minor bigint`; the 160 `_bigint` shadows already exist for int32 columns; backfill `round(numeric*100)` / `integer::bigint`, batched/idempotent; dual-write; verify 100% equality; flip serializers and CHECKs to bigint; demote then drop legacy columns in paired-rollback migrations. Finish the 160 cutover so `_bigint` is authoritative (DB-031).
- **Validation Plan:** Per-row equality job (zero mismatches required); overflow test (insert > ₹2.14cr and assert no wrap); the ½-paisa rounding probe on `orders.total` (PAY-006); reconciliation harness proves ledger balance identical pre/post contract.
- **Deletion Plan:** Drop legacy `numeric`/`integer` money columns only after (a) equality job = 0 mismatches and (b) recon proves zero drift; each drop ships a paired rollback (the `DROP COLUMN` residue gap in 151/160 rollbacks, DB-008, is fixed as part of this).
- **Rollback Plan:** Until contract, both columns exist and the legacy one is still readable — revert by repointing serializers back; after contract, the paired rollback re-adds the column and re-backfills from bigint (`/100`), with the caveat that historical sub-paise on numeric(16,4) is documented as non-reversible (acceptable; isolated from the ledger).
- **Risk Level:** **High** (it is a money-representation cutover across the live schema). **Complexity:** L. **Timeline:** Wave 2 (start after capture is ledgered so the harness can validate). **Owner:** DB-owning engineer + Finance/Payments. **Dependencies:** MNY-003 (ledgered capture gives the harness ground truth), MNY-013 (CI replay+verification so the cutover is provable). **Success Criteria:** no money path reads a `numeric`-rupee or `integer`-paise column; overflow test passes; equality job = 0; recon zero-drift.
- **Classification:** legacy reps **LEGACY → DEAD**; bigint-paise **CANONICAL.**

### MNY-003 — Ledger the legacy/webhook capture path (the #1 go-live blocker)

- **Current State:** `confirm_order_payment_with_ledger` (baseline:1590) sets `orders.payment_status='paid'` and `payment_transactions='captured'` but **posts no `ledger_*`** (verified: `grep "INSERT INTO ledger_" 000_baseline.sql` = 0). Every storefront sale and every provider webhook uses it (checkout-payment-routes.ts:620; internal-payment-routes.ts:163). `merchant_payable` is understated by the entire legacy GMV; hosted checkout even stamps `capture_posted_to_ledger:true` falsely (checkout.ts:647).
- **Strategic State:** Capture is an **adapter that posts canonical** — `[DEBIT pa_clearing / CREDIT merchant_payable]` — idempotently, either inside the RPC transactionally or by routing all captures through the V1 capture API.
- **Reasoning:** Without this, the ledger is blind to 100% of live volume; payouts gate to zero and the wallet locks (W-1). This is the single largest correctness defect and gates trusting payouts (PAY-001/PAY-019/DB-005).
- **Migration Plan:** Post the F6 capture ledger inside `confirm_order_payment_with_ledger` (idempotent on order/payment id), OR migrate the storefront/webhook confirm to call the V1 capture adapter; remove the false `capture_posted_to_ledger:true` stamp until a real posting returns a txn id (PAY-024); forbid ledger posting for `mode != 'live'` so mock captures cannot mint payable balances (PAY-025).
- **Validation Plan:** Integration: capture → assert a balanced `pa_clearing→merchant_payable` txn; E2E capture→ledger→settlement→payout→refund→reconcile; concurrency: double-webhook + double-verify on the same order produce exactly one posting (idempotency); contract test that the metadata flag is only set when a txn id exists.
- **Deletion Plan:** After capture is ledgered and reconciled, demote `payment_transactions` to a compat shadow (MNY-011) and rename `_with_ledger` to drop the lie.
- **Rollback Plan:** Posting is idempotent and additive; gate it behind a flag — disable to revert to the prior (un-ledgered) behavior with the ledger left frozen and consistent.
- **Risk Level:** Medium (additive idempotent posting on a hot path). **Complexity:** M. **Timeline:** **Wave 1** (first money-correctness item). **Owner:** Finance/Payments. **Dependencies:** MNY-007 (in-RPC tenant derivation so cross-store posting is impossible) ideally lands with it; idempotency lattice (present). **Success Criteria:** every live capture produces exactly one balanced canonical posting; `pa_clearing` is funded by capture; wallet shows `verified`.
- **Classification:** **TRANSITIONAL → CANONICAL** (path becomes a canonical adapter).

### MNY-004 — Ledger the returns-path refund + unify refund accounting

- **Current State:** `complete_order_refund` (baseline:1039) refunds the buyer and flips order/payment to refunded but **posts no `ledger_*`**; it is the live returns path (returns.ts:279; order-execution.adapter.ts:495). The V1 refund API *is* ledgered but reads its cumulative cap from the `payments` table, blind to legacy refunds → cross-path over-refund possible (PAY-002/PAY-012/DB-006; W-4).
- **Strategic State:** **One refund accounting on the ledger.** Both paths post `[DEBIT merchant_payable / CREDIT refund_clearing]`; the cumulative-refundable cap is derived from `refund_clearing`/`merchant_payable`, not per-table columns.
- **Reasoning:** Refund money exits while the book shows merchant still owed it; two unaware refund subsystems can exceed the capture.
- **Migration Plan:** Wrap `complete_order_refund` to also `post_ledger_transaction` (idempotent on refund id); derive remaining-refundable from the ledger so both APIs see one cumulative; align the two refund tables onto the ledger as the shared cap.
- **Validation Plan:** Concurrency: returns-refund + V1-refund on the same payment cannot exceed captured; property test cumulative refunds ≤ captured per order; reversing-entry coverage for refund corrections.
- **Deletion Plan:** Per-table refund cap columns demoted once the ledger is the cap; legacy refund tables consolidated after recon.
- **Rollback Plan:** Idempotent additive posting behind a flag; disable to revert.
- **Risk Level:** Medium. **Complexity:** M. **Timeline:** **Wave 1.** **Owner:** Finance/Payments. **Dependencies:** MNY-003 (capture must be ledgered for refund to relieve a real `merchant_payable`). **Success Criteria:** every refund posts canonical; no cross-path over-refund in the concurrency suite; `refund_clearing` reflects reality.
- **Classification:** **TRANSITIONAL → CANONICAL.**

### MNY-005 — Ledger COD cash-in-transit

- **Current State:** COD remittance writes only `wallet_ledger_entries` (cod-reconciliation.ts:305); canonical `cod_receivable`/`cod_remittance` never move; shrinkage exists only as a negative `difference_amount_minor` on a mutable compat row with no reject trigger (PAY-003; W-6).
- **Strategic State:** COD is an **adapter onto canonical**: debit `cod_receivable` at confirm/collection; at remittance relieve `cod_receivable` / debit bank-or-`pa_clearing`; short/over → **signed** `recon_breaks` (no auto-plug).
- **Reasoning:** COD is the #1 India operational cash risk (R6); cash-in-transit and shrinkage must be in the double-entry book (V1 §8: "COD cash-in-transit modeled explicitly").
- **Migration Plan:** Add the COD adapter postings; migrate `cod_reconciliation_entries.*_minor` int→bigint; replace the SELECT-then-INSERT wallet credit with `ON CONFLICT DO NOTHING` on the existing idempotency unique (PAY-030).
- **Validation Plan:** E2E COD collect→remit→short/over→break; concurrency double-reconcile produces one posting; signed-break test (short vs over distinguishable).
- **Deletion Plan:** `wallet_ledger_entries` COD writes become projection-only after backfill.
- **Rollback Plan:** Additive postings behind a flag; idempotent.
- **Risk Level:** Medium. **Complexity:** M. **Timeline:** **Wave 1–2.** **Owner:** Finance/Payments + Fulfillment. **Dependencies:** MNY-002 (bigint for cod columns), signed-break (MNY-009). **Success Criteria:** COD cash and shrinkage fully in the ledger; reconciliation ties COD remittance to `cod_receivable`.
- **Classification:** **TRANSITIONAL → CANONICAL.**

### MNY-006 — Kill razorpayx self-custody → PA-split mirror

- **Current State:** `payoutRail()` hardcodes `'razorpayx'` (payouts.ts:119-121); adapter defaults to razorpayx (payout-transfer-adapter:73); metadata falsely stamps `no_custody:true`/`instruction_only:true` (settlements.ts:249,298). RazorpayX disburses from LetBuyy's own balance = R-6 breach (PAY-014).
- **Strategic State:** Rail = `razorpay_route`/`cashfree` **split-instruction**; LetBuyy never custodies; `no_custody` derived from the rail; rail asserted to be a split product.
- **Reasoning:** Self-custody is the single largest *regulatory* money risk (R1/R6); the constitution forbids any in-house disbursement in this envelope.
- **Migration Plan:** Change the rail literal + adapter default; assert split-product; derive metadata from rail; wire the Route/Cashfree split client (live = `[HUMAN-REQUIRED]`).
- **Validation Plan:** Contract test: payout refuses any non-split rail; metadata `no_custody` matches the rail; E2E payout uses a split-instruction in mock.
- **Deletion Plan:** Remove all `razorpayx` rail references after the split path is the default.
- **Rollback Plan:** Live payouts stay mock/gated; the change is to the *designed* rail — reverting is a config flip back to mock, never to razorpayx.
- **Risk Level:** Medium (regulatory-critical; latent until live keys). **Complexity:** M. **Timeline:** **Wave 1–2** (before any live Route key). **Owner:** Finance/Payments. **Dependencies:** MNY-008 (real step-up) + MNY-012 (reconcile-on-uncertainty) gate trusting payouts. **Success Criteria:** no `razorpayx` in the payout path; rail is a split product; `no_custody` is true *because the rail makes it true*.
- **Classification:** `razorpayx` **DEAD**; PA-split **CANONICAL.**

### MNY-007 — Fix GUC-from-param cross-store ledger posting

- **Current State:** `post_settlement_ledger_transaction` does `set_config('app.site_id', p_site_id::text, true)` (151:23) immediately before `post_ledger_transaction`, so the inner `current_site_id() <> p_site_id` guard (139:251) is always satisfied — any caller can post into any store's ledger (PAY-020/DB-011; W-3). It is the only ledger-posting wrapper the app uses.
- **Strategic State:** Derive the posting tenant from an **authenticated principal/claim inside the RPC**; assert caller authorization; never set the GUC from a raw parameter.
- **Reasoning:** Tenant isolation on the live ledger path is otherwise absent; a single endpoint that forwards a caller-controlled `store_id` would be cross-tenant ledger poisoning.
- **Migration Plan:** Refactor the RPC to take the tenant from the validated session/claim (aligned with the A2 GUC-from-claims work); keep the explicit cross-tenant admin posting as a narrow, audited, break-glass path only.
- **Validation Plan:** Security test: a caller passing a foreign `site_id` is rejected; property test that no posting lands in a site the principal is not authorized for; audit of every call site for unvalidated `store_id` (the **UNVERIFIED** item in W-3 — confirm no reachable endpoint forwards a raw `store_id`).
- **Deletion Plan:** Remove the `set_config('app.site_id', p_site_id)` line.
- **Rollback Plan:** Guard the new derivation behind a flag; the prior behavior is recoverable but should never be re-enabled in prod.
- **Risk Level:** Medium-High (tenant isolation of money). **Complexity:** M. **Timeline:** **Wave 1** (ships with MNY-003 ideally, so the newly-ledgered capture cannot cross tenants). **Owner:** Finance/Payments + Platform/Security. **Dependencies:** A2 tenant-GUC-from-claims (cross-deliverable). **Success Criteria:** no RPC sets the tenant GUC from a parameter; cross-store posting test fails closed.
- **Classification:** GUC-from-param behavior **DEAD**; the RPC role **CANONICAL.**

### MNY-008 — Real cryptographic step-up on payouts/refunds

- **Current State:** `verifySensitiveActionStepUp` (security-controls.ts:27) accepts any string ≥12 chars + a fresh timestamp as a valid second factor for `refund.approve`/`payout.release` — no HMAC, no DB challenge lookup, no actor/action binding. The `step_up_challenges`/`sensitive_action_approvals` tables (migration 153) exist but are never consulted (PAY-018; W-2).
- **Strategic State:** Step-up validated against a **stored challenge** with **HMAC**, **actor+action binding**, and **single-use**, backed by the 153 tables.
- **Reasoning:** The only second factor on every payout release and refund approval is trivially forgeable client-side — combined with the missing `payout:release` permission (PAY-015), one owner-equivalent session drains payouts.
- **Migration Plan:** Implement challenge issue→verify against `step_up_challenges`; consume `sensitive_action_approvals`; bind to actor+action; mark single-use; enforce on `refund.approve`/`payout.release`.
- **Validation Plan:** Security: forged token rejected; replayed (used) challenge rejected; wrong-actor/wrong-action rejected; expiry enforced.
- **Deletion Plan:** Delete the string-length verifier.
- **Rollback Plan:** Feature-flag the real verifier; the forgeable one must never return to prod.
- **Risk Level:** Medium (forgeable money-auth; latent until live rails). **Complexity:** M. **Timeline:** **Wave 1** (part of the do-not-go-live gate). **Owner:** Finance/Payments + Platform/Security. **Dependencies:** none (tables exist). **Success Criteria:** step-up is cryptographically verified, single-use, actor+action-bound; the forgery walkthrough (W-2) fails.
- **Classification:** string-length verifier **DEAD**; real step-up **CANONICAL.**

### MNY-009 — Commission = 0% + collapse double fee-posting

- **Current State:** `commission_bps DEFAULT 300` (119:81, 119:108) and fallback `300` (commission.ts:202) = a live 3% GMV rake + 18% GST-on-fee; two independent fee postings (per-order commission.ts:337 vs per-statement payouts.ts:466) can double-debit `merchant_payable` (PAY-008/ARCH-001).
- **Strategic State:** **`commission_bps = 0`, permanent.** No fee leg; subscription is the monetization spine.
- **Reasoning:** The 0%-fee wedge is the stated India differentiator (Freeze §7); zeroing the fee also dissolves the double-posting and under-recognition bugs.
- **Migration Plan:** Set defaults and the in-code fallback to 0; if any non-zero schedule is ever reintroduced, route all fees through a **single fee-assessment authority** sharing one idempotency namespace, and tighten the `≤10000` CHECK to a business max.
- **Validation Plan:** Assert no `platform_revenue`/`gst_payable` leg is posted at 0%; regression that `merchant_payable` is never double-debited; property test fee==0 across capture/settlement/payout.
- **Deletion Plan:** Remove the second (duplicate) fee-posting path entirely (DEAD at 0%).
- **Rollback Plan:** Schedule-driven; revert is a config change, not a schema change.
- **Risk Level:** Low. **Complexity:** S. **Timeline:** **Wave 1–2.** **Owner:** Finance/Payments. **Dependencies:** none. **Success Criteria:** every store's effective commission is 0; no double fee posting in the suite.
- **Classification:** 3% rake + double-posting **DEAD**; 0% **CANONICAL.**

### MNY-010 — Gift cards / store credit / ai-credits as ledger tenders

- **Current State:** `gift_card_accounts.balance` is mutated in place (`UPDATE … SET balance = balance - amt`, **baseline:1836**, verified) at `numeric(12,2)`; a *second* `gift_cards.balance` exists at `numeric(10,2)` (DUP-8); `store_credit`/`ai_credits` are mutable; compat `*_ledger_entries` have no reject trigger (PAY-027/DB-010/DB-020/CHK-024).
- **Strategic State:** Each tender is a **ledger account** (liability); issue/redeem are ledger postings; balance is derived; the duplicate `gift_cards.balance` is dropped; precision unified to bigint paise.
- **Reasoning:** Mutable, dual-precision balances are a divergence/double-spend surface and are invisible to the book; tenders must be modeled as liabilities on the SSOT.
- **Migration Plan:** Model gift-card/store-credit/ai-credit liability accounts; convert issue/redeem to postings; backfill current balances onto the ledger; demote mutable columns to derived; drop the duplicate gift-card balance. Gift-card-as-tender is P2 in V1 (deferred), so this is **Wave 3–4** except where checkout already debits it (the existing `FOR UPDATE` at baseline:1824 stays for safety until the cutover).
- **Validation Plan:** Concurrency double-redeem on one card → exactly one debit; balance derives from ledger; no path reads `gift_cards.balance`.
- **Deletion Plan:** Drop `gift_cards.balance` and the mutable `gift_card_accounts.balance` after backfill+recon; compat ledger tables become projections.
- **Rollback Plan:** Backfill is additive; keep the mutable column readable until recon proves zero drift, then drop with a paired rollback.
- **Risk Level:** Medium. **Complexity:** M. **Timeline:** **Wave 3–4** (gift-card tender is P2). **Owner:** Finance/Payments. **Dependencies:** MNY-002 (bigint), MNY-001. **Success Criteria:** every tender balance derives from the ledger; no mutable tender balance remains; no precision split.
- **Classification:** mutable balances **LEGACY**; `gift_cards.balance` duplicate **DEAD**; tender-on-ledger **CANONICAL** (capability FROZEN until P2 trigger for ai-credits).

### MNY-011 — Demote `payment_transactions` (and unify payment truth)

- **Current State:** Two payment-truth rows: new `payments` session model (142:43) and legacy `payment_transactions` capture record (baseline:1618), linked by FK (142:81), each with its own provider-payment-id unique (DUP-5). The V1 capture path also skips the cross-order replay assert that only checks the legacy table (PAY-010).
- **Strategic State:** `payments` is the **single payment truth**; `payment_transactions` is a compat/audit shadow; the replay assert covers the `payments` table.
- **Reasoning:** Dual payment truth invites divergence and the replay-guard blind spot.
- **Migration Plan:** Route all capture truth to `payments`; extend `assertProviderPaymentNotReplayed` to the `payments` table; demote `payment_transactions` to shadow after MNY-003.
- **Validation Plan:** Replay test across `payments` sessions for one order → one posting; provider-payment-id uniqueness holds at capture time (closes the **UNVERIFIED** PAY-010 question).
- **Deletion Plan:** Delete `payment_transactions` writes after backfill+recon; keep as read-only audit if needed.
- **Rollback Plan:** Dual-write during transition; revert by repointing reads.
- **Risk Level:** Medium. **Complexity:** M. **Timeline:** **Wave 2.** **Owner:** Finance/Payments. **Dependencies:** MNY-003. **Success Criteria:** one payment-truth table; replay assert covers it; no dual provider-payment-id divergence.
- **Classification:** `payments` **CANONICAL**; `payment_transactions` **TRANSITIONAL → LEGACY.**

### MNY-012 — Reconcile-on-uncertainty for money-out (no stranded payouts)

- **Current State:** After `claim_payout_statement_release` flips to `processing`, the transfer runs (payouts.ts:580); a transfer that succeeds at the PA but fails the local write (payouts.ts:590) strands the statement in `processing` with money gone and no break (PAY-013). V1 §8 requires reconcile-on-uncertainty; it is absent for money-out.
- **Strategic State:** After release, query PA status; ambiguous → post to suspense/break + idempotent retry; never strand money with the book saying "still owed."
- **Reasoning:** Money-out without uncertainty handling is a guaranteed eventual loss/lock.
- **Migration Plan:** Add a payout status reconciler (queue-worker) that polls/handles PA callbacks, posts to `recon_breaks`/suspense on ambiguity, retries idempotently.
- **Validation Plan:** Fault injection: PA-success + local-write-fail → reconciler resolves; concurrency double-settle → one transfer; rollback validation that a stuck `processing` is recoverable.
- **Deletion Plan:** n/a (additive).
- **Rollback Plan:** Feature-flag the reconciler; payouts stay mock-gated meanwhile.
- **Risk Level:** Medium. **Complexity:** M. **Timeline:** **Wave 2** (before trusting live payouts). **Owner:** Finance/Payments. **Dependencies:** MNY-006. **Success Criteria:** no payout can be stranded; every ambiguous transfer resolves to settled or an aged, explained break.
- **Classification:** **TRANSITIONAL → CANONICAL.**

### MNY-013 — Append-only hardening + RESTRICT FKs + CI replay/verification

- **Current State:** Append-only is trigger-only; **zero `REVOKE`** in the corpus; gateway runs as `service_role` (likely owner) — one `DISABLE TRIGGER` from mutating history (PAY-021/DB-009). Ledger FKs `ON DELETE CASCADE` to `sites` (139:128, accidentally saved only by the reject trigger — CI-3/DB-014). Migrations are never replayed in CI and the 19 verification scripts are never executed (DB-021).
- **Strategic State:** `REVOKE UPDATE,DELETE` from `service_role`/`PUBLIC`; no-login owner; runtime as non-owner; ledger/audit FKs `RESTRICT`; CI replays 000→161 on ephemeral PG and runs all `verification/*.sql`.
- **Reasoning:** Immutability that a `DISABLE TRIGGER` defeats is not immutability; an unreplayed chain (with the missing `customers` FK, DB-001/CI-8) reaches prod broken.
- **Migration Plan:** Add the `REVOKE` + ownership change; flip CASCADE→RESTRICT on money/audit FKs; add the CI job; attach reject triggers to compat ledger tables until they are projections; fix the 151/160 rollback `DROP COLUMN` residue (DB-008); fix the dup-129 number (DB-022).
- **Validation Plan:** Attempt UPDATE/DELETE on `ledger_entries` as `service_role` → denied; attempt `DISABLE TRIGGER` as runtime role → denied; CI replay green + all verification SQL passes; `sites` delete blocked from cascading ledger.
- **Deletion Plan:** Drop `backfill_wallet_ledger_to_canonical` post-backfill (DB-012); gate `mirror_hot_table_partition_shadow` table allowlist (DB-013).
- **Rollback Plan:** `REVOKE`/ownership are reversible grants; FK change ships a paired rollback.
- **Risk Level:** Medium. **Complexity:** S (REVOKE/FKs) + M (CI replay). **Timeline:** **Wave 1** (REVOKE/RESTRICT) + **Wave 2** (CI replay). **Owner:** DB-owning engineer + Platform/Security. **Dependencies:** none for REVOKE; A0 deploy unblock for CI. **Success Criteria:** ledger history is mutation-proof even to the runtime role; CI replays and verifies the chain; no money/audit CASCADE-to-sites.
- **Classification:** **CANONICAL** (hardening); migration tools **DEAD-after-use.**

### MNY-014 — Transactional outbox + compensation executor (money side-effects)

- **Current State:** `emitDomainEvent` is a separate Supabase call after the money mutation and swallows missing-table errors (PAY-007); `compensation_actions` rows are written at checkout.ts:409 with **zero readers** (PAY-026), so a captured-but-order-failed buyer is never auto-refunded (money trapped).
- **Strategic State:** Outbox row written **in the same transaction** as the money mutation (in the RPC); a `queue-workers` consumer executes `compensation_actions(status=pending, action=refund_payment_intent)` via the canonical refund adapter, idempotently.
- **Reasoning:** Money side-effects (settlement scheduling, fulfillment, the auto-refund safety net) must be reliable, not silently dropped; the scoped-compensation path is the buyer-protection guarantee V1 §9 promises.
- **Migration Plan:** Make the outbox write part of the money RPC's transaction; build the compensation executor consuming the table.
- **Validation Plan:** Fault injection: capture-succeeds + order-create-fails → compensation executor issues an idempotent refund that posts canonical; outbox never silently null.
- **Deletion Plan:** n/a.
- **Rollback Plan:** Executor behind a flag; outbox change is additive.
- **Risk Level:** Medium. **Complexity:** M. **Timeline:** **Wave 1–2** (outbox is a P0 kernel in V1). **Owner:** Checkout + Finance/Payments. **Dependencies:** MNY-004 (refund adapter is the compensation action). **Success Criteria:** no captured-but-failed order leaves money trapped; outbox is transactional and never swallows.
- **Classification:** **TRANSITIONAL → CANONICAL.**

### MNY-015 — Ledger-backfill: reconcile legacy balances to canonical (zero-loss)

- **Current State:** The compat tables (`wallet_ledger_entries` etc.) and mutable balances hold money state the canonical ledger never saw; `backfill_wallet_ledger_to_canonical` (160:279) exists to migrate them but is a standing cross-tenant footgun.
- **Strategic State:** A **one-time, gated, idempotent backfill** posts the historical legacy money state into canonical so the ledger reflects all prior captures/refunds/COD/tenders, validated to **zero drift** before any compat table is deleted.
- **Reasoning:** The ledger must be *complete* (not just correct going forward) before mutable/compat stores are retired, or historical balances vanish.
- **Migration Plan:** Run the backfill per site under break-glass; for each legacy money record post the equivalent canonical txn idempotently; reconcile every site's derived `merchant_payable` to its prior wallet "available" and every tender balance to its mutable column.
- **Validation Plan:** **Zero-loss proof** — for every site: `ledger_account_balance_minor(merchant_payable)` equals the reconciled legacy available within `0` paise; `money_ledger_site_reconciliations` reads `verified`, `variance_minor=0`; a full reconciliation-harness pass over historical fixtures shows zero break or aged-explained suspense; a row-count parity check (every legacy money row has a canonical counterpart).
- **Deletion Plan:** Only after zero-drift across **all** sites: demote compat tables to projections, then drop in paired-rollback migrations; drop `backfill_wallet_ledger_to_canonical` (DB-012).
- **Rollback Plan:** The backfill is additive (it only *posts* to the append-only ledger via reversible logical txns); if a discrepancy appears, the offending site's postings are corrected by **reversing entries** (never edits), and compat tables remain authoritative until re-proven. No compat table is dropped until the proof holds, so rollback never loses the legacy source.
- **Risk Level:** **High** (it reconciles real historical money). **Complexity:** L. **Timeline:** **Wave 3** (after all adapters land so the going-forward book is correct; backfill closes the historical gap). **Owner:** Finance/Payments + DB-owning engineer. **Dependencies:** MNY-003/004/005/010 (adapters) + MNY-002 (bigint). **Success Criteria:** every site reconciles to `variance_minor=0`; no money row lacks a canonical counterpart; compat tables safely retired.
- **Classification:** backfill tool **TRANSITIONAL → DEAD-after-use**; the reconciled ledger **CANONICAL.**

### MNY-016 — Webhook & storefront-verify replay/forgery hardening

- **Current State:** Webhook dedupe is correct (HMAC + `(provider, provider_event_id)` unique) but has **no timestamp window** (index.ts:714-719) and **suppresses retries after a processing failure** (index.ts:733 short-circuits, leaving an order unpaid despite money captured — PAY-016/W-7); storefront verify trusts HMAC without a server-side capture/amount confirm or replay assert (PAY-022); the internal money-mutation secret falls back to `AUTH_SECRET` (PAY-023).
- **Strategic State:** Signature **+ timestamp-window + nonce** (V1 §8); dedup row marked `processed` only after side effects so a failed capture re-runs on redelivery; storefront verify adds `fetchRazorpayPayment` capture+amount + `assertProviderPaymentNotReplayed`; dedicated `INTERNAL_API_SECRET`.
- **Reasoning:** Replay-safety must not rest solely on dedup retention; a transiently-failed capture must self-heal; the public verify must match the subscription verify's own standard; one secret must not forge both auth and money.
- **Migration Plan:** Add timestamp-window rejection; restructure dedup to `processed`-after-effects; harden storefront verify; split the internal secret and rotate it independently.
- **Validation Plan:** Security: replay an old signed body → rejected by window; a failed-then-redelivered capture → order becomes paid; storefront verify rejects an unconfirmed/replayed payment; secret-rotation test.
- **Deletion Plan:** Remove the `AUTH_SECRET` fallback.
- **Rollback Plan:** Each hardening is independently flaggable.
- **Risk Level:** Medium. **Complexity:** S–M. **Timeline:** **Wave 1–2.** **Owner:** Finance/Payments + Platform/Security. **Dependencies:** identity `AUTH_SECRET`→asymmetric work (A1, cross-deliverable) for the secret split. **Success Criteria:** replay window enforced; failed captures self-heal; storefront verify at parity; internal secret independent of `AUTH_SECRET`.
- **Classification:** **TRANSITIONAL → CANONICAL**; `AUTH_SECRET` fallback **DEAD.**

---

## 10. Wave Sequencing (0–8) — money domain

| Wave | Theme | Money items | Why here |
|---|---|---|---|
| **0** | Security S0s + deploy unblock (other deliverables) | (none owned here) — but the deploy meta-blocker gates MNY-013's CI replay | Nothing ships until the branch lag is fixed. |
| **1** | **Money-correctness core (do-not-go-live gate)** | MNY-003 (ledger capture), MNY-004 (ledger refund), MNY-007 (GUC-from-param), MNY-008 (real step-up), MNY-013a (`REVOKE`+RESTRICT), MNY-016a (replay window/self-heal), MNY-009a (commission=0), MNY-006a (rail literal→split) | The six S1s + the rake; these must be true before any live PSP/Route key. |
| **2** | **Reconciliation closure + representation cutover + trust payouts** | MNY-002 (bigint cutover), MNY-005 (COD ledger), MNY-006b (PA-split execution + assert), MNY-012 (reconcile-on-uncertainty), MNY-011 (demote payment_transactions), MNY-013b (CI replay/verification), MNY-014 (transactional outbox + compensation executor) | Reconciliation must be *possible* (capture ledgered in W1) before the representation cutover is validated and payouts are trusted. |
| **3** | **Historical backfill + tenders** | MNY-015 (zero-loss ledger backfill), MNY-010 (gift-card/store-credit tenders onto ledger), retire compat tables after zero-drift | The going-forward book is correct after W1–2; W3 closes the historical gap and moves remaining mutable balances onto the SSOT. |
| **4** | Tender/ai-credit completion + cleanup | MNY-010 completion (ai-credits as tender when AI Studio ships), drop migration tools (`backfill_*`), drop duplicate `gift_cards.balance` | P2 tender capability; safe cleanup once recon holds. |
| **5–8** | Scale hardening (largely other domains) | money-domain: revisit fee model only if business reintroduces any non-zero schedule (single fee authority); partitioning of money tables deferred per V1 (P2 volume trigger) | No money go-live blockers remain past W3. |

**Go-live blocker closure:** the six money S1s (PAY-001, PAY-002→DB-006, PAY-014, PAY-018, PAY-019, PAY-020) are closed by **Waves 1–2** (capture/refund ledgered + reconciliation possible in W1–2; rail/step-up/GUC in W1). **Wave 3** closes the historical-completeness blocker (backfill). After Wave 3, live PSP/Route keys can be connected without a money-correctness defect.

---

## 11. Test & Validation Plan (money = highest rigor)

No money system is deleted until the reconciliation harness proves zero drift on the path it replaces. The full ladder, mapped to findings:

| Test class | What it must prove | Tied to |
|---|---|---|
| **Unit** | Ledger builders produce balanced, bigint, INR-asserted, ≥2-line postings for capture/refund/reversal/COD/tender; rail returns a split product; step-up rejects forged tokens. | packages/payments builders; MNY-006/008 |
| **Integration** | Each adapter (capture/refund/COD) posts the correct canonical legs; settlement ingest posts only when balanced; payout release gates on derived balance. | MNY-003/004/005/006 |
| **Contract** | `no_custody` metadata == rail; `capture_posted_to_ledger` set only when a txn id exists; payout refuses non-split rails; storefront verify == subscription verify standard. | PAY-024/PAY-022; MNY-006/016 |
| **E2E** | **capture → ledger → settlement → payout → refund → reconcile** end-to-end ties to provider+COD fixtures with zero break. | MNY-001 whole flow |
| **Security (forgery/replay/step-up)** | Forged step-up rejected (W-2); replayed old webhook rejected by window; cross-store posting rejected (W-3); storefront forgery rejected; internal secret independent of `AUTH_SECRET`. | MNY-007/008/016; PAY-018/020/022/023 |
| **Property-based** | **Σdebit = Σcredit** holds for every generated posting; cumulative refunds ≤ captured; commission==0 ⇒ no fee leg; balance == Σentries for every account. | 139:336; MNY-001/004/009 |
| **Concurrency** | **double-capture / double-payout / double-refund** races each yield exactly one effect (idempotency + `FOR UPDATE`); cross-path refund (returns+V1) cannot exceed captured; double-COD-reconcile yields one posting. | PAY-010/012/013/030; W-4 |
| **Reconciliation harness** | Replays PSP + COD remittance fixtures; asserts **zero break or aged-explained suspense**; never auto-plugs; break resolution requires maker-checker + real step-up. | settlements.ts:237-283; V1 §8 |
| **Reversing-entry coverage** | All corrections are reversing entries (no in-place edits); a corrected refund/capture is auditable as two postings. | packages/payments reversal; MNY-013 |
| **Performance** | Posting + balance-derivation latency acceptable at 30k orders/mo (V1 scale); money-join indexes present (MI-1/3/6 → DB-029). | DB-029 |
| **Regression** | `merchant_payable` never double-debited (fee dedup); `pa_clearing` funded by capture; no numeric-rupee/int32 read on a money path. | PAY-008; MNY-002/003 |
| **Rollback validation** | Each money migration's paired rollback reverses cleanly (fix 151/160 `DROP COLUMN` residue, DB-008); a stuck `processing` payout is recoverable. | DB-008; MNY-012 |
| **Deletion validation** | No compat table / mutable column is dropped until (a) row-count parity, (b) `variance_minor=0` for every site, (c) reconciliation harness zero-drift. | MNY-010/011/015 |
| **Backfill zero-loss proof** | Per site: derived `merchant_payable` == reconciled legacy available within 0 paise; every legacy money row has a canonical counterpart; `money_ledger_site_reconciliations` == `verified`; ledger balance byte-identical before/after representation contract. | **MNY-015** (the gate for retiring any money system) |
| **CI replay/verification** | `supabase db reset` on ephemeral PG, replay 000→161, execute all 19 `verification/*.sql`; catches the missing `customers` FK (DB-001/CI-8) and dup-129. | DB-021; MNY-013 |

---

## 12. Risk Register (money domain)

| ID | Risk | Sev | Likelihood (today) | Mitigation | Owner |
|---|---|---|---|---|---|
| MR-1 | Ledger blind to live captures ⇒ payouts blocked / wallet locked on 100% of volume the day live keys connect | S1 (go-live blocker) | Certain at go-live if MNY-003 not done | MNY-003 (Wave 1) before any live key | Finance/Payments |
| MR-2 | Self-custody `razorpayx` rail = unlicensed-PA / R-6 exposure | S1 (regulatory) | Latent until live Route key | MNY-006 (Wave 1–2); never connect a live key on razorpayx | Finance/Payments |
| MR-3 | Forgeable step-up ⇒ payout drain by an owner-equivalent session | S1 | Latent until live rail | MNY-008 (Wave 1) + `payout:release` perm + maker≠checker | Finance/Payments + Security |
| MR-4 | Cross-store ledger poisoning via GUC-from-param | S1 | Latent (no confirmed reachable endpoint forwards raw `store_id` — **UNVERIFIED**) | MNY-007 (Wave 1) + audit every call site | Finance/Payments + Security |
| MR-5 | Representation cutover or backfill loses/100×-errors money | High | Controlled by zero-loss gate | MNY-002/MNY-015 zero-loss proof; expand/contract; reversing-entry-only corrections | DB-owner + Finance/Payments |
| MR-6 | Unledgered refund/COD ⇒ `refund_clearing`/`cod_receivable` permanently wrong | S1 | Certain on those paths today | MNY-004/005 (Wave 1–2) | Finance/Payments |
| MR-7 | Append-only defeated by `DISABLE TRIGGER` on the runtime role | S1 | Possible (no REVOKE) | MNY-013 `REVOKE`+no-login owner (Wave 1) | DB-owner + Security |
| MR-8 | Cross-path over-refund (returns vs V1) exceeds capture | S2 | Possible if both APIs used | MNY-004 unify cap on ledger; concurrency suite | Finance/Payments |
| MR-9 | Payout stranded (PA-success, local-fail) | S2 | Possible once live | MNY-012 reconcile-on-uncertainty | Finance/Payments |
| MR-10 | Mock money mints a payable balance in a shared DB | S2 | Possible in shared envs | MNY-003 forbid ledger posting for `mode != live`; tag provider_mode | Finance/Payments |
| MR-11 | int32 overflow on payout/settlement > ₹2.14cr | S2 | Possible on large B2B/COD aggregate | MNY-002 bigint cutover | DB-owner |
| MR-12 | Migration chain unreplayable (`customers` FK) reaches prod | S2 | Certain without CI replay | MNY-013 CI replay+verification | DB-owner |

---

## 13. Money Canonicalization Findings / Actions

ID | Component | Decision | Classification | Wave | Risk | Evidence (path:line)
---|---|---|---|---|---|---
MNY-001 | Canonical ledger as SSOT; balance derived | Make the ledger the only money truth; balances = `ledger_account_balance_minor` | CANONICAL | 1–3 | Medium | 139:75-142; 139:223; 160:173
MNY-002 | Money representation (4 reps → bigint paise) | Expand/contract cutover to bigint paise everywhere; zero-loss gate | LEGACY→DEAD reps / CANONICAL bigint | 2 | High | DB-003 (139:132; 119:52; 109:7; baseline:13057); 160:28-40
MNY-003 | Legacy/webhook capture not ledgered | Post canonical capture (debit pa_clearing/credit merchant_payable) idempotently; route via V1 adapter | TRANSITIONAL→CANONICAL | 1 | Medium | baseline:1590-1709 (INSERT INTO ledger_=0); checkout-payment-routes.ts:620; internal-payment-routes.ts:163
MNY-004 | Returns-path refund not ledgered; cross-path over-refund | Post canonical refund; unify cap on ledger | TRANSITIONAL→CANONICAL | 1 | Medium | baseline:1039-1208; returns.ts:279; payments.ts:486
MNY-005 | COD cash-in-transit not ledgered | COD adapter posts cod_receivable; signed breaks | TRANSITIONAL→CANONICAL | 1–2 | Medium | cod-reconciliation.ts:305-326
MNY-006 | razorpayx self-custody rail (R-6) | Kill razorpayx; PA-split (Route/Cashfree) split-instruction; derive no_custody from rail | DEAD rail / CANONICAL PA-split | 1–2 | Medium (regulatory) | payouts.ts:119-121; payout-transfer-adapter:73; settlements.ts:249,298
MNY-007 | GUC-from-param cross-store posting | Derive tenant from principal inside the RPC; never set GUC from a param | DEAD behavior / CANONICAL RPC | 1 | Medium-High | 151:23; 139:251
MNY-008 | Forgeable step-up on payouts/refunds | Real HMAC/stored-challenge step-up, actor+action-bound, single-use | DEAD verifier / CANONICAL | 1 | Medium | security-controls.ts:20-83; payments.ts:491; payouts.ts:532
MNY-009 | 3% rake default + double fee-posting | commission_bps=0 permanent; single fee authority if ever non-zero | DEAD rake / CANONICAL 0% | 1–2 | Low | 119:81,108; commission.ts:202,337; payouts.ts:466
MNY-010 | Mutable gift-card/store-credit/ai-credit balances | Model tenders as ledger liability accounts; drop duplicate gift_cards.balance | LEGACY mutable / DEAD duplicate / CANONICAL tender | 3–4 | Medium | baseline:1836; 9438 (DUP-8); 153:39; baseline:8152
MNY-011 | Dual payment truth (payments vs payment_transactions) | payments is sole truth; demote payment_transactions; replay assert covers payments | CANONICAL payments / TRANSITIONAL→LEGACY | 2 | Medium | 142:43,81; baseline:1618; payments.ts:252-309
MNY-012 | No reconcile-on-uncertainty for money-out | Add payout status reconciler → suspense/break + idempotent retry | TRANSITIONAL→CANONICAL | 2 | Medium | payouts.ts:580-608
MNY-013 | Append-only trigger-only + CASCADE FKs + no CI replay | REVOKE UPDATE,DELETE + no-login owner; FKs RESTRICT; CI replay+verification | CANONICAL hardening | 1 (REVOKE) / 2 (CI) | Medium | 139:358-376; grep REVOKE=0; 139:128; ci.yml:247; production-deploy.yml:240
MNY-014 | Non-atomic outbox + unexecuted compensation | Transactional outbox in the money RPC; build compensation executor | TRANSITIONAL→CANONICAL | 1–2 | Medium | event-execution.adapter.ts:60-85; checkout.ts:409
MNY-015 | Legacy balances not on canonical (historical gap) | One-time gated zero-loss backfill; retire compat tables only after zero-drift | TRANSITIONAL tool→DEAD / CANONICAL ledger | 3 | High | 160:279-355; wallet.ts:163; 160:212-254
MNY-016 | Webhook replay window + retry self-heal + storefront verify + internal secret | Timestamp-window+nonce; processed-after-effects; capture/amount+replay assert; dedicated INTERNAL_API_SECRET | TRANSITIONAL→CANONICAL / DEAD fallback | 1–2 | Medium | index.ts:714-719,733; checkout-payment-routes.ts:534; webhook index.ts:543

---

## Appendix — What is genuinely correct (protect it; do not "improve" it away)

The kernel primitives are exemplary and must be preserved verbatim through every wave:

- **`packages/payments` ledger builders** — balanced, bigint, INR-asserted, ≥2 lines, account-code-validated.
- **`post_ledger_transaction` (139:223)** — idempotent (`ON CONFLICT`), balance-checked (139:336), append-only-enforced, tenant-GUC-checked *(once the wrapper stops bypassing it — MNY-007)*.
- **`claim_payout_statement_release` (160:357)** — `FOR UPDATE` + idempotency replay + status gate + ledger-balance gate. The payout-double-release fix done right.
- **Settlement break handling** — no auto-plug; explicit `recon_breaks` + alert (settlements.ts:265; billing-core:633). This is the V1 §8 behavior; do not weaken it.
- **Webhook signature verification** — correct HMAC + timing-safe across all four providers, with DB-unique dedupe and an idempotent downstream order RPC.
- **Merchant-admin Razorpay verify & subscription verify** — full order+payment+signature binding + provider-order reference + cross-order replay assert + (subscription) server-side capture+amount confirm. The payment-forgery fix done right; the storefront verify must be brought *up to* this standard (MNY-016), not the reverse.
- **Server-side amount re-derivation** — client-supplied amounts rejected on mismatch everywhere.
- **Wallet honesty gate (wallet.ts:163)** — refuses to display a balance unless reconciliation is `verified` with zero variance. This is the control that *surfaces* unledgered-path drift instead of hiding it; it is a feature, not a bug, and is the acceptance signal for MNY-015.

> The tragedy this plan corrects: the hard parts (a correct double-entry kernel, idempotency, payout gating, signature binding) are done well; the failure is in *not connecting the legacy money paths to them*. This is a wiring-and-cutover program, not a rebuild.
