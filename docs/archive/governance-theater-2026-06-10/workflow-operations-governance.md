# Workflow Operations Governance

Status: Phase 3 operations-final workflow operations foundation.

## Authority

- Workflow durability, recovery, checkpoint, and continuation contracts live in `packages/orchestration`.
- Workflow inspection, stuck-state diagnostics, lifecycle snapshots, timeout recovery, heartbeat recovery, and continuation orchestration live in `packages/orchestration/src/workflow-operations-runtime.ts`.
- Services may wire workflow operations but must not own business workflow sequencing.

## Rules

- Workflow recovery must use lifecycle records, checkpoints, heartbeats, and retry policy before resuming work.
- Compensation execution requires the workflow definition to declare compensation steps.
- Stuck workflow diagnostics must be persisted before recovery is attempted.
- Workflow replay must be replay-safe and idempotent.

## Enforcement

- Runtime manifests must declare `workflowRecoveryOwnership` and operational execution fields.
- `workflow_lifecycle`, `workflow_heartbeats`, and `workflow_operation_snapshots` are the interim persistence surfaces.
- Validators hard fail workflow operations contracts outside `packages/orchestration`.
