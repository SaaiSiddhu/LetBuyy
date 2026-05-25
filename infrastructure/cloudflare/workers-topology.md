# Cloudflare Workers and Queue Topology

LetBuyy uses Cloudflare Workers for service ingress and Cloudflare Queues for production async delivery.

## Workers

| Worker | Runtime root | Role | Queue bindings |
|---|---|---|---|
| `letbuyy-api` | `services/api-gateway` | Hono `/v1` API, scheduled dispatch, operational control-plane producer | Producers for `letbuyy-events`, `letbuyy-analytics`, `letbuyy-search-indexing`, `letbuyy-notifications` |
| `letbuyy-webhooks` | `services/webhook-service` | Provider webhook ingress | Produces events through API/outbox contracts |
| `letbuyy-queue-workers` | `services/queue-workers` | Cloudflare Queue consumer, DLQ persistence, telemetry emission | Consumers for runtime queues and `letbuyy-dead-letters` |

## Queues

| Queue | Purpose | DLQ | Consumer |
|---|---|---|---|
| `letbuyy-events` | Durable commerce event fanout | `letbuyy-dead-letters` | `letbuyy-queue-workers` |
| `letbuyy-analytics` | Analytics rollups and telemetry jobs | `letbuyy-dead-letters` | `letbuyy-queue-workers` |
| `letbuyy-search-indexing` | Product/order search projection updates | `letbuyy-dead-letters` | `letbuyy-queue-workers` |
| `letbuyy-notifications` | Email and customer notification fanout | `letbuyy-dead-letters` | `letbuyy-queue-workers` |
| `letbuyy-dead-letters` | Poison message retention and redrive source | None | `letbuyy-queue-workers` |

Queue creation is owned by `infrastructure/cloudflare/queues.tf`. Runtime bindings are owned by each service `wrangler.toml`.
