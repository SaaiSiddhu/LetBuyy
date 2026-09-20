# MONEY TRUTH REPORT — LetBuyy Repository Truth Audit

**Date:** 2026-06-10 · **Auditor axis:** Money truth (capture, refund, COD, settlement, payout, commission, webhooks)
**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · **Branch:** `stepup/main` · **HEAD:** `c4fc3cd6` ("fix(foundation): resolve final audit drift")
**Working tree:** ~998 dirty paths. Money migrations `162/163/164/165/166` and all Phase A/B/D money validators are **untracked** (worktree-only). `main` is 30 commits behind `stepup/main` (merge-base = `main` tip `4bcae19a`).

> Discovery-only. Every claim cites file:line. Code over docs. Live provider/DB behavior is out of scope (see Unknowns).

---

## 1. Executive Summary

1. **A real double-entry ledger kernel exists and is well-built** — `ledger_accounts/ledger_transactions/ledger_entries` (migration `139_executable_foundation_ledger_core.sql:75–142`) with append-only triggers (139:358–376), a deferred balance constraint trigger (139:378–382), idempotent posting (`UNIQUE (site_id, source_type, source_id, idempotency_key)`, 139:122), INR-only checks, and FORCE RLS keyed to the `app.site_id` GUC (139:384–406). Worktree migration 165 additionally **revokes UPDATE/DELETE grants** on both tables from every role including `service_role` (165:463–464).
2. **But the dominant customer money path never touches it.** Storefront checkout payment confirmation — both the public verify route and all provider webhooks — terminates in `confirm_order_payment_with_ledger` (000_baseline.sql:1590), which despite its name writes **zero canonical ledger lines**: it flips `orders.payment_status='paid'`, upserts `payment_transactions` to `captured`, and inserts `payment_attempts` (baseline:1599–1705). `000_baseline.sql` contains no reference to `post_ledger_transaction` or the canonical tables at all. Canonical capture/refund postings exist **only** on the V1 `/payments` sessions surface (`payments.ts:289–309, 516–535`).
3. **Refunds are split-brained.** The V1 path (`payments.ts:462–625`) is exemplary: step-up required, provider refund id required, cumulative cap, canonical `merchant_payable→refund_clearing` posting. The orders path (`orders.ts:1294–1374` → `complete_order_refund`, baseline:1039–1208) and the webhook `refund.created` path mark refunds succeeded with **no ledger entry**. Historical finding "refund-not-ledgered" is **fixed on one of three refund paths**.
4. **COD remittance is genuinely fixed — in the worktree only.** Worktree `cod-reconciliation.ts:290` delegates to the atomic `reconcile_cod_remittance_with_ledger` RPC (165:267–461: replay-by-idempotency-key, `FOR UPDATE`, canonical `cod_receivable→merchant_payable` posting, compatibility-only wallet row in the same transaction). At HEAD the route does a **two-step non-atomic** update + `insertWalletCreditIfMissing` wallet credit with **no canonical ledger** (verified via `git diff`). Migration 165 is untracked — at HEAD the RPC does not exist.
5. **`merchant_payable` has three independent credit writers with no cross-source dedup** — payment-capture postings (`payments.ts:289`), commission reconcile per-order settlement postings (`commission.ts:321–342`), and merchant-declared settlement ingest (`settlements.ts:207–252`). Each is idempotent within its own `source_type/source_id` but nothing prevents the same paid order from being credited twice via two different writers. Payout statement gross is computed from `orders.total` (`payouts.ts:384–402`), a fourth, ledger-independent number.
6. **Payout double-release is properly guarded at the DB** — `claim_payout_statement_release` (160:357–421): row lock, idempotency-key replay short-circuit, `released` short-circuit, non-pending rejection, and a `merchant_payable` **ledger-balance sufficiency check** (160:398–404). Beyond the claim, the release path is **fail-closed dead code**: `createPayoutTransferAdapter` is invoked with no provider client and `initiateTransfer` unconditionally throws `PayoutProviderUnavailable` when `options.provider` is absent (payout-transfer-adapter/index.ts:103–105), plus an env gate `RAZORPAY_ROUTE_PROVIDER_ENABLED === 'true'` (payouts.ts:123–131). No payout can actually move money from this code today.
7. **Commission truth:** HEAD = **300 bps (3%)** defaults in DB (`119_mobile_money_ledgers.sql:81,108`) and code fallbacks (`payouts.ts` HEAD `?? 300`; `commission.ts` HEAD `commission_bps: 300`). Worktree = **0 bps** everywhere + untracked migration 162 zeroing defaults and backfilling rows + `commission-bps-zero-validator`. `main` also carries `?? 300`. `gmv_percentage` is 0 in all billing tiers at HEAD and worktree. App-marketplace billing retains a separate, intentional **15% platform fee** on partner app revenue (`billing-core/src/index.ts:458–459`), outside the canonical ledger.
8. **Self-custody residue:** worktree defaults are `razorpay_route` (payouts.ts:120, adapter:73); HEAD defaulted `razorpayx` in both. `razorpayx` survives as a *legal enum member* in ~8 type/schema locations (`shared-types:713,3905`, `billing-core:95,384,454`, `event-core:323,411`, `api-client:766`, adapter:1) and in the baseline DB CHECK for `partner_payout_ledger_entries.rail` (baseline:10252).
9. **Reconciliation is built but wiring-dead.** `refresh/assert_money_ledger_site_reconciliation` and `backfill_wallet_ledger_to_canonical` (160:198–355) have **zero runtime callers** — only tests and migrations reference them. Because `wallet.ts:163–176` **fails closed** (409 `LEDGER_RECONCILIATION_REQUIRED` unless a verified zero-variance row exists), the merchant wallet read is permanently unavailable until an operator manually runs the backfill. No auto-plug anywhere in the current chain: reconciliation records `mismatch` (160:238), settlement breaks **skip posting** and open `recon_breaks` rows (settlements.ts:237, 265–280).
10. **Webhook truth is solid at the boundary, hollow at the ledger:** all four providers signature-verified (Razorpay dual-verified with timing-safe compare, index.ts:680–696; Stripe timestamped, :868–886; PayPal & Cashfree via adapters, :1067, :1205), replay-deduped via `UNIQUE (provider, provider_event_id)` upsert (baseline:14680; writeWebhookEvent index.ts:65–86). Every verified money event then flows to the no-ledger `confirm/record_*_with_ledger` RPCs (§2a).
11. **HEAD vs worktree vs `main` is three different money systems.** `main` (likely deploy branch) ends at migration **158**: no payout release claim/guard (160), no capture/refund ledger columns or routes, old COD path, 3% fallback. `stepup/main` HEAD has the ledger authority (139–161) and capture/refund ledger code but **no commission-zero, no D5 RPC, no ratchet validators** (162–166 + validators untracked). Only the worktree contains the claimed end-state.

**Verdict:** The canonical-ledger *kernel* and the V1 payments-session, COD (worktree), settlement-ingest, and payout-fee/release postings are real and balanced. The *storefront order-money path* — the one customers actually hit — and two of three refund paths still move money state with no ledger entries; the ratchet validator's file-level "evidence" heuristic cannot see this because the orders RPCs live in SQL, not TS. Money truth is therefore **canonical-on-the-new-surface, legacy-on-the-main-surface**, with all the hardening one `git add` away from not existing.

---

## 2. Canonical Money Path Traces

### (a) Online payment capture → ledger

**Canonical (V1 payment sessions) — HEAD = worktree (`payments.ts` unmodified):**
- Entry: `POST /payments/:paymentId/capture` (`services/api-gateway/src/routes/payments.ts:252`). Ownership via `loadOwnedPaymentSession` (payment-route-support.ts:201–224); replay short-circuit if already `captured` with `capture_ledger_transaction_id` (payments.ts:262–264); requires `provider_payment_id` (payments.ts:271–274).
- Idempotency: `IdempotencyExecutionAdapter.begin` scope `payment.capture:{paymentId}` (payments.ts:269–286) + ledger key `payment.capture:{paymentId}:{idempotency_key}` (payments.ts:270).
- Posting: `postPaymentLedger` (payment-route-support.ts:179–199) → RPC **`post_settlement_ledger_transaction`** with plan from `buildPaymentCaptureLedgerPosting` (packages/payments/src/index.ts:451–502):
  - `pa_clearing` **debit** gross; `merchant_payable` **credit** gross − fee − gst; optional `platform_revenue`/`gst_payable` credits. Routes call it with `platformFeeMinor: 0, gstMinor: 0`, metadata `fee_assessment: 'deferred_to_payout_statement'` (payments.ts:296–306).
- Row link: `payments.capture_ledger_transaction_id` set (payments.ts:317; column from 160:9).
- Tenant scoping: worktree RPC derives `site_id` from the **source row** (`resolve_money_ledger_source_site_id`, 165:110–212), raises on caller mismatch (165:243–245), sets the GUC from the resolved owner (165:252); HEAD RPC (151:6–36) **trusted caller `p_site_id` and set the GUC from it** — the pre-D5 cross-tenant posting surface.

**Non-canonical (storefront orders) — HEAD = worktree:**
- Entry points: `POST /storefront/:subdomain/payments/razorpay/verify` (checkout-payment-routes.ts:540–653), merchant `POST /payments/razorpay/verify` (payments.ts:1014–1115), all webhook confirms (webhook-service → `/v1/storefront/internal/payments/confirm`, gateway-order-transitions.ts:59; internal-payment-routes.ts:152–181).
- All call `PaymentExecutionAdapter.confirmPayment` → RPC **`confirm_order_payment_with_ledger`** (adapter:94–102) → `confirm_order_payment` (baseline:1439–1583) + `payment_transactions` captured upsert + `payment_attempts` insert (baseline:1618–1705). **No `ledger_transactions`/`ledger_entries` writes anywhere in this chain** (grep of 000_baseline.sql finds zero references to the canonical poster). The `_with_ledger` suffix refers to `payment_transactions` at best — naming theater.
- Idempotency on this path is real but non-canonical: `payment_webhook_events (provider, provider_event_id)` upsert (baseline:1479–1508), order `FOR UPDATE` + already-paid short-circuit (baseline:1457–1516), payment-reference binding (`order.payment_id` must equal the server-attached provider order id — payments.ts:1085–1087, checkout-payment-routes.ts:583–589), and provider-payment replay assertion across orders (`assertProviderPaymentNotReplayed`, payment-route-support.ts:226–258).

### (b) Refund → ledger

**Canonical:** `POST /payments/:paymentId/refund` (payments.ts:462–625). Step-up (`refund.approve`, payments.ts:491–500); `provider_refund_id` required (payments.ts:476–479); cumulative cap `refunded_amount_minor + refund ≤ amount_minor` (payments.ts:480–489); posting via `buildPaymentRefundLedgerPosting` — `merchant_payable` debit / `refund_clearing` credit (packages/payments:504–531); ledger idempotency key `payment.refund:{paymentId}:{idempotency_key}` (payments.ts:523); links `refund_ledger_transaction_id` (payments.ts:543).

**Non-canonical:** `POST /orders/:id/refund` + `/refund/complete` (orders.ts:1294–1374) → `create_order_return_and_refund` / **`complete_order_refund`** (baseline:1039–1208): flips `refunds`, `refund_transactions`, `payment_transactions`, `returns`, `orders` to refunded states and emits an outbox event — **no canonical ledger entry**. Webhook `refund.created` (webhook index.ts:812–834) → `record_order_payment_failure_with_ledger` — same gap. Both states (HEAD and worktree) carry this; `orders.ts` is unmodified.

### (c) COD remittance → ledger

**Worktree (D5):** `POST /cod/reconciliation/:id/reconcile` (cod-reconciliation.ts:355–380) → RPC **`reconcile_cod_remittance_with_ledger`** (165:267–461):
- Required idempotency key; replay returns the existing row (165:291–305); `FOR UPDATE` entry lock (165:307–313); status `short/over/reconciled` from deposited vs expected (165:327–331).
- Atomic in one SQL transaction: entry update (bigint side-columns) → canonical posting `cod_receivable` debit / `merchant_payable` credit with key `cod-remittance:{entryId}:{idempotencyKey}` (165:353–396) → `canonical_ledger_transaction_id` link (165:398–404) → compatibility `wallet_ledger_entries` row flagged `compatibility_only: true` with `ON CONFLICT (site_id, idempotency_key) DO UPDATE` (165:406–456).

**HEAD:** route computed status in TS, updated `cod_reconciliation_entries`, then separately inserted a wallet credit (`insertWalletCreditIfMissing`) — two non-atomic writes, **no canonical ledger** (git diff cod-reconciliation.ts: removed lines 277–399). Collection step (`POST /cod/reconciliation`) still updates the entry row directly in both states (cod-reconciliation.ts:332–351) — money-adjacent but pre-remittance, no ledger expected.

### (d) PA settlement ingest → ledger

- Entry: `POST /settlements/ingest` (settlements.ts:185–363), **merchant-owned tenant context** (`resolveTenantContextForOwnedSite`, settlements.ts:195) — amounts are **caller-declared** (gross/fee/gst/net/reserve in body). Live mode requires configured Route credentials, else 503 `HUMAN-REQUIRED HR-PA-SPLIT-LIVE` (settlements.ts:53–66); `mock`/`sandbox` ingest is unrestricted.
- Plan: `planSettlementLedgerPosting` (billing-core:554–637) — debit `pa_clearing` (or `cod_receivable` for `cod_remittance` rail) gross; credit `merchant_payable` net + `platform_revenue` + `gst_payable` + `reserve`; computes `recon_break_minor = gross − (net+fee+gst+reserve)`.
- Balanced & break-free → canonical post with key `settlement:{idempotency_key}` (settlements.ts:238–252) and `settlements.ledger_transaction_id` link. **Break ≠ 0 → posting skipped**, `recon_breaks` row opened (`break_type='amount_mismatch'`, suspense `reserve`, settlements.ts:265–280) — *no auto-plug*.
- Side-effect: pa_split net > 0 schedules an **instruction-only** `payouts` row (`requires_step_up: true`, metadata `no_custody/instruction_only`, settlements.ts:283–304) + `payout_items` with `ledger_preview` (settlements.ts:310–322). Nothing executes these scheduled payouts in the repo (census §5.4).
- Identical at HEAD and worktree (file unmodified); the RPC it calls differs (151 vs 165 writer semantics).

### (e) Payout release → ledger

- Statement creation: `POST /payouts` (payouts.ts:369–487). Gross = Σ `orders.total` of `payment_status='paid'` orders not present in any prior statement's `metadata.source_order_ids` (payouts.ts:384–387, 292–311 — JSON-metadata dedup, fragile). Fee = active `commission_schedules` bps (default now 0) + 18% GST on fee (payouts.ts:399–402). Writes `payout_statements` + a **pending** `wallet_ledger_entries` credit (payouts.ts:441–458, compat-only, not canonical) + a canonical **fee-assessment** posting when fee > 0: `merchant_payable` debit / `platform_revenue` + `gst_payable` credits, key `payout-fee-assessment:{statementId}` (payouts.ts:213–246, 460–484).
- Release: `POST /payouts/:id/settle` (payouts.ts:510–648). Step-up `payout.release` (payouts.ts:533–542); provider env gate (payouts.ts:544–548); **DB claim** `claim_payout_statement_release` (160:357–421, quoted §8); provider transfer via adapter (always throws today, §8); on `released`: canonical posting `merchant_payable` debit / `pa_clearing` credit, key `payout-release:{statementId}` (`planPayoutReleaseLedgerPosting`, billing-core:639–662; payouts.ts:611–627) + `release_ledger_transaction_id` link + posted wallet debit compat row (payouts.ts:628–644).
- Non-atomicity: transfer → status update → ledger post → wallet row are four separate writes; a crash after the provider transfer leaves moved money without a ledger entry until a retry replays the idempotent keys. There is no payout-status reconciler (roadmap W-15 acknowledges this).

---

## 3. Ledger Schema Truth (migration 139 + 160 + 165)

- **Accounts:** 8 fixed codes — `pa_clearing, merchant_payable, platform_revenue, gst_payable, cod_receivable, reserve, vendor_payable, refund_clearing`; INR-only; `UNIQUE (site_id, currency, account_code)` (139:75–97).
- **Transactions:** `source_type ∈ (payment_capture, refund, settlement, cod_remittance, payout, reversal)`; `writer_module` CHECK pinned to `'settlement'` (single-writer-module by constraint, 139:113); `reversal_of` self-FK; **idempotency** `UNIQUE (site_id, source_type, source_id, idempotency_key)` (139:122).
- **Entries:** side `debit|credit`, `amount_minor bigint > 0`, `UNIQUE (transaction_id, sequence)` (139:125–142).
- **Append-only:** `reject_ledger_mutation()` raises `'ledger is append-only; use reversing entries'` on UPDATE and DELETE for both tables (139:163–170, 358–376). Worktree adds `REVOKE UPDATE, DELETE … FROM PUBLIC, anon, authenticated, service_role, app_tenant` (165:463–464). HEAD relies on triggers alone (a superuser/owner could still drop triggers; service_role grant revocation is worktree-only).
- **Balance enforcement:** `enforce_ledger_transaction_balance()` as a **deferred constraint trigger** summing debits − credits per transaction, raising on imbalance at commit (139:172–198, 378–382); `post_ledger_transaction` also pre-checks debits = credits and ≥ 2 lines (139:259–261, 336–338). `ledger_balance_breaks()` exists for global drift queries (139:344–356).
- **Posting RPC:** `post_ledger_transaction` requires GUC == `p_site_id` (139:250–253), INR only, `ON CONFLICT DO NOTHING` + return existing id for idempotent replay (139:281–292).
- **Tenant scoping:** ENABLE + FORCE RLS with `site_id = public.current_site_id()` policy on all ledger tables (139:384–406). The settlement-writer wrapper sets the GUC: from caller param at HEAD (151:23), from **source-row ownership** in the worktree (165:233–252).
- **Reconciliation tables:** `money_ledger_site_reconciliations` with `status ∈ (verified, mismatch)`, `variance_minor`, service-role-all + owner-read RLS (160:54–89).

---

## 4. Legacy / Duplicate / Dead Money Path Census

### 4.1 Money state writers that bypass the canonical ledger (live in both states)
| Path | Writes | Ledger? | Evidence |
|---|---|---|---|
| `confirm_order_payment(_with_ledger)` | `orders.payment_status/paid`, `payment_transactions` captured, `payment_attempts`, `payment_webhook_events` | **No** | baseline:1439–1709 |
| `record_order_payment_failure_with_ledger` (refund/fail webhook + internal route) | `orders`, `payment_transactions` | **No** | adapter:122–132; internal-payment-routes.ts:184–208 |
| `complete_order_refund` / `create_order_return_and_refund` | `refunds`, `refund_transactions`, `refund_attempts`, `payment_transactions`, `orders` | **No** | baseline:1039–1208; orders.ts:1294–1374 |
| Merchant subscription billing (platform revenue) | `subscriptions.amount_paid` via `SubscriptionExecutionAdapter.activateMerchantSubscription` | **No** (platform revenue never enters the ledger) | payments.ts:889–904 |
| App-marketplace billing & partner payouts | `app_billing_charges`, `partner_payout_ledger_entries` (85/15 split, `DEFAULT_APP_PLATFORM_FEE_BPS` = 1500) | **No — explicitly exempted** | billing-core:452–469; queue-execution.adapter.ts:475–540; platform-queue-consumer.ts:1350–1440 |
| Gift cards | `gift_card_ledger_entries` (own mini-ledger, `balance_after` column) | Separate system | baseline:1866, 9383–9401 |
| `payouts.ts` compat wallet rows | `wallet_ledger_entries` pending credit / posted debit straight from TS | Linked but not atomic | payouts.ts:441–458, 628–644 |

### 4.2 Canonical-ledger-only validator exemption list (the official ratchet residue)
`scripts/validators/canonical-ledger-only-validator.mjs:22–32` — `legacyAllowedUntilD5`:
```
services/api-gateway/src/execution/queue-execution.adapter.ts
services/queue-workers/src/platform-queue-consumer.ts
services/api-gateway/src/routes/app-store/billing-oauth-routes.ts
services/api-gateway/src/routes/app-store/developer-routes.ts
services/api-gateway/src/routes/app-store/developer-tooling-routes.ts
services/api-gateway/src/routes/app-store/shared.ts
services/api-gateway/src/lib/internal-developer-ops.ts
services/api-gateway/src/lib/theme-marketplace-auxiliary-routes.ts
services/api-gateway/src/routes/operations/developers.ts
```
Tables ratcheted: `payment_transactions, payments, payout_statements, payouts, refund_transactions, refunds, cod_reconciliation_entries, settlements, wallet_ledger_entries, partner_payout_ledger_entries` (validator:9–20). **Heuristic weakness:** a file passes if it merely *mentions* any canonical token (e.g. `canonical_ledger_transaction_id`) anywhere (validator:39–53) — it does not prove the mutation itself is ledgered; and SQL-side writers (`confirm_order_payment_with_ledger` etc.) are invisible to it because it scans TS sources only. The `orders` table — where storefront payment state lives — is not in the table list at all.

### 4.3 Duplicate paths (two+ ways to do the same money operation)
- **`merchant_payable` credit:** (1) capture posting (payments.ts:289), (2) commission reconcile settlement posting per paid order (commission.ts:321–342 — gross credit when bps = 0), (3) merchant-declared settlement ingest (settlements.ts:238). Idempotency keys are per-source (`payment_capture/{provider_payment_id}` vs `settlement/{entry.id}` vs `settlement:{key}`) so the same economic rupee can legally enter twice. No cross-writer dedup exists.
- **Refunds:** V1 ledgered path vs orders-RPC path vs webhook path (§2b).
- **Payout scheduling:** `payout_statements` (merchant mobile flow, payouts.ts) **and** `payouts` instruction rows from settlement ingest (settlements.ts:283–304) — two parallel payout object models; only `payout_statements` has the release claim/guard.
- **Payment confirmation:** merchant `POST /payments/razorpay/verify` (payments.ts:1014) vs storefront `POST /storefront/:subdomain/payments/razorpay/verify` (checkout-payment-routes.ts:540) vs webhook confirm — all converge on the no-ledger RPC.
- **Order creation:** `create_checkout_order` (baseline:1716) is the declared single authority; D6/166 rebinds its inventory path (166:8–66) — checkout handoff now binds a cart-content digest into the HMAC (checkout.ts diff, worktree).

### 4.4 Dead / unreachable money code
- **Payout provider transfer:** no `PayoutProviderClient` implementation exists or is wired; `initiateTransfer` throws `PayoutProviderUnavailable` whenever `options.provider` is absent (adapter:103–105) — true at HEAD and worktree. Release beyond the DB claim is unreachable; with `RAZORPAY_ROUTE_PROVIDER_ENABLED !== 'true'` it 503s even earlier (payouts.ts:123–131, 544–548). The old "fabricated UTR sandbox" behavior is already gone at HEAD.
- **Settlement-scheduled `payouts` rows:** written with `status='scheduled'` and never consumed by any executor (no code transitions them; grep shows only inserts/reads).
- **Reconciliation refreshers:** `refresh_money_ledger_site_reconciliation`, `assert_…`, `backfill_wallet_ledger_to_canonical` (160:198–355) — **no runtime caller** in `services/`/`packages/`/`apps/` (only `tests/executable/foundation-wave1-money-postgres.test.mjs:186` and migration-internal use). `backfill_wallet_ledger_to_canonical` remains a callable SECURITY DEFINER cross-tenant mass-writer (160:279–355) — not route-exposed (verified by grep), but callable by anyone with RPC access.
- **Legacy Firebase money services:** at HEAD: `legacy/firebase/functions/src/{commissionService,settlementService,walletService}.ts`; worktree relocates them to `docs/archive/firebase-legacy/functions/src/` (archived, not deleted). Not in any active runtime/topology in either state.
- **`mode: 'mock'` defaults:** `settlements.provider_mode` default was `'mock'` (151:53); 160 flips payments/credentials/settlements/payouts defaults to `'sandbox'` (160:13–23) — HEAD has this.

### 4.5 Mutable-balance-as-truth (historical finding)
- **No mutable balance column writers remain in services** (grep for `wallet_balance|available_balance|balance` update patterns: zero hits in `services/`).
- The merchant wallet **read** path now derives truth from the canonical ledger: `wallet.ts:160–185` overrides `available_minor` with the summed canonical `merchant_payable` balance and **fails closed with 409** unless `money_ledger_site_reconciliations` is `verified` with `variance_minor = 0` (wallet.ts:163–176). `wallet_ledger_entries` remains as a compatibility projection (status-summed in `summarize`, wallet.ts:79–102) — still directly inserted by `payouts.ts` and the COD RPC.
- Validator backstop: `mutableBalanceReadPattern` forbids selecting `*balance_minor` columns without derived-ledger evidence (canonical-ledger-only-validator:42, 55–59).

---

## 5. Reconciliation Coverage

- **What is reconciled:** per-site wallet-vs-ledger variance — `refresh_money_ledger_site_reconciliation` sums posted `wallet_ledger_entries` and compares to `ledger_account_balance_minor(site,'merchant_payable')`, upserting `verified|mismatch` + `variance_minor` (160:206–258). `assert_…` raises on non-zero variance (160:260–277). Settlement-level: `recon_break_minor` computed at ingest; breaks open `recon_breaks` rows and **skip ledger posting** (settlements.ts:237, 265–280). Ledger-internal: `ledger_balance_breaks()` (139:344) + per-transaction deferred balance trigger.
- **What is NOT reconciled:** orders/`payment_transactions` vs canonical ledger (the storefront money path has no reconciliation at all); provider statements vs ledger (no provider-feed ingestion exists — settlement ingest is self-declared); payout provider status vs `payout_statements` (no poller/callback reconciler); app-marketplace partner ledger; gift cards; platform subscription revenue.
- **Auto-plug residue:** **None found in the current chain.** The reconciliation row records variance without correcting it (160:227–254); breaks are recorded, not plugged (settlements.ts:265–280 — explanation literal: *"Canonical settlement ledger posting skipped until the provider mismatch is reconciled."*). The June-09 "reconciliation auto-plug" finding does not reproduce at HEAD or worktree.
- **Wiring gap:** nothing schedules the refresh — wallet reads stay 409 until manual ops (§4.4). The variance-evidence requirement is formalized as **SKIP-D5-LIVE-MONEY-RECONCILIATION** (SKIPPED_HUMAN_DECISIONS.md:14): live capture→refund→COD→settlement→payout smoke + `refresh_money_ledger_site_reconciliation` zero-variance evidence is explicitly deferred to a human operator. Honest seam, correctly fail-closed.

---

## 6. Commission / Rake Truth

| Surface | `main` | HEAD (`stepup/main`) | Worktree |
|---|---|---|---|
| `commission_schedules.commission_bps` DB default | 300 (119:81) | 300 (119:81; no 162) | **0** (162:3–4, untracked) |
| `commission_reconciliation_entries.commission_bps` DB default | 300 (119:108) | 300 | **0** (162:6–7) + row backfill to 0 and `net_payable=gross` (162:14–22) |
| `payouts.ts` fallback when no schedule | `?? 300` (git show main) | `?? 300` (git show HEAD:…payouts.ts) | `?? 0` (payouts.ts:345) |
| `commission.ts` ensureSchedule default | n/a/300 | `commission_bps: 300` (git diff) | `commission_bps: 0` (commission.ts:202) |
| GST on fee | 1800 bps on fee in all states (payouts.ts:401; commission.ts:203) — zero effect when fee = 0 | | |
| `gmv_percentage` (billing tiers) | — | **0** in all 6 tiers (git show HEAD:billing-core grep) | 0 (billing-core:678 etc.) |
| App-marketplace platform fee | 15% (`DEFAULT_APP_PLATFORM_FEE_BPS = 10_000 − 8500`, billing-core:458–459) — unchanged, intentional, out of commission-zero scope | | |
| Enforcement | none | none | `commission-bps-zero-validator.mjs` (forbids `?? 300`, `commission_bps: 300`, `DEFAULT 300 NOT NULL`, `gmv_percentage = [1-9]`, "% transaction fee"; requires 162 + rollback) — **untracked** |

**Net:** the "commission set to zero" claim (PHASE-A-HARD-044) is **true only in the working tree**. Every committed state of the repository — `main` and `stepup/main` — still defaults to a 3% rake.

---

## 7. Payout Safety

**Double-release guard (real, at HEAD via migration 160 — absent on `main`):**
```sql
-- 160:357 claim_payout_statement_release(p_site_id, p_statement_id, p_idempotency_key, p_actor_id)
SELECT * INTO v_statement FROM payout_statements WHERE id=… AND site_id=… AND deleted_at IS NULL FOR UPDATE;
IF v_existing_key = p_idempotency_key THEN RETURN v_statement; END IF;      -- replay
IF v_statement.status = 'released' THEN RETURN v_statement; END IF;          -- already done
IF v_statement.status <> 'pending' THEN RAISE EXCEPTION '… not pending …';   -- single transition
v_balance_minor := public.ledger_account_balance_minor(p_site_id, 'merchant_payable');
IF v_balance_minor < v_statement.net_amount_minor_bigint THEN RAISE EXCEPTION 'insufficient merchant payable balance …';
UPDATE … SET status='processing', release_idempotency_key=…, release_claimed_by=… ;
```
(160:373–419.) The balance check makes un-ledgered captures **unpayable** — a fail-safe interlock: orders paid via the no-ledger storefront path contribute to statement gross but not to `merchant_payable`, so release raises. Step-up token required (`payout.release`, payouts.ts:533–542). Caveat: idempotency-key comparison short-circuits **before** the released/pending checks, so a replayed key returns whatever state exists — correct replay semantics.

**Self-custody residue census:** §1.8 / §6 table. No hardcoded `razorpayx` default remains in worktree (validator `no-self-custody-rail-validator.mjs:10–11` forbids `return 'razorpayx'`, `rail|provider: 'razorpayx'`, `default('razorpayx')`, `?? 'razorpayx'`); HEAD fails that rule in 2 files (payouts.ts:120, adapter:73 — confirmed by git show). Enum/CHECK-level legality persists everywhere including `payouts.rail` CHECK (`razorpay_route|cashfree_easy_split|manual`, 151:141 — razorpayx already excluded there) and `partner_payout_ledger_entries.rail` (`…'razorpayx'…`, baseline:10252).

**Provider-mode badging:** `payments/payment_credentials/settlements/payouts` mode defaults `'sandbox'` (160:13–23); `paymentProviderMode` resolves env-aware mode (payment-route-support.ts:76–87); payout summaries now carry `provider_mode` (payouts.ts:248–270, worktree diff); storefront payment config derives `mock|sandbox|live` from credential presence + `test_mode` (store-payment-config.ts diff, `paymentConfigProviderMode`); `provider-mode-badge-validator.mjs:10–35` requires `provider_mode` tokens across 15 API/UI/mobile surfaces plus `ProviderModeBadge` components, and forbids `success: true` adjacent to `provider_mode: 'mock'` (validator:47–55). All worktree-only.

---

## 8. Webhook Truth

| Provider | Signature | Replay/idempotency | Money effect |
|---|---|---|---|
| Razorpay (`POST /razorpay`, webhook index.ts:677) | Dual: raw timing-safe HMAC-SHA256 of body (index.ts:222–230, 680–684) **and** adapter `webhookVerify` (685–691); reject unless both pass (693–696) | `payment_webhook_events` upsert on `UNIQUE (provider, provider_event_id)` (baseline:14680; writeWebhookEvent index.ts:65–86) → `duplicate: true` short-circuit (733–735); old-but-valid events processed (age logged, not rejected, 712–719) | `markOrderPaid` → internal confirm → **no canonical ledger** (§2a); unmatched capture with `store_id+plan_slug` notes → subscription activation; else marked `ignored` (779–781) |
| Stripe (`/stripe`, index.ts:868) | Adapter verify of `stripe-signature` `t=…,v1=…` incl. timestamp tolerance (`STRIPE_WEBHOOK_TIMESTAMP_OUTSIDE_TOLERANCE`, 878–886) | same upsert dedupe (906–916) | same no-ledger confirm chain |
| PayPal (`/paypal`, index.ts:1067) | Adapter verify w/ PAYPAL_WEBHOOK_ID (creds required or handler throws, 238–249) | same | same |
| Cashfree (`/cashfree`, index.ts:1205) | `x-webhook-signature = base64(HMAC(ts+body))` via adapter (1203–1212) | same | same |

- Outbound (partner) webhooks: claim/complete/fail RPC loop with exponential backoff capped at 1h (`claim_webhook_deliveries`, index.ts:596–646, 202–205); HMAC-signed dispatch (`dispatchLetBuyyWebhook`); internal endpoints gated by `INTERNAL_API_SECRET`/`AUTH_SECRET` bearer (index.ts:542–551, 562–570) — note the **shared AUTH_SECRET fallback** is still an accepted credential here.
- Storefront verify gap: `razorpay-adapter.verify()` checks **signature only** — it accepts an `amount` input but never calls `fetchRazorpayPayment` to confirm capture status/amount (razorpay-adapter:323–358, fetch helper exists at :117–130 with a warning comment). Mitigated by server-side order binding (`order.payment_id === razorpay_order_id`, set only by server-created provider orders for the order's amount), but an authorized-not-captured payment can mark an order paid. The **subscription** verify path does it right: provider fetch + `status==='captured'` + `amount ≥ plan price` + order binding (payments.ts:862–887).

---

## 9. HEAD vs Working Tree vs `main` Divergence Table

| Finding | `main` (4bcae19a) | HEAD `stepup/main` (c4fc3cd6) | Working tree |
|---|---|---|---|
| Canonical ledger kernel (139/151) | present | present | present |
| Ledger authority: release claim, reconciliation tables, capture/refund ledger columns (160) | **absent** (migrations end at 158) | present | present |
| Capture/refund canonical postings in `payments.ts` | **absent** (`capture_ledger_transaction_id` count = 0 in `git show main:…payments.ts`) | present | present (file unmodified) |
| COD remittance atomic ledger RPC (165) | absent | **absent** (old wallet-credit path; 165 untracked) | **present** |
| Settlement writer GUC from source-row ownership | absent | **defect present** (151: GUC from `p_site_id`) | **fixed** (165:233–252) |
| Ledger UPDATE/DELETE grant revocation | trigger-only | trigger-only | + REVOKE incl. service_role (165:463–464) |
| Commission default | 300 bps | 300 bps (DB 119 + code fallbacks) | **0 bps** (162 + code) |
| Payout default rail | razorpayx | razorpayx | **razorpay_route** |
| Provider-mode badging surfaces/validator | absent | absent | present (untracked validator) |
| Money validators (canonical-ledger-only, commission-zero, no-self-custody, provider-mode) | absent | **absent (untracked)** | present, all passing |
| Storefront/webhook/orders-refund money paths un-ledgered | defect | defect | **defect (unchanged)** |
| Reconciliation refreshers wiring-dead | n/a (don't exist) | defect | defect |
| Legacy Firebase money services | `legacy/firebase/...` | `legacy/firebase/...` | moved to `docs/archive/firebase-legacy/` |
| Checkout handoff cart-digest binding (D6) | absent | absent | present (checkout.ts diff) |
| Legacy JSON-items stock mutation inside payment confirm | present | present | **removed** (payment-execution.adapter diff) |

**Deployment risk:** worktree route code (e.g. `reconcile_cod_remittance_with_ledger` caller) **hard-depends on untracked migration 165**; deploying code without the migration breaks COD reconcile outright (fail-closed, but an outage). Nothing in the committed history contains the Phase A–D money end-state.

---

## 10. Validator Runs (read-only, executed 2026-06-10 against the working tree)

```
node scripts/validators/canonical-ledger-only-validator.mjs
→ Canonical ledger only validator passed (canonical money mutation ratchet checked). EXIT 0
node scripts/validators/commission-bps-zero-validator.mjs
→ Commission bps zero validator passed (commission_bps remains zero in active defaults). EXIT 0
node scripts/validators/no-self-custody-rail-validator.mjs
→ No self-custody rail validator passed (self-custody payout rail defaults checked). EXIT 0
node scripts/validators/provider-mode-badge-validator.mjs
→ Provider mode badge validator passed (provider-mode honesty surfaces checked). EXIT 0
```
All four validators are **untracked files** — they exist only in the working tree; a fresh clone of HEAD has no money gates. Their pass-state is meaningful but bounded by the heuristics documented in §4.2.

**Test reality:** `money-d5-ledger.test.ts`, `money.test.ts`, `settlements.test.ts` are predominantly **source-text regex assertions** on migrations/validators/routes (e.g. money-d5-ledger.test.ts:111–150 regex-matches 165's SQL); builder math (balanced postings) is genuinely executed (money-d5-ledger.test.ts:34–109). The only DB-executing money tests run migrations **139/160** in dockerized Postgres (`tests/executable/money-ledger-postgres.test.mjs`, `foundation-wave1-money-postgres.test.mjs:186`); **no executed test covers 165's RPCs** (grep: zero hits) — D5's SQL has never run in CI.

---

## 11. Unknowns / UNVERIFIED

- **Live database state** — which migrations are actually applied to the production Supabase instance is unknowable from the repo; given `main` ends at 158, the live DB plausibly lacks even the 160 payout guard. UNVERIFIED.
- **Live provider behavior** — Razorpay Route/Cashfree split rails, webhook secrets, and any real settlement feeds are explicitly deferred (SKIP-D5-LIVE-MONEY-RECONCILIATION, SKIPPED_HUMAN_DECISIONS.md:14). UNVERIFIED by design.
- Whether any deployed worker serves `stepup/main` HEAD vs `main` (deploy topology out of this axis's scope).
- `attach_order_payment_reference_with_ledger` / `record_order_payment_failure_with_ledger` SQL bodies were verified to exist in baseline with no canonical-ledger references via repo-wide grep, but only `confirm_order_payment*` and `complete_order_refund` were read line-by-line.
- Runtime callability of `backfill_wallet_ledger_to_canonical` by `service_role`/`authenticated` (GRANT state of the function itself) — not declared in migrations; default PostgreSQL `EXECUTE` to PUBLIC on functions would make it broadly callable. UNVERIFIED against live grants.
- `money_screen.dart` / mobile money UI behavior against the 409 fail-closed wallet endpoint (UX of permanent reconciliation-required state) — out of scope.

---

## Appendix: Key RPC / function inventory

| Function | Defined | Ledger writes | Caller(s) |
|---|---|---|---|
| `post_ledger_transaction` | 139:223 | YES (core) | `post_settlement_ledger_transaction` only |
| `post_settlement_ledger_transaction` | 151:6 (HEAD) / 165:214 (worktree) | YES | payment-route-support.ts:185; payouts.ts:189; commission.ts:148; settlements.ts:121; 160 backfill; 165 COD RPC |
| `reconcile_cod_remittance_with_ledger` | 165:267 (worktree only) | YES | cod-reconciliation.ts:290 |
| `claim_payout_statement_release` | 160:357 | no (guard) | payouts.ts:560 |
| `refresh/assert_money_ledger_site_reconciliation` | 160:198/260 | no (recon) | **none in runtime** |
| `backfill_wallet_ledger_to_canonical` | 160:279 | YES (mass) | **none in runtime**; test only |
| `confirm_order_payment(_with_ledger)` | baseline:1439/1590 | **NO** | PaymentExecutionAdapter.confirmPayment (all storefront/webhook confirms) |
| `record_order_payment_failure_with_ledger` | baseline (grep) | **NO** | adapter:122; webhook failure/refund paths |
| `complete_order_refund` | baseline:1039 | **NO** | order-execution.adapter.ts:494 (orders.ts:1295) |
| `create_checkout_order` → `create_order_with_inventory_reservations` | baseline:1716 / 166:8 | no (order+inventory) | checkout routes |
