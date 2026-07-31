# 06 — Payout Hardening

**Readiness: PARTIAL.** Ledger math + balance-checked release guard are correct; provider gated off pending PA onboarding.
Detailed audit: `docs/v1-execution/pre-launch-wave/09-payouts.md`.

## Verified
- `payout_statements` creation (ledger-backed, commission from `commission_schedules`, 18% GST on fee → `platform_revenue`/`gst_payable`). `claim_payout_statement_release` RPC: `FOR UPDATE` + balance check (`merchant_payable >= net`). Step-up gated. Provider client makes a real `POST /v1/transfers`.

## Open / gated
- **R-07 (human seam H8):** `RAZORPAY_ROUTE_ACCOUNT_ID` + `RAZORPAY_ROUTE_PROVIDER_ENABLED` absent → `/settle` returns 503 in all envs. Razorpay Route PA license + onboarding = **regulatory, weeks**. This structurally blocks "Merchant Paid".
- **R-03 (MED):** payout order double-inclusion race — eligibility read in TS before insert; two concurrent different-key requests can double-include orders. Needs a DB-level order claim (`orders.payout_statement_id` + claim in the RPC). Deferred: needs schema + concurrency verification on staging.

**Live cert:** CAP-C03 — blocked by H8 + R-03. Not launch-critical for the Oct-1 commerce window (settlement is post-window), but required before real payouts.
