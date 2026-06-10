# Queue Operations Governance

Status: Phase 3 operations-final queue operations foundation.

## Authority

- Durable queue execution contracts live in `packages/distributed-runtime/src/queue-runtime.ts`.
- Queue inspection, lag diagnostics, partition balancing, stuck lease recovery, dead-letter redrive, and queue operational projections live in `packages/distributed-runtime/src/queue-operations-runtime.ts`.
- Queue consumers may execute operations only through service runtimes or queue worker runtimes.

## Rules

- Every redrive must include an operator reason, correlation metadata, and audit trail.
- Expired lease recovery must use fencing tokens, idempotency keys, and attempt limits.
- Poison-message handling must move messages to dead-letter state instead of infinite retry.
- Queue partition balancing must preserve tenant partition keys and noisy-neighbor isolation.

## Enforcement

- Runtime manifests must declare `queueOwnership` and `queueExecutionOwnership`.
- `distributed_queue_messages`, `distributed_queue_heartbeats`, `queue_operation_snapshots`, and `queue_recovery_operations` are the interim persistence surfaces.
- `scripts/validators/distributed-runtime-validator.mjs` hard fails queue operations contract leakage.
