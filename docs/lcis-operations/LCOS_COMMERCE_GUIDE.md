# LCOS Commerce Guide — "What is happening to revenue?"

**Phase:** 6 — LCOS (LetBuyy Central Operations System)
**Service:** `CommerceOperationsService` (`packages/lcis-operations/src/commerce/CommerceOperationsService.ts`)
**Honesty contract:** canonical ledger model CONNECTED (topology, functions, tables); every live monetary VALUE NOT_CONNECTED (value=null, confidence=0) + exact env var. Subscriptions honestly NOT_IMPLEMENTED.

---

## 1. What This Service Does

`CommerceOperationsService` observes the commerce topology and emits a `CommerceReport`. It answers "What is happening to revenue?" by reading structural money metadata from `graphify-out/db-intel.json` and `graphify-out/revenue-intelligence-v2.json`.

It NEVER reads live GMV, order counts, or payment rates directly — all live amounts are NOT_CONNECTED.

---

## 2. The 5 Commerce Detectors

### 2.1 `detectGmvTrend()`

**What it reads:**
- `store.revenue()` → `graphify-out/revenue-intelligence-v2.json:models.funnel.stages[]`

Structural: if revenue funnel stages are present → `gmv-funnel` (info, CONNECTED). The funnel topology is declared (GMV → captured → net revenue → payout). Live GMV amount → `gmv-live` (info, NOT_CONNECTED; source: `orders.total_minor` grouped by `site_id`; requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).

### 2.2 `detectOrderTrend()`

**What it reads:**
- `store.raw('commerce-control-intel')` → `graphify-out/commerce-control-intel.json:domains[]` and `journeys.order[]`

Structural: orders domain (routes/RPCs/tables count, money flag) → `order-topology` (info, CONNECTED). Checkout journey steps anchored on `create_checkout_order` → `order-journey` (info, CONNECTED). Live order rate → `order-rate-live` (info, NOT_CONNECTED; source: `orders` table; requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).

### 2.3 `detectRefundSpikes()`

**What it reads:**
- `store.raw('commerce-control-intel')` → `journeys.refund[]`
- `store.revenue()` → `models.leakageDetection.rpcs[]`

Structural: refund RPC ledger path → `refund-ledger-path` (info, CONNECTED). The chain is: `complete_order_refund` (writes refunds + ledger reversal) → `restore_gift_card_on_refund` (restores `gift_card_ledger_entries`). Leakage-detection RPCs (reconciliation RPCs for ledger drift) → `refund-leakage-detection` (info, CONNECTED). Live refund rate → `refund-rate-live` (info, NOT_CONNECTED; source: `refunds` + `refund_transactions`; requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).

### 2.4 `detectPaymentFailures()`

**What it reads:**
- `store.raw('db-intel')` → `graphify-out/db-intel.json:functions[]` filtered by `money=true`
- `store.raw('commerce-control-intel')` → `journeys.payment[]`

Structural: payment journey topology → `payment-journey` (info, CONNECTED) — anchored on `confirm_order_payment_with_ledger`.

**Security checks on money functions (all CONNECTED):**

| Check | Severity | Condition |
|-------|----------|-----------|
| `payment-security-no-sd` | high | `money=true` AND `securityDefiner=false` AND not a trigger/read helper |
| `payment-security-no-idempotency` | medium | `securityDefiner=true` AND `forUpdate=true` AND `hasIdempotency=false` |

Known trigger/read helpers (`enforce_ledger_transaction_balance`, `ledger_balance_breaks`) missing SECURITY DEFINER are expected — emitted as info.

Live payment failure rate → `payment-failure-rate-live` (info, NOT_CONNECTED; source: `payment_transactions`; requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).

### 2.5 `detectCheckoutDegradation()`

**What it reads:**
- `store.raw('db-intel')` → `functions[name='create_checkout_order']`
- `store.raw('commerce-control-intel')` → `domains[key in (orders, payments, inventory)]`

Structural: `create_checkout_order` RPC confirms `securityDefiner`, `hasIdempotency`, `forUpdate`, `money` flags → `checkout-rpc` (info, CONNECTED). Checkout chain domains (orders, payments, inventory) → `checkout-domain` per domain (info, CONNECTED). Live checkout success/failure → `checkout-degradation-live` (info, NOT_CONNECTED; source: `orders + payment_transactions`; requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).

---

## 3. The Canonical Ledger Model (CONNECTED)

The ledger model is the most important structural fact. Tables and functions are read from `graphify-out/db-intel.json`.

**Core ledger tables** (append-only double-entry):
- `ledger_accounts`, `ledger_transactions`, `ledger_entries`
- Enforced by trigger function `enforce_ledger_transaction_balance`: every `ledger_transaction` entry must sum to zero.
- `ledger_balance_breaks()` RPC: returns count of transactions that break the double-entry invariant (used as the post-recovery verification signal).

**Money tables count:** read live from `db-intel.json:tables[money=true]` — the exact count is whatever `graphify-out/db-intel.json` reports; the discovery doc found 18 money tables. Confirmed CONNECTED.

**Money RPCs count:** read live from `db-intel.json:functions[money=true]` — discovery found 34 money functions. Confirmed CONNECTED.

**Canonical write-path RPCs** (all must be SECURITY DEFINER + FOR UPDATE + idempotency_key):
| RPC | Purpose |
|-----|---------|
| `create_checkout_order` | Checkout entry point; highest blast radius (19+ tables) |
| `confirm_order_payment_with_ledger` | Payment capture + ledger recording |
| `complete_order_refund` | Refund + ledger reversal |
| `issue_gift_card` | Gift card issuance |
| `set_gift_card_status` | Gift card state transition |
| `restore_gift_card_on_refund` | Gift card balance restore on refund |

**TS code rule:** never `.from(money_table).insert/update` in TypeScript. All money mutations go through `db.rpc(canonical_rpc, ...)` only. This is enforced by the `canonical-ledger-only-validator`.

---

## 4. What Is CONNECTED vs NOT_CONNECTED

| Observation | Status | Source |
|-------------|--------|--------|
| Number of money tables | CONNECTED | `db-intel.json:tables[money=true]` |
| Number of money RPCs | CONNECTED | `db-intel.json:functions[money=true]` |
| Which RPCs have `securityDefiner` | CONNECTED | `db-intel.json:functions[securityDefiner]` |
| Which RPCs have `hasIdempotency` | CONNECTED | `db-intel.json:functions[hasIdempotency]` |
| Revenue funnel stages | CONNECTED | `revenue-intelligence-v2.json:models.funnel.stages` |
| Leakage detection RPC list | CONNECTED | `revenue-intelligence-v2.json:models.leakageDetection.rpcs` |
| Order/checkout/payment journey steps | CONNECTED | `commerce-control-intel.json:journeys.*` |
| Domain routes/RPCs/tables counts | CONNECTED | `commerce-control-intel.json:domains` |
| GMV amount | NOT_CONNECTED | `orders.total_minor` — needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| Order rate | NOT_CONNECTED | `orders` table — same credentials |
| Refund rate | NOT_CONNECTED | `refunds` + `refund_transactions` — same credentials |
| Payment failure rate | NOT_CONNECTED | `payment_transactions` — same credentials |
| Checkout success rate | NOT_CONNECTED | `orders + payment_transactions` — same credentials |
| `ledger_balance_breaks()` count | NOT_CONNECTED | Supabase RPC — needs `SUPABASE_SERVICE_ROLE_KEY` |

---

## 5. Subscriptions: NOT_IMPLEMENTED

The `subscriptions` table exists in the schema and is used as a churn signal. However:
- No subscriptions commerce domain in `commerce-control-intel.json`
- No subscription-payment RPC in db-intel money functions
- No subscription journey step in `journeys.*`

Recurring subscription billing as a merchant feature is **NOT IMPLEMENTED**. The `generateCommerceReport()` method emits a CONNECTED finding `COMMERCE-SUBSCRIPTIONS-NOT-IMPLEMENTED` documenting this honestly. See `LCOS_COMMERCE_DISCOVERY.md §7`.

---

## 6. `CommerceReport` Key Fields

```typescript
{
  area: 'commerce',
  liveConnected: false,
  summary: 'Commerce intelligence: N money tables, M money RPCs declared (CONNECTED). ...',
  facts: [
    // Ledger facts (CONNECTED)
    { kind: 'ledger-table', subject: 'ledger_accounts', value: 'ledger_accounts', status: 'CONNECTED' },
    { kind: 'ledger-invariant', subject: 'enforce_ledger_transaction_balance', value: 'active', status: 'CONNECTED' },
    // Counts (CONNECTED)
    { kind: 'money-table-count', value: /* from db-intel */, status: 'CONNECTED' },
    { kind: 'money-function-count', value: /* from db-intel */, status: 'CONNECTED' },
    // Subscriptions status (CONNECTED structural observation)
    { kind: 'subscriptions-status', value: 'NOT_IMPLEMENTED', status: 'CONNECTED' },
    // Live amounts (all NOT_CONNECTED)
    { kind: 'gmv-amount', subject: 'orders.total_minor', value: null, status: 'NOT_CONNECTED' },
  ],
  findings: [
    { id: 'COMMERCE-GMV-FUNNEL-TOPOLOGY', status: 'CONNECTED' },     // funnel stages
    { id: 'COMMERCE-GMV-LIVE-NOT-CONNECTED', status: 'NOT_CONNECTED', confidence: 0 },
    { id: 'COMMERCE-CHECKOUT-RPC-CONNECTED', status: 'CONNECTED' },  // create_checkout_order
    { id: 'COMMERCE-SUBSCRIPTIONS-NOT-IMPLEMENTED', status: 'CONNECTED' },
    // Security checks on money functions (CONNECTED):
    { id: 'COMMERCE-PAYMENT-NO-SD-<fn_name>', severity: 'high', status: 'CONNECTED' },  // if any non-SD money fn found
    ...
  ]
}
```

---

## 7. How to Connect Live Commerce Metrics

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Once wired, all five live metric findings flip from NOT_CONNECTED to CONNECTED and `liveConnected` becomes true.

---

## 8. Cross-References

- Source: `packages/lcis-operations/src/commerce/CommerceOperationsService.ts`
- Commerce discovery: `docs/lcis-operations/LCOS_COMMERCE_DISCOVERY.md`
- DB money model: `graphify-out/db-intel.json` (gitignored; regenerate with `pnpm graph:db`)
- Revenue funnel: `graphify-out/revenue-intelligence-v2.json`
- Commerce control intel: `graphify-out/commerce-control-intel.json`
