# Replay Operations Governance

Status: Phase 3 operations-final replay operations foundation.

## Authority

- Replay storage contracts live in `packages/distributed-runtime/src/replay-storage-runtime.ts`.
- Replay scheduling, inspection, dry-run impact analysis, authorization, checkpoint coordination, rollback planning, and replay telemetry live in `packages/distributed-runtime/src/replay-operations-runtime.ts`.
- Event replay policy may be invoked by service runtimes only after authorization and audit checks.

## Rules

- Non-dry-run replay requires an approved authorization that has not expired.
- Replay operations must identify event type scope, tenant scope when applicable, cursor, batch size, and expected impact.
- Replay rollback requires an explicit rollback plan and checkpoint identifier.
- Replay must preserve original event ids and correlation metadata.

## Enforcement

- Runtime manifests must declare `replayOwnership` and `replayExecutionOwnership`.
- `runtime_replay_executions`, `replay_operation_schedules`, and `replay_dry_run_results` are the interim persistence surfaces.
- Validators hard fail replay execution contracts outside `packages/distributed-runtime`.
