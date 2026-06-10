# LetBuyy Foundation Forensics — Phase C Commerce-OS Subsystem Audit

**Date:** 2026-06-09
**Scope:** Read-only forensic due diligence ahead of a hypothetical $100M acquisition.
**Method:** Trust only code + migrations + runtime wiring. A route existing ≠ the feature being real. Every classification carries `file:line` evidence. Money paths audited for ledger, idempotency, reconciliation, provider webhooks/signatures, and integer/float money handling.
**Real backend under audit:** `services/api-gateway` (62 route files) + `services/webhook-service` + `database/supabase/migrations` (159 migrations, Supabase/Postgres, no ORM). Reserved services (`analytics-pipeline`, `checkout-runtime`, `notification-service`, `media-service`, `search-service`, `event-bus`) are manifest-only (zero src). `-core` packages are contract + pure-function planners.

---

## Executive Summary

LetBuyy's foundation is **substantially more real than a typical demo, but is a "two parallel systems" architecture** where a genuinely-engineered deterministic core (inventory, orders, a real append-only double-entry ledger, real provider webhook verification) coexists with **stubbed money rails and stubbed logistics** that are the default execution path. The danger for an acquirer is not that nothing works — it is that the **most load-bearing trust primitive (money movement) is simulated by default**, and the canonical ledger is **not** the system of record for payment capture.

Three findings dominate the verdict:

1. **There IS a real double-entry ledger.** `migrations/139_executable_foundation_ledger_core.sql` defines `ledger_accounts`/`ledger_transactions`/`ledger_entries` with an append-only trigger, a deferred balance-enforcement constraint trigger, idempotency on `(site_id, source_type, source_id, idempotency_key)`, bigint minor units, and a `post_ledger_transaction` SECURITY DEFINER RPC that requires a tenant GUC. Settlement/payout/commission routes genuinely call it. This is the strongest part of the money stack and is real.

2. **Real payouts do NOT happen.** The merchant payout "provider" `packages/infrastructure/payout-transfer-adapter/index.ts` is a pure mock: in sandbox mode (the default, `payouts.ts:116`) it returns `status:'released'` with a **fabricated UTR and provider reference** and **never makes any HTTP call**; in "live" mode it returns `processing` and *still* makes no provider call. Merchant wallet is debited and a ledger "payout released" transaction is posted against money that never moved. This is the "fabricated payouts" the prior autopsy flagged — confirmed in code.

3. **Captured payments never hit the canonical ledger.** A clean, balanced `buildPaymentCaptureLedgerPosting` helper exists (`packages/payments/src/index.ts:420`) but **no route calls it** (grep across `services/api-gateway/src`). The ledger is fed only by settlement/payout/commission, whose amounts are recomputed in-memory from `orders.total`. So the "double-entry ledger" sees a synthetic downstream projection, not the actual payment event — a serious system-of-record integrity gap.

Counterweight: the **inbound payment confirmation path is production-grade**. `services/webhook-service/src/index.ts` does real HMAC-SHA256 signature verification for Razorpay, Stripe, PayPal, and Cashfree, with `payment_webhook_events` idempotency and order state transitions. The synchronous `payments.ts /razorpay/verify` does real HMAC + replay-guard + order-binding, and `/subscription/verify` does a real server-side Razorpay capture re-check (amount + status + order binding). So real money *can* be taken and confirmed — but a parallel mock "V1 payment session/capture" path lets an order be marked `paid` with zero provider involvement in `mock` mode (the default).

**Foundation Score: 58/100.** Defensible core engineering (inventory, orders, ledger schema, webhook verification, CRM) is dragged down by simulated-by-default money rails, no real logistics, no payment→ledger posting, an integer-overflow money-width bug in the mobile compatibility tables, and the "two parallel systems" pattern that makes "what is actually wired in production" ambiguous.

---

## Master Table

| # | Subsystem | Status | Evidence (file:line) | Top blocker |
|---|-----------|--------|----------------------|-------------|
| 1 | Products | REAL | `routes/products.ts` (41KB CRUD); `commerce-core` 1188L schemas; variants reconcile `migrations/086` | Legacy `products.stock` vs `inventory_levels` dual stock model |
| 2 | Orders | REAL | `routes/orders.ts` via `OrderExecutionAdapter` (803,1158…); state machine `migrations/147_executable_order_state_risk.sql:33-62` | Order create not wired into checkout-confirm flow |
| 3 | Inventory | REAL | `reserve_inventory` `SELECT…FOR UPDATE` `migrations/141:121-139`; idempotency `141:104`; expiry sweeper `FOR UPDATE SKIP LOCKED` `141:325` | Dual stock systems; cart/storefront use naive `products.stock` |
| 4 | Checkout | PARTIAL | Signed handoff HMAC `routes/checkout.ts:161`; state machine `planCheckoutStateTransition`; saga `compensation_actions`; BUT payment-intent fabricated `checkout.ts:435`, confirm creates NO order `checkout.ts:490-509` | Confirm terminal step does not create an order or capture payment |
| 5 | Payments | PARTIAL (bifurcated) | REAL: webhook HMAC `webhook-service/src/index.ts:677-696`, razorpay verify `payments.ts:1290-1318`, subscription capture re-check `payments.ts:1101-1118`. MOCK: V1 capture `payments.ts:604` (synthetic `provider_payment_id`, no provider call) | Mock `/sessions`+`/capture` marks orders paid with no provider in default `mock` mode |
| 6 | Settlement/Payouts/Wallet/Commission/COD | PARTIAL — ledger real, **rails mocked** | Ledger `migrations/139`; routes call `post_settlement_ledger_transaction` (`settlements.ts:235`, `payouts.ts:419/545`, `commission.ts:337`); payout adapter mock `payout-transfer-adapter/index.ts:82-103` | **Fabricated payouts** (fake UTR, no provider call); payment never posts to ledger; integer overflow `migrations/119` |
| 7 | Billing | PARTIAL/MOCK | `/subscribe` driven by `mock_payment_status` `billing.ts:232`; ids `mock_autopay:` `billing.ts:330`; invoice IRN `mock-irn-` `billing.ts:145`. Real path = `payments.ts /subscription/verify` + webhook. `internal-billing.ts` real S2S | In-app billing is a simulation; only webhook/verify path takes real money |
| 8 | Notifications + WhatsApp | PARTIAL — Twilio real | WhatsApp adapter real Twilio POST `whatsapp-commerce-adapter/index.ts:244` + signature verify `:332-334`; sandbox default `whatsapp.ts:119`. Notifications router persists+routes | No Meta/Gupshup BSP; Twilio-only; sandbox by default |
| 9 | Shipping/Logistics | STUB | `createScaffoldLogisticsProvider` `logistics-adapter/index.ts:161`; fake label URL `:158`; **no carrier `fetch` anywhere**; tracking numbers synthesized `:146` | No real Shiprocket/Delhivery/Pickrr integration even in "live" mode |
| 10 | Tax (GST) | PARTIAL | `generateGstInvoice` real CGST/SGST/IGST compute (checkout-core); IRP e-invoice mock `tax.ts:113-115`, live throws HumanRequired `tax.ts:67` | No real IRP/IRN government e-invoicing |
| 11 | Customers/CRM | REAL | `routes/customers.ts` segments+rules `CustomerSegmentRulesSchema`, notes, tags, merge, real email `sendResendEmail` `customers.ts:35` | None material; strong |
| 12 | Analytics | REAL (in-DB rollups) | Reads `analytics_rollups_daily` + `commerce_analytics_daily` MV `analytics.ts:119-139`; period deltas computed from persisted rows | Dedicated `analytics-pipeline` service is zero-file; warehouse mode mock `analytics.ts:70-86` |
| 13 | KYC | STUB | `kyc-verification-adapter` — only a type union names signzy/hyperverge, **no `fetch`**; sandbox auto-verify `kyc.ts:71-79` | No real KYC/AML provider; onboarding verification is simulated |
| 14 | Domains | REAL-ish | Real Vercel attach `attachVercelProjectDomain`/`readVercelDomainStatus` `domains.ts:150-151`; registrar default `mock` `domains.ts:109` | Registrar purchase is mock/external-reference; Vercel DNS is real |
| 15 | Themes (API) | REAL | `routes/themes.ts` (54KB) CRUD/versioning/drafts `migrations/087_theme_template_drafts.sql` | Editor depth assessed by separate agent |
| 16 | Returns/Reviews/Coupons/Marketing | REAL | Returns RMA state machine `routes/returns.ts`; coupons `planCouponValidation`; reviews w/ merchant replies `migrations/115`; marketing campaigns `migrations/136` | Marketing send depends on email/WhatsApp providers (sandbox) |

---

## Per-Subsystem Findings

### 1. Products — REAL
- **Current state:** `routes/products.ts` (41KB) is full CRUD with variants, images, SKU, metafields (`routes/metafields.ts`, 19KB), categories, collections, search (trigram indexes `migrations/084`). Contracts in `commerce-core` (1188L of Zod). Variants reconciled in `migrations/086_products_variants_reconcile.sql`.
- **Risk / debt:** Two stock representations: legacy scalar `products.stock` and the `inventory_levels` reservation ledger. Storefront/cart read `products.stock`; the real concurrency-safe path is `inventory_levels`. Drift between them is a correctness risk.
- **Blockers:** None blocking; the dual-stock model is technical debt, not a launch blocker.

### 2. Orders — REAL (lifecycle), with a checkout seam gap
- **Current state:** `routes/orders.ts` (52KB) handles list (cursor + relational order_items hydration), create, draft-order create/convert (`migrations/116_mobile_draft_orders.sql`), status transitions, fulfillment, refunds, GST invoice fields, all via `OrderExecutionAdapter` (calls at `orders.ts:803,1158,1206,1267,1313,1358`).
- **Intended state (schema):** `migrations/147_executable_order_state_risk.sql:33-62` defines a real state machine: `status` enum (pending→confirmed→processing→shipped→delivered + cancelled/refunded/returned/rto), independent `financial_state`, `fulfillment_state`, `cod_confirmation_status`, `rto_status`, `risk_score`/`risk_level`, plus `order_risk_assessments` and `cod_confirmation_requests` tables and an `immutable_snapshot`.
- **Risk / debt:** Draft→order conversion is real, but the **hosted checkout confirm flow does not create an order** (see §4). So the "order" is reachable via admin/draft/API, not via the customer checkout terminal step in this codebase. COD confirmation provider defaults to `mock_whatsapp` (`migrations/147:89`).
- **Blockers:** The checkout→order seam (no order emitted on `checkout.confirm`) is a functional gap for the consumer flow.

### 3. Inventory — REAL (genuine concurrency safety)
- **Current state:** All mutations are Postgres RPCs with idempotency keys, called from `routes/inventory.ts`: `reserve_inventory`, `commit_inventory_reservation`, `release_inventory_reservation`, `adjust_inventory_level`, `create_purchase_order_with_lines`, `receive_purchase_order`, transfers.
- **Concurrency proof:** `migrations/141_executable_inventory_reservations.sql` — `reserve_inventory` takes a `SELECT … FOR UPDATE` row lock on the level (`141:121`), checks `available - reserved >= qty` (`141:127`), atomic `UPDATE … reserved = reserved + qty` (`141:133`), idempotency replay (`141:104`), tenant GUC enforcement (`require_inventory_site_guc`, `141:53`). Optimistic `version` column + `increment_version` trigger (`141:48-51`). Expiry sweeper uses `FOR UPDATE SKIP LOCKED` (`141:325`). This is correct pessimistic-locking inventory.
- **Risk / debt:** Same dual-stock concern as §1 (`products.stock` is naive and unguarded). RLS uses tenant GUC (`store_id = current_site_id()`), good.
- **Blockers:** None for the ledgered path. The naive `products.stock` path used by storefront is an oversell risk.

### 4. Checkout — PARTIAL (orchestration real, money + order absent)
- **Current state:** `routes/checkout.ts` + `checkout-core`. Real signed cart handoff: HMAC over `site:cart:token:channel:expires` with timing-safe compare and expiry (`checkout.ts:161-163`). Real state machine via `planCheckoutStateTransition` and `checkout_sessions.checkout_state` (`migrations/146_executable_checkout_state_machine.sql`). Idempotency on every step. Saga via `compensation_actions` table (`checkout.ts:311-338`, table from `migrations/139`). Confirm revalidates inventory reservations + coupons (`checkout.ts:274-309`).
- **What is NOT real:** payment-intent is a fabricated id `${provider}_${mode}_${uuid}` (`checkout.ts:435`), live mode is blocked (`checkout.ts:427-431`), and **confirm does not create an order** — it flips the checkout session to `completed` and the cart to `converted` (`checkout.ts:490-509`) with a `simulate_order_failure` test hook (`checkout.ts:463`). No payment capture, no `orders` insert, no inventory commit in the terminal step.
- **Assessment:** Matches the "~60-70% real" recon: the saga/state/idempotency/handoff scaffolding is real; the terminal money + order materialization is missing.
- **Blockers:** No order/payment produced by hosted checkout; this is the central consumer-flow gap.

### 5. Payments — PARTIAL (two parallel systems: real provider + mock session)
**Real (provider-backed):**
- `routes/payments.ts /razorpay/order` calls real `createRazorpayOrder` → `https://api.razorpay.com/v1/orders` (`razorpay-adapter/index.ts:95`).
- `/razorpay/verify` does real HMAC-SHA256 over `order|payment` (`payments.ts:1290-1303`), timing-safe compare (`:1305`), replay guard (`assertProviderPaymentNotReplayed`, `:1320`), order-binding fail-closed (`:1316`).
- `/subscription/verify` is the strongest path: HMAC + **server-side `fetchRazorpayPayment` capture re-check** verifying `status==='captured'` AND `amount >= plan price` AND order binding (`payments.ts:1101-1118`). Correct.
- **Inbound webhooks (production-grade):** `services/webhook-service/src/index.ts` verifies Razorpay (`:677-696`, HMAC over raw body), Stripe (`stripe-signature` t/v1 parse), PayPal (provider verify API), Cashfree (base64 HMAC). Idempotency via `payment_webhook_events` unique `(provider, provider_event_id)` (`:75-86`). Routes captured/failed/refund → `confirmGatewayOrderPayment` / `markOrderFailed` / `markOrderRefunded`. Real.

**Mock (V1 session flow — the default):**
- `/sessions` builds `buildMockPaymentSessionPlan` (`packages/payments/src/index.ts:281`); in `mock` mode (default, `payments.ts:130`) status jumps to `authorized`.
- `/:id/capture` simply sets `status:'captured'` with a synthesized `provider_payment_id = ${provider}_${mode}_capture_${id}` and **no provider call** (`payments.ts:604,618-630`). `/refund` flips status with no provider refund (`payments.ts:793-810`).
- **Consequence:** in default `mock` mode a merchant can drive an order to `paid` with zero money. Because payouts compute from `payment_status='paid'` orders (§6) and the payout rail is also mocked, the entire money loop is simulable end-to-end with no real funds.

**Money handling:** INR minor units as integers/bigint; `assertInrMinorUnits` caps at 9,999,999,999 (`payments/src/index.ts:11,195`). The provider adapter ledger helper is bigint-safe. No float bugs in the payments package itself.

### 6. Settlement / Payouts / Wallet / Commission / COD — PARTIAL (ledger real, money movement simulated)
See the dedicated **Money-Movement Integrity Deep-Dive** below. Summary: the canonical double-entry ledger is real and is correctly written by settlement/payout/commission; but (a) the actual payout transfer is a mock with fabricated UTRs, (b) captured payments are never posted to the ledger, (c) COD remittance and the wallet write only to single-entry integer compatibility tables, and (d) those compatibility tables (`migrations/119`) use `integer` minor units (overflow at ₹21,474,836.47).

### 7. Billing — PARTIAL/MOCK; monetization = 3% commission + subscriptions
- **In-app billing is simulated:** `routes/billing.ts /subscribe` uses request field `mock_payment_status` to decide paid/failed (`billing.ts:232-234`); external ids are `mock_autopay:…` (`:330`), payment ids `mock_autopay_payment:…` (`:331`); merchant GST invoice `irn`/`qr_payload` are `mock-irn-…`/`mock-qr:…` (`:145-146`). `/mandate` uses `planMockUpiAutopayMandate` with `upi_vpa_hash: mock-hash:…` (`:201`). Live throws HumanRequired (`:40`).
- **Real billing path:** `payments.ts /subscription/order` → Razorpay order/subscription, `/subscription/verify` with capture re-check, and the webhook-service subscription activation. `internal-billing.ts` is a legitimate internal-secret-gated S2S surface the webhook service calls.
- **Monetization:** Subscription tiers in `billing-core` — Starter ₹399/mo, Business ₹999/mo, Enterprise contact (`billing-core/src/index.ts:714,751,787`); **`gmv_percentage: 0` on every tier**. Transaction rake via `commission_schedules.commission_bps` default **300 bps (3%)** + 18% GST on commission (`migrations/119:81,95`). App marketplace take `DEFAULT_APP_REVENUE_SHARE_BPS = 8500` → 15% platform fee (`billing-core:452`). Note the contradiction: tier defs zero the GMV rake while `commission`/`payouts` apply 3% — the effective rake depends on which path runs.

### 8. Notifications + WhatsApp — PARTIAL (Twilio real, sandbox default)
- **WhatsApp:** `routes/whatsapp.ts` uses `createWhatsAppCommerceAdapter`. The adapter genuinely POSTs to `https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json` (`whatsapp-commerce-adapter/index.ts:244`) and verifies inbound `x-twilio-signature` via real HMAC (`:332-334`). Providers: `letbuyy_sandbox | twilio | manual`; default sandbox (`whatsapp.ts:119-120`); live requires Twilio creds. Templates enumerated (order_update/paid/shipped/delivered/shipping_update/cod_confirmation/abandoned_cart/custom). DPDP consent opt-in/opt-out persisted (`whatsapp.ts:40-49`). More real than prior "mock" notes — Twilio BSP is wired.
- **Notifications:** `routes/notifications.ts` (25KB) persists and routes notifications; backed by `notification-core` (419L) and `migrations/148_executable_notifications_router.sql` + `149_executable_email_delivery.sql`. Email via real `sendResendEmail` adapter (seen in customers.ts).
- **Risk/blockers:** No Meta Cloud API / Gupshup BSP — Twilio-only is a cost/deliverability constraint for India WhatsApp at scale. Sandbox by default.

### 9. Shipping / Logistics — STUB (no real carrier integration)
- **Serviceability/rates real-ish:** `routes/shipping.ts` computes serviceability via `planShippingServiceability` (checkout-core) over DB rules `shipping_serviceability_rules` with hardcoded fallbacks (`shipping.ts:52-65`); rates from `shipping_rates` with a ₹60 mock fallback (`shipping.ts:149-158`). Tax/serviceability migrations `145`, `144`.
- **Carrier integration absent:** `packages/infrastructure/logistics-adapter/index.ts` is `createScaffoldLogisticsProvider` (`:161`) — label URLs are the fake `https://logistics.test.letbuyy.store/{provider}/labels/{id}.pdf` (`:158`), tracking numbers are synthesized strings (`:146-148`), and there is **no `fetch` to Shiprocket/Delhivery/Pickrr anywhere** — even "live" mode (which only checks for a token, `:121-127`) returns synthetic shipment IDs. `shipping-labels.ts` and `shipping-tax.ts` build on this scaffold.
- **Blockers:** No real label purchase, no real tracking, no real pickup booking. This is a launch blocker for physical-goods commerce.

### 10. Tax (GST) — PARTIAL (math real, e-invoicing mock)
- **Real:** `generateGstInvoice` (checkout-core) computes CGST/SGST vs IGST by place-of-supply and line tax; `gst_invoices` table (`migrations/144_executable_tax_gst_invoices.sql`). `routes/tax.ts /calculate` returns a real calculation.
- **Mock:** IRP (government Invoice Registration Portal) e-invoicing is simulated — `irp_mode:'mock'`, `irn`/`qr_payload` generated locally (`tax.ts:113-115`); live throws HumanRequired (`tax.ts:64-69`).
- **Blockers:** No real IRN registration; fine for sub-₹5cr turnover sellers but not for e-invoice-mandated merchants.

### 11. Customers / CRM — REAL
- `routes/customers.ts` (60KB): customers, **segments with a real rules engine** (`CustomerSegmentRulesSchema`), segment preview, notes (`migrations/117`), tags, addresses, merge, customer email via real `sendResendEmail` (`customers.ts:35`), cursor pagination, order-derived summaries (`buildCustomerSummaries`, commerce-core). `contacts.ts` is a thin form-contact surface. Strong and real.

### 12. Analytics — REAL aggregation (not fake numbers)
- `routes/analytics.ts` reads persisted `analytics_rollups_daily` and a `commerce_analytics_daily` materialized view refreshed from rollups (`analytics.ts:11-27,119-139`); computes period-over-period deltas, traffic sources, device/country, sessions (`migrations/154_executable_analytics_media_ai_seam.sql`, `155_storefront_session_analytics.sql`, `129_internal_os_executive_analytics_rollups.sql`). Numbers derive from real rows, not constants.
- **Caveat:** The dedicated `services/analytics-pipeline` is zero-file (manifest only); aggregation is served by SQL rollups/MV inside the gateway. External-warehouse mode is mock/deferred (`analytics.ts:70-86`). Feature is real; the "pipeline service" is a placeholder.

### 13. KYC — STUB
- `routes/kyc.ts` uses `createKycVerificationAdapter` with providers `letbuyy_sandbox_kyc | signzy | hyperverge | manual`, sandbox default (`kyc.ts:71-79`). The adapter file contains **no `fetch` and no provider endpoints** — only a type union names signzy/hyperverge. Document submission persists to `mobile_kyc_documents` (`migrations/120`) and auto-verifies in sandbox. Onboarding verification is simulated.
- **Blockers:** No real identity/AML verification — a compliance blocker for a payments-adjacent platform.

### 14. Domains — REAL-ish (Vercel real, registrar mock)
- `routes/domains.ts` + `custom-domains.ts`: real Vercel domain provisioning via `attachVercelProjectDomain` / `readVercelDomainStatus` (`domains.ts:150-151`), real CNAME target config, `domain_orders` persistence with idempotency upsert (`domains.ts:120-137`), site `custom_domain_status` sync. Registrar default is `mock`; live registrar purchase is gated. Custom-domain DNS/cert via Vercel is genuinely wired (`migrations/090_custom_domains_and_store_access.sql`).
- **Blockers:** Registrar purchase is mock/external-reference; Vercel attach/verify is real.

### 15. Themes (API) — REAL
- `routes/themes.ts` (54KB): theme/template CRUD, versioning, drafts (`migrations/087_theme_template_drafts.sql`, `091_theme_marketplace_stepup.sql`). Editor UX depth is covered by a separate agent; the API surface is real and persisted.

### 16. Returns / Reviews / Coupons / Marketing — REAL
- **Returns:** `routes/returns.ts` — RMA lifecycle (authorized/received/inspected/refunded/closed), `return_lines`, `refunds`, via `OrderExecutionAdapter`. Real.
- **Reviews:** `routes/reviews.ts` with merchant replies (`migrations/115_product_review_merchant_replies.sql`). Real.
- **Coupons:** `routes/coupons.ts` — DB CRUD + `planCouponValidation` with structured reasons (checkout-core). Real.
- **Marketing:** `routes/marketing.ts` (26KB) — email campaigns (`migrations/136_mobile_marketing_email_campaigns.sql`). Real persistence; actual send depends on the (sandbox-default) email/WhatsApp providers.

---

## Money-Movement Integrity Deep-Dive

### Is there a double-entry ledger? YES — and it is real.
`migrations/139_executable_foundation_ledger_core.sql`:
- `ledger_accounts` (codes: pa_clearing, merchant_payable, platform_revenue, gst_payable, cod_receivable, reserve, vendor_payable, refund_clearing), `ledger_transactions`, `ledger_entries` with `amount_minor bigint NOT NULL CHECK (amount_minor > 0)` and `side IN ('debit','credit')` (`139:125-142`).
- **Append-only:** `reject_ledger_mutation()` trigger blocks UPDATE/DELETE on both entries and transactions (`139:358-376`).
- **Balance enforcement:** deferred constraint trigger `enforce_ledger_transaction_balance` raises unless debits == credits per transaction (`139:172-198, 378-382`).
- **Idempotency:** unique `(site_id, source_type, source_id, idempotency_key)` on transactions (`139:122`); `post_ledger_transaction` does `ON CONFLICT … DO NOTHING` and returns the existing id (`139:281-292`).
- **Tenant isolation:** `post_ledger_transaction` requires `current_site_id() = p_site_id` (`139:251`); RLS FORCE + tenant-GUC policy on all ledger tables (`139:384-406`).
- **Drift detector:** `ledger_balance_breaks()` returns any site/currency whose entries don't net to zero (`139:344-356`).

This is a correctly-designed ledger kernel. Settlement posts via `post_settlement_ledger_transaction` which sets the GUC then delegates (`migrations/151:6-36`). Routes that genuinely call it: `settlements.ts:235`, `payouts.ts:419` and `payouts.ts:545`, `commission.ts:337`. The in-memory planners (`planSettlementLedgerPosting`, `planPayoutReleaseLedgerPosting`, `buildPaymentCaptureLedgerPosting`) all assert debit==credit before returning (`billing-core:617-625`, `payments:381-410`).

### Are real payouts made? NO — fabricated.
`packages/infrastructure/payout-transfer-adapter/index.ts`:
- `initiateTransfer` in **sandbox** mode returns `status:'released'`, `providerReference: sandbox_{rail}_{token}`, `utr: UTR{token}` — **a fabricated UTR with no HTTP call** (`:82-92`).
- In **live** mode it returns `status:'processing'` with `providerReference: {rail}_{token}` and **still makes no provider API call** (`:95-103`). There is no `fetch`, no Razorpay Route / RazorpayX / Cashfree Payout SDK invocation anywhere in the adapter.
- `payouts.ts /:id/settle` calls this adapter (`payouts.ts:505-521`), and on `released` posts a canonical "payout released" ledger transaction and writes a `payout_debit` to `wallet_ledger_entries` (`payouts.ts:544-577`). So the merchant's balance is debited and the ledger records a release against **money that never moved**. Default mode is sandbox (`payouts.ts:116`, gated on `RAZORPAY_ROUTE_MODE === 'live'`).

**Verdict: the prior autopsy's "fabricated payouts" is confirmed in code.** Step-up auth (`verifySensitiveActionStepUp`, `payouts.ts:487`) and maker/checker columns exist (`migrations/151:126-129`), so the *controls* around payout are real — but the *transfer itself* is simulated.

### Does payment capture post to the ledger? NO.
`buildPaymentCaptureLedgerPosting` exists and is correct (`packages/payments/src/index.ts:420-471`, debits `pa_clearing`, credits `merchant_payable`/`platform_revenue`/`gst_payable`), but a grep across `services/api-gateway/src` for ledger-posting calls returns **only** settlements/payouts/commission — never payments. So when a real payment is captured (webhook → `confirmGatewayOrderPayment`), **no `pa_clearing` debit is recorded**. The ledger's `pa_clearing` account is only ever *credited* by payout release, never debited by capture, so `ledger_balance_breaks()` would only stay balanced because the synthetic settlement postings self-balance. **The canonical ledger is not the system of record for payments; it is a downstream projection of in-memory settlement math derived from `orders.total`.** This is the single most important integrity finding.

### Idempotency, reconciliation, signatures, money width
- **Idempotency:** Strong and pervasive — ledger (`139:122`), settlements (`151:84`), payouts (`151:144`), wallet (`119:141`), commission (`119:157`), COD (`collection_/reconciliation_idempotency_key`), plus an app-level `IdempotencyExecutionAdapter` on payments/inventory/checkout.
- **Reconciliation:** `recon_breaks` table + `settlements.recon_break_minor` + `reserves` suspense (`migrations/151:170-192`); `planSettlementLedgerPosting` routes any break to the `reserve` account so postings always balance (`billing-core:601-615`). COD short/over computed (`cod-reconciliation.ts:276-280`). Reconciliation is modeled, but the "provider feed" it reconciles against is itself mock.
- **Provider webhook signatures:** Real for Razorpay/Stripe/PayPal/Cashfree inbound (`webhook-service/src/index.ts`). **No payout-provider or settlement-feed webhook** (consistent with there being no real PA/payout integration).
- **Money width bug:** `migrations/119_mobile_money_ledgers.sql` declares `*_amount_minor integer` on `payout_statements`, `wallet_ledger_entries`, `commission_reconciliation_entries` (`119:16-19,52,107-112`). Postgres `integer` max is 2,147,483,647 minor units = **₹21,474,836.47** — a single statement/wallet row overflows above that. The canonical ledger (`139`) and the newer `settlements`/`payouts` (`151`) correctly use `bigint`. So the mobile compatibility tables carry a real overflow hazard that the canonical layer does not. (`migrations/109_orders_money_width.sql` widened orders, but these mobile tables were not.)

### Net money-movement assessment
A real, well-formed double-entry ledger kernel with strong idempotency and reconciliation modeling — wrapped around **simulated rails**: payouts are fabricated, payment capture never reaches the ledger, COD/wallet write only single-entry integer rows, and billing autopay is mock. The platform can *take* money (real Razorpay/Stripe/Cashfree inbound + webhook verification) but cannot *move* money out, and its ledger does not yet reflect the inbound side. For a $100M acquisition this is the headline risk: the trust primitive looks production-grade on the schema surface but is not load-bearing in the runtime path.

---

## Cross-Cutting Observations
- **"Two parallel systems" pattern** recurs: real provider path + mock self-serve path for payments; canonical ledger + single-entry compatibility tables for money; `inventory_levels` ledger + naive `products.stock`. This makes "what runs in production" ambiguous and is the dominant architectural smell.
- **HUMAN-REQUIRED gating is consistent**: live payments, payouts, autopay, carriers, GST IRP, KYC, warehouse all fail closed to a `*_SETUP_REQUIRED` 503 with `[HUMAN-REQUIRED]` markers. Honest about being unconfigured — but it means almost every external integration is off by default.
- **Security posture of money tables is good**: RLS FORCE + tenant GUC on ledger; step-up + maker/checker on payout/refund; replay guards on payment verify. The controls are more mature than the rails they protect.
