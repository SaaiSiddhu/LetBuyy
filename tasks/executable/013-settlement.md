# Task 013 - Settlement
Status: done
DependsOn: [001,004,005]
Covers: settlement and PA split
Conforms-to: V1 sections 3, 8, Appendix C row 013

## Goal

Ingest PA/COD statements, post to F6 ledger, reconcile, manage breaks/suspense/reserves, and produce PA split instructions without custody.

## Scope

In: canonical ledger-backed settlement; compatibility for mobile payout/wallet/commission. Out: self-custody and reseller commission.

## Reuse

`payouts.ts`, `wallet.ts`, `commission.ts`, migration `119`, `packages/billing-core`, payout adapter.

## Database

`settlements`, `reserves`, `payouts`, `payout_items`, `recon_breaks`, canonical ledger link columns on `payout_statements`, `wallet_ledger_entries`, and `commission_reconciliation_entries`; migration `151_executable_settlement_ledger.sql` with rollback proof.

## APIs

`POST /settlements/ingest`, `GET /settlements/:site`, plus existing payout/wallet/commission endpoints reconciled to canonical F6 ledger transaction ids.

## Events

`settlement.recorded.v1`, `settlement.recon_break_detected.v1`, `payout.scheduled.v1`, `payout.paid.v1`, `payout.failed.v1`.

## Acceptance

Ledger balanced post-recon; COD cash-in-transit modeled via `cod_receivable`; payout instructions are no-custody PA split instructions with step-up metadata; recon breaks are explained through `reserve`; mobile V2 payout/wallet/commission compatibility rows link to canonical ledger transactions.

## Tests

Real Postgres settlement proof PASS; billing-core typecheck/test PASS 8/8; gateway typecheck PASS; focused settlement route tests PASS 3/3; human-required live-path skips PASS 10 skipped; gateway unit PASS 199/199; lint/governance/architecture PASS.

## Rollback

Revert to compatibility reads, rollback additive DB.

## [HUMAN-REQUIRED]

`HR-PA-SPLIT-LIVE`, `HR-LEGAL-DPDP-PA`.
