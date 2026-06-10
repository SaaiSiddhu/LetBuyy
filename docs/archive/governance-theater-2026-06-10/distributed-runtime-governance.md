# Distributed Runtime Governance

Status: Phase 3 final durable execution foundation.

## Authority

- `packages/distributed-runtime` owns provider-neutral contracts and execution state machines for append-only event persistence, queue execution, replay storage, checkpoint storage, distributed coordination, CQRS command journaling, tenant workload governance, resilience, telemetry, cache invalidation, regional execution, operations, and runtime security.
- Services own execution-container wiring only. They may claim jobs, persist checkpoints, dispatch events, and call provider adapters, but they must not define durable runtime policy locally.
- Apps have no distributed execution ownership. They may propagate correlation metadata and call service APIs.

## Persistence

Active baseline migration `database/supabase/migrations/000_baseline.sql` creates the interim durable persistence layer. The historical source migration `059_distributed_runtime_operations_foundation.sql` is archived under `docs/archive/migrations-history/` for audit only:

- `distributed_event_streams`
- `distributed_event_store`
- `runtime_replay_executions`
- `runtime_checkpoints`
- `distributed_queue_messages`
- `runtime_leases`
- `tenant_execution_quotas`
- `provider_health_snapshots`
- `cache_invalidation_events`
- `execution_audit_trail`

These tables are not Kafka or EventStoreDB. They are the canonical persistence contract until dedicated infrastructure is introduced behind the package boundary.

The active baseline also includes the historical `060_operational_runtime_finalization.sql` content for durable command journals, event stream snapshots, projection checkpoints, query snapshots, workflow lifecycle and heartbeat tables, queue heartbeat storage, runtime telemetry spans/metrics/logs, health projections, provider outage records, and runtime control commands.

## Execution Helpers

The database exposes durable helper functions for service execution containers:

- `claim_distributed_queue_messages`
- `heartbeat_distributed_queue_message`
- `complete_distributed_queue_message`
- `retry_distributed_queue_message`
- `dead_letter_distributed_queue_message`
- `claim_runtime_lease`

Services may call these helpers as execution-container wiring. Retry policy, queue lifecycle, leasing, fencing, and dead-letter semantics remain package-owned.

## Enforcement

`scripts/validators/distributed-runtime-validator.mjs` hard fails missing Phase 3 package files, missing manifest ownership fields, missing migration tables/RLS/functions, direct app imports of distributed runtime packages, application-service leakage into distributed execution, and local definitions of event-store, queue, projection, resilience, telemetry, coordination, cache, tenant, audit, or workflow recovery contracts outside their owning packages.
