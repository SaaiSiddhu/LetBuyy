# Queue Runtime Governance

Status: Phase 3 distributed queue foundation.

## Authority

- Queue policies, partitioning, retry, dead-letter, visibility timeout, consumer coordination, and backpressure contracts live in `packages/distributed-runtime`.
- Services own queue execution containers and adapter wiring.
- Apps do not produce or consume durable queues directly.

## Persistence

`distributed_queue_messages` is the canonical Phase 3 queue persistence table. Existing `platform_queue_jobs` remains a compatibility queue used by current API gateway execution adapters.

## Rules

- Queue messages require idempotency keys, correlation metadata, tenant partition keys when tenant-owned, attempts, visibility leases, and dead-letter policy.
- Consumers must heartbeat or release leases.
- Retry schedules must be explicit and bounded.
- Dead-letter redrive must go through operations control contracts.
