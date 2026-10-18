# F9 payout release finalization atomicity — 5 October 2026

## Result

Migration 301 adds a service-role-only finalizer for the database work that
follows the payout adapter. The Gateway keeps the provider call outside the
SQL transaction, then commits the recorded provider result, the
canonical `merchant_payable` debit / `pa_clearing` credit, the posted wallet
debit and the linked settlement payout instruction together. The function
locks the tenant payout statement, checks its durable release claim and amount,
and rejects conflicting provider results or accounting projections. Retrying
an already released statement repairs/verifies the same effects instead of
short-circuiting past them. Rollback drops the function and retains posted
financial evidence.

## Verification

- The real Gateway and runner-owned PostgreSQL 16/PostgREST suite passed
  **1/1** with zero failures, skips, TODOs or cancellations (`a68db73f7cf1`).
  It reads a settlement-backed payout through the owner route, confirms a
  different tenant receives 404 for that statement, then calls the owner
  release route using a local HTTP stub for the provider endpoint; no
  request leaves the test process. The stub first returned Razorpay's
  documented concurrent-idempotent-request response (409), then synthetic
  success after two injected database failures: a wallet-debit insert failure
  and a settlement payout-instruction update
  failure. The 409 left the statement safely processing with no accounting
  effects, and the retry reached the provider again. Each database fault left
  no canonical payout transaction or wallet debit and the instruction still
  scheduled. The final retry produced one released statement, one canonical
  ledger posting, one wallet debit and a paid instruction with matching
  provider references. The same suite now also replays a settlement-backed
  statement through the generic payout route and confirms its one
  settlement-linked pending wallet projection is not duplicated.
- All four provider requests derived the same provider-safe idempotency key
  from the durable release claim and tenant statement scope and sent the same
  body. Exact route replay
  created no duplicate effects and did not call the provider again. A changed provider reference was
  rejected. The suite verified `service_role` execution and denial for `anon`,
  `authenticated` and `app_tenant`, then rolled back/reapplied migration 301
  while preserving payout evidence.
- `pnpm --filter @letbuyy/api-gateway typecheck` passed;
  `pnpm run validate:migrations` passed; focused provider, idempotency,
  settlement and money contracts passed **20/20**; `git diff --check` passed.
- Focused source-contract assertions also verify the route-to-finalizer wiring.
- The provider endpoint was intercepted inside the test process. No provider
  sandbox, hosted account, live transfer or live-money movement was used.

## Remaining

This closes local database finalization after a provider response and implements
the public Route direct-transfer idempotency contract for retrying an unknown
response, including its `X-Transfer-Idempotency` header, bounded stable key,
same-payload retry, and non-definitive handling of 409/429/5xx outcomes. The
Gateway idempotency middleware also leaves a pending payout response retryable.
The generic payout replay path now recognizes settlement-backed statements,
reuses their settlement-scoped wallet projection key, validates its settlement
reference, and fails closed if that atomic source projection is missing rather
than appending a second pending credit.
It does not prove LetBuyy's provider account supports or accepts this journey,
nor provide an operator reconciliation workflow for persistently ambiguous
results. Weekly eligibility, holds, refunds, COD treatment, release
authorization, reversal handling and provider statement reconciliation remain
open. Broader F3.7 capture/refund/COD source-to-ledger and Phase 10 attribution
ownership remain open as well. See the dated [Route API contract review](RESEARCH_AND_CLOUD_FINDINGS.md#razorpay-route-direct-transfer-retry-contract--5-october-2026).
