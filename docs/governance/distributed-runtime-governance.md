# Distributed Runtime Governance

Status: Phase 3 durable execution foundation.

## Authority

- `packages/distributed-runtime` owns provider-neutral contracts for append-only event persistence, queue execution, replay storage, checkpoint storage, distributed coordination, CQRS metadata, tenant workload governance, resilience, telemetry, cache invalidation, regional execution, operations, and runtime security.
- Services own execution-container wiring only. They may claim jobs, persist checkpoints, dispatch events, and call provider adapters, but they must not define durable runtime policy locally.
- Apps have no distributed execution ownership. They may propagate correlation metadata and call service APIs.

## Persistence

Supabase migration `059_distributed_runtime_operations_foundation.sql` creates the interim durable persistence layer:

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

## Enforcement

`scripts/validators/distributed-runtime-validator.mjs` hard fails missing Phase 3 package files, missing manifest ownership fields, missing migration tables/RLS, direct app imports of distributed runtime packages, application-service leakage into distributed execution, and local definitions of event-store, queue, or projection persistence contracts outside their owning packages.
