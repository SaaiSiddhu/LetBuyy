# Task 001 - Foundation
Status: done
DependsOn: []
Covers: V1 foundation F1-F12
Conforms-to: V1 sections 2, 3, 7, 8, Appendix C row 001

## Goal

Build the load-bearing platform primitives: tenant isolation, outbox, typed events, scoped compensation, idempotency, money ledger, migration/rollback, channel, observability, security, boundary enforcement, and proof harness.

## Scope

In: F1-F12 with full F6 rigor on real local Postgres.

Out: standalone event-bus/schema registry/general saga/full SLO-chaos governance/new partitioning/reserved-service activation.

## Reuse

Extend `services/api-gateway/src/lib/tenant-context.ts`, `lib/crypto.ts`, `lib/replayable-secret-redaction.ts`, `packages/event-core`, `packages/tenant-core`, existing baseline tables, migrations `107`, `119`, `130`, `131`, and V2 status conventions.

## Files

Create: `database/supabase/migrations/139_executable_foundation_ledger_core.sql`, `database/supabase/rollback/139_executable_foundation_ledger_core.rollback.sql`, `tests/executable/money-ledger-postgres.test.mjs`, `tests/executable/foundation-reference-postgres.test.mjs`, `services/api-gateway/src/lib/foundation-observability.ts`.

Modify: `packages/event-core/src/index.ts`, `packages/tenant-core/src/index.ts`, `packages/payments/src/index.ts`, `packages/shared-types/src/index.ts`, `services/api-gateway/src/lib/tenant-context.ts`, `services/api-gateway/src/lib/crypto.ts`, tests, status/ledger/report files.

## Database

Migrations: `139_executable_foundation_ledger_core.sql` plus rollback proof script. Tables: `compensation_actions`, `outbox_consumptions`, `ledger_accounts`, `ledger_transactions`, `ledger_entries`. RLS: ENABLE+FORCE+GUC for new tenant tables. Partition: dormant seam only.

## APIs

No new public API required for F1-F12 except internal proof/operations helpers if needed. Existing routes continue to use `/v1`.

## Events

Publishes/Subscribes: V1 event catalog via outbox; duplicate `event_id` gives one effect.

## Acceptance

Tenant GUC unset returns zero rows; domain write + outbox commit atomically; outbox relay publishes; idempotent consumer posts balanced ledger entries; replay causes no double effect; audit/tracing present; no PII in logs; F6 four proof suites pass on real local Postgres.

## Tests

Unit, integration, contract, and real local Postgres proof suites for property balance, reconciliation, reversing entries, and concurrency.

Current evidence:

- F6 proof PASS on Docker Postgres `letbuyy-executable-pg` using host port `54339`.
- Task 001 reference slice PASS on Docker Postgres `letbuyy-executable-pg`: tenant-scoped domain write + outbox commit, publish stamping, idempotent consumer, balanced ledger post, audit correlation, replay no double effect, RLS fail-closed, forward+rollback proof.
- `pnpm --filter @letbuyy/payments run test` PASS 3/3.
- `pnpm --filter @letbuyy/event-core run test` PASS 4/4.
- `pnpm run test:unit:gateway` PASS 162/162.
- `pnpm turbo typecheck` PASS 59/59 after temporary workspace-link restore.
- `cd services/api-gateway && npx tsc --noEmit` PASS.
- `node scripts/validate-governance.mjs` PASS 172.
- `node scripts/validate-architecture.mjs` PASS.

## Rollback

Revert code, run local rollback script/manifest, keep live external paths disabled in mock mode.

## [HUMAN-REQUIRED]

`HR-KMS-LIVE`, `HR-PROD-MIGRATE-DEPLOY`.
