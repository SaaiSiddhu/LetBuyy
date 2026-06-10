# LETBUYY — PAYMENTS & MONEY-MOVEMENT AUTOPSY
### Phase 8 of the Foundation Autopsy · 2026-06-09 · evidence-only
### Question: if real merchant money flows tomorrow, what breaks or is silently fake?

---

## 0. One-paragraph verdict

The **hard part is genuinely well-built**: the append-only double-entry ledger is enforced *at the database layer* (real reject-mutation triggers + a deferred balance constraint), all eight named accounts exist, posting is idempotent and single-writer, and the money-IN forgery/replay fixes are correct — including a server-side capture re-check. **The dangerous part is money-OUT.** There are **two parallel, non-reconciled payout pipelines**, and the default one **fabricates a "released" status with a fake UTR and then writes canonical ledger entries asserting the merchant was paid** — a stub reading as success at the most dangerous possible layer. The "live" payout path is a silent no-op. COD is self-attested and bypasses the canonical ledger entirely. Net money-path production-readiness: **~45–55%** — the accounting engine is real, the disbursement of actual money is not.

---

## 1. Component-by-component reality

| Component | Status | Evidence |
|---|---|---|
| Double-entry ledger DDL (8 accounts, append-only, balance trigger) | **REAL** | `database/supabase/migrations/139_executable_foundation_ledger_core.sql:75-142` (tables), `:79-88` (8 accounts in CHECK), append-only triggers `:360-376`, deferred balance constraint `:378-382`, `ledger_balance_breaks()` Σ-check `:344-356` |
| Ledger posting RPC `post_ledger_transaction` | **REAL** | `139:223-342` — enforces tenant GUC, single-writer (`writer_module='settlement'` CHECK `:113`), per-txn debit=credit `:336-338`, idempotent on `(site,source_type,source_id,idem_key)` `:281` |
| `packages/payments` money helpers (balanced-ledger assert, INR minor-units) | **REAL** (pure, unit-tested) | `packages/payments/src/index.ts:381-471`; `packages/payments/test/payments.test.ts` (30 real `assert.*`) |
| Settlement math (`planSettlementLedgerPosting`, `planPayoutReleaseLedgerPosting`) | **REAL** | `packages/billing-core/src/index.ts:548-663` |
| Settlement ingest route (no-custody, idempotent, ledger-linked) | **REAL** | `services/api-gateway/src/routes/settlements.ts:185-358` — idempotency `:196-205`, ledger RPC `:235-249`, `no_custody:true` `:246` |
| Razorpay money-IN adapter (order/capture/refund) | **REAL (live HTTP)** | `packages/infrastructure/razorpay-adapter/index.ts:90-110` (`fetch('https://api.razorpay.com/v1/orders')`) |
| Money-IN signature verify (forgery fix) | **REAL & strong** | `routes/payments.ts:1299-1325` — HMAC over `order_id\|payment_id` `:1299`, timing-safe `:1305`, `payment_id` fail-closed binding `:1316`, global replay guard `:1320-1325` |
| Subscription verify (binds order+amount+server capture re-check) | **REAL** | `routes/payments.ts:1093-1118` re-fetches payment, asserts `status==='captured'` AND `amount>=plan` AND order binding |
| Webhook handler (Razorpay/Stripe signature + dedup) | **REAL** | `services/webhook-service/src/index.ts:677-861` (Razorpay HMAC `:680-696`, dedup via `payment_webhook_events` `:725-735`) |
| **PA-split payout transfer in sandbox = fabricated "released"** | **MOCK READING AS SUCCESS** | `packages/infrastructure/payout-transfer-adapter/index.ts:82-93` returns `status:'released'` + fake `UTR…`; `routes/payouts.ts:505-578` consumes it and posts canonical `merchant_payable→pa_clearing` ledger `:544-560` |
| **Live payout transfer = silent no-op** | **SCAFFOLD** | `payout-transfer-adapter/index.ts:95-103` returns `status:'processing'`, `utr:null`, **makes no API call**; nothing advances `processing→released` |
| COD reconciliation | **SCAFFOLD-ish** (real diff math, self-reported, off canonical ledger) | `routes/cod-reconciliation.ts:379-424` real diff `:403`, but merchant-typed amounts `:354,:393`, writes only `wallet_ledger_entries` `:421`, never posts canonical `cod_remittance` |
| App-marketplace partner payout | **MOCK READING AS SUCCESS** | `packages/billing-core/src/index.ts:525-546` `planSandboxAppPayoutTransfer` → `released`/`settled_at` |
| `recon_breaks` harness | **PARTIAL / auto-explained** | `routes/settlements.ts:260-275` always inserts `status:'explained'`, dumps delta into `reserve`; no human review, no independent recompute |
| Money-path tests | **SCAFFOLD (string-match)** | `services/api-gateway/src/__tests__/money.test.ts:17-76` are `assert.match(source, /regex/)` — assert source text, not behavior |
| Real-DB integration tests (would exercise triggers/constraints) | **ABSENT** | no `pg-mem`/`pglite`/`testcontainers` anywhere in tests |
| Provider-mode honesty badge on payouts UI | **MISSING** | `provider_mode` stored (`151:53,118`) + API-returned (`routes/payouts.ts:135`) but no merchant UI renders a "simulated/not-real-money" badge on payouts |

---

## 2. The two-pipeline split that causes the danger

- **Pipeline A — canonical / no-custody** (`routes/settlements.ts` → `settlements`/`payouts`/`payout_items`): instruction-only, never moves money, posts the canonical double-entry ledger. This matches R-6 ("self-custody forbidden").
- **Pipeline B — `routes/payouts.ts` → `createPayoutTransferAdapter`**: calls a transfer adapter that **in sandbox mode (the default) returns `status:'released'` with a fabricated UTR**, then on that fake success writes canonical ledger truth claiming the merchant was paid.

The verified ledger/idempotency kernels are wired into Pipeline A. They are **also** wired into Pipeline B's fake success — which is what makes it dangerous: the lie is recorded in the *real* books.

---

## 3. Ranked money-safety findings

### S0 — must fix before any real money
- **S0-1 — Sandbox payout adapter fabricates "released" + writes canonical ledger truth.** `payout-transfer-adapter/index.ts:82-93` returns `status:'released'` + `UTR${token}` in sandbox (the default mode, `:116`); `routes/payouts.ts:544-560` posts a canonical `merchant_payable→pa_clearing` release transaction. A merchant clicking "settle" with default config **produces a permanent ledger record stating they were paid, plus a fake UTR**, while no money moved. Direct violation of "a stub must never read as success," at money-out.
- **S0-2 — "Live" payout path is a silent no-op.** `payout-transfer-adapter/index.ts:95-103` returns `processing`/`utr:null` and makes **no API call**; there is no Razorpay Route/Cashfree transfer creation and no poller. A real payout sits in `processing` forever. The initiated→processing→settled→failed lifecycle is **not implemented** for live.
- **S0-3 — App-marketplace partner payout uses the same fabricated-success pattern.** `billing-core/src/index.ts:525-546` marks partner revenue-share money-out `released`/`settled_at` without movement.

### S1 — serious, fix before live / before scale
- **S1-1 — recon breaks auto-"explained," not reconciled.** `routes/settlements.ts:260-275` inserts every break as `status:'explained'` and shoves the delta into the `reserve` suspense account. A real PA shortfall books cleanly and disappears into reserve — no open→review workflow, no independent recompute.
- **S1-2 — COD is self-attested and bypasses the canonical ledger.** `routes/cod-reconciliation.ts:354,393` trust merchant-entered collected/deposited amounts with no courier feed; `:421` writes only `wallet_ledger_entries`. The canonical `cod_receivable` account and `cod_remittance` source type exist (`139:84,107`) but COD money never hits `ledger_entries`, so `ledger_balance_breaks()` cannot see COD shortfalls. **A merchant can under-report COD collection and the balance invariant won't detect it.**
- **S1-3 — Razorpay webhook deliberately skips the timestamp window.** `webhook-service/src/index.ts:712-719` only `console.warn`s on events older than 300s and processes them ("do not reject by age"). Replay safety rests entirely on `payment_webhook_events` dedup. Spec requires signature **+ timestamp-window + nonce**; the window leg is missing for Razorpay (Stripe enforces it `:882-885`).
- **S1-4 — No honesty badge surfaced on payouts.** A sandbox "released" payout is indistinguishable from a real one in the merchant UI (only a generic test-mode toggle exists on the credentials page).

### S2 — hardening
- **S2-1 — Money-path tests are source-text assertions** (`money.test.ts:17-76`) — they pass even if the ledger triggers are dropped or the payout state machine is wrong. No real-DB test exists.
- **S2-2 — Step-up guards a fake transfer.** `routes/payouts.ts:487-496` requires step-up — but it guards the sandbox adapter, so the control protects an action that moves no money (false sense of control).
- **S2-3 — Two payout vocabularies drift.** `payouts.status` ∈ `scheduled/processing/paid/failed/cancelled` (`151:138`) vs `payout_statements.status` ∈ `pending/processing/released/failed` (`routes/payouts.ts:50`).

---

## 4. "Real money tomorrow" — concrete failure list

1. **Merchant settles a payout with default config → the books record a lie.** Default mode ≠ live ⇒ sandbox ⇒ fabricated `released` + fake UTR ⇒ canonical release ledger posted. No money left LetBuyy or any PA. (S0-1)
2. **Flip to live and real payouts never complete.** Live adapter makes no API call; balance shows released-pending forever. (S0-2)
3. **COD cash is whatever the merchant types.** Self-attested, off the canonical ledger; the balance invariant is blind to it. (S1-2)
4. **A genuine settlement mismatch self-heals** into the reserve account with no review. (S1-1)
5. **Partner app payouts (rev-share) are fabricated** in non-live. (S0-3)
6. **An old signed Razorpay webhook is processed** if dedup ever misses, because there is no timestamp-window rejection. (S1-3)
7. **Merchants cannot tell fake from real** — no sandbox badge on payouts. (S1-4)

---

## 5. What is genuinely safe (do NOT re-litigate)

- **Money-IN forgery/replay**: HMAC binds `order_id|payment_id`, fail-closed `payment_id` binding, global unique index `idx_payment_transactions_provider_payment_global ON payment_transactions(gateway, provider_payment_id)` (`107:134`, `142:148`), plus a real server-side capture re-check on subscriptions (`routes/payments.ts:1101-1118`).
- **The double-entry ledger DDL** with DB-enforced reject-mutation triggers on `ledger_entries`/`ledger_transactions` (`139:360-376`), a deferred balance constraint, the 8-account model, and single-writer CHECK.
- **Idempotent capture/refund/session** via the idempotency execution adapter.
- **The no-custody settlement-ingest path** (Pipeline A).

The accounting core is above typical pre-production quality. The danger is entirely on the **money-OUT** side (Pipeline B + COD self-attestation) and in the **absence of behavioral tests** that would catch a regression in the parts that are correct today.

---

## 6. Required fixes (smallest set that makes money honest)

1. **Delete the fabricated-success branch.** `payout-transfer-adapter` sandbox must return a clearly-non-released status and must **never** trigger a canonical release posting; gate any release ledger write behind a real provider `settled` callback. (S0-1, S0-3)
2. **Implement the live PA-split transfer + status poller/webhook** so `processing→settled` is driven by the provider, not assumed. (S0-2)
3. **Route COD remittance through the canonical ledger** (`cod_receivable`/`cod_remittance`) and require a courier/remittance feed, not merchant self-report. (S1-2)
4. **Make recon breaks open-by-default** with maker-checker resolution; stop auto-`explained`. (S1-1)
5. **Surface the provider-mode honesty badge** on every payout/settlement surface. (S1-4)
6. **Add real-DB integration tests** that exercise the ledger triggers, balance constraint, payout state machine, and idempotency under concurrency. (S2-1)
