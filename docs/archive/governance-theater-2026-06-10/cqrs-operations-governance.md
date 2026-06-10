# CQRS Operations Governance

Status: Phase 3 operations-final CQRS operations foundation.

## Authority

- Command persistence and query consistency contracts live in `packages/distributed-runtime/src/cqrs-runtime.ts`.
- Projection persistence, consistency verification, drift detection, repair planning, and projection operational snapshots live in `packages/projection-runtime`.
- Runtime composition may read projections but does not own projection persistence.

## Rules

- Commands requiring durability must use idempotency keys and command journal persistence.
- Projection rebuilds must checkpoint progress and record failed counts.
- Query serving must respect consistency contracts and staleness budgets.
- Projection repair must prefer replay-safe rebuilds over ad hoc mutation.

## Enforcement

- Runtime manifests must declare `cqrsOwnership` and projection ownership.
- `runtime_command_journal`, `projection_checkpoints`, `projection_operation_snapshots`, and `query_snapshots` are the interim persistence surfaces.
- Validators hard fail CQRS and projection operation leakage.
