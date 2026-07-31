# 09 — Payouts / Merchant Settlement (Stream I)

**Readiness: PARTIAL.** Ledger math + release guard are correct; the provider is gated off pending PA onboarding (human seam H8).

## What works (code-verified)
- `payout_statements` CRUD: reads paid orders, excludes already-included, computes gross/commission/GST/net, posts `wallet_ledger_entries` + canonical fee-assessment ledger entry.
- `claim_payout_statement_release` RPC: `FOR UPDATE` on the statement + **balance check** (`ledger_account_balance_minor(merchant_payable) >= net`) before release — an insolvency guard.
- Release ledger posting reverses the capture's `merchant_payable` credit. Commission from `commission_schedules`; GST 18% on platform fee → `platform_revenue`/`gst_payable`.
- Step-up gate on `POST /:id/settle` ✅. Razorpay Route provider client makes a real `POST /v1/transfers` call.

## NOT live / open
| ID | Sev | Finding |
|---|---|---|
| R-07 | INFO | `RAZORPAY_ROUTE_ACCOUNT_ID` + `RAZORPAY_ROUTE_PROVIDER_ENABLED` absent → `POST /:id/settle` returns 503 in all environments. **Human seam H8** (Razorpay Route PA license + onboarding — regulatory, weeks). |
| R-03 | MED | Payout creation reads order eligibility in TS before insert; two concurrent different-key requests can double-include the same paid orders in separate statements (no DB-level order claim; `orders` has no `payout_statement_id`). Fix before any real-concurrency payout. |

## Live gate
**CAP-C03** (live payout provider cert) — blocked by H8 (PA onboarding) + R-03 (fix the order double-inclusion race first).

## Verdict
Payout engineering is sound and correctly gated-off-with-503. It is **not launch-critical for Oct 1 commerce** (merchants get paid via settlement after the launch window), but real payouts require H8 + the R-03 fix.
