# Queue Provider Governance

Cloudflare Queues is the selected Phase 4 production queue provider.

## Ownership

- Queue infrastructure: `infrastructure/cloudflare/queues.tf`
- Producer bindings: `services/api-gateway/wrangler.toml`
- Consumer bindings: `services/queue-workers/wrangler.toml`
- Consumer source: `services/queue-workers/src/index.ts`
- Operational persistence: `distributed_queue_messages`, `queue_operation_snapshots`, and `queue_recovery_operations`

## Required Queues

- `letbuyy-events`
- `letbuyy-analytics`
- `letbuyy-search-indexing`
- `letbuyy-notifications`
- `letbuyy-dead-letters`

## Rules

- Every production queue must have a DLQ unless it is itself a DLQ.
- Redrive requires operator authorization and audit through `/v1/operations/runtime/queues/:queueName/redrive-dead-letters`.
- Queue consumers must emit telemetry and persist retry/dead-letter state.
- Consumer concurrency, retry delay, batch size, and DLQ routing must be explicit in `services/queue-workers/wrangler.toml`.
- Queue outage and DLQ recovery procedures live in `docs/runbooks/queue-dlq-redrive.md`.
