# Queue Provider Governance

Cloudflare Queues is the selected Phase 4 production queue provider.

## Ownership

- Queue infrastructure: `infrastructure/cloudflare/queues.tf`
- Producer bindings: `services/api-gateway/wrangler.toml`
- Consumer bindings: `services/queue-workers/wrangler.toml`
- Consumer source: `services/queue-workers/src/index.ts`
- Operational persistence: `distributed_queue_messages`, `queue_operation_snapshots`, and `queue_recovery_operations`
- Provider validation: `infrastructure/scripts/cloudflare/verify-provider-contracts.mjs`

## Required Queues

- Staging:
  - `letbuyy-events-staging`
  - `letbuyy-analytics-queue-staging`
  - `letbuyy-search-queue-staging`
  - `letbuyy-notifications-queue-staging`
  - `letbuyy-dead-letters-staging`
- Production:
  - `letbuyy-events-production`
  - `letbuyy-analytics-queue-production`
  - `letbuyy-search-queue-production`
  - `letbuyy-notifications-queue-production`
  - `letbuyy-dead-letters-production`

## Rules

- Every production queue must have a DLQ unless it is itself a DLQ.
- Staging and production queue names must be unique and must not share producers, consumers, DLQs, or telemetry labels.
- Redrive requires operator authorization and audit through `/v1/operations/runtime/queues/:queueName/redrive-dead-letters`.
- Queue consumers must emit telemetry and persist retry/dead-letter state.
- Consumer concurrency, retry delay, batch size, and DLQ routing must be explicit in `services/queue-workers/wrangler.toml`.
- Cloudflare provider validation must prove Terraform queue declarations, Worker producer bindings, consumer DLQ routing, retry settings, and optional live Cloudflare account resources before production promotion.
- Queue outage and DLQ recovery procedures live in `docs/runbooks/queue-dlq-redrive.md`.
