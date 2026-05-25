# Event Store Governance

The production event store is the Supabase Postgres append-only event store until a dedicated event-store provider is introduced behind `packages/distributed-runtime`.

## Ownership

- Contracts: `packages/distributed-runtime/src/event-store-runtime.ts`
- Persistence: `distributed_event_streams`, `distributed_event_store`, and `event_stream_snapshots`
- Replay scheduling: `runtime_replay_executions` and `replay_operation_schedules`
- Replay authorization: `/v1/operations/runtime/replays/:replayId/authorize`
- Integrity checks: `event_store_integrity_checks` and `/v1/operations/runtime/event-store/integrity`
- Archival execution: `/v1/operations/runtime/event-store/archive`
- Production verification SQL: `database/supabase/verification/063_absolute_production_operationalization.sql`
- Production verification runner: `infrastructure/scripts/database/verify-supabase-operations.mjs`

## Rules

- Events must be append-only and idempotent by stream/idempotency key.
- Replay reads must be authorized, bounded, checkpointed, and telemetry-emitting.
- Snapshot persistence must include stream position and version.
- Event archival must preserve legal hold and retention classes.
- Production replay or archival cannot start while the latest integrity check for the target stream is failed.
- Supabase production promotion must verify operational tables, RLS policies, helper functions, and a replay-safe integrity check before deployment gates are marked healthy.
