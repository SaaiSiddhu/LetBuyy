# Phase 7 — Payment Graph

**Densest business domain in the graph: 864 code nodes, total degree 2,307. Flow truth where it crosses into SQL is cited from migrations.**

## Payment subgraph anchors
- `services/api-gateway/src/routes/payments.ts` — refund + capture + Razorpay/subscription verify (refund chain `:462–667`).
- `services/api-gateway/src/routes/payouts.ts` — payout settle (`:553–709`).
- `packages/payments` (101 nodes) + `packages/infrastructure` payment adapters (`infrastructure → payments`, 63 edges) — Razorpay/PayPal/Cashfree/Stripe adapters.
- `packages/checkout-core` (259 nodes, index.ts degree 227) — totals/GST/line math.

## Traced flows (graph TS hops → SQL authority)
| Flow | Graph-visible (TS) | SQL authority (ungraphed) |
|---|---|---|
| COD | checkout-payment-routes COD branch | `create_checkout_order` (mig 170) |
| Razorpay | verify `:617–661` (sig+replay+amount) → confirmPayment | order/payment tables |
| Refunds | `payments.ts:462–667` step-up→provider→postPaymentLedger | `ledger_entries` (mig 139) |
| Payouts | `payouts.ts` step-up→claim→transfer | `claim_payout_statement_release` (mig 160) |
| Gift cards | gift-cards.ts wrappers | `issue_gift_card`/redeem (mig 170/173) |
| Coupons | coupon validate routes | coupon tables |
| Ledger | `postPaymentLedger`, `post_ledger_transaction` callers | append-only double-entry trigger (mig 139) |
| Settlement | `settlements.ts` | `post_settlement_ledger_transaction` |

## What the graph confirms (structurally)
- Payments is the **most-connected domain** (degree 2,307) — its TS surface is large and heavily cross-referenced, concentrated in api-gateway + the payment/checkout packages, **never in the apps** (apps have zero payment-logic nodes). This matches "server-authoritative amounts, gateway owns money."
- `infrastructure → payments` (63 edges) shows providers are isolated behind adapter interfaces, not inlined into routes.

## What the graph cannot confirm (SQL boundary)
The **canonical ledger, the double-entry balance trigger, the idempotency/`FOR UPDATE` locks, the gift-card redemption tables** are all SQL RPCs — **not nodes** in this graph. Graphify therefore **cannot** certify money correctness; that is established by:
- the certification's code+SQL audit (refund provider-before-ledger, payout atomic claim, gift-card split-brain fixed, append-only ledger), and
- the `canonical-ledger-only` / `commission-bps-zero` validators.

## Verdict
The payment *application surface* is the graph's densest, cleanest domain (adapter-isolated, gateway-owned, app-free). The payment *ledger* is invisible to the graph — re-index with SQL to bring `create_checkout_order`/`post_ledger_transaction`/`claim_payout_statement_release` into the graph and make money-flow paths traceable end-to-end. Until then, migrations 139/160/170/173 remain the money authority, not Graphify.
