# F3.7 COD remittance writer privilege correction — 5 October 2026

## Result

Migration 297 revokes default/public execute rights on
`reconcile_cod_remittance_with_ledger` from `PUBLIC`, `anon`, `authenticated`,
and `app_tenant`, while granting the existing Gateway `service_role` caller.
The RPC remains a `SECURITY DEFINER` financial writer, and database access is
now limited to the trusted server boundary that the current route already uses.

The paired rollback deliberately preserves this access boundary. Restoring
`PUBLIC` execute would reopen the direct mutating RPC that this correction
closes.

Migration 298 subsequently made the legacy function private even to
`service_role`, adding a checked wrapper as the sole server entry point; see
the [COD replay-binding evidence](F3_7_COD_RECONCILIATION_REPLAY_2026-10-05.md).

## Verification

- The real Gateway/refund owned-PostgreSQL suite passes **10/10** against
  Postgres 16/PostgREST (`dd69ef5a5c00`). Its ACL regression proves `anon`,
  `authenticated`, and `app_tenant` lack execute, `PUBLIC` has no execute ACL,
  the database rejects direct calls from each API role, and `service_role`
  retains execute. It also runs the paired rollback and verifies the service-only
  boundary remains.
- The same real Gateway suite continues through payment/refund/ledger behavior
  after the ACL migration; owned resources are cleaned by the runner.
- Migration safety validation and API Gateway typecheck pass. No external
  provider, hosted database, or live funds were used.

## Remaining census items

The source-to-ledger census remains open. It also found that the COD reconciliation
RPC returns an existing row for a repeated key without comparing the submitted
entry, deposited amount, or notes, and the route returns that row before calling
the RPC. Bind exact replay to the original request and reject changed payloads
before continuing the capture, refund, settlement, and COD lifecycle review.
