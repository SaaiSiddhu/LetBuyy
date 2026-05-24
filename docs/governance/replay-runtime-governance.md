# Replay Runtime Governance

Status: Phase 3 replay-safe runtime foundation.

## Authority

- Replay storage contracts live in `packages/distributed-runtime/src/replay-storage-runtime.ts`.
- Event handler replay policy remains in `packages/orchestration`.
- Projection replay execution lives in `packages/projection-runtime`.
- Services own only the runtime execution container for approved replay operations.

## Rules

- Every replay requires an explicit replay id, owner runtime, event type scope, cursor, batch size, reason, requester, approval, and authorization expiry.
- Replay must preserve event id, stream position, global position, schema version, correlation id, trace id, tenant scope, and idempotency key.
- Replay may be dry-run, paused, cancelled, completed, or failed. Silent replay is forbidden.

## Operations

Replay state persists in `runtime_replay_executions`. Replay progress and crash recovery use `runtime_checkpoints`.
