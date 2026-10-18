# F9 settlement payout instruction atomicity — 5 October 2026

## Result

Migration 300 adds a service-role-only database transaction for a recorded
Razorpay Route settlement's payout-side state. It locks and revalidates the
tenant settlement, invokes the existing atomic payout-statement/wallet/fee
writer in the same SQL transaction, then creates or checks the no-custody
payout instruction, its single settlement item, and the typed
`payout.scheduled` outbox event. Exact retries converge on the existing rows;
conflicting source, amount, instruction, item or event data aborts the unit.
The Gateway no longer creates these payout-side records through separate
requests.

The procedure records a payout instruction only. It does not invoke a provider,
move money, prove step-up approval, or close weekly eligibility, hold, reversal
or provider-reconciliation requirements. The provider guard also keeps a
Cashfree sandbox settlement from creating a mismatched Route payout: the
settlement and its own event can be recorded, while no Route payout statement,
instruction, item or scheduled event is created.

## Verification

- Real Gateway settlement journey against runner-owned PostgreSQL 16/PostgREST:
  **1/1** test passed, zero failures/skips/TODOs/cancellations
  (`576a0b9e5198`). The test injects failure at payout-item insertion and at
  `payout.scheduled` outbox insertion. In both cases it verifies the payout
  statement, wallet row, payout instruction, payout item and scheduled event
  all roll back together, then exact settlement retry creates one complete
  set. Existing statement wallet/fee fault injection, changed-payload replay,
  concurrent statement requests and settlement replay checks also pass.
- The same Gateway/Postgres journey records a synthetic Cashfree sandbox
  settlement without creating any Razorpay Route payout rows or event.
- The suite verifies direct RPC denial for `anon`, `authenticated` and
  `app_tenant`, `service_role` access, and rollback/reapply while preserving
  committed payout data.
- Gateway typecheck passed; migration-safety validation passed; focused
  settlement route contracts passed **3/3** and money/ledger contracts passed
  **15/15**. No provider sandbox, hosted account,
  live payout or live-money movement was used.

## Remaining

This closes only the payout-side transaction boundary for recorded Route
settlements. F9 weekly eligible selection, holds/refunds/COD treatment, payout
release authorization and failure/reversal recovery, and provider
reconciliation remain open. F3.7 still needs its wider capture/settlement/refund/
COD source-to-ledger census, and finance/ARB decisions still govern COD
receivable recognition and fee/tax policy.
