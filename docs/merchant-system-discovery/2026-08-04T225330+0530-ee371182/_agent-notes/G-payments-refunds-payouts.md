# AGENT G — Payments, Merchant-Owned Razorpay, LetBuyy-Managed Provider, Refunds, Settlements, Payouts

Run: `docs/merchant-system-discovery/2026-08-04T225330+0530-ee371182`
Repo: `/Users/saai_siddharth/Projects/Start_Up/Letbuyy_Store` · Branch `stepup/main` · Commit `ee371182`
Scope: money-in (BYOG + platform-managed), COD, refunds, settlement/transfer/payout, step-up, ledger invariants.
Mode: **discovery only — no file in this repository was modified except this notes file.**

---

## 0. Executive summary (evidence-first)

1. **The merchant-owned Razorpay (BYOG) architecture does not exist as a money path.** Merchant credentials are captured, AES-GCM-encrypted, and stored (`sites.payment_settings.razorpay.key_secret_ciphertext`), but there is **no decrypt function anywhere in the repository** and **no code path reads that ciphertext**. Every real Razorpay call — storefront order create, storefront signature verify, refund creation, Route transfer — uses the **single platform-level `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` worker secrets**. Buyers therefore pay into **LetBuyy's** Razorpay account, not the merchant's. This is a direct contradiction of ART-11 / PAY-R4 (merchant = merchant-of-record; LetBuyy never custodies money-in). Status `CONTRADICTORY_EVIDENCE` / `STUB_OR_MOCK`.
2. **`confirm_order_payment_with_ledger` DOES post balanced double-entry rows** as of migration `168`. AGENTS.md PAY-R2's claim that it "posts **zero** ledger entries despite its name" is **stale documentation drift** — REFUTED with SQL. (Headline finding either way, as the commander predicted.)
3. **Refund completion is not gated by step-up on two of three refund routes**, and the refund id is caller-supplied and never bound to the caller's tenant — a cross-tenant refund/ledger-write candidate.
4. **All merchant payouts route to a single `RAZORPAY_ROUTE_ACCOUNT_ID` env var.** There is no per-site linked-account, beneficiary, or bank-account column anywhere in the schema. If live payouts were enabled today, every merchant's money would transfer to one linked account.
5. **The canonical ledger double-counts merchant money.** Capture credits `merchant_payable`; PA settlement ingest credits `merchant_payable` *again* (same direction, not a relief); only payout release debits it. The repo's own invariant `i4-merchant-conservation.sql` encodes `payable = captures − refunds − payouts` and will therefore **fail on any site that has ever ingested a settlement**.
6. **Merchant wallet/earnings is fail-closed on a reconciliation that structurally cannot reach zero** once any online capture happens → merchants cannot see their balance.
7. Step-up **is** real HMAC-SHA256 with constant-time compare (PAY-R7 satisfied where it is applied), but the token is **replayable within its 10-minute window** (`jti` never consumed).
8. Live payout/settlement execution is correctly **gated off** (`RAZORPAY_ROUTE_PROVIDER_ENABLED`), so the payout defects are **latent, not currently exploitable in production** — but they are shipped code.

---

## 1. Governance read before inspection

| Doc | Read | Note |
|---|---|---|
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:51,85,120,207,213–215,398–403` | yes | ART-10/11/12/13; R-5..R-10 |
| root `AGENTS.md:245–254` | yes | PAY-R1..PAY-R10 |
| `CLAUDE.md` | yes | runtime map, money rules |
| `apps/merchant-control-plane/AGENTS.md:1–26` | yes | boundary-only; no money override |
| `services/api-gateway/AGENTS.md` | present, read | no money override |

---

## 2. The five architectures — discovered state

### (1) MERCHANT-OWNED gateway (BYOG) — `STUB_OR_MOCK` / `CONTRADICTORY_EVIDENCE`

**What exists**

| Layer | Evidence | Verdict |
|---|---|---|
| Merchant UI to enter Razorpay key id + secret + test-mode | `apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx:224–279` (`handleSave`), `:468` renders *"Seller Razorpay account"* vs *"Shared LetBuyy account"* | `UI_ONLY` |
| Same-origin app proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/payment-config/route.ts:24–46` (POST) | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` |
| Typed API-client | `packages/typescript/api-client/src/index.ts:3854` (`stores.paymentConfig`) | present |
| Gateway route | `services/api-gateway/src/routes/stores.ts:368–491` | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` |
| Encryption at rest | `services/api-gateway/src/lib/store-payment-config.ts:32–47` — SHA-256(env secret) → AES-GCM-256, random 12-byte IV, stored as `base64(iv):base64(ct)` in `sites.payment_settings` (jsonb) | encrypted, **key usage list is `['encrypt']` only** (`:34`) |
| Env gate | `services/api-gateway/src/routes/stores.ts:368–378` — 503 `PAYMENT_CONFIG_UNAVAILABLE` if `PAYMENT_CONFIG_ENCRYPTION_KEY` absent | fail-closed, good |
| Credential verification against provider | `store-payment-config.ts:49–51` → `verifyRazorpayCredentials` → `packages/infrastructure/razorpay-adapter/index.ts:197–206` (`GET /v1/payments?count=1`) | real call, sets `verified` |
| Masking on read | `store-payment-config.ts:26–30, 53–70` — key id masked, secret never returned | good |

**What does NOT exist — the decisive gap**

Search run (repo-relative, production source only, `.wrangler`/`dist`/`node_modules` excluded):

```
grep -rn "key_secret_ciphertext|decryptPaymentSecret|PAYMENT_ENCRYPTION_KEY|payment_settings" \
  services/*/src apps/*/src packages/*/src apps/mobile
```

Every hit is a **write, an existence check, or a mask**:
- `store-payment-config.ts:8` (type), `:66` (`secret_configured: Boolean(...)`), `:77` (mode heuristic)
- `routes/stores.ts:432` (write), `:425` (read of prior settings for merge)
- `apps/*` — display only

**There is no `decrypt`, no `crypto.subtle.decrypt`, and no consumer of `key_secret_ciphertext` anywhere.** Confirmed by the absence of any `['decrypt']` key-usage import in `store-payment-config.ts:34`.

Second, disjoint, equally dead credential store:

- `database/supabase/migrations/142_executable_payment_sessions.sql:7–23` — `payment_credentials(site_id, provider, mode, status, kms_key_ref DEFAULT 'sandbox-kms://letbuyy/payment-credentials', encrypted_credentials jsonb)`.
- The **only** code touching it: `services/api-gateway/src/lib/payment-route-support.ts:96–108` — `select('id')`, i.e. an existence check. There is **no insert/update path** for `payment_credentials` in any runtime.
- Consequence: `requireLivePaymentCredential` (`payment-route-support.ts:122–139`) can never be satisfied because nothing can create the row → `POST /v1/payments/sessions` in `live` mode always returns 503 `PAYMENT_SETUP_REQUIRED` (`payments.ts:125–131`).

**Key rotation / disconnect / permission boundary**: `NOT_IMPLEMENTED`. No rotate endpoint, no disconnect endpoint, no revocation, no `deleted_at` path for `payment_settings.razorpay`. Re-POSTing the same route overwrites; `connected_at` is preserved (`stores.ts:435`).

**Test vs live mode**: stored as `razorpay.test_mode` (bool) and surfaced through `paymentConfigProviderMode` (`store-payment-config.ts:72–79`) — but **this value never influences which Razorpay account is used**, because the merchant credential is never used. The badge is therefore structurally dishonest (see G-16).

### (2) LETBUYY-MANAGED provider (the actual live money-in) — `IMPLEMENTED_NOT_RUNTIME_VERIFIED`, constitutional deviation

Shopper money-in, the real path:

```
storefront checkout → POST /v1/storefront/:subdomain/payments/razorpay/order
  → services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:449–566
    :464  if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) → 503     ← PLATFORM env, not merchant
    :505  createRazorpayPaymentProvider({ keyId: c.env.RAZORPAY_KEY_ID,
                                          keySecret: c.env.RAZORPAY_KEY_SECRET })
    :509  provider.createIntent(...)  → POST https://api.razorpay.com/v1/orders  (platform account)
    :544  responseBody exposes keyId: c.env.RAZORPAY_KEY_ID to the browser
→ POST /v1/storefront/:subdomain/payments/razorpay/verify   (:569–698)
    :584  env check only — again platform secret
    :635  createRazorpayPaymentProvider({ keyId: c.env.RAZORPAY_KEY_ID || 'storefront',
                                          keySecret: c.env.RAZORPAY_KEY_SECRET })
    :639  provider.verify(...)  → HMAC-SHA256(secret, `${order_id}|${payment_id}`)
    :664  paymentService.confirmPayment(...) → RPC confirm_order_payment_with_ledger
```

**Nowhere in this path is `site_id` used to select a credential.** One account serves every tenant. Cashfree is identical: `checkout-payment-routes.ts:214–225` reads `CASHFREE_APP_ID`/`CASHFREE_SECRET_KEY` from env.

Merchant-context duplicates of the same platform-account path:
- `services/api-gateway/src/routes/payments.ts:1047–1142` `POST /payments/razorpay/order` — `:1062, :1091, :1125` platform env.
- `services/api-gateway/src/routes/payments.ts:1146–1247` `POST /payments/razorpay/verify` — `:1162, :1194`.
- Refund: `payments.ts:533–536` — `createRazorpayPaymentProvider({ keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET })`.
- Subscription billing (merchant pays LetBuyy): `services/api-gateway/src/lib/subscription-checkout.ts:118, 133, 152, 208, 227` — same env pair. This one is *correct* (platform is merchant-of-record for its own SaaS fee).

**Stripe is also on the money path** — `payments.ts:1250–1321` `POST /payments/stripe/checkout` using `STRIPE_SECRET_KEY`, and `services/webhook-service/src/index.ts:907+` handles Stripe webhooks. India-only Constitution: worth an explicit decision.

**Razorpay Route (the "PA split")**: `services/api-gateway/src/routes/payouts.ts:594–603` + `packages/infrastructure/payout-transfer-adapter/index.ts:165–219` → `POST https://api.razorpay.com/v1/transfers` with `account: accountId` where `accountId = c.env.RAZORPAY_ROUTE_ACCOUNT_ID` — **one env var, all tenants**.

Search proving no per-merchant beneficiary exists:
```
grep -rn "linked_account|route_account|beneficiary|bank_account|ifsc" services/*/src packages/*/src database/supabase/migrations
→ zero hits for any per-site linked-account/beneficiary/bank column.
```
The only bank-adjacent artifact is a KYC *document type* `bank_proof` (`services/api-gateway/src/routes/kyc.ts:19, 66`), which stores `document_number_last4` + a file url — not a payable beneficiary.

**KYC** exists and is honest: `routes/kyc.ts`, `merchant_kyc_documents` (`database/supabase/migrations/120_mobile_kyc_documents.sql:5–47`), adapter `packages/infrastructure/kyc-verification-adapter/index.ts`. Sandbox auto-"verifies" if any evidence present (`:52–67`); `live` + `manual` → `needs_review` (`:123–131`); `live` + signzy/hyperverge → throws `KYC_LIVE_PROVIDER_UNAVAILABLE` (`:105–110`). Fail-closed, no fabricated live verification. Status `PARTIAL` + `BLOCKED_EXTERNAL` (SKIP-CAP-KYC-LIVE-PROVIDER).

### (3) COD — `PARTIAL`, ledger contract not met

- COD order confirm: `services/api-gateway/src/routes/order-risk.ts:315–415`. Sets `status`, `cod_confirmation_status`, `fulfillment_state`. **Posts no ledger entry, does not set `payment_status='paid'`, does not create `cod_receivable`.** PAY-R2 requires `cod_receivable` at confirm — `NOT_IMPLEMENTED`.
- COD receivable seeding is a *listing side effect*: `routes/cod-reconciliation.ts:166–205` — `ensureEntriesForCodOrders` inserts `cod_reconciliation_entries` for **every** non-cancelled COD order whenever the merchant opens the COD list (`:224`). Money-shaped rows created by a GET.
- Collection: `routes/cod-reconciliation.ts:311–353` — `collected_amount_minor` is **caller-supplied with no upper bound** (`:330 body.collected_amount_minor ?? expectedAmountMinor`); direct `.update()` on a money table; no ledger posting.
- Remittance: `routes/cod-reconciliation.ts:355–380` → RPC `reconcile_cod_remittance_with_ledger` (`database/supabase/migrations/165_d5_canonical_money_paths.sql:267–461`). Posts **debit `cod_receivable` / credit `merchant_payable`** (`:359–380`). Since nothing ever credited `cod_receivable` at confirm, this account can never net to zero, and the direction is the *same* as recognition rather than relief.
- Only the remittance RPC also writes `wallet_ledger_entries` (`165:407–456`) with `ON CONFLICT (site_id, idempotency_key)` — idempotent, canonical id attached.
- `orders.payment_status` is never set to `'paid'` for COD anywhere I could find → COD revenue is **structurally excluded** from `/payouts` statement creation, which filters `payment_status = 'paid'` (`routes/payouts.ts:364`).

### (4) REFUND — `PARTIAL` with two P0-class holes

Three distinct refund entry points exist. They do **not** share controls.

| Route | Step-up? | Idempotency? | Ledger posting | Evidence |
|---|---|---|---|---|
| `POST /v1/payments/:paymentId/refund` | **YES** (`payments.ts:497–507`) | yes (`:509–520`) | `postPaymentLedger` → `post_settlement_ledger_transaction` (`:563–582`) | `routes/payments.ts:467–672` |
| `POST /v1/orders/:id/refund/complete` | **NO** | yes (`orders.ts:1351–1362`) | RPC `complete_order_refund` posts refund ledger | `routes/orders.ts:1341–1400`, `execution/order-execution.adapter.ts:504–523` |
| `POST /v1/returns/:id/refund/complete` | **NO** | **NO idempotency claim** | RPC `complete_order_refund` posts refund ledger | `routes/returns.ts:259–292` |

Refund creation (`POST /v1/orders/:id/refund` → RPC `create_order_return_and_refund`, `orders.ts:1427–1460`) has idempotency + staff permission but no step-up; it creates the `refunds` row that the *complete* routes then settle.

Provider-side refund: only the `payments.ts` route actually calls Razorpay (`:542–549`, adapter `razorpay-adapter/index.ts:392–417`, `POST /v1/payments/:id/refund` with `receipt: idempotencyKey`). The `orders`/`returns` complete routes accept a **caller-supplied `provider_refund_id`** and mark the refund succeeded with **no provider call and no provider verification**.

### (5) SETTLEMENT / TRANSFER / PAYOUT — `PARTIAL`, gated off, latent defects

Two parallel, non-reconciling payout pipelines:

**Pipeline A — order-derived** (`routes/payouts.ts:412–530`)
`POST /v1/payouts` → sums `orders.total` for `payment_status='paid'` (`:356–374`), dedupes against `payout_statements.metadata.source_order_ids` (`:335–354`), applies `commission_bps` from `commission_schedules` (`:376–389`) and **18 % GST on the fee** (`:444 taxMinor = platformFeeMinor * 1800 / 10000`), inserts `payout_statements` (`:452`), inserts a `pending` `wallet_ledger_entries` credit (`:484`), posts a fee-assessment ledger txn **only if fee > 0** (`:504–527`).
`POST /v1/payouts/:id/settle` (`:553–709`) → step-up (`:576–586`) → provider gate (`:588–592`) → `claim_payout_statement_release` RPC (`:605`, defined `migrations/160:357–421`, checks derived `merchant_payable` balance, `FOR UPDATE`, idempotency-key claim) → Route transfer (`:626`) → posts `payout` ledger txn debit `merchant_payable` / credit `pa_clearing` (`:658–668`, `packages/billing-core/src/index.ts:658–681`) → inserts a `posted` `wallet_ledger_entries` debit (`:674`).

**Pipeline B — PA-statement-derived** (`routes/settlements.ts:319–515`)
`POST /v1/settlements/ingest` — **merchant-authenticated** (`:329 resolveTenantContextForOwnedSite`) and takes `gross_amount_minor`, `platform_fee_minor`, `gst_minor`, `net_amount_minor`, `reserve_minor` **straight from the request body** (`packages/billing-core/src/index.ts:138–152`). No provider feed, no signature, no statement fetch. Then:
- posts a `settlement` ledger txn **debit `pa_clearing` / credit `merchant_payable`** (`billing-core:585–621`) — i.e. the **same direction as a capture**;
- creates a *second* `payout_statements` row (`settlements.ts:212–241`) with `metadata.no_custody: true` **hardcoded** (`:233`);
- creates a `payouts` instruction row (`:428–453`, `metadata.no_custody: true` hardcoded at `:444`);
- creates `payout_items` (`:460`) and, on mismatch, an honest `recon_breaks` row with no auto-plug (`:402–417`) — PAY-R9 upheld here.

Pipeline B statements carry **no `source_order_ids`**, so Pipeline A's dedupe (`payouts.ts:335–354`) cannot see them → the same orders can be paid out through both pipelines.

Live execution gate (honest): `payouts.ts:124–132` requires `RAZORPAY_KEY_ID` + `RAZORPAY_ROUTE_KEY_SECRET|RAZORPAY_KEY_SECRET` + `RAZORPAY_ROUTE_ACCOUNT_ID` + `RAZORPAY_ROUTE_PROVIDER_ENABLED === 'true'`, else 503 `PAYOUT_PROVIDER_UNAVAILABLE` (`:588–592`). `settlements.ts:58–71` throws `HumanRequiredError` for live mode without Route credentials.

---

## 3. Required end-to-end traces

### Trace T1 — Shopper online payment (the live money-in path)

| Link | Evidence | Status |
|---|---|---|
| Entry: storefront checkout | `apps/storefront-runtime` (agent-D scope) | not traced here |
| Gateway route (order) | `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:449` | public (mounted pre-auth, `index.ts:722`) |
| App proxy | n/a — storefront calls the gateway directly | — |
| Typed API client | **MISSING** — no `storefront.payments.razorpay` method in `packages/typescript/api-client/src/index.ts` | MISSING |
| Auth / authorization | `loadPublishedStore(c, subdomain)` (`:455`) only. No `verifySiteOwnership` — correct for a public route. | ok |
| Provider credential selection | `c.env.RAZORPAY_KEY_ID/SECRET` (`:464, :505`) — **platform account, not per-site** | **MISSING per-tenant credential** |
| Server-authoritative amount | `orderAmountMinorUnits(order)` from DB (`:474`), client amount rejected on mismatch (`:483–489`) | ok |
| Idempotency | `IdempotencyExecutionAdapter.begin` before provider call (`:491–502`) | ok |
| Provider binding | `attachPaymentReference` → RPC `attach_order_payment_reference_with_ledger` (`payment-execution.adapter.ts:63–83`; base RPC `migrations/000_baseline.sql:345–400`) writes `orders.payment_id = provider_order_id`, rejects re-binding to a different reference (`:380–382`) | ok |
| Verify: signature | `:639` → adapter `razorpay-adapter/index.ts:325–345`: `hmacSha256Hex(keySecret, "${orderId}|${paymentId}")` + `timingSafeEqual` (`:223–230`, length-check then XOR accumulate) | **HMAC-SHA256 + timing-safe: PASS** |
| Verify: order binding | `:617–623` rejects if `order.payment_id !== razorpay_order_id` | ok |
| Verify: cross-order replay | `assertProviderPaymentNotReplayed` (`payment-route-support.ts:222–255`) + unique index `payments_provider_payment_id_uniq` / `payment_transactions_provider_payment_id_v1_uniq` (`migrations/142:144–150`) | ok |
| Verify: **amount / capture proof** | **MISSING** — `fetchRazorpayPayment` exists (`razorpay-adapter:127–147`) and its own doc comment warns the HMAC "only proves order_id\|payment_id, not that the money was taken or how much", but it is called **only** from the subscription path (`payments.ts:970`), never from the storefront/order path | **MISSING** |
| RPC / ledger | `confirm_order_payment_with_ledger` (`migrations/168:133–312`) → `post_settlement_ledger_transaction` → `post_ledger_transaction` | posts double-entry (§4) |
| RLS | `payments`, `payment_transactions`, `payment_attempts` ENABLE+FORCE + GUC policy (`migrations/142:181–221`); gateway uses `service_role` (`lib/supabase.ts:13–19`) so RLS is bypassed and replaced by an app-level guard `createTenantGuardedSupabaseClient` | deviation (ART-08) |
| Webhook | `services/webhook-service/src/index.ts:718–905` | §5 |
| Storefront/merchant consequence | order `payment_status='paid'`, `outbox_events`, order-paid email | ok |
| Tests | `services/api-gateway/src/__tests__/payments.test.ts` — **regex assertions over source text**, not behaviour | weak |
| Runtime observation | none performed | `UNVERIFIED_RUNTIME` |

### Trace T2 — Merchant refund from the Orders page

| Link | Evidence | Status |
|---|---|---|
| Entry | `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:379–423` | `UI_ONLY` |
| Step-up challenge | `POST /api/stores/[store]/security/step-up` → `/security/step-up/challenges` (`routes/security.ts:159–250`) requires an active TOTP factor (`:177`) | ok |
| App proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/orders/[orderId]/refund/route.ts:24–61` | **BROKEN** |
| — proxy resolves payment id | `:36 const paymentId = orderPayload?.data?.payment_id` — this is `orders.payment_id`, which the RPC sets to the **Razorpay order id** (`migrations/000_baseline.sql:384–386`), e.g. `order_ABC123` | **BROKEN** |
| — proxy calls gateway | `:51 /payments/${paymentId}/refund` | passes a provider string where a `payments.id` UUID is required |
| Gateway | `routes/payments.ts:467` → `loadOwnedPaymentSession` → `.from('payments').eq('id', paymentId)` (`payment-route-support.ts:200–212`) on a `uuid` PK (`migrations/142:44`) | uuid cast failure / not found |
| Verdict | The merchant Orders-page refund button cannot reach the refund logic. `BROKEN`. Needs runtime confirmation, but the type mismatch is unambiguous in source. | `BROKEN` |

### Trace T3 — Payout release

| Link | Evidence | Status |
|---|---|---|
| Entry | `apps/merchant-control-plane/src/app/[store]/payouts/page.tsx:89–121` | `UI_ONLY` |
| App proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/payouts/[payoutId]/settle/route.ts` | present |
| Typed client | `packages/typescript/api-client/src/index.ts:4966–4977` (`payouts.list/summary/get/create/settle`) | present |
| Gateway | `routes/payouts.ts:553–709` | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` |
| Ownership | `resolveTenantContextForOwnedSite(c, statement.site_id)` (`:570`) — statement loaded first, ownership checked before any mutation | ok |
| Step-up | `verifySensitiveActionStepUp({action:'payout.release', ...})` (`:576–586`) → real HMAC (`lib/security-controls.ts:192–212`) | ok |
| Provider gate | `:588–592` → 503 unless `RAZORPAY_ROUTE_PROVIDER_ENABLED==='true'` | `BLOCKED_EXTERNAL` |
| Claim (lock + idempotency) | RPC `claim_payout_statement_release` (`migrations/160:357–421`): `FOR UPDATE`, replay by key, status guard, **derived-balance sufficiency check** `ledger_account_balance_minor(site,'merchant_payable') >= net_amount_minor_bigint` (`:398–404`) | good |
| Transfer | `payout-transfer-adapter/index.ts:180–219` → `POST /v1/transfers` with `Idempotency-Key` header and `account: RAZORPAY_ROUTE_ACCOUNT_ID` | **single account for all tenants** |
| Ledger | `postCanonicalPayoutLedger` (`payouts.ts:658`) → debit `merchant_payable` / credit `pa_clearing` | balanced |
| Projection write | `db.from('wallet_ledger_entries').insert(...)` (`:674`) — direct TS money-table write | invariant issue (§6A) |
| Instruction sync | `syncSettlementPayoutInstruction` (`:209–244`) updates `payouts` rows | ok |
| Tests | `services/api-gateway/src/__tests__/payout-provider-client.test.ts` (source-regex style) | weak |

---

## 4. MANDATORY AUDIT B — Double-entry reality check (the headline)

### B.1 `confirm_order_payment_with_ledger` — **AGENTS.md PAY-R2 is REFUTED**

**Latest definition:** `database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql:133–312`.

It **does** post a balanced double-entry transaction:

```sql
-- migrations/168_b1_b2_capture_refund_ledgering.sql:237–267
IF v_amount_minor > 0 THEN
  v_ledger_transaction_id := public.post_settlement_ledger_transaction(
    v_site_id, 'payment_capture', p_provider || ':' || p_provider_payment_id, v_ledger_idempotency_key,
    jsonb_build_array(
      jsonb_build_object('account_code','pa_clearing',      'side','debit',  'amount_minor', v_amount_minor, ...),
      jsonb_build_object('account_code','merchant_payable', 'side','credit', 'amount_minor', v_amount_minor, ...)
    ), ...);
```

The prior (baseline, `migrations/000_baseline.sql:1590`) definition had no ledger posting — that is the version AGENTS.md PAY-R2 describes. **AGENTS.md:246 is stale documentation drift** and must be corrected. Recorded as gap **G-G-01**.

Caveats found in the same SQL:
- `v_amount_minor := round(COALESCE(v_order.total,0) * 100)::bigint` (`168:179`) — the ledger amount is derived from `orders.total`, a **`numeric(10,2)` rupee column** (`migrations/000_baseline.sql:10121,10156`), not from a bigint-paise source and **not from the provider's captured amount**. Partial captures / provider amount drift are invisible to the ledger.
- `p_idempotency_key` is **optional**; it falls back to `p_provider_payment_id` (`168:180`). Idempotency is still effectively enforced by the unique key `(site_id, source_type, source_id, idempotency_key)` on `ledger_transactions` (`139:122`) because `source_id` already embeds the provider payment id.
- `FOR UPDATE` on `orders` (`168:172`) — present.
- No `provider_mode` is recorded in the ledger metadata (`168:257–265`) → sandbox and live captures are indistinguishable in the canonical ledger.

### B.2 `complete_order_refund` — posts double-entry, **but is not tenant-bound**

`migrations/168:314–561`.
- `IF p_idempotency_key IS NULL OR btrim = '' THEN RAISE` (`:336–338`) — idempotency **required**. Good.
- `FOR UPDATE` on `refunds` (`:345`) and `orders` (`:356`). Good.
- Over-refund guard: `IF v_existing_succeeded + v_refund.amount > v_order_total THEN RAISE` (`:376–378`). Good.
- Posting: debit `merchant_payable` / credit `refund_clearing` (`:401–429`). Balanced.
- **`SELECT * INTO v_refund FROM refunds WHERE id = p_refund_id` (`:340–345`) — no `site_id` predicate.** The refund is located by primary key alone. The caller supplies `p_refund_id`.

### B.3 `record_order_payment_failure_with_ledger` — conditional posting

`migrations/168:563–737`. Posts debit `merchant_payable` / credit `refund_clearing` **only when `p_payment_status = 'refunded'`** (`:662`). Otherwise no ledger movement (correct — a failed payment never moved money).

### B.4 `post_ledger_transaction` (the writer) — genuinely append-only double-entry

`migrations/139_executable_foundation_ledger_core.sql:223–342`:
- requires tenant GUC to equal `p_site_id` (`:250–253`);
- ≥ 2 lines (`:259–261`);
- `ON CONFLICT (site_id, source_type, source_id, idempotency_key) DO NOTHING` then returns the existing id (`:281–292`) — **idempotent**;
- rejects non-positive amounts (`:300–302`);
- asserts `debits == credits` (`:336–338`);
- plus a `DEFERRABLE INITIALLY DEFERRED` constraint trigger re-checking balance per transaction (`:378–382`, function `:172–198`);
- `ledger_entries.amount_minor bigint NOT NULL CHECK (amount_minor > 0)` (`:132`);
- `writer_module text NOT NULL DEFAULT 'settlement' CHECK (writer_module = 'settlement')` (`:113`) — single-writer constraint holds;
- BEFORE UPDATE / BEFORE DELETE triggers raise `'ledger is append-only; use reversing entries'` (`:358–376`);
- **`REVOKE UPDATE, DELETE ON ledger_transactions/ledger_entries FROM PUBLIC, anon, authenticated, service_role, app_tenant`** — `migrations/165:463–464`. **PAY-R6 (trigger AND REVOKE) is SATISFIED.**

### B.5 Balance is DERIVED, not a column — **CONFIRMED**

`ledger_account_balance_minor(p_site_id, p_account_code)` (`migrations/160:173–196`) sums `ledger_entries` (credit-positive). There is **no** balance column on `ledger_accounts` (`139:75–97`). Consumers: `claim_payout_statement_release` (`160:398`), `refresh_money_ledger_site_reconciliation` (`160:224`), invariant `i4`. **PAY-R1 satisfied for the canonical ledger.**

`wallet_ledger_entries` is a *mutable-row* compatibility projection but has no mutable balance column either — the wallet route derives from rows (`routes/wallet.ts:80–101`) and then **overrides `available_minor` with the canonical derived balance** (`:182`). Honest.

### B.6 Tenant-scope hardening of the settlement writer

`post_settlement_ledger_transaction` was originally a GUC bypass — `migrations/151:23` did `PERFORM set_config('app.site_id', p_site_id::text, true)` from the **caller-supplied** parameter. `migrations/165:214–265` replaced it: it now resolves the owning site from the **source row** (`resolve_money_ledger_source_site_id`, `165:110–212`, extended `168:5–131`), rejects `p_site_id <> v_source_site_id` (`:243–245`), rejects a conflicting pre-existing GUC (`:247–250`), and only then sets the GUC. **Fixed. Good.**
Residual note: `set_config(..., true)` is transaction-local, so the GUC persists for the remainder of the calling transaction — subsequent statements in the same tx inherit that tenant scope.

---

## 5. Webhook ingestion, tenant attribution, replay

`services/webhook-service/src/index.ts:718–905` (`POST /razorpay`).

| Control | Evidence | Verdict |
|---|---|---|
| Signature algorithm | `verifyRazorpayWebhookSignature` (`:248–256`) → `hmacSha256Hex(secret, rawBody)` + `timingSafeEqual` (adapter `:208–230`) | **HMAC-SHA256 + timing-safe: PASS** |
| Double verification | Both the local helper (`:721`) and the adapter's `webhookVerify` (`:726`) must pass (`:734`) | belt-and-braces, fine |
| Raw body | `await c.req.text()` before JSON parse (`:719`) | correct |
| Secret | **one** `RAZORPAY_WEBHOOK_SECRET` (`:38, :724, :730`) | single-account model |
| Replay: timestamp window | **NOT enforced** — `:753–760` explicitly *logs* stale events and comments "do not reject by age" | deliberate; documented in code |
| Replay: stored event id | `writeWebhookEvent` (`:766–776`) → `payment_webhook_events`; duplicate → early return | ok |
| Event-id derivation | `razorpayProviderEventId` (`:105–117`) falls back to `${event}:${created_at}:${signature.slice(0,24)}` when no payment/refund/order id | weak but signature-derived |
| **Tenant attribution** | `findOrderByPaymentCandidates` (`:332–352`) — `SELECT ... FROM orders WHERE (payment_id.eq.X or id.eq.X)` **with no `site_id`/`store_id` predicate**, `limit 1`. Attribution is by global provider id lookup. | works only because there is exactly one Razorpay account |
| PostgREST filter construction | `:339–343` interpolates the candidate string directly into an `or=(...)` filter without escaping. Candidates come from `notes.order_id` / `payment.order_id` / `payment.id`, i.e. attacker-influenced **only** by someone able to sign a webhook. | low exploitability, still unsafe construction |
| Handler idempotency | `markOrderPaid` → gateway `/storefront/internal/payments/confirm` (`gateway-order-transitions.ts:59`) → `confirm_order_payment_with_ledger` with `idempotencyKey: payment-webhook:${provider}:${eventId}:paid` | ok |
| Dispute / chargeback events | **not handled** — the switch covers `payment.captured`, `payment.failed`, `refund.created`, `payment.authorized`, default→ignored (`:781–896`). No `payment.dispute.*`. | `NOT_IMPLEMENTED` |

**If BYOG were implemented as designed, this handler would be structurally unable to attribute events** — one shared `RAZORPAY_WEBHOOK_SECRET` cannot verify N merchant accounts' signatures. Recording as a design blocker for the BYOG remediation (G-G-02 dependency).

---

## 6. MANDATORY INVARIANT AUDITS

### AUDIT A — CANONICAL-LEDGER-ONLY

**Search run** (production TS only; `node_modules`, `.next`, `dist`, `.wrangler`, `__tests__`, `*.test.*` excluded; roots `services/ packages/ apps/`):

```js
new RegExp("\\.from\\(\\s*['\"`](" + tables.join("|") + ")['\"`]\\s*\\)([\\s\\S]{0,600}?)\\.(insert|update|upsert|delete)\\b","g")
tables = payment_transactions, payments, payout_statements, payouts, refund_transactions, refunds,
         cod_reconciliation_entries, settlements, wallet_ledger_entries, partner_payout_ledger_entries,
         gift_card_accounts, gift_card_ledger_entries, gift_card_redemptions, ledger_entries,
         ledger_transactions, commission_reconciliation_entries, reserves, recon_breaks, payout_items,
         money_ledger_site_reconciliations, ai_credits, orders
```

**46 matches. Manual adjudication:**

| # | Path:line | Table → verb | Judgement |
|---|---|---|---|
| 1 | `services/api-gateway/src/routes/payments.ts:164` | `payments` → insert | **Real direct money-table write** (payment session row) — not a money movement, but a money-table insert from TS |
| 2 | `…/routes/payments.ts:317` | `payments` → update (capture) | **Real** — sets `status='captured'`, `capture_ledger_transaction_id` |
| 3 | `…/routes/payments.ts:407` | `payments` → update (void) | **Real** |
| 4 | `…/routes/payments.ts:585` | `payments` → update (refund) | **Real** — sets `refunded_amount_minor` |
| 5 | `…/routes/payouts.ts:452` | `payout_statements` → insert | **Real** — creates a payable statement with computed money |
| 6 | `…/routes/payouts.ts:484` | `wallet_ledger_entries` → insert | **Real** — `pending` payout credit, **no `canonical_ledger_transaction_id`** |
| 7 | `…/routes/payouts.ts:523,637,670` | `payout_statements` → update | **Real** — status/released/ledger-link |
| 8 | `…/routes/payouts.ts:674` | `wallet_ledger_entries` → insert | **Real** — `posted` payout debit |
| 9 | `…/routes/payouts.ts:237` | `payouts` → update | **Real** — instruction status/UTR |
| 10 | `…/routes/settlements.ts:201/213` | `payout_statements` → insert | **Real** |
| 11 | `…/routes/settlements.ts:243` | `wallet_ledger_entries` → insert | **Real** |
| 12 | `…/routes/settlements.ts:347` | `settlements` → insert | **Real** — merchant-supplied amounts |
| 13 | `…/routes/settlements.ts:392` | `settlements` → update | **Real** |
| 14 | `…/routes/settlements.ts:403` | `recon_breaks` → insert | **Real** (acceptable — a break record, no auto-plug) |
| 15 | `…/routes/settlements.ts:429` | `payouts` → insert | **Real** |
| 16 | `…/routes/settlements.ts:460` | `payout_items` → insert | **Real** |
| 17 | `…/routes/cod-reconciliation.ts:203` | `cod_reconciliation_entries` → insert | **Real** — seeded on a GET |
| 18 | `…/routes/cod-reconciliation.ts:333` | `cod_reconciliation_entries` → update | **Real** — merchant-supplied `collected_amount_minor` |
| 19 | `…/routes/commission.ts:316,344` | `commission_reconciliation_entries` → insert/update | **Real** |
| 20 | `…/routes/internal-console/money-reconciliation.ts:248` | `money_ledger_site_reconciliations` → update | **Real** (metadata-only annotation; no amount mutation — acceptable) |
| 21 | `…/execution/queue-execution.adapter.ts:475,540,566`; `…/routes/operations/developers.ts:241,272,359`; `services/queue-workers/src/platform-queue-consumer.ts:1347,1411,1437` | `partner_payout_ledger_entries` | **Ring-fenced by an explicit governance seam** `SKIP-B3-PARTNER-PAYOUT-LEDGER-BOUNDARY` (`SKIPPED_HUMAN_DECISIONS.md:10`, enforced `scripts/validators/canonical-ledger-only-validator.mjs:29–35, 122–129`) — not a new violation |
| 22 | `orders` → update ×13 (`order-execution.adapter.ts:338,454`; `payment-execution.adapter.ts:150`; `queue-execution.adapter.ts:624`; `customers.ts:1050,1280`; `order-risk.ts:228,363,451`; `orders.ts:1102`; `security.ts:356`; `whatsapp.ts:454`; `platform-queue-consumer.ts:1121,1532`) | status/fulfilment/risk fields | **Not money-column writes** on inspection (status, risk, fulfilment, notes). Verified spot-checks at `order-risk.ts:348–361` and `payment-execution.adapter.ts:148–156`. |
| 23 | `ledger_entries` / `ledger_transactions` | **zero** insert/update/delete from TS anywhere | **CLEAN — the canonical ledger has exactly one writer (SQL)** |
| 24 | `gift_card_accounts` / `gift_card_ledger_entries` / `gift_card_redemptions` | **zero** mutations from TS | **CLEAN** |
| 25 | `refunds` / `refund_transactions` / `payment_transactions` | **zero** mutations from TS (only `.select`) | **CLEAN** |

**Verdict:** the *canonical* ledger tables and the core money tables (`refunds`, `payment_transactions`, gift cards) are RPC-only — genuinely good. But **the settlement/payout/COD/commission subsystem writes money-bearing tables directly from TypeScript in 19 production sites**, with money amounts computed in the worker rather than in a `SECURITY DEFINER` RPC.

**Why the ratchet does not catch it:** `scripts/validators/canonical-ledger-only-validator.mjs:130–136` only requires that the **file** contains *some* canonical-ledger token (`canonicalLedgerEvidence` regex at `:49–50`). `routes/payouts.ts` and `routes/settlements.ts` both mention `post_settlement_ledger_transaction`, so **every** direct write in those files passes. The check is file-level adjacency, not per-mutation enforcement.

### AUDIT C — Idempotency + locking on every money RPC

| RPC | idempotency required | ON CONFLICT | FOR UPDATE | non-negative CHECK | Evidence |
|---|---|---|---|---|---|
| `create_checkout_order` | **YES** — raises if blank | yes (`site_id, idempotency_key` ×6) | yes (`:181`, `:209`) | order/gift-card amounts via `LEAST(balance, total)` | `migrations/170_v1_shipping_rates_gst.sql:77–78, 181, 209, 231, 259, 285, 342, 417, 548, 588` |
| `confirm_order_payment_with_ledger` | **NO** (optional, falls back to provider payment id) | via ledger unique key + `payment_attempts ON CONFLICT DO NOTHING` (`168:308`) | yes (`168:172`) | `ledger_entries CHECK (amount_minor > 0)` | `migrations/168:140, 172, 180, 308` |
| `complete_order_refund` | **YES** (`168:336`) | outbox `ON CONFLICT (idempotency_key)` (`168:552`); `refund_attempts ON CONFLICT DO NOTHING` (`:482`) | yes (`:345`, `:356`) | over-refund guard (`:376`) | `migrations/168:336, 345, 356, 376, 482, 552` |
| `record_order_payment_failure_with_ledger` | NO (optional) | `payment_attempts ON CONFLICT DO NOTHING` (`:733`) | yes (`:603`) | n/a | `migrations/168:572, 603, 733` |
| `reconcile_cod_remittance_with_ledger` | **YES** (`165:291`) | replay-by-key lookup (`:295–305`); wallet `ON CONFLICT (site_id, idempotency_key)` (`:450`) | yes (`:313`) | `deposited_amount_minor >= 0` (`:323`) | `migrations/165:291, 295, 313, 323, 450` |
| `post_ledger_transaction` | **YES** (param) | `ON CONFLICT (site_id, source_type, source_id, idempotency_key) DO NOTHING` + returns existing (`139:281–292`) | n/a | `amount_minor > 0` (`139:132`), balance assert (`:336`) | `migrations/139:223–342` |
| `claim_payout_statement_release` | **YES** | claim-by-key replay (`160:385–388`) | yes (`160:379`) | derived-balance sufficiency (`:398–404`) | `migrations/160:357–421` |

Gateway-level idempotency (`IdempotencyExecutionAdapter`) is applied on: payment session create, capture, refund (`payments.ts:135, 281, 509`), storefront razorpay order/verify (`checkout-payment-routes.ts:491, 601`), orders refund + refund/complete (`orders.ts:1351, 1436`). **Not applied** on `POST /returns/:id/refund/complete` (`returns.ts:259–292`).

### AUDIT D — `commission_bps` MUST be 0

| Layer | Evidence | Verdict |
|---|---|---|
| DB default | `ALTER TABLE commission_schedules ALTER COLUMN commission_bps SET DEFAULT 0` and same for `commission_reconciliation_entries` — `migrations/162_phase_a_commission_zero.sql:3–7`; backfill `UPDATE … SET commission_bps = 0` (`:9–21`) | default 0 ✔ |
| Original DDL default | `commission_bps integer DEFAULT 0 NOT NULL` — `migrations/119_mobile_money_ledgers.sql:81, 108` | 0 ✔ |
| DB **constraint** | `CHECK (commission_bps >= 0 AND commission_bps <= 10000 …)` — `migrations/119:95, 125` | **allows 0–10000; nothing forces 0** ✘ |
| Code default | `loadCommissionBps` returns `?? 0` — `routes/payouts.ts:376–389` | 0 ✔ |
| Code behaviour if non-zero | `platformFeeMinor = grossAmountMinor * commissionBps / 10000` and `taxMinor = platformFeeMinor * 1800 / 10000` — `routes/payouts.ts:443–444` | **live 3 %-style rake + 18 % GST-on-fee arithmetic is still executable** ✘ |
| Validator | `scripts/validators/commission-bps-zero-validator.mjs` exists | ratchet only, source-level |
| Certification invariant | `scripts/money-certification/invariants/i5-zero-rake.sql:35–41` queries `public.payment_credentials.commission_bps` — **that column does not exist** (`migrations/142:7–23`) | **the zero-rake DB check cannot run** ✘ |

**Verdict:** the *default* is 0 everywhere (R-9 met by default), but there is no DB constraint pinning it to 0, the fee arithmetic is live in the payout path, and the automated zero-rake check is broken.

### AUDIT E — Self-custody (`razorpayx`)

```
grep -rni "razorpayx" services apps packages database scripts   (node_modules/.wrangler/dist excluded)
```
Results (7 files, all non-executing):
- `database/supabase/migrations/000_baseline.sql:8293, 8295, 10263` — residual CHECK-constraint enum values on `app_billing_charges.payout_rail`, `app_billing_charges.provider`, `partner_payout_ledger_entries.rail`. **The DB contract still accepts `'razorpayx'`.**
- `scripts/validators/no-self-custody-rail-validator.mjs:11–32` — blocks any hardcoded/default/fallback `razorpayx` in code and requires the `SKIP-RAZORPAYX-ENUM-PURGE` seam.
- **Zero** occurrences in any runtime TS/Dart. `payout-transfer-adapter` supports only `razorpay_route | upi | manual` (`packages/infrastructure/payout-transfer-adapter/index.ts:1`) and `manual` **throws** (`:100`).

**Verdict: the self-custody rail is DEAD in code.** Residual enum values are a documented, tracked contract cleanup (`SKIPPED_HUMAN_DECISIONS.md:54`). `PARTIAL`, P2 — not a live custody path.

Counter-evidence on never-custody: `no_custody: true` is **hardcoded** at `routes/settlements.ts:233, 386, 444`, not derived from the rail. PAY-R4 explicitly says *"MUST NOT stamp `no_custody:true` … derive `no_custody` from the rail."* Direct rule violation (currently benign because the rail is `pa_split`).

### AUDIT F — Money representation (R-8: bigint minor units)

**bigint (compliant):** `ledger_entries.amount_minor` (`139:132`), `payments.amount_minor` (`142:50`), `settlements.*_minor` (`151:57–62`), `payouts.amount_minor` (`151:121`), `payout_items.amount_minor` (`151:155`), `reserves.amount_minor` (`151:95`), `recon_breaks.amount_minor` (`151:177`), `payments.refunded_amount_minor` (`160:11`).

**int32 (`integer`) money columns still written in production:**

| Column | Evidence | Live writer |
|---|---|---|
| `payout_statements.gross_amount_minor / platform_fee_minor / tax_minor / net_amount_minor` | `migrations/119:16–19` | `routes/payouts.ts:461–464`, `routes/settlements.ts:222–225` |
| `wallet_ledger_entries.amount_minor` | `migrations/119:51` | `routes/payouts.ts:491, 681`, `routes/settlements.ts:250`, `migrations/165:430` |
| `cod_reconciliation_entries.expected/collected/deposited/difference_amount_minor` | `migrations/140:26–29` | `routes/cod-reconciliation.ts:187–190, 336`, `migrations/165:335–339` |
| `commission_reconciliation_entries.gross/commission/gst/net_payable_minor` | `migrations/119:106–113` | `routes/commission.ts:316, 344` |

`_bigint` shadow columns + sync triggers were added (`migrations/160:26–40, 96–145`; `165:5–10, 26–78`) but **the int4 columns remain the inserted/updated columns**, so overflow occurs at the int4 write, before the trigger copies.

**Worse — silent truncation of money:** `migrations/165:335–339` writes
```sql
collected_amount_minor  = LEAST(v_collected_amount_minor, 2147483647)::integer,
deposited_amount_minor  = LEAST(v_deposited_amount_minor, 2147483647)::integer,
difference_amount_minor = GREATEST(LEAST(v_deposited - v_expected, 2147483647), -2147483648)::integer,
```
Amounts above ₹2,14,74,836.47 are **silently capped**, not rejected.

**numeric-rupee money still authoritative on the capture path:** `orders.total numeric(10,2)` (`migrations/000_baseline.sql:10156`), `orders.subtotal numeric(10,2)` (`:10152`), `payment_transactions.amount` (numeric, written from `v_order.total` at `168:225`), `refunds.amount` (numeric, `168:363`), `v_gift_card_balance NUMERIC(12,2)` (`migrations/170:64`). The canonical capture amount is `round(orders.total * 100)` (`168:179`) — a numeric→bigint conversion at the ledger boundary.

**No float money columns found.**

---

## 7. Step-up (PAY-R7 / R-10) — real cryptography, with a replay gap

`services/api-gateway/src/lib/security-controls.ts`:
- Token = `lb-stepup-v1.<base64url(payload)>.<base64url(HMAC-SHA256)>` (`:126–163`).
- Secret must be ≥ 32 chars and not a placeholder (`:46–51`) — fails closed.
- Verify: recompute HMAC, `constantTimeEqual` (`:88–97`, XOR accumulate), then bind `action`, `actor_id`, `site_id`, `verified_at` (`:192–212`).
- 10-minute window + future-skew rejection + `exp` (`:214–227`) — `STEP_UP_WINDOW_MS = 10*60*1000` (`:29`).
- Issued only after an **active TOTP factor** check (`routes/security.ts:159–250`, `:177` requires the factor; `:183` records a `step_up_challenges` row).
- **NOT a string-length check.** PAY-R7 satisfied where applied.

**Gap:** the payload's `jti` (`:40`) is generated but **never persisted or consumed** on verify. Within the 10-minute window the same token authorises unlimited distinct refunds/payouts for that actor+site. `step_up_challenges` rows are written but not marked consumed on use.

**Enforcement coverage:**
- `refund.approve` — `routes/payments.ts:497–507` ✔
- `payout.release` — `routes/payouts.ts:576–586` ✔
- `POST /orders/:id/refund/complete` — **none** (`routes/orders.ts:1341–1400`) ✘
- `POST /returns/:id/refund/complete` — **none** (`routes/returns.ts:259–292`) ✘
- `POST /orders/:id/refund` (create) — **none** (`routes/orders.ts:1427`) ✘
- `POST /settlements/ingest` (writes the ledger) — **none** (`routes/settlements.ts:319`) ✘
- `POST /payouts` (creates the payable statement) — **none** (`routes/payouts.ts:412`) ✘

---

## 8. Ledger model correctness (accounting)

Postings actually implemented:

| Event | Lines | Source |
|---|---|---|
| Capture | Dr `pa_clearing` / Cr `merchant_payable` (full order total) | `migrations/168:243–256` |
| V1 payment capture (session route) | Dr `pa_clearing` / Cr `merchant_payable` (fee 0, gst 0) | `packages/payments/src/index.ts:446–497`; `routes/payments.ts:294–314` |
| Refund | Dr `merchant_payable` / Cr `refund_clearing` | `migrations/168:406–419`; `packages/payments/src/index.ts:499–526` |
| COD remittance | Dr `cod_receivable` / Cr `merchant_payable` | `migrations/165:359–380` |
| PA settlement ingest | Dr `pa_clearing` / Cr `merchant_payable` (+ `platform_revenue`, `gst_payable`, `reserve` when > 0) | `packages/billing-core/src/index.ts:585–621` |
| Payout fee assessment | Dr `merchant_payable` / Cr `platform_revenue` (+ `gst_payable`) — **skipped entirely when fee = 0** | `routes/payouts.ts:256–289, 509` |
| Payout release | Dr `merchant_payable` / Cr `pa_clearing` | `packages/billing-core/src/index.ts:658–681` |

**Defect 1 — settlement re-recognises money instead of relieving it.** Capture already credited `merchant_payable` and debited `pa_clearing`. The PA settlement (the event where the aggregator actually pays out) posts the **same direction again**. Only payout release reverses it, once. Net after capture → settlement → payout of the same rupee: `merchant_payable` retains a permanent `+gross` residue and `pa_clearing` a permanent `−gross`. Total debits still equal credits (so I1 double-entry passes), but per-account balances are wrong.

**Defect 2 — the repo's own conservation invariant encodes the *other* model.** `scripts/money-certification/invariants/i4-merchant-conservation.sql:22–56` asserts
`merchant_payable == Σcapture-credits − Σrefund-debits − Σpayout-debits`, with **no `settlement` term**. Any site with a settlement ingest fails I4. This is the repo contradicting itself about what the ledger means.

**Defect 3 — COD receivable never recognised at confirm** (§2.3), so `cod_receivable` only ever accumulates debits.

**Defect 4 — no reversal path is exercised.** `buildReversalLedgerPosting` (`packages/payments/src/index.ts:528–541`) and `ledger_transactions.reversal_of` (`139:114`) exist but have **zero production callers** (`grep -rn "buildReversalLedgerPosting" services apps` → tests only). Corrections cannot currently be posted.

---

## 9. RLS / tenancy on money tables

| Table | ENABLE | FORCE | Blanket `service_role USING(true)` policy still present? |
|---|---|---|---|
| `ledger_accounts/transactions/entries`, `compensation_actions`, `outbox_consumptions` | ✔ `139:396` | ✔ `139:397` | no — GUC policy only (`139:399–403`) |
| `payout_statements`, `wallet_ledger_entries`, `commission_schedules`, `commission_reconciliation_entries`, `settlements`, `reserves`, `payouts`, `payout_items`, `recon_breaks` | ✔ `151:271` | ✔ `151:272` | **dropped** at `151:273–275` — clean |
| `payment_credentials`, `payment_tokens`, `payments`, `payment_attempts`, `payment_transactions` | ✔ `142:181–188` | ✔ | GUC policies (`142:190–222`) |
| `cod_reconciliation_entries` | ✔ `140:82` | via the generic loop `164:64` | **YES — `FOR ALL TO service_role USING(true) WITH CHECK(true)` at `140:84–88` was never dropped** |
| `money_ledger_site_reconciliations` | ✔ `160:70` | via `164:64` | **YES — `160:72–76`** |

`migrations/164_d4_tenant_role_guc.sql:33–75` adds ENABLE+FORCE and an `app_tenant` GUC policy to every table with `site_id`/`store_id`, and creates a `NOBYPASSRLS` `app_tenant` role — the correct target design.

**But the gateway still connects as `service_role`**: `services/api-gateway/src/lib/supabase.ts:13–19` (`createSupabaseServiceClient`, comment: *"service role — bypasses RLS"*), wrapped in an application-level `createTenantGuardedSupabaseClient`. Combined with the two surviving blanket `service_role USING(true)` policies on money tables, DB-layer tenancy is **not load-bearing** for money reads/writes. (Primary ownership: agents B/C — recorded here because it is a money-table exposure.)

---

## 10. Merchant-visible surfaces, exports, operator dependencies

| Surface | Path | Status |
|---|---|---|
| Payments settings (connect Razorpay) | `apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx` | `UI_ONLY` — writes a credential that is never used |
| ProviderModeBadge on payments/orders/shipping/billing | `page.tsx:365`, `orders/page.tsx:784`, `settings/shipping/page.tsx:459`, `components/billing/BillingPaymentMethods.tsx:166` | present |
| **ProviderModeBadge on Payouts** | `apps/merchant-control-plane/src/app/[store]/payouts/page.tsx` — **absent** (grep for `ProviderModeBadge`/`provider_mode` → 0 hits) | **UI-R6 / PAY-R10 gap** |
| Payouts list + release | `[store]/payouts/page.tsx:60–121` | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` |
| **Create payout statement** | no UI anywhere; `POST /payouts` reachable only via the typed client (`api-client:4974`) | `BACKEND_ONLY` |
| **Settlement ingest** | no merchant UI, **no typed API-client method** (`api-client` has `wallet`, `commission`, `cod`, `payouts` groups but **no `settlements`**) | `BACKEND_ONLY` |
| Wallet / earnings | `routes/wallet.ts:147–186` — 409 `LEDGER_RECONCILIATION_REQUIRED` unless `money_ledger_site_reconciliations.status='verified'` **and** `variance_minor = 0` (`:163–176`) | fail-closed and honest, but see G-G-08 |
| Mobile merchant money screen | `apps/mobile/merchant-app/lib/screens/money/money_screen.dart:615` (has `ProviderModeBadge`) | present |
| Operator money-reconciliation console | `services/api-gateway/src/routes/internal-console/money-reconciliation.ts:183–270`; UI `apps/platform-console/src/app/(dashboard)/money-reconciliation/page.tsx` | dual-control + reason + audit + **no auto-plug** (`:240–262`) — PAY-R9 upheld |
| Operator dual-control weakness | `actor_id` and `secondary_approver_id` come from the **request body** (`money-reconciliation.ts:202–206`), not from an authenticated identity. Perimeter is IP-allowlist + internal credential (`middleware/internal-perimeter.ts:81–110`). | control is asserted, not proven |
| Money export | no payout/settlement/ledger CSV export found in `routes/export.ts` | `NOT_IMPLEMENTED` |
| Disputes / chargebacks | `chargeback_events` table exists (`migrations/124_internal_os_risk_detection.sql:212–235`) for internal risk scoring only; `payout_disputes` is app-marketplace developer scope. No merchant dispute surface, no Razorpay dispute webhook. | `NOT_IMPLEMENTED` |

---

## 11. Tests and certification tooling

- `services/api-gateway/src/__tests__/payments.test.ts`, `money.test.ts`, `money-d5-ledger.test.ts`, `settlements.test.ts`, `payout-provider-client.test.ts` are **source-text regex assertions** (`readFileSync` + `assert.match`, e.g. `payments.test.ts:11–17, 25–32, 53–70`). They prove a string exists; they do **not** execute the money path. Refactor-brittle and behaviourally empty.
- `tests/executable/*.mjs` (money-ledger, settlement, payment, foundation-wave1) are **real Postgres tests** but require a Docker container (`tests/executable/money-ledger-postgres.test.mjs:9` `LETBUYY_EXECUTABLE_PG_CONTAINER`) → `BLOCKED_EXTERNAL` in this environment; not executed.
- `scripts/money-certification/` — 8 SQL invariants + 12 scenarios, needs `STAGING_DB_URL` → `BLOCKED_EXTERNAL`. Static defects found by reading:
  - `i5-zero-rake.sql:35–41` queries `payment_credentials.commission_bps` — **column does not exist** (`migrations/142:7–23`) → the check errors.
  - `i8-cod-symmetry.sql:47–60` queries `cod_reconciliation_entries.amount`, `status = 'remitted'`, and `metadata->'canonical_ledger_transaction_id'` — **the column is `expected/collected/deposited_amount_minor`**, `'remitted'` is not in the status CHECK (`migrations/140:43–51`), and `canonical_ledger_transaction_id` is a **column**, not a metadata key (`migrations/165:6`) → the check errors.
  - `i7-single-writer.sql:29–36` expects **0** `wallet_ledger_entries` with `canonical_ledger_transaction_id IS NULL` after 2026-01-01 — `routes/payouts.ts:484` and `routes/settlements.ts:243` insert exactly such rows → I7 fails by construction.
  - `i4-merchant-conservation.sql` — see §8 Defect 2.

**No runtime observation of any money path was performed. Nothing in this domain is `VERIFIED_E2E`.**

---

## 12. GAPS

Severity: P0 = blocks launch / money-loss or money-misrouting class · P1 = must fix before real merchants · P2 = fix before scale · P3 = hygiene.

---

### G-G-01 — AGENTS.md PAY-R2 is stale: `confirm_order_payment_with_ledger` DOES post the canonical ledger
- **Domain:** governance / payments
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Impact:** the supreme operating rulebook mis-describes the single most important money RPC. Agents and engineers acting on PAY-R2 would "fix" a non-problem or distrust correct code.
- **Evidence:** `AGENTS.md:246` ("the legacy `confirm_order_payment_with_ledger` posts **zero** ledger entries despite its name") vs `database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql:237–267` (posts Dr `pa_clearing` / Cr `merchant_payable`) and the enforcing ratchet `scripts/validators/canonical-ledger-only-validator.mjs:139–146`.
- **Expected:** AGENTS.md reflects the post-`168` reality.
- **Root cause:** documentation not updated after migration 168.
- **Blast radius:** every agent/engineer reading PAY-R2.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** HIGH · **Deps:** none
- **Remediation approach:** amend `AGENTS.md` PAY-R2 to state that migration 168 made the RPC a real ledgering path, and re-point the "legacy, posts zero" language at the baseline definition `migrations/000_baseline.sql:1590`.
- **Acceptance:** PAY-R2 text cites `168` and the baseline separately; `node scripts/validate-governance.mjs` green.
- **Tests:** governance doc-drift validator assertion.
- **Owner:** ARB / lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-02 — Merchant-owned Razorpay (BYOG) is UI + storage only; all money-in uses ONE platform Razorpay account
- **Domain:** payments / never-custody
- **Status:** `STUB_OR_MOCK` (credential path) + `CONTRADICTORY_EVIDENCE` (vs ART-11)
- **Impact:** buyers pay into **LetBuyy's** Razorpay account for every store. LetBuyy becomes merchant-of-record and custodian of buyer funds — the exact regulatory posture ART-11 says is existential. Merchants believe their own account is connected ("Seller Razorpay account", "Razorpay connected"). Settlement of buyer money to merchants would require LetBuyy to disburse, which is the DEAD self-custody model.
- **Evidence (money-in uses platform env):** `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:464, 505–508, 544` and `:584, 635–638`; `services/api-gateway/src/routes/payments.ts:1062, 1091, 1125`, `:1162, 1194`, `:533–536`; Cashfree `checkout-payment-routes.ts:214–225`.
- **Evidence (merchant secret never read):** `services/api-gateway/src/lib/store-payment-config.ts:32–47` (`importKey(..., ['encrypt'])` only, no decrypt fn in the file); `routes/stores.ts:412–438` (only writer); repo-wide search for `key_secret_ciphertext` returns only write/mask/existence sites.
- **Evidence (second dead store):** `migrations/142:7–23` `payment_credentials.encrypted_credentials` — only reader is `lib/payment-route-support.ts:96–108` (`select('id')`); **no writer exists**.
- **Evidence (product acknowledges shared account):** `lib/store-payment-config.ts:57` `mode: settings?.mode || 'shared'`; UI label `apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx:468` "Shared LetBuyy account".
- **Expected:** per-site Razorpay credentials decrypted server-side at request time and used for order create / verify / refund; webhook verification per-account; never-custody preserved.
- **Missing links:** decrypt function · per-site credential resolver in the storefront payment routes · per-account webhook secret + routing · credential rotation/disconnect · merchant onboarding to their own Razorpay.
- **Blast radius:** every order, every merchant, every refund, all settlement/payout semantics, RBI/PA-licensing posture, the 0 %-fee thesis.
- **Invariant tag:** [HIGH-STAKES] [IRREVERSIBLE]
- **Severity:** **P0** · **Likelihood:** HIGH (it is the current shipped behaviour) · **Deps:** G-G-03, G-G-04, G-G-11
- **Remediation approach (design, not code):** ARB decision on the money-in model first — (a) true BYOG: add a server-side decrypt of the per-site secret behind a KMS-backed key, resolve credentials by `site_id` in every provider call, move to per-merchant webhook endpoints/secrets, and drop the platform fallback; or (b) explicitly adopt the platform-collect + Route-split model and rewrite ART-11 with payments counsel. **Do not** ship (b) implicitly by leaving the code as-is.
- **Acceptance:** for a given `site_id`, the Razorpay order-create request carries that site's key id (provable in provider logs); no code path reads `RAZORPAY_KEY_SECRET` for shopper money-in; a validator forbids platform-env Razorpay credentials in storefront payment routes.
- **Tests:** integration test asserting per-site credential selection; validator forbidding `c.env.RAZORPAY_KEY_*` in `routes/storefront/**`; sandbox provider smoke per merchant.
- **Owner:** founder + payments counsel + ARB + payments-provider
- **Reversible:** design choice reversible; **funds already collected into the platform account are not**
- **Confidence:** HIGH

---

### G-G-03 — All merchant payouts transfer to a single `RAZORPAY_ROUTE_ACCOUNT_ID`; no per-merchant linked account exists
- **Domain:** payouts / settlements
- **Status:** `BROKEN` (latent — gated off)
- **Impact:** if `RAZORPAY_ROUTE_PROVIDER_ENABLED=true` were set, every merchant's payout would be transferred to one linked account. Money to the wrong beneficiary is irreversible.
- **Evidence:** `services/api-gateway/src/routes/payouts.ts:596–603` (`accountId: c.env.RAZORPAY_ROUTE_ACCOUNT_ID`); `packages/infrastructure/payout-transfer-adapter/index.ts:180–199` (`account: accountId` in the `POST /v1/transfers` body); schema search shows **no** `linked_account_id` / `beneficiary` / `bank_account` / `ifsc` column in `database/supabase/migrations/**`.
- **Expected:** each site has a verified Route linked-account id (or equivalent beneficiary), stored, KYC-gated, and used for that site's transfers.
- **Missing links:** per-site linked-account column · onboarding flow to create the Route linked account · KYC → linked-account binding · pre-transfer beneficiary assertion.
- **Blast radius:** every payout, every merchant, irreversible fund movement.
- **Invariant tag:** [HIGH-STAKES] [IRREVERSIBLE]
- **Severity:** **P0** · **Likelihood:** HIGH if enabled · **Deps:** G-G-02, KYC live provider
- **Remediation approach:** add a per-site linked-account record with a verified state; make `initiateTransfer` **fail closed** when the site has no verified linked account; keep `RAZORPAY_ROUTE_PROVIDER_ENABLED` off until that assertion exists.
- **Acceptance:** a payout for site A cannot be initiated without site A's own verified linked-account id; attempting it returns a typed error; a unit test proves the env fallback is gone.
- **Tests:** adapter unit test (no site linked account → throw); integration test on two sites.
- **Owner:** founder + payments-provider + lead engineer · **Reversible:** no (once money moves) · **Confidence:** HIGH

---

### G-G-04 — `complete_order_refund` locates the refund by primary key with no tenant predicate; two gateway routes pass a caller-supplied `refund_id`
- **Domain:** refunds / tenancy
- **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED` (defect is unambiguous in source; exploitability needs runtime proof)
- **Impact:** an authenticated merchant of site A can submit a refund id belonging to site B. The RPC will mark B's refund succeeded, post a refund ledger transaction against B, flip B's order to `refunded`, and emit `refund.succeeded`. The TS-side site check runs **after** the RPC and does not roll it back.
- **Evidence:**
  - `database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql:340–345` — `SELECT * INTO v_refund FROM refunds WHERE id = p_refund_id AND deleted_at IS NULL FOR UPDATE;` (no `site_id`).
  - `services/api-gateway/src/routes/returns.ts:274–286` — `refundId = body.refund_id || existing.refunds[0].id` then `db.rpc('complete_order_refund', { p_refund_id: refundId, ... })`. `loadOwnedReturn` (`:103–128`) validates the **return**, never the refund.
  - `services/api-gateway/src/routes/orders.ts:1364` → `service.completeRefund(orderId, tenant, body)`; `services/api-gateway/src/execution/order-execution.adapter.ts:504–523` — the ownership check `if (order?.store_id && order.store_id !== tenant.siteId) throw ForbiddenError` is at `:519–521`, **after** `db.rpc(...)` at `:505`.
  - Schema allows it: `CompleteRefundSchema` (`packages/checkout-core/src/index.ts:443–448`) takes any UUID.
- **Expected:** the refund must be resolved with `site_id = <caller's site>` (and `order_id = :id`) inside the RPC, before any mutation.
- **Missing link/root cause:** the RPC never received a site parameter; the TS guard is post-hoc.
- **Blast radius:** every tenant's refunds, orders, and canonical ledger.
- **Invariant tag:** [HIGH-STAKES] [IRREVERSIBLE] (ledger entries cannot be deleted, only reversed — and no reversal path is wired, see G-G-13)
- **Severity:** **P0** · **Likelihood:** MEDIUM (needs a valid foreign refund UUID) · **Deps:** none
- **Remediation approach:** add a `p_site_id` parameter to `complete_order_refund` and scope the `SELECT` (and the order lookup) by it, raising on mismatch **before** any UPDATE or ledger post; pass the resolved tenant site from both routes; keep the TS check as defence in depth.
- **Acceptance:** calling the RPC with a refund id from another site raises and mutates nothing (verified by a Postgres test that asserts row counts and ledger counts unchanged).
- **Tests:** `tests/executable` Postgres test for cross-tenant refund rejection; gateway contract test for both routes.
- **Owner:** security + lead engineer · **Reversible:** no (ledger append-only) · **Confidence:** HIGH

---

### G-G-05 — Refund completion has no step-up on two of three routes (and refund creation has none)
- **Domain:** refunds / security
- **Status:** `PARTIAL`
- **Impact:** PAY-R7 / ART-11 require a second factor on refund. A compromised merchant session (or a staff account with `orders:write`) can complete refunds and post refund ledger entries with **no** second factor via `/orders/:id/refund/complete` or `/returns/:id/refund/complete`.
- **Evidence:** step-up present only at `services/api-gateway/src/routes/payments.ts:497–507`. Absent at `services/api-gateway/src/routes/orders.ts:1341–1400`, `services/api-gateway/src/routes/returns.ts:259–292`, `services/api-gateway/src/routes/orders.ts:1427–1460`.
- **Expected:** every route that transitions a refund to succeeded (or creates one) requires `verifySensitiveActionStepUp({action:'refund.approve'})`.
- **Missing link:** the control was added to the newest route only.
- **Blast radius:** all refunds, canonical ledger, merchant funds.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** **P0** · **Likelihood:** HIGH · **Deps:** G-G-06
- **Remediation approach:** apply the existing `verifySensitiveActionStepUp` guard uniformly; consider centralising it as middleware keyed by route so new refund routes cannot skip it.
- **Acceptance:** all four routes return 428 `STEP_UP_REQUIRED` without a valid proof; a validator enumerates refund/payout routes and asserts the guard is present.
- **Tests:** contract tests per route; a source-level route-coverage validator.
- **Owner:** security + lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-06 — Step-up tokens are replayable inside their 10-minute window (`jti` never consumed)
- **Domain:** security / refunds / payouts
- **Status:** `PARTIAL`
- **Impact:** one TOTP-backed proof authorises unlimited refunds or payout releases for that actor+site for 10 minutes. The second factor degrades from per-action to per-session.
- **Evidence:** `services/api-gateway/src/lib/security-controls.ts:40` (`jti` in payload), `:126–163` (issued), `:192–227` (verified — `jti` never checked against storage); `routes/security.ts:183–232` writes `step_up_challenges` but nothing marks a challenge consumed at verify time.
- **Expected:** single-use proof — `jti`/`challenge_id` recorded on first successful use and rejected thereafter.
- **Missing link:** no consume/burn step on the verify path.
- **Blast radius:** refunds, payouts, DSR export/erase (`SensitiveSecurityAction` at `:1`).
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** MEDIUM · **Deps:** none
- **Remediation approach:** bind each proof to a single action instance (include the target resource id in the signed payload) **and** burn the `jti` in `step_up_challenges` on first successful verification.
- **Acceptance:** re-presenting the same token for a second refund returns 428/403.
- **Tests:** contract test replaying a token; unit test on burn.
- **Owner:** security · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-07 — Canonical ledger double-recognises merchant money: settlement posts the same direction as capture
- **Domain:** ledger / accounting
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Impact:** after capture → PA settlement → payout release of the same rupee, `merchant_payable` retains a permanent `+gross` residue and `pa_clearing` a permanent `−gross`. Merchant balance, payout sufficiency checks, and reconciliation all read a wrong number. The repo's own conservation invariant encodes the opposite model.
- **Evidence:**
  - capture: `migrations/168:243–256` Dr `pa_clearing` / Cr `merchant_payable`
  - settlement ingest: `packages/billing-core/src/index.ts:584–600` — `sourceAccount = 'pa_clearing'`, side `debit`; `merchant_payable` side `credit` (`:594–600`)
  - payout release: `packages/billing-core/src/index.ts:668–680` Dr `merchant_payable` / Cr `pa_clearing`
  - invariant contradicting the above: `scripts/money-certification/invariants/i4-merchant-conservation.sql:22–56` (no `settlement` term)
  - dependent consumers: `claim_payout_statement_release` sufficiency check (`migrations/160:398–404`), `refresh_money_ledger_site_reconciliation` (`migrations/160:224`)
- **Expected:** a documented chart of accounts and posting matrix where each rupee is recognised once and relieved once; PA settlement should **relieve** `pa_clearing` against `merchant_payable`, not re-credit it.
- **Missing link/root cause:** two independently-authored money pipelines (capture path and settlement path) with no agreed posting matrix.
- **Blast radius:** every merchant balance, every payout decision, all reconciliation, all financial reporting, GST on platform fee.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** **P0** · **Likelihood:** HIGH · **Deps:** G-G-08, G-G-09
- **Remediation approach:** produce a written posting matrix reviewed by a CA (capture, settlement, payout, refund, COD, fee, GST, reserve, reversal), then align the SQL/TS builders and `i4` to it. Correct any already-posted rows with **reversing entries only** — never a mutation, never a direct money-table write.
- **Acceptance:** for a synthetic full lifecycle (capture ₹X → settle ₹X → release ₹X), `ledger_account_balance_minor(site,'merchant_payable') = 0` and `pa_clearing = 0`; `i4` passes.
- **Tests:** Postgres lifecycle test asserting per-account balances return to zero; `i4`/`i3` green.
- **Owner:** CA-tax / finance + founder + ARB · **Reversible:** entries are append-only; corrections are reversing entries · **Confidence:** HIGH (arithmetic is deterministic from the two builders)

---

### G-G-08 — Merchant wallet/earnings is unreachable in practice (fail-closed on a reconciliation that cannot converge)
- **Domain:** merchant UX / money reporting
- **Status:** `BROKEN`
- **Impact:** merchants cannot see their balance. `GET /v1/wallet` returns 409 unless `money_ledger_site_reconciliations.status='verified'` and `variance_minor = 0`, but the reconciliation compares a canonical `merchant_payable` (credited by captures, settlements, COD) against a wallet projection that only counts **posted** `cod_remittance_credit` and `payout_debit` rows. Once any online capture exists the two cannot match.
- **Evidence:** `services/api-gateway/src/routes/wallet.ts:163–176` (409 gate); `database/supabase/migrations/160_foundation_money_ledger_authority.sql:212–225` (wallet side counts only `status='posted'` rows); `routes/payouts.ts:484–500` inserts the payout credit with `status: 'pending'` (excluded); captures never create a wallet row at all.
- **Expected:** the merchant sees a derived balance; reconciliation compares like with like.
- **Missing link:** no wallet projection is written on capture; the reconciliation contract compares two different quantities.
- **Blast radius:** merchant trust, mobile money screen, dashboard, payout decisions.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** HIGH · **Deps:** G-G-07
- **Remediation approach:** decide (ARB) whether `wallet_ledger_entries` remains a projection at all; if yes, define the projection rule so it is derivable from the canonical ledger and have the reconciliation compare that derivation. Consider serving the merchant balance directly from `ledger_account_balance_minor` and demoting the wallet table to display history.
- **Acceptance:** after a capture, `GET /wallet` returns 200 with `available_minor` equal to the derived `merchant_payable`.
- **Tests:** Postgres + gateway integration test across capture/refund/payout.
- **Owner:** founder + lead engineer + CA-tax · **Reversible:** yes · **Confidence:** MEDIUM-HIGH (requires runtime confirmation of the 409 in a live DB)

---

### G-G-09 — Two independent payout pipelines can pay the same orders twice
- **Domain:** payouts / settlements
- **Status:** `BROKEN` (latent — provider gated off)
- **Impact:** `POST /payouts` builds a statement from `orders.payment_status='paid'` and dedupes only against `payout_statements.metadata.source_order_ids`. `POST /settlements/ingest` builds a **second** `payout_statements` row for the same money with **no** `source_order_ids`, so it is invisible to that dedupe. Both statements are independently releasable.
- **Evidence:** `services/api-gateway/src/routes/payouts.ts:335–354` (dedupe reads only `metadata.source_order_ids`), `:427–430` (eligibility); `services/api-gateway/src/routes/settlements.ts:212–241` (second statement, `metadata` has `source_settlement_id`, no `source_order_ids`), `:428–453` (parallel `payouts` instruction row).
- **Expected:** exactly one payable-statement authority per rupee, with a single idempotent source registry.
- **Missing link:** no shared "already-paid-out" ledger of source orders across both pipelines.
- **Blast radius:** merchant over-payment, `merchant_payable` drawdown, provider transfers.
- **Invariant tag:** [HIGH-STAKES] [IRREVERSIBLE]
- **Severity:** **P0** · **Likelihood:** MEDIUM · **Deps:** G-G-07
- **Remediation approach:** ARB decision on one canonical payout authority (recommend: PA statement is the only source of truth, `POST /payouts` becomes read-only or is removed); if both must remain, introduce a settled-source table with a unique constraint per `(site_id, source_order_id)` enforced in SQL.
- **Acceptance:** a source order can appear in at most one releasable statement, enforced by a DB unique constraint (not application logic).
- **Tests:** Postgres test attempting to include the same order in both pipelines.
- **Owner:** founder + finance/CA + ARB · **Reversible:** no once released · **Confidence:** HIGH

---

### G-G-10 — `POST /settlements/ingest` lets a merchant write arbitrary amounts into the canonical ledger
- **Domain:** settlements / ledger integrity
- **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED`
- **Impact:** a merchant-authenticated request supplies `gross_amount_minor`, `platform_fee_minor`, `gst_minor`, `net_amount_minor`, `reserve_minor` and the gateway posts them to the append-only canonical ledger and creates a payable statement + payout instruction. There is no provider feed, no signature, no statement fetch, no step-up, no operator approval.
- **Evidence:** `packages/billing-core/src/index.ts:138–152` (schema: amounts are plain request fields); `services/api-gateway/src/routes/settlements.ts:319–329` (auth = `resolveTenantContextForOwnedSite` only), `:344` (`planSettlementLedgerPosting(body)`), `:375–389` (posts to the canonical ledger), `:420–474` (creates payout statement + instruction).
- **Expected:** settlement data originates from a verified PA statement (API fetch or signed webhook), reconciled against captures; merchant-declared settlements are, at most, an operator-reviewed suspense entry.
- **Missing link:** no PA statement ingestion adapter; no provider-side verification; no operator/maker-checker gate.
- **Blast radius:** canonical ledger truth, `merchant_payable`, payout eligibility.
- **Invariant tag:** [HIGH-STAKES] [IRREVERSIBLE]
- **Severity:** **P0** · **Likelihood:** MEDIUM · **Deps:** G-G-07, G-G-09
- **Remediation approach:** make settlement ingest an **internal/operator or provider-webhook-only** path; add provider statement verification; if a merchant-facing endpoint remains, it must create only a `recon_breaks`/suspense record, never a ledger posting.
- **Acceptance:** a merchant token cannot cause a `settlement` ledger transaction; ingest requires provider evidence (statement id fetched from the PA) or an internal credential.
- **Tests:** contract test asserting merchant auth is rejected; adapter test for statement verification.
- **Owner:** ARB + finance + payments-provider · **Reversible:** entries append-only · **Confidence:** HIGH

---

### G-G-11 — Payment verification never proves the money was captured or how much
- **Domain:** payments / checkout
- **Status:** `PARTIAL`
- **Impact:** the Razorpay HMAC proves only `order_id|payment_id`. The storefront and merchant verify routes mark the order paid and post a full-order-total capture to the ledger without asking Razorpay whether the payment is `captured` and for what amount. Authorized-but-uncaptured, or amount-mismatched, payments are recorded as revenue.
- **Evidence:** the adapter's own warning at `packages/infrastructure/razorpay-adapter/index.ts:119–125`; `fetchRazorpayPayment` (`:127–147`) is called **only** at `services/api-gateway/src/routes/payments.ts:970` (subscriptions); the order paths `routes/storefront/checkout-payment-routes.ts:639–672` and `routes/payments.ts:1206–1237` do not call it; ledger amount comes from `orders.total` (`migrations/168:179`), never from the provider.
- **Expected:** server-side `GET /v1/payments/:id` confirming `status='captured'`, `amount >= expected`, and `order_id` binding **before** confirming the order — the pattern already implemented for subscriptions at `payments.ts:962–987`.
- **Missing link:** the subscription-path guard was never back-ported to the order path.
- **Blast radius:** every order, `payment_transactions`, canonical ledger, merchant revenue reporting.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** MEDIUM · **Deps:** G-G-02 (per-site credentials needed to make the fetch tenant-correct)
- **Remediation approach:** reuse the existing subscription-path capture check in both order verify routes; record the **provider** amount as the ledger capture amount.
- **Acceptance:** a signature for an authorized-not-captured payment is rejected; a capture ledger entry equals the provider's captured amount.
- **Tests:** adapter-stubbed integration test for authorized/partial/captured cases.
- **Owner:** lead engineer + security · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-12 — Public hosted-checkout confirm posts a capture ledger entry from an unverified `provider_payment_id`
- **Domain:** checkout / payments
- **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED`
- **Impact:** `POST /v1/checkout/:cartId/confirm` is mounted **before** the auth middleware (public), gated only by an HMAC cart handoff the storefront issues to the shopper. It requires only that `provider_payment_id` be a non-empty string, then calls `confirm_order_payment_with_ledger`, creating a paid order and a canonical capture posting. No signature check, no provider fetch, no replay guard.
- **Evidence:** mount order — `services/api-gateway/src/index.ts:724` (`api.route('/checkout', checkoutRouter)`) vs `:750` (`api.use('/*', authMiddleware)`); route `services/api-gateway/src/routes/checkout.ts:598`; presence-only check `:638–649`; confirm `:685–697`; ledger-proof read-back `:700–712`. `assertProviderPaymentNotReplayed` is **not** called here. A test hook `body.simulate_order_failure` is live in the same route (`:653`).
- **Mitigating evidence:** the earlier `payment-intent` step refuses `mode === 'live'` (`:571–577`), so in production the intent is sandbox — but `confirm` does not re-check the session's mode, and a sandbox capture is written to the **same** canonical ledger with no `provider_mode` marker.
- **Expected:** confirm must verify provider proof (signature + capture fetch) and must refuse to post a capture for a sandbox intent, or must mark the posting as sandbox.
- **Missing link:** signature/capture verification on the hosted-checkout confirm; mode propagation into the ledger.
- **Blast radius:** canonical ledger integrity; potentially free orders if the hosted checkout is ever enabled for live.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 (raise to P0 if hosted checkout is enabled for live) · **Likelihood:** MEDIUM · **Deps:** G-G-11
- **Remediation approach:** require the same verification the storefront route uses; refuse ledger postings when the payment intent mode is not `live`; remove `simulate_order_failure` from the production route or gate it behind a non-production flag.
- **Acceptance:** confirm with a fabricated `provider_payment_id` returns 400 and writes no ledger row.
- **Tests:** contract test with a fabricated provider id; validator forbidding `simulate_*` hooks in public routes.
- **Owner:** security + lead engineer · **Reversible:** yes · **Confidence:** MEDIUM-HIGH (mount order and route body are certain; live reachability needs runtime proof)

---

### G-G-13 — No reversal path is wired; the canonical ledger cannot be corrected
- **Domain:** ledger
- **Status:** `NOT_IMPLEMENTED`
- **Impact:** the ledger is append-only by trigger **and** REVOKE (correct), corrections must be reversing entries — but nothing in production can create one. Any bad posting (from G-G-04, G-G-07, G-G-10, G-G-12) is permanently unfixable through supported means.
- **Evidence:** `packages/payments/src/index.ts:528–541` `buildReversalLedgerPosting` — zero production callers (`grep -rn "buildReversalLedgerPosting" services apps` → tests only); `ledger_transactions.reversal_of` column exists (`migrations/139:114`) and is never written by any RPC or route; `source_type` CHECK includes `'reversal'` (`139:103–110`) with no writer.
- **Expected:** an operator-only, dual-control, audited reversal endpoint that posts a `reversal` transaction linked via `reversal_of`.
- **Missing link:** reversal route + RPC + console UI.
- **Blast radius:** all money-correction capability.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** HIGH · **Deps:** G-G-07
- **Remediation approach:** add an internal-console reversal path with segregation of duty, reason capture, audit, and `reversal_of` linkage; never allow a mutation or a direct money-table write as the correction mechanism.
- **Acceptance:** an operator can reverse a named transaction; the original rows are untouched; balances net correctly; the action is audited.
- **Tests:** Postgres test on reversal balance behaviour; console contract test on dual control.
- **Owner:** finance + ARB + lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-14 — int32 money columns are still the written columns; COD amounts are silently truncated
- **Domain:** money representation (R-8)
- **Status:** `PARTIAL` / `BROKEN` for the COD clamp
- **Impact:** `payout_statements`, `wallet_ledger_entries`, `cod_reconciliation_entries`, `commission_reconciliation_entries` store money as `integer`. Above ₹2,14,74,836.47 a payout statement insert overflows; COD amounts are **silently capped** instead of failing.
- **Evidence:** `migrations/119_mobile_money_ledgers.sql:16–19, 51, 106–113`; `migrations/140_mobile_cod_reconciliation.sql:26–29`; writers `routes/payouts.ts:461–464, 491, 681`, `routes/settlements.ts:222–225, 250`, `routes/commission.ts:316, 344`; **silent clamp** `migrations/165_d5_canonical_money_paths.sql:335–339` (`LEAST(x, 2147483647)::integer`, `GREATEST(LEAST(...), -2147483648)::integer`). Shadow `_bigint` columns exist (`160:26–40`, `165:6–10`) but are populated by trigger *after* the int4 write.
- **Expected:** bigint minor units on every money path (R-8); no silent capping — ever.
- **Missing link:** the expand/contract cutover (Wave 5) never contracted; the clamp was added as an expedient.
- **Blast radius:** high-GMV merchants, COD reconciliation accuracy, payout amounts.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** LOW today, HIGH at scale · **Deps:** none
- **Remediation approach:** complete the expand/contract: switch all writers to the `_bigint` columns, backfill, then drop the int4 columns in a paired forward/rollback migration. Replace every `LEAST(..., 2147483647)` clamp with an explicit `RAISE` until the contraction lands.
- **Acceptance:** no `integer` money column is written by any runtime; a validator rejects new int4 `*_minor` columns; the clamp expressions are gone.
- **Tests:** migration test writing > int4 max and asserting success; validator over migrations.
- **Owner:** lead engineer + database operator · **Reversible:** yes (expand/contract) · **Confidence:** HIGH

---

### G-G-15 — `canonical-ledger-only-validator` is file-level adjacency, so 19 direct money-table writes pass
- **Domain:** governance / money
- **Status:** `PARTIAL`
- **Impact:** the ratchet meant to enforce "money mutates only via `SECURITY DEFINER` RPCs" only checks that the **file** contains one of a set of canonical-ledger tokens. `routes/payouts.ts` and `routes/settlements.ts` mention `post_settlement_ledger_transaction`, so all of their direct `payout_statements` / `payouts` / `wallet_ledger_entries` / `settlements` / `recon_breaks` / `payout_items` writes pass unexamined.
- **Evidence:** `scripts/validators/canonical-ledger-only-validator.mjs:45–50` (regex) and `:130–136` (`mutationMatches.length > 0 && !canonicalLedgerEvidence.test(entry.text)`); the 19 real writers enumerated in §6 Audit A.
- **Expected:** per-mutation enforcement, or an explicit allowlist naming each permitted direct write with a governance seam.
- **Missing link:** the validator was written as a coarse ratchet.
- **Blast radius:** the entire money-write invariant.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** HIGH · **Deps:** none
- **Remediation approach:** tighten the validator to per-match adjacency (evidence within N lines of the mutation) and add an explicit, reviewed allowlist for the settlement/payout writes until they are moved into RPCs.
- **Acceptance:** adding a new `.from('payouts').insert()` in a file that already mentions the ledger fails the gate.
- **Tests:** validator self-test with a positive and a negative fixture.
- **Owner:** ARB + lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-16 — Provider-mode honesty is broken: the badge is derived from an unused credential; the ledger records no mode; Payouts has no badge
- **Domain:** UI honesty (PAY-R10 / UI-R6 / ANTI-R9)
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Impact:** the merchant is told "Razorpay connected · Verified · live/sandbox" based on a credential that is never used, while the actual mode is whatever the platform's `RAZORPAY_KEY_*` secret is. A sandbox capture and a live capture are indistinguishable in the canonical ledger. The Payouts page — a money surface — shows no mode badge at all.
- **Evidence:** `services/api-gateway/src/lib/store-payment-config.ts:72–79` (`paymentConfigProviderMode` derives from `razorpay.test_mode` + presence of the unused ciphertext); UI `apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx:262–268` ("The seller Razorpay account is connected and verified"), `:365` badge; ledger metadata without mode `migrations/168:257–265` (vs `routes/payments.ts:305–312` which *does* include `provider_mode`); `apps/merchant-control-plane/src/app/[store]/payouts/page.tsx` — no `ProviderModeBadge` import or usage.
- **Expected:** the badge reflects the credential actually used for that site's money; the canonical ledger records `provider_mode` on every posting; every money surface renders the badge.
- **Missing link:** mode is not propagated from the effective credential into either the UI or the ledger.
- **Blast radius:** merchant trust; sandbox/live money commingling in the ledger.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** HIGH · **Deps:** G-G-02
- **Remediation approach:** derive the badge from the credential actually used at request time; add `provider_mode` to every ledger posting's metadata (and consider a column + partial index) so sandbox rows can be excluded from financial reporting; add the badge to Payouts.
- **Acceptance:** a sandbox capture is queryable and excludable from `merchant_payable`; the Payouts page renders a truthful badge.
- **Tests:** UI test for badge presence; SQL test asserting `provider_mode` on every `payment_capture` posting.
- **Owner:** founder + lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-17 — Money-certification invariants I5, I7, I8 cannot pass against the shipped schema/code
- **Domain:** certification tooling
- **Status:** `BROKEN`
- **Impact:** the "money certification" gate that would catch G-G-07/G-G-09/G-G-14 is itself broken, so a green-looking certification run is not achievable and a failing one is uninformative.
- **Evidence:**
  - `scripts/money-certification/invariants/i5-zero-rake.sql:35–41` queries `public.payment_credentials.commission_bps` — column absent (`migrations/142:7–23`).
  - `…/i8-cod-symmetry.sql:47–60` queries `cod_reconciliation_entries.amount`, `status='remitted'`, `metadata->'canonical_ledger_transaction_id'` — none exist (`migrations/140:20–51`; `migrations/165:6`).
  - `…/i7-single-writer.sql:29–36` expects zero `wallet_ledger_entries` with a null canonical id — `routes/payouts.ts:484` and `routes/settlements.ts:243` create exactly those.
  - `…/i4-merchant-conservation.sql:22–56` omits the `settlement` term (see G-G-07).
  - Runner semantics: `scripts/money-certification/check-invariants.mjs:1–6` — pass requires exit 0 **and** zero rows; a SQL error is a hard fail.
- **Expected:** invariants that reflect the shipped schema and the agreed posting matrix.
- **Missing link:** the invariants were authored against an intended schema, never re-validated.
- **Blast radius:** every money-launch gate that depends on certification.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** HIGH · **Deps:** G-G-07
- **Remediation approach:** rewrite I4/I5/I7/I8 against the real schema after the posting matrix decision; add a self-test that runs each invariant against an empty schema to catch column drift.
- **Acceptance:** all 8 invariants execute without SQL error on a migrated database.
- **Tests:** CI step running the invariants against the ephemeral Postgres container used by `tests/executable`.
- **Owner:** finance + lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-18 — Merchant Orders-page refund is wired to the wrong identifier (`orders.payment_id` is a provider order id, not a `payments` UUID)
- **Domain:** refunds / merchant UX
- **Status:** `BROKEN`
- **Impact:** the merchant's primary refund action cannot reach the refund logic.
- **Evidence:** proxy `apps/merchant-control-plane/src/app/api/stores/[store]/orders/[orderId]/refund/route.ts:36, 51`; `orders.payment_id` is set to the provider order id by `attach_order_payment_reference` (`migrations/000_baseline.sql:384–386`) and compared against `razorpay_order_id` at `routes/payments.ts:1217`; the gateway looks the id up as a `payments.id` uuid (`lib/payment-route-support.ts:200–212`, column type `migrations/142:44`).
- **Expected:** the proxy resolves the `payments` row for the order (or the gateway exposes an order-scoped refund).
- **Missing link:** no order→`payments.id` resolution exists; the V1 `payments` session row is also not created by the storefront razorpay path at all.
- **Blast radius:** all merchant-initiated refunds from the web console.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** HIGH · **Deps:** G-G-05
- **Remediation approach:** decide the single canonical refund entry point (recommend an order-scoped gateway route that itself resolves the payment), then align the proxy and the typed client.
- **Acceptance:** the Orders-page refund completes end-to-end in a sandbox environment and produces one refund ledger transaction.
- **Tests:** e2e refund test through the app proxy.
- **Owner:** lead engineer · **Reversible:** yes · **Confidence:** MEDIUM-HIGH (needs runtime confirmation of the exact failure mode)

---

### G-G-19 — COD receivable is never recognised at order confirm; COD revenue never reaches a payout statement
- **Domain:** COD / ledger
- **Status:** `PARTIAL`
- **Impact:** PAY-R2 requires `cod_receivable` at confirm, relieved at remittance. Nothing posts at confirm; the remittance **debits** `cod_receivable`, so the account only accumulates. Separately, COD orders never get `payment_status='paid'`, so `POST /payouts` (which filters on that) excludes them entirely.
- **Evidence:** `services/api-gateway/src/routes/order-risk.ts:315–415` (COD confirm — no ledger call, no `payment_status`); `migrations/165:353–396` (remittance posts Dr `cod_receivable` / Cr `merchant_payable`); `routes/payouts.ts:360–366` (`.eq('payment_status','paid')`).
- **Expected:** confirm posts Dr `cod_receivable` / Cr `merchant_payable`; remittance relieves it against cash/`pa_clearing`; COD revenue is payable.
- **Missing link:** no confirm-time posting; no COD→paid transition.
- **Blast radius:** COD merchants (a large share of India commerce), COD reconciliation, payouts.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** HIGH · **Deps:** G-G-07
- **Remediation approach:** include COD in the posting matrix (G-G-07); post at confirm; relieve at remittance; decide the COD paid-state transition with finance.
- **Acceptance:** a COD lifecycle nets `cod_receivable` to zero and produces a payable balance.
- **Tests:** Postgres COD lifecycle test; `i8` rewritten and green.
- **Owner:** CA-tax + founder + lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-20 — Merchant-declared COD collection amount is unbounded; COD receivables are seeded by a GET
- **Domain:** COD
- **Status:** `PARTIAL`
- **Impact:** `collected_amount_minor` is taken from the request with no upper bound relative to the order (`routes/cod-reconciliation.ts:330, 336`), and the remittance then credits `merchant_payable` for the deposited amount (`migrations/165:353–380`), inflating the merchant balance. Separately, opening the COD list (`GET /cod/reconciliation`) inserts receivable rows for every COD order (`:203, 224`).
- **Evidence:** `services/api-gateway/src/routes/cod-reconciliation.ts:166–205, 304–353`; `migrations/165:319–331` (`status` becomes `'over'` when deposited > expected, still posts the full deposited amount).
- **Expected:** collection/deposit bounded by (or reconciled against) the order total, with overages routed to `recon_breaks`/suspense rather than straight into `merchant_payable`.
- **Missing link:** no server-side bound; no over-collection break.
- **Blast radius:** COD merchant balances and payouts.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P2 · **Likelihood:** MEDIUM · **Deps:** G-G-19
- **Remediation approach:** bound the collected/deposited amount server-side; route `'over'` to a signed `recon_breaks` entry instead of a `merchant_payable` credit; move receivable seeding to an explicit action or a worker, not a GET.
- **Acceptance:** an over-deposit creates a break, not a payable credit; a GET creates no money rows.
- **Tests:** contract test for over-deposit; test asserting GET is side-effect-free.
- **Owner:** finance + lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-21 — Webhook has no timestamp/replay window; tenant attribution is a global unscoped order lookup with unescaped PostgREST filter construction
- **Domain:** webhooks / tenancy
- **Status:** `PARTIAL`
- **Impact:** SEC-R5/PAY-R8 require a timestamp/replay window; the handler explicitly declines to enforce one and relies solely on stored event ids. Attribution to a tenant is a global `orders` lookup with no `site_id` predicate — which works only because a single Razorpay account exists, and becomes structurally impossible under BYOG. The `or=(...)` filter is built by string interpolation.
- **Evidence:** `services/webhook-service/src/index.ts:753–760` (age is logged, not rejected), `:332–352` (`findOrderByPaymentCandidates` — no tenant predicate, `payment_id.eq.${candidate}` interpolation), `:105–117` (event-id fallback), `:38, 724, 730` (single `RAZORPAY_WEBHOOK_SECRET`).
- **Expected:** a bounded acceptance window plus stored event id; tenant resolution from a verified, site-scoped binding; parameterised/escaped filters.
- **Missing link:** replay window; per-account webhook secret + routing (blocked on G-G-02).
- **Blast radius:** all inbound payment webhooks.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P2 (rises to P0 the moment BYOG lands) · **Likelihood:** MEDIUM · **Deps:** G-G-02
- **Remediation approach:** add a configurable acceptance window with an explicit, audited override path for provider retries; scope the order lookup by the site derived from the receiving endpoint/account; escape or parameterise filter values.
- **Acceptance:** an old signed event outside the window is rejected and recorded; a webhook for account A cannot resolve an order of site B.
- **Tests:** webhook contract tests for stale event and cross-tenant candidate.
- **Owner:** security + lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-22 — `no_custody: true` is hardcoded rather than derived from the rail (PAY-R4 literal violation)
- **Domain:** governance / settlements
- **Status:** `PARTIAL`
- **Evidence:** `services/api-gateway/src/routes/settlements.ts:233` (payout statement metadata), `:386` (settlement ledger metadata), `:444` (payout instruction metadata). PAY-R4 (`AGENTS.md:248`): *"MUST NOT stamp `no_custody:true` on a self-custody path — derive `no_custody` from the rail."*
- **Impact:** currently benign (the rail is `pa_split`), but the flag carries no evidentiary value and would lie if a non-split rail were ever used.
- **Severity:** P2 · **Likelihood:** LOW · **Invariant tag:** [HIGH-STAKES]
- **Remediation approach:** compute `no_custody` from `rail`/`provider` and add a validator forbidding the literal.
- **Owner:** lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-23 — `commission_bps` has no DB constraint pinning it to 0, and the fee + 18 % GST-on-fee arithmetic is live
- **Domain:** monetisation (R-9 / PAY-R3)
- **Status:** `PARTIAL`
- **Evidence:** `migrations/119_mobile_money_ledgers.sql:95, 125` (`CHECK (commission_bps >= 0 AND commission_bps <= 10000)`); `migrations/162_phase_a_commission_zero.sql:3–7` (default 0 only); `routes/payouts.ts:443–444` computes the fee and `taxMinor = platformFeeMinor * 1800 / 10000`; `routes/payouts.ts:376–389` reads a **per-site** `commission_schedules` row — PAY-R3 says the fee MUST NOT be per-merchant configurable.
- **Impact:** a single row update re-enables a GMV rake, silently, per merchant.
- **Severity:** P2 · **Likelihood:** LOW · **Invariant tag:** [HIGH-STAKES]
- **Remediation approach:** replace the range CHECK with `CHECK (commission_bps = 0)` (paired forward/rollback migration) and delete the fee/GST arithmetic from the payout path; keep the source-level ratchet as defence in depth.
- **Owner:** founder + ARB + database operator · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-24 — Two blanket `service_role USING(true)` policies survive on money tables
- **Domain:** tenancy / RLS
- **Status:** `PARTIAL`
- **Evidence:** `migrations/140_mobile_cod_reconciliation.sql:84–88` (`cod_reconciliation_entries_service_all`) and `migrations/160_foundation_money_ledger_authority.sql:72–76` (`money_ledger_site_reconciliations_service_all`). Migration `151:273–275` dropped the equivalent policies for the other nine money tables but did not cover these two. The gateway connects as `service_role` (`services/api-gateway/src/lib/supabase.ts:13–19`).
- **Impact:** DB-layer tenancy is not load-bearing for these money tables; isolation depends entirely on the application guard.
- **Severity:** P2 · **Likelihood:** MEDIUM · **Invariant tag:** [HIGH-STAKES]
- **Remediation approach:** drop both blanket policies in a paired migration and rely on the `app_tenant` GUC policy created by `migrations/164:33–75`; this is a subset of the broader "gateway off blanket service_role" work owned by agents B/C.
- **Owner:** security + database operator · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-25 — Money "tests" in the gateway are source-text regex assertions
- **Domain:** test quality
- **Status:** `PARTIAL`
- **Evidence:** `services/api-gateway/src/__tests__/payments.test.ts:11–17` (`readFileSync`), `:25–32, 53–70` (`assert.match(paymentsSource, /…/)`); same pattern in `money.test.ts`, `money-d5-ledger.test.ts`, `settlements.test.ts`, `payout-provider-client.test.ts`.
- **Impact:** the highest-stakes domain has no behavioural regression coverage in the fast test suite. A refactor that preserves the strings but breaks the logic passes.
- **Severity:** P2 · **Likelihood:** HIGH · **Invariant tag:** [HIGH-STAKES]
- **Remediation approach:** keep the regex tests as anti-deletion ratchets but add behavioural tests (stubbed provider fetch + ephemeral Postgres) for capture, refund, COD, settlement, payout.
- **Owner:** lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-26 — Typed API-client drift on money routes
- **Domain:** route-ownership lockstep
- **Status:** `PARTIAL`
- **Evidence:** `packages/typescript/api-client/src/index.ts:4938–4939` — `orders.refund(id, { amount?, reason? })` sends no `idempotency_key`, but `RefundOrderSchema` requires one (`packages/checkout-core/src/index.ts:435–441`) and has no `amount` field; **no `settlements` group exists** in the client while `/v1/settlements/ingest` is a live money route; no client methods for `/payments/sessions`, `/payments/:id/capture`, `/payments/:id/refund`.
- **Impact:** typed callers get 400s; untyped money routes are called via raw `merchantApiFetch`, defeating the contract.
- **Severity:** P2 · **Likelihood:** MEDIUM
- **Remediation approach:** regenerate/align the client from the route schemas; add a lockstep validator for money routes specifically.
- **Owner:** lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-27 — Operator dual control on money reconciliation is client-asserted
- **Domain:** operator controls
- **Status:** `PARTIAL`
- **Evidence:** `services/api-gateway/src/routes/internal-console/money-reconciliation.ts:202–206` — `actor_id` and `secondary_approver_id` come from the request body and are only compared to each other by `checkSegregationOfDuty`; perimeter is IP allowlist + shared internal credential (`middleware/internal-perimeter.ts:81–110`).
- **Mitigation present:** reason required (`:188–196`), no auto-plug (`:240–262` — only metadata annotation or a `refresh_money_ledger_site_reconciliation` recheck), audit written.
- **Severity:** P2 · **Likelihood:** MEDIUM · **Invariant tag:** [HIGH-STAKES]
- **Remediation approach:** derive the primary actor from an authenticated operator identity; require an independently authenticated second approval rather than a self-declared id.
- **Owner:** security · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-28 — No merchant dispute/chargeback capability
- **Domain:** payments lifecycle
- **Status:** `NOT_IMPLEMENTED`
- **Evidence:** the Razorpay webhook switch handles only `payment.captured`, `payment.failed`, `refund.created`, `payment.authorized` (`services/webhook-service/src/index.ts:781–896`); no `payment.dispute.*` case. `chargeback_events` (`migrations/124_internal_os_risk_detection.sql:212–235`) is an internal risk-scoring table with no merchant surface and no webhook writer; `payout_disputes` belongs to the frozen app-marketplace developer scope.
- **Impact:** disputes are invisible; disputed money is not reserved or reflected in `merchant_payable`.
- **Severity:** P2 · **Likelihood:** MEDIUM · **Invariant tag:** [HIGH-STAKES]
- **Remediation approach:** scope disputes explicitly (in or out of V1); if in, add webhook handling, a reserve posting, and a merchant surface.
- **Owner:** founder + payments-provider · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-29 — Residual `razorpayx` values remain accepted by DB CHECK constraints
- **Domain:** never-custody hygiene
- **Status:** `PARTIAL` (documented seam)
- **Evidence:** `database/supabase/migrations/000_baseline.sql:8293, 8295, 10263`; tracked as `SKIP-RAZORPAYX-ENUM-PURGE` (`SKIPPED_HUMAN_DECISIONS.md:54`); code is clean (`scripts/validators/no-self-custody-rail-validator.mjs`).
- **Severity:** P3 · **Likelihood:** LOW · **Invariant tag:** [HIGH-STAKES]
- **Remediation approach:** execute the documented purge migration after probing for residual rows.
- **Owner:** database operator + money engineering · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-30 — `POST /returns/:id/refund/complete` has no idempotency claim
- **Domain:** refunds
- **Status:** `PARTIAL`
- **Evidence:** `services/api-gateway/src/routes/returns.ts:259–292` — no `IdempotencyExecutionAdapter` (contrast `routes/orders.ts:1351–1362`). The RPC itself requires an idempotency key (`migrations/168:336`) and the outbox insert is `ON CONFLICT (idempotency_key) DO NOTHING` (`:552`), so the ledger posting is protected — but the route-level replay contract is inconsistent with every other money route.
- **Severity:** P3 · **Likelihood:** LOW · **Invariant tag:** [HIGH-STAKES]
- **Owner:** lead engineer · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-31 — Stripe is a live money-in path in an India-only platform
- **Domain:** topology / payments
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Evidence:** `services/api-gateway/src/routes/payments.ts:1250–1321` (`POST /payments/stripe/checkout`, `STRIPE_SECRET_KEY`); Stripe webhook handler `services/webhook-service/src/index.ts:907+`; `payment_transactions_gateway_check` allows `'stripe'`, `'paypal'` (`migrations/142:116–126`). Constitution scope is India-only with Razorpay/Cashfree as the PA options.
- **Severity:** P2 · **Likelihood:** LOW · **Invariant tag:** [HIGH-STAKES]
- **Remediation approach:** ARB decision — remove or formally scope Stripe/PayPal as out-of-scope legacy with a deletion plan.
- **Owner:** ARB + founder · **Reversible:** yes · **Confidence:** HIGH

---

### G-G-32 — Migration-count documentation drift
- **Domain:** governance
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Evidence:** root `AGENTS.md:245` says the canonical ledger is "mig 139–161" and (per the commander) claims a current max of 161; the directory contains 124 files with a maximum of `195_contact_requests.sql`, and money-critical ledger changes live in `162`, `165`, `168`, `170`, `174`.
- **Severity:** P3 · **Likelihood:** HIGH
- **Owner:** ARB · **Reversible:** yes · **Confidence:** HIGH

---

## 13. External human seams gating this domain (BLOCKED_EXTERNAL)

All from `SKIPPED_HUMAN_DECISIONS.md` (line references are to that file):

| Seam | Line | What a human must do | Gates |
|---|---|---|---|
| `SKIP-CAP-PAYOUT-PROVIDER-CLIENT` | 40 | Provision sandbox/live Razorpay Route credentials **outside the repo**, set `RAZORPAY_ROUTE_PROVIDER_ENABLED=true` only in the approved environment, run a payout-release smoke, record provider reference/UTR/variance evidence. | all live payouts (G-G-03) |
| `SKIP-CAP-SETTLEMENT-EXECUTOR` | 42 | Provision PA split payout credentials, ingest a real provider settlement twice (by idempotency key and by provider reference), release the linked statement, prove the instruction syncs, record zero-variance evidence. | settlement executor (G-G-09, G-G-10) |
| `SKIP-D5-LIVE-MONEY-RECONCILIATION` | 22 | Apply migrations through 165, provision Route/Cashfree split credentials + webhook secrets, run capture → refund → COD → settlement → payout smoke, store variance + provider + webhook evidence. | money certification (G-G-17) |
| `SKIP-CAP-RECONCILIATION-WIRING` | 41 | Live zero-break-or-explained-suspense evidence via the operator resolve/recheck path. | reconciliation (G-G-08) |
| `SKIP-CAP-STEPUP-CRYPTO` | 43 | Provision distinct staging/production `STEP_UP_SIGNING_SECRET` and `TOTP_ENCRYPTION_KEY`, enrol a merchant TOTP factor, prove tampered/expired proofs are rejected. | refunds + payouts (G-G-05, G-G-06) |
| `SKIP-MERCHANT-PSP-LIVE-CREDENTIALS` | 57 | Complete the approved credential-capture flow per merchant/provider, verify webhook endpoints and provider payment ids, run live create/capture/refund reconciliation before enabling live mode. | **the BYOG seam that G-G-02 shows is not actually the live path** |
| `SKIP-CAP-KYC-LIVE-PROVIDER` | 55 | Select the automated KYC provider (Signzy/HyperVerge), provision credentials, implement provider-contract tests, enable `KYC_PROVIDER_MODE=live`. | merchant onboarding, Route linked-account creation (G-G-03) |
| `SKIP-RAZORPAYX-ENUM-PURGE` | 54 | Probe for residual `razorpayx` rows, author a paired forward/rollback purge migration. | G-G-29 |
| `SKIP-B3-PARTNER-PAYOUT-LEDGER-BOUNDARY` | 10 | ARB + finance decide whether `partner_payout_ledger_entries` folds into the canonical ledger. | Audit A ring-fence |
| `SKIP-B6-AI-CREDIT-DESIGN-ARB` | 64 | ARB approval of the AI-credit money design; route currently returns 501 fail-closed. | out of my scope; noted |

**Environment variable NAMES this domain depends on** (presence/absence only — no values read, no `.env` opened): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_ROUTE_ACCOUNT_ID`, `RAZORPAY_ROUTE_KEY_SECRET`, `RAZORPAY_ROUTE_MODE`, `RAZORPAY_ROUTE_PROVIDER_ENABLED`, `LETBUYY_RAZORPAY_MODE`, `AI_CREDIT_RAZORPAY_KEY_ID`, `AI_CREDIT_RAZORPAY_KEY_SECRET`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENVIRONMENT`, `CASHFREE_API_VERSION`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_MODE`, `PAYMENT_CONFIG_ENCRYPTION_KEY`, `STEP_UP_SIGNING_SECRET`, `TOTP_ENCRYPTION_KEY`, `KYC_PROVIDER`, `KYC_PROVIDER_MODE`, `INTERNAL_API_SECRET`, `LETBUYY_PAYMENT_MODE`. **No secret value was read, printed, or written anywhere.**

---

## 14. Legal / accounting / contract questions requiring a human decision

1. **Who is the merchant-of-record?** If money-in continues to land in LetBuyy's Razorpay account (G-G-02), LetBuyy is collecting on behalf of merchants — an aggregator activity with RBI PA-licensing implications. Requires payments counsel **before** any live traffic. *(founder + payments counsel)*
2. **Razorpay Route contract and linked-account onboarding.** Route requires a linked account per merchant with its own KYC. Who signs, who owns the sub-merchant relationship, what are the settlement terms? *(founder + payments-provider)*
3. **Chart of accounts sign-off.** §8 shows two incompatible posting models shipped simultaneously. A CA must sign a single posting matrix (capture, settlement, payout, refund, COD, fee, GST, reserve, reversal) before any financial statement is derived from this ledger. *(CA-tax)*
4. **GST on the platform fee.** `taxMinor = platformFeeMinor * 18 %` is hardcoded (`routes/payouts.ts:444`) and `gst_bps` defaults to 1800 (`migrations/119:82, 111`). With a 0 % fee this is moot, but the treatment (place of supply, invoicing to the merchant, ITC) must be settled before any fee exists. *(CA-tax)*
5. **COD money handling.** Who holds COD cash between courier collection and merchant remittance, and does LetBuyy ever touch it? This determines whether the COD path is custody. *(founder + payments counsel)*
6. **Refund funding source.** Under the current platform-account model, refunds are paid from LetBuyy's Razorpay balance — a lending/float question if the merchant has already been paid out. *(founder + CA-tax)*
7. **Sandbox rows in the canonical ledger.** Whether sandbox captures may share the production ledger at all (G-G-16), and how to segregate or purge them before an audit. *(CA-tax + ARB)*
8. **Reserve / rolling reserve policy.** `reserves` and `recon_breaks` exist with a `'reserve'` suspense account but there is no policy, no hold rule, and no release schedule. *(finance + payments-provider)*
9. **Dispute liability.** Who bears a chargeback under the platform-account model? *(founder + payments counsel)*

---

## 15. Contradictions found (explicit)

| # | Claim A | Claim B | Resolution |
|---|---|---|---|
| C1 | `AGENTS.md:246`: `confirm_order_payment_with_ledger` posts **zero** ledger entries | `migrations/168:237–267`: it posts Dr `pa_clearing` / Cr `merchant_payable` | **B is current truth**; A is stale (G-G-01) |
| C2 | ART-11 / PAY-R4: money-in flows to the **merchant's own** Razorpay | `checkout-payment-routes.ts:505–508`, `payments.ts:1091`: platform env credentials for every site | **Code contradicts the Constitution** (G-G-02). Unresolved — needs an ARB/founder decision, not an engineering fix |
| C3 | UI: "The seller Razorpay account is connected and verified" (`settings/payments/page.tsx:262–265`) | The stored secret is never decrypted or used | UI overstates reality (G-G-16) |
| C4 | `i4-merchant-conservation.sql:22–56`: `payable = captures − refunds − payouts` | `billing-core:585–600`: settlement also **credits** `merchant_payable` | Two incompatible models shipped (G-G-07). Unresolved without a CA decision |
| C5 | `SKIPPED_HUMAN_DECISIONS.md:57`: live merchant PSP sessions "fail closed without active merchant credentials" | The live shopper path (`checkout-payment-routes.ts:449–698`) never consults merchant credentials at all | The seam describes `/payments/sessions` only; the real money path bypasses it (G-G-02) |
| C6 | `i7-single-writer.sql:29–36`: zero `wallet_ledger_entries` without a canonical ledger id | `routes/payouts.ts:484`, `routes/settlements.ts:243` create exactly those | Invariant contradicts shipped code (G-G-17) |
| C7 | PAY-R4: derive `no_custody` from the rail | `settlements.ts:233, 386, 444`: hardcoded `no_custody: true` | Rule violated literally (G-G-22) |
| C8 | PAY-R3: the fee MUST NOT be per-merchant configurable | `commission_schedules` is per-`site_id` with a 0–10000 CHECK (`migrations/119:81, 95`) and is read per site (`payouts.ts:376–389`) | Rule violated structurally (G-G-23) |

---

## 16. Honest UNKNOWNS

1. **No runtime observation was performed.** Nothing in this domain is `VERIFIED_E2E`. All statuses cap at `IMPLEMENTED_NOT_RUNTIME_VERIFIED`.
2. **Whether `POST /v1/checkout/:cartId/confirm` is reachable in the deployed storefront** (G-G-12) — mount order and route body are certain; live reachability is not.
3. **Whether the merchant Orders-page refund fails with a uuid cast error or a 404** (G-G-18) — the identifier mismatch is certain; the exact failure needs a runtime call.
4. **Whether any production `payment_credentials` rows exist** — there is no writer in this repo, but rows could have been seeded out-of-band. Not probed (no production access, by rule).
5. **Whether `orders.payment_status` is ever set to `'paid'` for COD** by a path I did not read (queue workers, mobile BFF, or a trigger). I found none; treated as absent, flagged as an unknown.
6. **Whether the `_bigint` shadow columns or the int4 columns are read by any reporting surface** — writers were traced; readers were not exhaustively traced.
7. **Actual production values of any environment variable** — deliberately not inspected.
8. **Whether `tests/executable/*.mjs` pass** — Docker Postgres not available; not run.
9. **Gift-card money paths** were only spot-checked (`create_checkout_order` derives balance from `gift_card_ledger_entries`, `migrations/170:225–231`, and no TS mutates gift-card tables). Full gift-card coverage belongs to another agent.
10. **Cashfree end-to-end behaviour** was confirmed only as far as the credential source (platform env). Its verify/webhook path was not traced in the same depth as Razorpay.

---

## 17. Blockers I hit

- No production or staging database access (correct, per the safety rules) → all SQL-behaviour claims are read from migration source, not observed.
- Docker/Postgres not available → `tests/executable/*` and `scripts/money-certification/*` could not be executed. Their defects (G-G-17) were found by reading, not running.
- No provider credentials (correct) → no sandbox Razorpay call was made, so signature/capture behaviour is asserted from code only.
- `apps/mobile/merchant-app` (Flutter) money surfaces were sampled, not exhaustively traced — Dart client contract drift is a known unknown.

---

*End of Agent G notes. One file written; nothing else in the repository was modified.*
