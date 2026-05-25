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

## Environment Deployment

Production and staging use explicit Wrangler environments. Queue producer and consumer bindings are repeated under each `[env.*]` block because Wrangler environment configuration does not inherit queue bindings from the top-level Worker configuration.

| Environment | API route | Webhook route | Queue suffix |
|---|---|---|---|
| staging | `api.staging.letbuyy.store` | `webhooks.staging.letbuyy.store` | `-staging` |
| production | `api.letbuyy.store` | `webhooks.letbuyy.store` | none |

## Edge Storage

`infrastructure/cloudflare/storage.tf` owns the production and staging Cloudflare KV namespaces for runtime cache coordination and R2 buckets for object storage. Worker `wrangler.toml` files bind those resources at runtime; secret values and generated resource IDs stay in Cloudflare/Terraform state, not in git.

## Rollout Commands

- Plan-only validation: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=production --target=all`.
- Execute production rollout: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=production --target=all --execute`.
- Roll back a Worker deployment: `node infrastructure/scripts/deploy/production-rollback.mjs --environment=production --worker=letbuyy-api --version-id=<version-id> --reason=<summary>`.
