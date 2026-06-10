# PHASE 4 — PAYMENTS FORENSIC AUDIT

**Repo:** `Letbuyy_Store` | **Audit date:** 2026-06-10
**Auditor:** Stripe-grade payment-systems forensic audit (money-in Razorpay/UPI/COD; money-out PA-split), code-only working-tree analysis
**Scope:** `services/api-gateway/src/{routes,lib,execution}` (payments, checkout, settlements, payouts, refunds, COD, commission, wallet), `services/webhook-service/src`, `packages/{payments,billing-core,infrastructure/*}`, money RPCs in `database/supabase/migrations`.
**Baseline constitution:** `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` §3 money kernel, §8 payments, Risk R2 (ban silent success), Rejected R-6 (no self-custody).
**Companion audits read:** `FORENSIC_MASTER_2026_06_10/DATABASE_FORENSIC_AUDIT.md` (Phase 7), with Phase 2 (outbox / scoped-compensation) findings re-verified.

### Methodology

1. **End-to-end code trace.** Every money-bearing route handler and its downstream RPC/adapter was read in full and quoted: payment session create/capture/void/refund (`payments.ts`), hosted-checkout confirm (`checkout.ts`), public storefront verify/capture (`checkout-payment-routes.ts`), webhook ingest (`webhook-service/src/index.ts`), settlement ingest (`settlements.ts`), payout statement create/settle (`payouts.ts`), COD reconciliation (`cod-reconciliation.ts`), commission reconcile (`commission.ts`), wallet read (`wallet.ts`), and the canonical ledger RPCs (`139_…`, `151_…`, `160_…`) plus the legacy capture/refund RPCs (`000_baseline.sql`).
2. **Money-bug hunt against the 10 mandated questions** (disappear / duplicate / refund-double-fire / payout-double-pay / webhook-replay / settlement-drift / ledger-drift / forgery-auth / provider-honesty / self-custody-R-6).
3. **Concrete exploit walkthroughs**: request → code path → ledger/DB effect → ₹ impact.
4. **Prior-finding re-verification** (Phase 7 DB audit + Phase 2 + prior forensics hypothesis list) marked FIXED / OPEN with code evidence.
5. Every claim cites `file:line` with quoted code. Claims provable only against live runtime state are marked **UNVERIFIED**.

> **One-paragraph thesis.** LetBuyy has two payment systems welded together. A **modern V1 kernel** (`packages/payments` builders + `post_settlement_ledger_transaction` + `claim_payout_statement_release`) is genuinely Stripe-grade: bigint paise, balanced double-entry, idempotent posting, FOR-UPDATE payout gating, recon-break-without-auto-plug. But the **live money-in path that real buyers actually hit** — Razorpay/Stripe/PayPal/Cashfree verify and webhook → `confirm_order_payment_with_ledger` (`000_baseline.sql:1590`) — **captures money and never writes the canonical ledger**, despite the `_with_ledger` name. The **returns refund path** (`complete_order_refund`, `000_baseline.sql:1039`) and the **COD remittance path** (`cod-reconciliation.ts`) are likewise unledgered. So the canonical ledger is fed by the *new* admin/settlement APIs but starved by the *legacy* capture/refund/COD paths that carry the actual transaction volume — guaranteeing ledger drift. Layered on top: a **forgeable step-up** that "protects" payouts and refunds with a string-length check, a **self-custody payout rail** (`razorpayx`) that violates R-6 while the ledger metadata stamps `no_custody: true`, a **cross-store ledger-posting primitive** (`post_settlement_ledger_transaction` sets the tenant GUC from its own parameter), and a **scoped-compensation table that is written but never executed** (captured-but-order-failed buyers never get auto-refunded).

---

## 1. Executive Verdict — the 10 questions

| # | Question | Verdict | Severity | One-line proof |
|---|---|---|---|---|
| 1 | Can money **DISAPPEAR**? | **YES** | **S1** | Legacy capture (`confirm_order_payment_with_ledger`, baseline:1590) marks `payment_transactions='captured'` but writes **no `ledger_entries`**; COD remittance (`cod-reconciliation.ts:305`) and returns-refund (baseline:1039) likewise never post canonical — captured money leaves the canonical ledger. |
| 2 | Can money **DUPLICATE**? | **YES (latent)** | **S2** | Two independent commission-fee postings hit `merchant_payable`: `commission.ts:337` (per-order) and `payouts.ts:466` (per-statement) — both can post for the same orders with no cross-guard, double-debiting merchant payable. |
| 3 | Can **refunds DOUBLE-FIRE**? | **NO (per-path)** / drift | **S2** | New refund API caps cumulative ≤ captured (`payments.ts:486`) and is idempotency-gated; legacy `complete_order_refund` early-returns on `status='succeeded'` (baseline:1065). But the two refund paths are unaware of each other and the legacy one is unledgered. |
| 4 | Can **payouts DOUBLE-PAY**? | **NO (gated)** | **S2** | `claim_payout_statement_release` row-locks (`FOR UPDATE` 160:379), replays on key (160:386), gates on ledger balance (160:399); but the provider transfer (`payouts.ts:580`) runs **after** the status flips to `processing` with no post-transfer reconciliation, so a transfer that succeeds at the PSP but errors locally is invisible. |
| 5 | Can **webhooks REPLAY**? | **NO (deduped)** | **S2** | `payment_webhook_events (provider, provider_event_id)` UNIQUE upsert returns empty on conflict ⇒ `duplicate:true` skip (`index.ts:75-85,733`). Signature = HMAC-SHA256 timing-safe (`razorpay-adapter:435`). But age is **not** enforced (`index.ts:714-719`, "do not reject by age") and a crash after the dedup row is written strands the event. |
| 6 | Can **settlement DRIFT**? | **YES** | **S1** | COD remittance posts only the compat `wallet_ledger_entries` (`cod-reconciliation.ts:305`), never canonical `cod_receivable`/`cod_remittance`; PA-settlement ingest is correct but is a *separate* feed from the capture path that never ledgered — so canonical `pa_clearing` is fed by settlement yet never debited by capture. |
| 7 | Can the **LEDGER DRIFT**? | **YES** | **S1** | Append-only is enforced on `ledger_entries`/`_transactions` (139:358-376) and balance is checked (139:336), but `post_settlement_ledger_transaction` **sets `app.site_id` from its own parameter** (151:23), defeating the inner tenant-GUC check (139:251) → any authorized caller can post into any store's ledger. |
| 8 | **Forgery & auth** on money endpoints? | **PARTIAL — step-up forgeable** | **S1** | `verifySensitiveActionStepUp` (security-controls.ts:27) accepts ANY string ≥12 chars + a fresh timestamp as a valid step-up for `refund.approve`/`payout.release` — no HMAC, no DB challenge lookup. Signature binding on capture is correct (payments.ts:1068,1085). |
| 9 | **Provider-mode honesty**? | **PARTIAL** | **S2** | Mock is correctly banned in prod runtime (`packages/payments:280`). But hosted-checkout stamps `capture_posted_to_ledger: true` (checkout.ts:647) when the RPC it calls posts **no** ledger entry — a false honesty attestation; and a mock-mode V1 session can be `captured` into a real ledger entry if any `provider_payment_id` string is supplied (payments.ts:271). |
| 10 | **Self-custody (R-6)**? | **VIOLATED** | **S1** | `payoutRail()` hardcodes `'razorpayx'` (payouts.ts:119-121); RazorpayX disburses from LetBuyy's **own** balance, not a Route split-instruction — direct R-6 breach — while settlement/payout metadata claims `no_custody: true` / `instruction_only: true` (settlements.ts:249,298). |

**Composite payments verdict: 2.3/5.** The kernel primitives are excellent; the *wiring of the real money paths into the kernel* is incomplete, the second factor on payouts/refunds is decorative, and the payout rail and ledger honesty stamps contradict the constitution. None of the S1s is continuously bleeding cash today only because the live rails are gated `[HUMAN-REQUIRED]` (mock/sandbox) — every one becomes an active loss the day live PSP keys are connected.

---

## 2. End-to-End Money-Flow Trace (annotated)

There are **two parallel money-in flows** and they post to the ledger differently. This split is the root of most findings.

### Flow A — "V1 session" path (merchant-admin, `/payments/*`) — LEDGERED ✅

```
POST /payments/sessions            payments.ts:103   → INSERT payments (status=authorized|pending|requires_action)   [no ledger yet]
POST /payments/:id/capture         payments.ts:252   → postPaymentLedger(buildPaymentCaptureLedgerPosting)           ← F6 CAPTURE LEDGER POSTED
                                                        payment-route-support.ts:179 → RPC post_settlement_ledger_transaction
                                                        → 151:6 → 139:223 post_ledger_transaction (balanced, idempotent)
                                                        → UPDATE payments SET status=captured, capture_ledger_transaction_id
POST /payments/:id/refund          payments.ts:462   → postPaymentLedger(buildPaymentRefundLedgerPosting)            ← F6 REFUND LEDGER POSTED
POST /payments/:id/void            payments.ts:387   → status=voided, NO ledger (correct — nothing captured)
```
Ledger lines for capture (`packages/payments:451`): **debit `pa_clearing` (gross) / credit `merchant_payable` (net) [+ platform_revenue + gst]**. At capture, `platformFeeMinor:0, gstMinor:0` are hardcoded (payments.ts:296-298, "fee_assessment: deferred_to_payout_statement"), so capture posts `pa_clearing → merchant_payable` 1:1 and fees are taken later at payout/settlement. Internally consistent.

### Flow B — "legacy order" path (storefront + every provider webhook) — **NOT LEDGERED** ❌

```
Buyer checkout (storefront)                 → POST /storefront/:sub/payments/razorpay/order   checkout-payment-routes.ts:415 → attachPaymentReference
Buyer pays at Razorpay                       → POST /storefront/:sub/payments/razorpay/verify  checkout-payment-routes.ts:534 → provider.verify (HMAC only)
                                                                                              → PaymentExecutionAdapter.confirmPayment  payment-execution.adapter.ts:218
                                                                                              → RPC confirm_order_payment_with_ledger   baseline:1590
Razorpay async webhook (payment.captured)    → webhook-service index.ts:741 → markOrderPaid:328 → confirmGatewayOrderPayment
                                                → internal /payments/confirm  internal-payment-routes.ts:152 → confirmPayment → same RPC baseline:1590
```
`confirm_order_payment_with_ledger` (baseline:1590) calls the inner `confirm_order_payment` (baseline:1439, sets `orders.payment_status='paid'`), then `UPDATE payment_transactions SET status='captured'` (1618) / inserts `payment_attempts` (1673). **It contains zero `INSERT INTO ledger_entries`/`ledger_transactions`** (verified: `grep "INSERT INTO ledger_" 000_baseline.sql` → **0 matches**). The name is a lie (Phase 7 DB-005). Every storefront sale and every provider-webhook capture therefore credits the buyer's money to `orders.payment_status='paid'` but **never debits `pa_clearing` or credits `merchant_payable`** in the canonical ledger.

### Money-out trace (settlement → payout) — LEDGERED, but rail violates R-6

```
POST /settlements/ingest    settlements.ts:185 → planSettlementLedgerPosting (billing-core:554)
                              if recon_break==0 && balanced → post_settlement_ledger_transaction   ← debit pa_clearing / credit merchant_payable,platform_revenue,gst,reserve
                              if break != 0 → INSERT recon_breaks (NO auto-plug)  settlements.ts:265
                              if net>0 && pa_split → INSERT payouts(status=scheduled, rail=razorpay_route, no_custody:true)  settlements.ts:283
POST /payouts (create)      payouts.ts:368  → INSERT payout_statements(pending) + wallet_ledger_entries(payout_credit,pending)
                              + canonical fee-assessment ledger  payouts.ts:466 (debit merchant_payable / credit platform_revenue,gst)
POST /payouts/:id/settle    payouts.ts:509  → step-up (FORGEABLE) → claim_payout_statement_release (160:357, gated)
                              → adapter.initiateTransfer (rail = razorpayx)  payouts.ts:549,580
                              → if released: post_settlement_ledger_transaction (debit merchant_payable / credit pa_clearing)  payouts.ts:611
                              + wallet_ledger_entries(payout_debit,posted)  payouts.ts:627
```

### COD trace — UNLEDGERED (canonical)

```
POST /cod-reconciliation             cod-reconciliation.ts:335 → UPDATE cod_reconciliation_entries SET status=collected (no money post)
POST /cod-reconciliation/:id/reconcile  cod-reconciliation.ts:379 → status short|over|reconciled
                                       → insertWalletCreditIfMissing → INSERT wallet_ledger_entries(cod_remittance_credit,posted)  :305
                                       → NO post_settlement_ledger_transaction; canonical cod_receivable/cod_remittance never moves
```

---

## 3. Money-Disappearance Register

| ID | Where money disappears (from the canonical ledger's view) | Evidence | Mechanism |
|---|---|---|---|
| PAY-001 | **Legacy/webhook capture is unledgered.** Buyer pays; `orders.payment_status='paid'`; `payment_transactions='captured'`; **no `pa_clearing`/`merchant_payable` entry.** | baseline:1590-1709 (no ledger insert); grep `INSERT INTO ledger_` baseline = 0 | The canonical ledger never sees money-in for storefront/webhook captures. `merchant_payable` is understated by the entire legacy GMV. |
| PAY-002 | **Returns-path refund is unledgered.** `complete_order_refund` debits the customer (provider refund) and flips order to refunded but never debits `merchant_payable`/credits `refund_clearing`. | baseline:1039-1208; called returns.ts:279, order-execution.adapter.ts:495 | Refund money leaves but the ledger shows merchant still owed it. Over time `refund_clearing` is permanently 0 while real refunds flow. |
| PAY-003 | **COD remittance is unledgered (canonical).** Only `wallet_ledger_entries` moves; `cod_receivable` is never debited on order, never relieved on remittance. | cod-reconciliation.ts:305-326; no `post_settlement_ledger_transaction` in file | COD cash-in-transit (V1 §8 "modeled explicitly") is invisible to the 8-account ledger; cash shrinkage between collection and deposit (`short`) is recorded only as `difference_amount_minor` on a compat row. |
| PAY-004 | **`recon_breaks` drops the sign of the variance** (`amount_minor>0` CHECK, code stores `Math.abs`). A short remittance (PSP paid less) and an over remittance are indistinguishable at the column. | settlements.ts:272; 151:190 (CHECK amount_minor>0) | When the break is later "resolved", the operator cannot tell from the row whether money was short or over — risk of plugging the wrong direction. |
| PAY-005 | **Capture posts no platform fee / GST**, deferring 100% to payout. If a merchant is offboarded after captures but before any payout/settlement, the platform-fee leg never posts and `platform_revenue` under-recognizes. | payments.ts:296-298 (`platformFeeMinor:0,gstMinor:0`) | Not a buyer loss but a revenue-recognition gap; fees exist only as `metadata.fee_assessment='deferred_to_payout_statement'`. |
| PAY-006 | **Mock/sandbox amount is `Math.round(order.total*100)`** everywhere; `order.total` is `numeric(12,2)` rupee-major. A `total` like `100.005` (possible via discount math) rounds to `10001` paise, a ½-paisa creation/loss vs the stored major. | payments.ts:128,938; checkout-payment-routes.ts:155 | Sub-paisa rounding at the rupee→paise boundary; bounded to <1 paisa/order but systematic. The new kernel avoids this (bigint native) — the loss is only on the legacy `orders.total`-derived paths. |
| PAY-007 | **`emitDomainEvent` silently swallows a missing-table error** and returns null. If `outbox_events` is unavailable, the `order.paid`/`payment.captured`/`settlement.recorded` event is dropped with no error to the caller. | event-execution.adapter.ts:79-85 | Downstream consumers (email, fulfillment, analytics) never fire; the money state is correct but the side-effects (e.g. payout scheduling driven by events) silently don't happen. |

---

## 4. Money-Duplication Register

| ID | Where money can duplicate | Evidence | Mechanism |
|---|---|---|---|
| PAY-008 | **Double commission/fee posting.** `commission.ts:337` posts a full settlement ledger (debit merchant_payable / credit platform_revenue+gst) for *every paid order*; `payouts.ts:466` independently posts a *fee-assessment* ledger (debit merchant_payable / credit platform_revenue+gst) for the *statement* built from the same paid orders. Nothing prevents both from running. | commission.ts:288-348; payouts.ts:386-483 | `merchant_payable` is debited twice for the same fee — merchant under-paid by the fee amount; `platform_revenue` over-credited. Each path is independently idempotent but they share no idempotency namespace. |
| PAY-009 | **Payout `wallet_ledger_entries` double-credit.** `POST /payouts` writes a `payout_credit` (pending) for the statement net (payouts.ts:440). `POST /settlements/ingest` *also* schedules a `payouts` row + `payout_items` for the settlement net (settlements.ts:283-322). If both the manual statement and the settlement-driven payout cover overlapping orders, the merchant's wallet (compat view) shows the net twice. | payouts.ts:440; settlements.ts:283 | Compat-table wallet inflation (the canonical ledger is protected by balance checks, but the *displayed* wallet and the payout queue can double-count). |
| PAY-010 | **No global idempotency on the V1 capture provider_payment_id.** `assertProviderPaymentNotReplayed` checks only the **legacy `payment_transactions`** table (payment-route-support.ts:236), not the new `payments` table. Two different `payments` sessions for the same order can each be `/capture`d with the *same* `provider_payment_id` (the unique index on `payments(provider, provider_payment_id)` would block the *second row's* id, but capture sets the id by UPDATE, and the guard isn't invoked on this path at all). | payments.ts:252-309 (no replay assert); payment-route-support.ts:226-258 | Capture path relies solely on the per-payment idempotency key + DB unique; the cross-payment "same provider id ⇒ one order" invariant is only enforced for the legacy table. **UNVERIFIED** whether the `payments` unique index alone fully closes it at capture time. |
| PAY-011 | **Settlement re-ingest is deduped by `idempotency_key` only, not by `settlement_reference`.** A provider settlement re-sent with a new idempotency key but the same `settlement_reference` is blocked by the DB unique `(site_id, provider, settlement_reference)` (151:85) — good — but the route checks only `idempotency_key` (settlements.ts:196) and lets the insert fail on the *other* unique, returning a 500 rather than an idempotent replay. | settlements.ts:196-205; 151:85 | Operational (500 instead of idempotent replay), not a duplication of money, because the DB unique holds. Listed for completeness. |

---

## 5. Refund Audit

**New refund API (`POST /payments/:id/refund`, payments.ts:462) — STRONG:**
- Requires `status='captured'` (472), a `provider_refund_id` (477).
- Caps cumulative: `cumulativeRefundMinor > payment.amount_minor` → reject (payments.ts:485-488). Partial refunds tracked via `refunded_amount_minor` (542).
- Idempotency-gated (`payment.refund:{id}` scope, 506) and posts the F6 refund ledger **debit `merchant_payable` / credit `refund_clearing`** (buildPaymentRefundLedgerPosting, packages/payments:504).
- **Step-up gate is present but FORGEABLE** (see PAY-018) — the only auth on a refund is `verifySensitiveActionStepUp(action:'refund.approve')` (payments.ts:491), which accepts any plausible string.

**Legacy returns refund (`complete_order_refund`, baseline:1039) — UNLEDGERED:**
- Idempotent (early-return on `status='succeeded'`, 1065; `FOR UPDATE` on refund row, 1059).
- Computes `v_total_succeeded` and sets order/payment to refunded|partially_refunded (1141-1166).
- **Never posts the canonical ledger** (PAY-002). So the refund money exits but `merchant_payable`/`refund_clearing` are untouched.

**Concurrency:** the legacy path `FOR UPDATE`-locks the refund (1059) and the order (1074), so concurrent `complete_order_refund` for the same refund serialize safely. The new path serializes on the idempotency key. The two paths do not coordinate: a refund created via returns and a refund via the new API for the same payment could each succeed (one ledgered, one not), and the new API would see `refunded_amount_minor` only if the returns path updated `payments` — **it updates `payment_transactions`/`refunds`, not the new `payments` table** — so the new API's cumulative cap (PAY-002 cross-table blindness) does not see legacy refunds. **Cross-path over-refund is possible** if both APIs are used on the same order.

> **PAY-012 (S2):** Returns-refund and V1-refund operate on different tables (`refunds`/`payment_transactions` vs `payments`) with no shared cumulative ledger, so the V1 cap (payments.ts:486) cannot see a prior returns refund → combined refunds can exceed captured.

---

## 6. Payout Audit (incl. self-custody / R-6)

**Release gating — STRONG (this is the fix for the prior "payout double-release" P0):**
- `claim_payout_statement_release` (160:357): `SELECT … FOR UPDATE` (379) row-locks the statement; replays if `release_idempotency_key` matches (386); early-returns if already `released` (390); requires `status='pending'` (394); **checks the canonical ledger balance** `ledger_account_balance_minor(site,'merchant_payable') >= net_amount_minor_bigint` (398-404); transitions `pending→processing` atomically (406). Wired at payouts.ts:559. This is correct, lock-safe, and ledger-gated.

**Post-claim transfer — WEAK reconciliation:**
- After the claim flips to `processing`, the actual transfer runs (payouts.ts:580). If `adapter.initiateTransfer` returns `released` → ledger posted + wallet debit. If it returns `processing`/`failed`, the statement is updated accordingly. **But there is no reconciliation of a transfer that succeeds at the PSP yet errors locally** (e.g. the `UPDATE payout_statements` at 590 fails after the money left). The statement stays `processing` with the money gone and no break row. There is no "reconcile-on-uncertainty" for payouts (V1 §8 requires it for money-in; it is absent for money-out).

> **PAY-013 (S2):** Payout has no post-transfer reconciliation / suspense. A transfer that succeeds at the provider but fails the local status write leaves the statement stuck `processing` with no break and no retry-safe recovery — money out, ledger says still owed.

**Self-custody — R-6 VIOLATED:**
- `payoutRail()` returns the hardcoded literal `'razorpayx'` (payouts.ts:119-121). RazorpayX is a **payouts/disbursement product that moves money from the platform's own RazorpayX balance** — i.e. LetBuyy custodying and disbursing — which is exactly what R-6 ("Self-custodied payout / disbursement engine… Never build in-house") and §8 ("PA-split, no custody… No self-custody, ever") forbid. The sanctioned rail is **Razorpay Route / Cashfree split**, where LetBuyy only *instructs* a split out of the buyer-merchant's own funds.
- The contradiction is self-documented: the settlement ingest stamps the payout `metadata: { no_custody: true, instruction_only: true }` (settlements.ts:298) and the settlement ledger `metadata.no_custody: true` (settlements.ts:249), while the *actual* rail config and the adapter default (`normalizeRail … || 'razorpayx'`, payout-transfer-adapter:73) are RazorpayX. The honesty badge says "no custody"; the rail says "our balance".
- Mitigant: live payouts are gated `payoutProviderConfigured` requiring `RAZORPAY_ROUTE_PROVIDER_ENABLED==='true'` + Route account id (payouts.ts:123-130), and the adapter throws `PayoutProviderUnavailable` with no provider client wired (payout-transfer-adapter:103). So **no real disbursement happens today** — but the *designed* rail is the banned one.

> **PAY-014 (S1):** Payout rail is hardcoded `razorpayx` (self-custody) in violation of R-6, while ledger/payout metadata falsely asserts `no_custody`/`instruction_only`. The correct rail (`razorpay_route` split) is even named in the scheduled payout row (settlements.ts:292) but the *execution* path uses `razorpayx`.

**Authorization — role-coarse:**
- `POST /payouts/:id/settle` gates via `resolveTenantContextForOwnedSite` (payouts.ts:526) → `verifySiteOwnership` (tenant-context.ts:183). It resolves `permissions` but **never checks** `permissions.includes('payout:release')`. Any active site member who passes ownership + the (forgeable) step-up can release a payout. Maker/checker exists in the schema (`payouts.requires_step_up`, `maker_actor_id`, settlements.ts:296-297) but the settle route does not enforce a *different* checker actor.

> **PAY-015 (S2):** Payout release is gated only by site-ownership + a forgeable step-up; no `payout:release` permission check and no maker≠checker enforcement, so a single compromised owner session can drain payouts (subject to the live-rail gate).

---

## 7. Webhook Replay Audit

**Signature verification — CORRECT.** Razorpay: `hmacSha256Hex(secret, rawBody)` compared with `timingSafeEqual` (razorpay-adapter:435-436, webhook-service index.ts:222-230). The webhook route verifies **twice** (raw timing-safe check + provider.webhookVerify) and rejects unless both pass (index.ts:680-696). Stripe/PayPal/Cashfree route through their adapters' `webhookVerify` with the same discipline (index.ts:870, 1070, 1212). Good.

**Dedupe / exactly-once — PRESENT but soft.**
- `writeWebhookEvent` upserts into `payment_webhook_events` with `onConflict: 'provider,provider_event_id'` and treats an empty returned array as a duplicate (index.ts:75-85). On duplicate the handler returns `{duplicate:true}` and **skips all side effects** (index.ts:733-735). The DB unique `(provider, provider_event_id)` (baseline:14680) guarantees one event id processes once.
- The downstream order mutation (`confirm_order_payment`) *also* dedupes on the webhook event id (baseline:1503) and is idempotent on `orders.payment_status='paid'` (baseline:1510), so even a same-id reprocess is a no-op. Defense in depth — good.

**Replay weaknesses:**
- **No timestamp window enforcement (Razorpay).** Code explicitly logs but does **not reject** old signed events (index.ts:714-719: "idempotency is enforced by payment_webhook_events, so do not reject by age"). V1 §8 mandates "timestamp-window + nonce" for replay-safe webhooks. Dedupe substitutes for the nonce, but a captured old signed body can be replayed indefinitely; only the dedup store stops it, and if the dedup row were ever purged (retention), the old event reprocesses.
- **Crash-after-dedup strands the event.** `writeWebhookEvent` inserts status `received` *before* processing (index.ts:80). If processing throws, `markWebhookEvent(...,'failed')` is attempted in the catch (index.ts:856) but the **redelivery** by the provider hits the dedup and returns `{duplicate:true}` **without** re-running the side effect — so a transiently-failed capture is never retried via webhook (index.ts:733 short-circuits before the switch). The order can be left unpaid despite money captured at the PSP.
- **`provider_event_id` fallback is weak for events lacking ids.** `razorpayProviderEventId` falls back to `${event}:${created_at}:${signature.slice(0,24)}` (index.ts:116). Two distinct events with the same type+second+sig-prefix would collide (extremely unlikely, but the fallback is non-unique by construction).

> **PAY-016 (S2):** Webhook redelivery after a processing failure is suppressed by the dedup row (status stuck `received`/`failed`), so a capture that fails its post-processing is never retried via the webhook channel — order stays unpaid while money is captured.

> **PAY-017 (S3):** No webhook timestamp-window rejection (Razorpay); replay-safety rests entirely on the dedup store, contrary to V1 §8's signature+timestamp+nonce requirement.

---

## 8. Settlement & Reconciliation-Drift Audit

**PA settlement ingest — CORRECT, no auto-plug (confirms prior "reconciliation auto-plug" is NOT present):**
- `planSettlementLedgerPosting` (billing-core:554) derives `recon_break_minor = gross − (net+fee+gst+reserve)` (564). If `0 && balanced` → posts the canonical ledger (settlements.ts:237). If `!=0` → inserts a `recon_breaks` row and **posts nothing** (settlements.ts:265-280); the alert message literally says "no reserve auto-plug was created" (billing-core:633). **No suspense auto-balancing.** This is exactly what V1 §8 wants (zero-break or explained suspense, no auto-plug).
- Reserve modeled as a `reserve` credit leg (billing-core:599).

**Drift sources:**
- **The capture feed and the settlement feed are disconnected.** Settlement debits `pa_clearing` (billing-core:565) on the assumption that capture previously credited `pa_clearing`. But Flow B captures (the live ones) **never credit `pa_clearing`** (PAY-001). So when a real PA settlement is ingested, it debits a `pa_clearing` that capture never funded → `pa_clearing` goes negative and `merchant_payable` is double-counted (settlement credits it, but capture never did, so settlement is the *only* credit — actually under-counted relative to GMV). Net: the canonical ledger cannot reconcile to provider reality because half the double-entry (capture) is missing.
- **COD never reaches canonical** (PAY-003): `cod_receivable` is never debited at COD order creation and never relieved at remittance; the `wallet_ledger_entries` compat row is the only record. The constitution's "COD cash-in-transit modeled explicitly" is unmet.
- **`money_ledger_site_reconciliations`** (read at wallet.ts:129) compares `wallet_available_minor` to `ledger_merchant_payable_minor` and flags `variance_minor`. Because the wallet compat table is fed by payout/COD writes the canonical ledger never saw, this reconciliation will **perpetually show `mismatch`**, and the wallet GET will hard-fail with `LEDGER_RECONCILIATION_REQUIRED` (wallet.ts:163-176). The honesty gate works — but it means the merchant wallet is *unviewable* the moment any unledgered path is exercised.

> **PAY-019 (S1):** The canonical ledger's `pa_clearing` is debited by settlement ingest but never credited by the live capture path (Flow B), so PA settlement reconciliation is structurally impossible — `pa_clearing` drifts negative and the merchant wallet locks on `variance != 0`.

---

## 9. Ledger Integrity Audit

**What is enforced (and it's genuinely good):**
- **Append-only by trigger.** `reject_ledger_mutation()` raises on UPDATE/DELETE of both `ledger_entries` and `ledger_transactions` (139:163-170, attached 139:358-376).
- **Balance enforced.** `post_ledger_transaction` sums debits/credits and raises if unequal (139:336); a separate deferred constraint trigger `enforce_ledger_transaction_balance()` re-checks per transaction (Phase 7 §8.1).
- **Idempotent posting.** `ON CONFLICT (site_id, source_type, source_id, idempotency_key) DO NOTHING` then returns the existing id (139:281-292) — re-posting the same logical transaction is a safe no-op.
- **Positive amounts, ≥2 lines, INR-only** (139:255-261, 300).
- **Reversing-entries-only** for corrections (`buildReversalLedgerPosting`, packages/payments:533) — no in-place edits.

**Where it drifts / can be subverted:**
- **Tenant GUC defeated by the settlement wrapper.** `post_ledger_transaction` correctly raises unless `current_site_id() = p_site_id` (139:251) — but the **only caller used by the app**, `post_settlement_ledger_transaction`, does `PERFORM set_config('app.site_id', p_site_id::text, true)` *immediately before* calling it (151:23). So the GUC is whatever the caller passed; the isolation check is unconditionally satisfied. Any code (or any actor who can reach an endpoint that calls this RPC with an attacker-chosen `p_site_id`) can post balanced entries into **any store's** ledger. (Phase 7 DB-011, here traced to the live money path.)
- **No `REVOKE`; append-only is trigger-only.** Zero `REVOKE` statements in the corpus (Phase 7 §2.1). The gateway connects as `service_role`, typically the table owner, which can `ALTER TABLE … DISABLE TRIGGER` and then mutate/delete immutable history (Phase 7 DB-009). The append-only guarantee is one statement away from being bypassable by the same role that runs every request.
- **Compat "ledgers" are mutable.** `wallet_ledger_entries`, `gift_card_ledger_entries`, `store_credit_ledger_entries`, `partner_payout_ledger_entries` have **no reject trigger**, and `wallet_ledger_entries` even carries a `BEFORE UPDATE` sync trigger (160:137) — they are append-only by convention only (Phase 7 DB-010). These are the tables the mobile money routes actually write.
- **32-bit overflow** on `wallet_ledger_entries.amount_minor integer`, `payout_statements.*_minor integer`, `commission_reconciliation_entries.*_minor integer`, `cod_reconciliation_entries.*_minor integer` — overflow at ₹2,14,74,836.47 (Phase 7 DB-002). A single payout/settlement above ~₹2.14cr silently wraps. The 160 `_bigint` shadow columns mitigate the canonical path but the API still reads the `integer` columns in several serializers (e.g. payouts.ts:147-150 `Number(row.gross_amount_minor)`).

> **PAY-020 (S1):** `post_settlement_ledger_transaction` sets the tenant GUC from its own parameter (151:23), neutralizing the inner cross-tenant guard — the entire app posts to the ledger through this function, so ledger tenant-isolation is effectively absent on the live path.

> **PAY-021 (S2):** Ledger immutability is trigger-only with zero REVOKE; the `service_role` runtime can disable the triggers. Defense-in-depth (`REVOKE UPDATE,DELETE … FROM service_role`, no-login owner) is absent.

---

## 10. Forgery / Auth-on-Money Audit

**Signature binding on capture — CORRECT.** Merchant-admin `/payments/razorpay/verify` (payments.ts:1014):
- Fetches the order, verifies site ownership (1049), blocks double-pay (`payment_status='paid'`, 1054).
- HMAC over `${order_id}|${payment_id}` with `timingSafeEqualHex` (1068-1074).
- **Binds the order to a server-created provider order**: rejects unless `order.payment_id === razorpay_order_id` (1085) — closes the "replay a signature from another order" hole.
- `assertProviderPaymentNotReplayed` (1089): rejects if the `provider_payment_id` already settled a *different* order (payment-route-support.ts:251). This is the payment-forgery fix and it is correctly bound to **order_id + payment_id + signature + provider-order reference** (V1 §8 satisfied for this endpoint).

**Subscription verify — self-documented hardening is real.** `/payments/subscription/verify` (payments.ts:811) HMAC-verifies, then **server-side fetches the Razorpay payment** and requires `status='captured'` AND `amount >= plan price` AND order binding (payments.ts:870-887). The inline comment correctly explains why signature-alone is insufficient. Good.

**Step-up is FORGEABLE — the worst auth finding.** `verifySensitiveActionStepUp` (security-controls.ts:27) is the *only* second factor on `refund.approve` and `payout.release`. It checks:
- `plausibleToken`: a string ≥12 chars, not starting `SKIP_NEEDS_HUMAN_`, not containing `replace-with` (security-controls.ts:20-25).
- `verifiedAt` parses and is within a 10-minute past window / 60s future skew (security-controls.ts:59).

There is **no HMAC, no signature, no DB lookup against `step_up_challenges`/`sensitive_action_approvals`, no binding to actor or action**. Any caller can send `X-Step-Up-Token: aaaaaaaaaaaa` + `X-Step-Up-Verified-At: <now ISO>` and the gate returns `ok:true`. The `step_up_challenges`/`sensitive_action_approvals` tables exist (migration 153) but are never consulted by this verifier.

> **PAY-018 (S1):** Step-up verification for refunds and payouts is a string-length + timestamp check with no cryptographic or stored-challenge validation (security-controls.ts:27-83). The "second factor" on every payout release and refund approval is trivially forgeable client-side.

**Public storefront verify — no server-side capture confirmation.** `/storefront/:sub/payments/razorpay/verify` (checkout-payment-routes.ts:534) checks order binding (583) and HMAC (`provider.verify`, razorpay-adapter:323) but does **not** call `fetchRazorpayPayment` to confirm the money was captured for the right amount (unlike the subscription path). It also does **not** call `assertProviderPaymentNotReplayed`. The HMAC proves Razorpay signed `(order|payment)` but not capture/amount. Because the merchant owns the Razorpay account this is lower-risk, but it diverges from the subscription path's own stated standard.

> **PAY-022 (S2):** Public storefront payment verify trusts the HMAC signature without a server-side capture/amount confirmation and without the cross-order replay assertion that the merchant-admin path uses — weaker than the subscription verify in the same codebase.

**Amount re-derivation — CORRECT.** All payment-intent and verify paths re-derive the amount server-side from `order.total` (`Math.round(order.total*100)`) and reject a client-supplied `amount`/`amount_minor_units` that disagrees (`amountMismatchBody`, payments.ts:939-942; checkout-payment-routes.ts:450). A buyer cannot dictate the charge amount.

**Cross-tenant trigger surface.** Settlement/payout/COD/commission routes all gate on `resolveTenantContextForOwnedSite` → `verifySiteOwnership` (tenant-context.ts:183). Ownership is enforced; **specific money permissions are not** (PAY-015). Internal webhook→gateway endpoints require `X-Internal-API-Secret` (internal-secret.ts:15, internal-payment-routes.ts:108) compared timing-safely — adequate **provided** the secret is not the shared `AUTH_SECRET` (the webhook service falls back to `AUTH_SECRET` for the internal dispatch secret, index.ts:543; per memory, shared `AUTH_SECRET` is an identity+money forgery surface).

> **PAY-023 (S2):** The internal payment-mutation secret falls back to `AUTH_SECRET` (webhook index.ts:543), the same secret used for session/identity signing — a single secret compromise forges both auth and internal money-state mutations (`/payments/confirm`, `/payments/failure`).

---

## 11. Provider-Mode Honesty Audit

**What's honest:**
- Mock is banned in production runtime: `resolvePaymentProviderMode` throws if `mock && productionRuntime` (packages/payments:280). `isProductionRuntime` keys off ENVIRONMENT/VERCEL_ENV/mode (packages/payments:258).
- Live PSP requires merchant credentials or returns `PAYMENT_SETUP_REQUIRED` 503 (payment-route-support.ts:122-138, payments.ts:122-124).
- Settlement live ingest is `[HUMAN-REQUIRED]`-gated (settlements.ts:53-66); payout live is gated (payouts.ts:123-131, 543).
- Mock session metadata stamps `external_rail: 'mock'` (packages/payments:332), so a mock session is labeled.

**Where honesty breaks (V1 R2: "ban silent success"):**
- **False ledger attestation.** Hosted checkout writes `metadata.capture_posted_to_ledger: true` for non-COD providers (checkout.ts:647) — but the capture it performs (`confirmPayment` → `confirm_order_payment_with_ledger`) posts **no** ledger entry (PAY-001). The system asserts ledger coverage that does not exist.
- **Mock capture mints a real ledger entry.** `/payments/:id/capture` requires only *some* `provider_payment_id` string (payments.ts:271-273); for a `mode='mock'` session it will call `postPaymentLedger` and write a real, balanced `pa_clearing→merchant_payable` transaction (payments.ts:289). A mock authorization (`buildMockPaymentSessionPlan` returns `status:'authorized'` for mock, packages/payments:321) thus produces canonical money the merchant could try to settle/pay out. The mode is recorded in metadata, but the ledger entry itself is indistinguishable from a live one to the balance/payout-gate logic (`claim_payout_statement_release` does not check provider mode, 160:357).
- **`no_custody`/`instruction_only` stamps are false** given the `razorpayx` rail (PAY-014).

> **PAY-024 (S2):** Hosted checkout records `capture_posted_to_ledger:true` while calling an RPC that posts no ledger — a silent false-success/false-attestation contrary to R2.

> **PAY-025 (S2):** A mock-mode V1 payment session can be `/capture`d into a real canonical ledger transaction (any `provider_payment_id` string suffices); the payout gate does not distinguish mock-origin balances, so mock money can drive a payout.

---

## 12. Prior-Finding Re-Verification Table

| Prior hypothesis (forensics / Phase 7 / Phase 2) | Status on current tree | Evidence |
|---|---|---|
| **Payout double-release** | **FIXED** | `claim_payout_statement_release` FOR UPDATE + idempotency-replay + status gate + ledger-balance gate (160:373-419); wired payouts.ts:559. |
| **Refund-not-ledgered (returns path)** | **OPEN** | `complete_order_refund` (baseline:1039-1208) touches no `ledger_*`; new API path is ledgered (payments.ts:516) but the returns path is the live one (returns.ts:279). |
| **Capture-not-ledgered (legacy/webhook)** | **OPEN (newly confirmed, broader than refund)** | `confirm_order_payment_with_ledger` (baseline:1590) posts no ledger; every storefront/webhook capture uses it (checkout-payment-routes.ts:620, internal-payment-routes.ts:163). |
| **Reconciliation auto-plug** | **NOT PRESENT (FIXED)** | Break → `recon_breaks` row, no ledger post (settlements.ts:265-280); planner explicitly "no reserve auto-plug" (billing-core:633). |
| **Mutable-balance-as-truth** | **PARTIAL** | Payout release gates on derived ledger balance (160:398) — fixed for the dangerous rail. Gift-card balance still mutated in place (`gift_card_accounts SET balance = balance - …`, baseline:1836); store-credit/ai_credits mutable. |
| **Fabricated payouts** | **REFRAMED — not fabrication; self-custody rail + unledgered feeds** | Payout amounts derive from real paid orders (payouts.ts:386) and gate on ledger balance; the real defects are the `razorpayx` rail (PAY-014) and the unledgered capture feed starving the gate (PAY-019). |
| **Payment forgery** | **FIXED on merchant-admin verify; PARTIAL on storefront** | order+payment+signature+provider-order bound + replay assert (payments.ts:1068-1094); storefront verify omits capture-confirm + replay assert (checkout-payment-routes.ts:534). |
| **Unique `provider_payment_id`** | **PRESENT** | `payments(provider, provider_payment_id)` and `payment_transactions(gateway, provider_payment_id)` partial uniques (Phase 7 §7.2; 142:144,148). |
| **Webhook replay** | **DEDUPED (no nonce/timestamp window)** | `payment_webhook_events` unique dedup (index.ts:75-85); age not enforced (index.ts:714-719). |
| **GUC-from-param cross-store posting** | **OPEN (live money path)** | `post_settlement_ledger_transaction` sets `app.site_id` from `p_site_id` (151:23), used by payments/payouts/settlements/commission. |
| **Outbox dual-write non-atomic (Phase 2)** | **OPEN** | `emitDomainEvent` is a separate Supabase call from the money mutation, and swallows missing-table errors (event-execution.adapter.ts:60-85). |
| **Scoped-compensation rows written but no executor (Phase 2)** | **OPEN** | `compensation_actions` only written (checkout.ts:409); zero readers/executors in services or queue-workers (grep). |
| **32-bit integer money overflow (Phase 7)** | **OPEN** | integer-minor columns on wallet/payout/commission/cod (Phase 7 DB-002); API serializers read them. |

---

## 13. Concrete Money-Loss Attack Walkthroughs

### W-1 — Ledger blind to all live captures ⇒ payouts permanently blocked / wallet locked (S1, no attacker needed)
1. Merchant connects live Razorpay. Buyer pays ₹10,000 for an order. Storefront `/payments/razorpay/verify` (checkout-payment-routes.ts:620) → `confirm_order_payment_with_ledger` (baseline:1590).
2. Effect: `orders.payment_status='paid'`, `payment_transactions='captured'`, **`merchant_payable` ledger balance = 0** (no capture ledger entry).
3. Merchant requests a payout. `claim_payout_statement_release` reads `ledger_account_balance_minor('merchant_payable')` = 0 (160:398) → raises `insufficient merchant payable balance` → payout rejected.
4. Merchant opens wallet. `money_ledger_site_reconciliations.variance != 0` → wallet GET returns `LEDGER_RECONCILIATION_REQUIRED` 409 (wallet.ts:163-176).
5. **Impact:** every rupee captured is real, but the platform cannot pay the merchant and cannot even show their balance. Conversely, if settlement ingest is run (which debits `pa_clearing` that capture never funded), `pa_clearing` goes negative and `merchant_payable` is credited *once* (by settlement) — the only path that ever credits it — so payouts become possible but the ledger no longer ties to provider reality. Net: structural ledger drift on 100% of live volume.

### W-2 — Forge a payout release with a fake step-up (S1)
1. Attacker compromises (or is) a low-privilege but site-member session. Live Route is enabled.
2. Attacker calls `POST /payouts/:id/settle` with headers `X-Step-Up-Token: aaaaaaaaaaaa`, `X-Step-Up-Verified-At: 2026-06-10T12:00:00Z` (current).
3. `verifySensitiveActionStepUp` returns `ok:true` (security-controls.ts:27) — no challenge was ever issued or verified.
4. `claim_payout_statement_release` succeeds if the ledger balance covers it; `adapter.initiateTransfer` runs on the `razorpayx` rail (payouts.ts:580).
5. **Impact:** merchant funds released without a genuine second factor; combined with PAY-015 (no `payout:release` permission), any owner-equivalent session drains payouts. Bounded today only by the live-rail `[HUMAN-REQUIRED]` gate.

### W-3 — Cross-store ledger poisoning via GUC-from-param (S1)
1. Any code path (or any endpoint that forwards a caller-controlled `store_id` into a function that calls `post_settlement_ledger_transaction`) is invoked with `p_site_id = victim_store`.
2. `post_settlement_ledger_transaction` does `set_config('app.site_id', victim_store)` (151:23) then `post_ledger_transaction` — the `current_site_id() <> p_site_id` guard (139:251) passes because the wrapper just set it.
3. **Impact:** balanced but unauthorized entries land in the victim store's canonical ledger (e.g. fabricated `merchant_payable` credits that later authorize a payout, or `refund_clearing` noise). Tenant isolation on the ledger is absent on the live path. The settlement/commission/payout routes themselves derive `siteId` from ownership, so the *current* call sites are safe — but the RPC is a standing cross-tenant primitive and the route gate is the only thing stopping it. **UNVERIFIED** whether any reachable endpoint passes an unvalidated `store_id` to it.

### W-4 — Cross-path over-refund (S2)
1. Order paid ₹5,000 (legacy path). Operator issues a returns refund of ₹5,000 via `complete_order_refund` (returns.ts:279) → `refunds`/`payment_transactions` show refunded; **`payments` table untouched**; **no ledger**.
2. Operator (or another) issues a V1 refund via `POST /payments/:id/refund` for the same payment session. The cumulative cap reads `payment.refunded_amount_minor` from the **`payments`** table (payments.ts:480), which is still 0 (the returns path never touched it).
3. V1 refund of up to ₹5,000 is permitted again and posts a *real* `merchant_payable→refund_clearing` ledger entry + (if live) a provider refund.
4. **Impact:** up to ₹10,000 refunded against a ₹5,000 capture; one leg ledgered, one not. The two refund subsystems share no cumulative state.

### W-5 — Mock money drives a payout (S2)
1. In a non-prod-but-real environment (or any env where `mode='mock'` is allowed), create a V1 session (`buildMockPaymentSessionPlan` → `status:'authorized'`, packages/payments:321).
2. Call `POST /payments/:id/capture` with `provider_payment_id: "mock_anything"` (payments.ts:271 accepts any non-empty string). `postPaymentLedger` writes a real balanced `pa_clearing→merchant_payable` transaction (payments.ts:289).
3. Build a payout statement; `claim_payout_statement_release` sees the (mock-origin) `merchant_payable` balance and authorizes release — it never checks provider mode (160:357).
4. **Impact:** synthetic/mock captures are indistinguishable from real ones to the money-out gate. If a mock-enabled environment shares a database with live, mock money is payable.

### W-6 — COD shrinkage invisible to the ledger (S2)
1. COD order ₹2,000. Rider collects ₹2,000 (`/cod-reconciliation`), deposits ₹1,500 (`/cod-reconciliation/:id/reconcile`, `deposited_amount_minor=150000`).
2. Status → `short`, `difference_amount_minor = -50000` on the compat row; `insertWalletCreditIfMissing` credits `wallet_ledger_entries` ₹1,500 (cod-reconciliation.ts:305).
3. **No canonical `cod_receivable` debit, no `cod_remittance` posting.** The ₹500 shrinkage exists only as a negative `difference_amount_minor` on a mutable compat row with no reject trigger.
4. **Impact:** COD cash-in-transit and shrinkage are outside the double-entry ledger entirely; the platform's books cannot reconcile COD cash, and the shrinkage row can be silently UPDATEd (no append-only protection on `cod_reconciliation_entries`).

### W-7 — Webhook transient failure strands a paid order (S2)
1. Razorpay sends `payment.captured`. `writeWebhookEvent` inserts the dedup row (status `received`, index.ts:80). The downstream `markOrderPaid` → internal `/payments/confirm` throws (e.g. transient gateway-binding error). Catch marks the event `failed` (index.ts:856).
2. Razorpay retries the same event id. `writeWebhookEvent` returns empty (conflict) → handler returns `{duplicate:true}` and **short-circuits before the switch** (index.ts:733).
3. **Impact:** the order is never marked paid despite money captured at the PSP; the only recovery is the merchant-admin verify path or manual intervention. No automatic retry consumes `failed` webhook events.

---

## 14. Findings Register

Severity: **S0** = active, continuous money loss / cross-tenant money exposure on a live path; **S1** = serious correctness/safety defect that becomes live loss the moment live rails are enabled (gated today), or a forgeable money-auth control; **S2** = meaningful defect with real risk; **S3** = hygiene.

| ID | Sev | Area | Title | Root Cause | Evidence (path:line) | Impact | Fix | Recommended Fix |
|---|---|---|---|---|---|---|---|---|
| PAY-001 | S1 | Disappear/Ledger | Legacy & webhook capture posts no canonical ledger | `_with_ledger` RPC predates F6, never wired to ledger | `000_baseline.sql:1590-1709`; checkout-payment-routes.ts:620; internal-payment-routes.ts:163 | Canonical `merchant_payable`/`pa_clearing` blind to all live captures | M | Post the F6 capture ledger inside `confirm_order_payment_with_ledger` (debit pa_clearing / credit merchant_payable) idempotently, OR route all captures through the V1 capture API |
| PAY-002 | S1 | Disappear/Refund | Returns-path refund not ledgered | Legacy `complete_order_refund` never updated for F6 | `000_baseline.sql:1039-1208`; returns.ts:279; order-execution.adapter.ts:495 | `refund_clearing`/`merchant_payable` wrong on every returns refund | M | Add `post_ledger_transaction` (debit merchant_payable / credit refund_clearing) to the refund RPC, idempotent on refund id |
| PAY-003 | S1 | Disappear/COD | COD remittance not posted to canonical ledger | COD route writes only `wallet_ledger_entries` | cod-reconciliation.ts:305-326 | COD cash-in-transit / shrinkage outside the ledger | M | On collect: debit cod_receivable; on remittance: credit cod_receivable / debit pa_clearing (or bank), post short/over to a break |
| PAY-014 | S1 | Self-custody/R-6 | Payout rail hardcoded `razorpayx` (self-custody) | Wrong rail literal; adapter defaults to razorpayx | payouts.ts:119-121; payout-transfer-adapter:73; metadata `no_custody` settlements.ts:249,298 | Direct R-6 breach; LetBuyy would disburse from its own balance; honesty stamp is false | M | Switch rail to `razorpay_route`/cashfree split-instruction; assert the rail is a split product; make `no_custody` derive from the rail, not a literal |
| PAY-018 | S1 | Forgery/Auth | Step-up for refund & payout is a forgeable string check | Verifier never validates a stored/HMAC challenge | security-controls.ts:20-83; consumed payments.ts:491, payouts.ts:532 | Any client forges the second factor on payouts/refunds | M | Verify step-up against `step_up_challenges`/`sensitive_action_approvals` with HMAC + actor+action binding + single-use |
| PAY-019 | S1 | Settlement-drift | `pa_clearing` debited by settlement but never credited by capture | Two disconnected money-in feeds (PAY-001) | settlements.ts:237 vs baseline:1590; billing-core:565 | PA settlement reconciliation structurally impossible; `pa_clearing` drifts negative; wallet locks | M | Fix PAY-001 so capture credits pa_clearing; add a capture↔settlement reconciliation harness |
| PAY-020 | S1 | Ledger-drift/Tenancy | `post_settlement_ledger_transaction` sets tenant GUC from its own param | Wrapper does `set_config('app.site_id', p_site_id)` | `151:6-36` (23); 139:251 | Cross-store ledger posting; tenant isolation absent on the live ledger path | M | Derive site from an authenticated principal/claim inside the RPC; do not set the GUC from a raw parameter; assert caller authorization |
| PAY-021 | S2 | Ledger-integrity | Append-only is trigger-only; no REVOKE; runtime is owner | Zero REVOKE; gateway = service_role | 139:358-376; Phase 7 §2.1; 107:17 | One `DISABLE TRIGGER` re-enables mutation/deletion of immutable money history | S | `REVOKE UPDATE,DELETE ON ledger_entries,ledger_transactions FROM service_role,PUBLIC`; own ledger by a no-login role |
| PAY-008 | S2 | Duplicate | Double commission/fee posting (per-order vs per-statement) | Two independent fee-posting paths, no shared idempotency | commission.ts:337; payouts.ts:466 | `merchant_payable` double-debited for the same fee | M | Single fee-assessment authority; share an idempotency namespace keyed on order/statement; make payout consume commission entries instead of re-deriving |
| PAY-009 | S2 | Duplicate | Payout wallet credit double-count (manual vs settlement-driven) | Two payout-creation paths over overlapping orders | payouts.ts:440; settlements.ts:283 | Compat wallet/payout queue inflation | M | One payout-creation authority; reconcile source_order_ids across both before crediting |
| PAY-012 | S2 | Refund | Cross-path over-refund (returns vs V1 tables) | Refund subsystems use different tables, no shared cap | payments.ts:486; baseline:1132 | Combined refunds can exceed captured | M | Unify refund accounting on the ledger; derive remaining-refundable from `refund_clearing`/`merchant_payable`, not per-table columns |
| PAY-013 | S2 | Payout | No post-transfer reconciliation / suspense for payouts | Status flips to processing before transfer; no recovery | payouts.ts:580-608 | A PSP-succeeded but locally-failed transfer strands money | M | Reconcile-on-uncertainty for payouts: query provider status, post to a break/suspense if ambiguous, idempotent retry |
| PAY-015 | S2 | Payout/Auth | Payout release lacks permission check & maker≠checker | Ownership-only gate; step-up forgeable | payouts.ts:526-541; tenant-context.ts:183 | Single owner-equivalent session can drain payouts | S | Require `payout:release` permission; enforce checker actor ≠ `maker_actor_id` |
| PAY-016 | S2 | Webhook | Failed webhook is suppressed by dedup on retry | Dedup row written before processing; retry short-circuits | webhook index.ts:80,733,856 | Capture succeeds at PSP but order stays unpaid; no auto-retry | M | Only mark dedup `processed` after side effects; on retry of a non-processed event, re-run the handler |
| PAY-022 | S2 | Forgery | Storefront verify trusts signature without capture/amount confirm or replay assert | Public path weaker than subscription path | checkout-payment-routes.ts:534-617 | Relies on HMAC alone; no server capture proof; no cross-order replay guard | S | Add `fetchRazorpayPayment` capture+amount check and `assertProviderPaymentNotReplayed` to storefront verify |
| PAY-023 | S2 | Auth | Internal money-mutation secret falls back to `AUTH_SECRET` | Shared secret across identity + internal money RPC | webhook index.ts:543; internal-secret.ts:15 | One secret compromise forges both auth and internal payment-state mutations | S | Dedicated `INTERNAL_API_SECRET`, never fall back to `AUTH_SECRET`; rotate independently |
| PAY-024 | S2 | Honesty | Hosted checkout falsely stamps `capture_posted_to_ledger:true` | Metadata asserts ledger coverage the RPC doesn't provide | checkout.ts:647 vs baseline:1590 | Silent false-success (R2 violation); masks PAY-001 | S | Only set the flag after a real ledger post returns a transaction id |
| PAY-025 | S2 | Honesty | Mock-mode session can be captured into a real ledger entry | Capture accepts any provider_payment_id; gate ignores mode | payments.ts:271-309; 160:357 | Mock money can drive a payout if mock shares a DB with live | M | Forbid ledger posting for `mode!='live'`; tag canonical transactions with provider_mode and exclude non-live from payout balance |
| PAY-007 | S2 | Outbox | `emitDomainEvent` non-atomic and swallows missing-table errors | Separate Supabase call; silent null on error | event-execution.adapter.ts:60-85 | Money side-effects (email/fulfillment/payout-scheduling) silently dropped | M | Write outbox in the same DB transaction as the money mutation (RPC), or use a transactional outbox table written by the money RPC; never swallow |
| PAY-026 | S2 | Compensation | Scoped compensation written but never executed | No consumer of `compensation_actions` | checkout.ts:409; grep = no readers | Captured-but-order-failed buyer never auto-refunded; money trapped | M | Build a queue-worker that claims `compensation_actions(status=pending, action=refund_payment_intent)` and executes an idempotent refund |
| PAY-010 | S2 | Duplicate | V1 capture path skips cross-order replay assertion | `assertProviderPaymentNotReplayed` only checks legacy table | payments.ts:252-309; payment-route-support.ts:236 | Same provider payment id could be applied across `payments` sessions | M | Extend the replay assert to the `payments` table, or call it on capture |
| PAY-004 | S2 | Settlement | `recon_breaks` drops the sign of the variance | `CHECK amount_minor>0` + `Math.abs` | settlements.ts:272; 151:190 | Short vs over remittance indistinguishable at the column | S | Add a signed `direction`/`variance_signed_minor`; split break_type by sign |
| PAY-006 | S3 | Disappear/Rounding | Rupee→paise rounding on legacy `orders.total` | `Math.round(total*100)` on numeric(12,2) | payments.ts:128,938; checkout-payment-routes.ts:155 | Sub-paisa creation/loss per order on legacy paths | M | Migrate `orders` money to bigint paise; derive amounts from minor units end-to-end |
| PAY-017 | S3 | Webhook | No timestamp-window rejection (Razorpay) | Age logged, not enforced | webhook index.ts:714-719 | Replay safety rests solely on dedup store retention | S | Reject events older than a window (e.g. 5–15 min) in addition to dedup; keep dedup for in-window retries |
| PAY-011 | S3 | Settlement | Re-ingest with new key but same reference returns 500 not replay | Route dedups on key only; DB unique catches reference | settlements.ts:196; 151:85 | Operational error instead of idempotent replay | S | Pre-check `(provider, settlement_reference)` and return the existing settlement |
| PAY-005 | S3 | Revenue | Capture posts zero platform fee/GST (all deferred) | Fees deferred 100% to payout/settlement | payments.ts:296-298 | `platform_revenue` under-recognized until payout; offboarded merchants leak fees | M | Post platform fee/GST at capture (or guarantee a settlement runs); reconcile fee accrual |
| PAY-027 | S3 | Honesty/Money | Gift-card balance mutated in place, off-ledger | Legacy single-entry gift-card model | `000_baseline.sql:1836` (UPDATE gift_card_accounts SET balance) | Gift-card spend not in the 8-account ledger; mutable truth | M | Model gift-card liability as a ledger account; make redemption a ledger posting |
| PAY-028 | S3 | Ledger | `commission_bps` allows up to 100% | CHECK `<=10000` | Phase 7 DB-033 (119:95) | Misconfigured schedule can take 100% of GMV from merchant_payable | S | Tighten CHECK to a sane business max (e.g. ≤3000 bps) |
| PAY-029 | S3 | Overflow | 32-bit integer minor-unit money columns | Mobile tables used `integer` paise | Phase 7 DB-002 (119:16-19,52; 140:26-29); read at payouts.ts:147 | Payout/settlement > ₹2.14cr silently wraps | M | Complete the 160 `_bigint` cutover; make bigint authoritative; drop integer columns |
| PAY-030 | S3 | Idempotency | Wallet/COD writes rely on app-side existence checks, not DB upsert | `insertWalletCreditIfMissing` SELECT-then-INSERT race | cod-reconciliation.ts:282-326 | Concurrent reconcile could double-insert the COD wallet credit | S | Use the `(site_id, idempotency_key)` unique with `ON CONFLICT DO NOTHING` instead of a read-then-write |
| PAY-031 | S3 | Auth | Money permissions computed but never enforced on settlement/commission/wallet | Routes gate on ownership only | settlements.ts:195; commission.ts:263; wallet.ts:150 | Role-coarse access to money surfaces | M | Enforce `settlement:ingest`/`commission:reconcile`/`wallet:read` permissions per route |
| PAY-032 | S3 | Honesty | `confirm_order_payment` writes a synthetic `payment_webhook_events` row marked `signature_valid:true` | Legacy confirm fabricates a "verified" webhook event | `000_baseline.sql:1479-1508` | A confirmation-path event looks identical to a real provider webhook in the dedup/audit table | S | Distinguish confirmation-origin events (separate event_type/source); don't assert `signature_valid` for non-webhook origins |

**32 findings: S0 ×0 · S1 ×6 · S2 ×14 · S3 ×12.**

> **Why no S0:** every S1 is one configuration flip (`live` PSP/Route keys, `mode='mock'` removed, `RAZORPAY_ROUTE_PROVIDER_ENABLED=true`) away from active loss, but on the current working tree the live money rails are gated `[HUMAN-REQUIRED]` (mock/sandbox by default), so no path is *continuously* bleeding cash. The closest to S0 are **PAY-001/PAY-019** (the entire canonical ledger is blind to live captures — the day live keys connect, the books are wrong for 100% of volume) and **PAY-018** (the second factor on money-out is forgeable). Treat the six S1s as a single "do-not-go-live" gate.

---

## Appendix A — What is genuinely correct (so it isn't lost in the findings)

- **`packages/payments` ledger builders** (capture/refund/reversal) — balanced, bigint, INR-asserted, ≥2 lines, positive amounts, account-code-validated (packages/payments:386-546). Exemplary.
- **`post_ledger_transaction`** (139:223) — idempotent (ON CONFLICT), balance-checked, append-only-enforced, tenant-GUC-checked *(when not bypassed by the wrapper)*.
- **`claim_payout_statement_release`** (160:357) — FOR UPDATE + idempotency replay + status gate + ledger-balance gate. The payout-double-release fix is real.
- **Settlement break handling** — no auto-plug; explicit `recon_breaks` + alert (settlements.ts:265; billing-core:633).
- **Webhook signature verification** — correct HMAC + timing-safe across all four providers, with DB-unique dedup and an idempotent downstream order RPC.
- **Merchant-admin Razorpay verify & subscription verify** — full order+payment+signature binding, provider-order reference check, cross-order replay assertion, and (subscription) server-side capture+amount confirmation. This is the payment-forgery fix done right.
- **Server-side amount re-derivation** — client-supplied amounts are rejected on mismatch everywhere.
- **Wallet honesty gate** — refuses to display a balance unless the canonical ledger reconciliation is `verified` with zero variance (wallet.ts:163), which is what *surfaces* the unledgered-path drift rather than hiding it.

The tragedy of this codebase is that the hard parts (a correct double-entry kernel, idempotency, payout gating, signature binding) are done well, and the failure is in *not connecting the legacy money paths to them* — a wiring problem, not a primitives problem.
