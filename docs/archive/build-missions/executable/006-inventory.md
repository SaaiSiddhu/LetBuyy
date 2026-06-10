# Task 006 - Inventory
Status: done
DependsOn: [001]
Covers: oversell-proof inventory
Conforms-to: V1 section 3, Appendix C row 006

## Goal

Implement Available/Committed/Reserved/Consumed inventory with TTL reservations and optimistic concurrency.

## Scope

In: reserve/commit/release, multi-location, stale reservation sweeper. Out: partitioning.

## Reuse

`services/api-gateway/src/routes/inventory.ts`, baseline inventory tables, migration `088`.

## Database

Use/extend `inventory_levels`, `inventory_reservations`, `locations` with `version`, TTL indexes, idempotency keys, tenant-GUC RLS, and RPC writers.

## APIs

`POST /inventory/reserve`, `/commit`, `/release`, `GET /inventory/:variant`.

## Events

`inventory.reserved.v1`, `inventory.committed.v1`, `inventory.released.v1`, `inventory.low.v1`.

## Acceptance

Concurrent reserve on last unit has exactly one winner; abandoned reservations auto-release. Verified on real local Postgres with the additive migration and rollback proof.

## Tests

`tests/executable/inventory-postgres.test.mjs`; `services/api-gateway/src/__tests__/inventory-reservations.test.ts`; `pnpm run test:unit:gateway` PASS 170/170; `pnpm --filter @letbuyy/commerce-core run typecheck` PASS.

## Rollback

Disable reservation enforcement and rollback additive columns/tables.

## [HUMAN-REQUIRED]

None.
