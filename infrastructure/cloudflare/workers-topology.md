# Cloudflare Workers and Queue Topology

LetBuyy uses Cloudflare Workers for service ingress and Cloudflare Queues for production async delivery.

## Workers

| Worker | Runtime root | Role | Queue bindings |
|---|---|---|---|
| `letbuyy-api-dev` | `services/api-gateway` | Development Hono `/v1` API, scheduled dispatch, operational control-plane producer | Producers for `letbuyy-events-dev`, `letbuyy-analytics-dev`, `letbuyy-search-indexing-dev`, `letbuyy-notifications-dev` |
| `letbuyy-api` | `services/api-gateway` | Hono `/v1` API, scheduled dispatch, operational control-plane producer | Producers for `letbuyy-events`, `letbuyy-analytics`, `letbuyy-search-indexing`, `letbuyy-notifications` |
| `letbuyy-webhooks-dev` | `services/webhook-service` | Development provider webhook ingress | Produces events through API/outbox contracts scoped to development |
| `letbuyy-webhooks` | `services/webhook-service` | Provider webhook ingress | Produces events through API/outbox contracts |
| `letbuyy-queue-workers-dev` | `services/queue-workers` | Development Cloudflare Queue consumer, DLQ persistence, telemetry emission | Consumers for development runtime queues and `letbuyy-dead-letters-dev` |
| `letbuyy-queue-workers` | `services/queue-workers` | Cloudflare Queue consumer, DLQ persistence, telemetry emission | Consumers for runtime queues and `letbuyy-dead-letters` |

## Queues

| Queue | Purpose | DLQ | Consumer |
|---|---|---|---|
| `letbuyy-events-dev` | Development commerce event fanout | `letbuyy-dead-letters-dev` | `letbuyy-queue-workers-dev` |
| `letbuyy-analytics-dev` | Development analytics rollups and telemetry jobs | `letbuyy-dead-letters-dev` | `letbuyy-queue-workers-dev` |
| `letbuyy-search-indexing-dev` | Development product/order search projection updates | `letbuyy-dead-letters-dev` | `letbuyy-queue-workers-dev` |
| `letbuyy-notifications-dev` | Development email and customer notification fanout | `letbuyy-dead-letters-dev` | `letbuyy-queue-workers-dev` |
| `letbuyy-dead-letters-dev` | Development poison message retention and redrive source | None | `letbuyy-queue-workers-dev` |
| `letbuyy-events` | Durable commerce event fanout | `letbuyy-dead-letters` | `letbuyy-queue-workers` |
| `letbuyy-analytics` | Analytics rollups and telemetry jobs | `letbuyy-dead-letters` | `letbuyy-queue-workers` |
| `letbuyy-search-indexing` | Product/order search projection updates | `letbuyy-dead-letters` | `letbuyy-queue-workers` |
| `letbuyy-notifications` | Email and customer notification fanout | `letbuyy-dead-letters` | `letbuyy-queue-workers` |
| `letbuyy-dead-letters` | Poison message retention and redrive source | None | `letbuyy-queue-workers` |

Queue creation is owned by `infrastructure/cloudflare/queues.tf`. Runtime bindings are owned by each service `wrangler.toml`.

## Environment Deployment

Development, staging, and production use explicit Wrangler environments. Queue producer and consumer bindings are repeated under each `[env.*]` block because Wrangler environment configuration does not inherit queue bindings from the top-level Worker configuration.

| Environment | API route | Webhook route | Queue suffix | KV namespace | R2 bucket |
|---|---|---|---|---|---|
| dev | `api-dev.letbuyy.store` | `webhooks-dev.letbuyy.store` | `-dev` | `letbuyy-runtime-cache-dev` | `letbuyy-dev-storage` |
| staging | `api.staging.letbuyy.store` | `webhooks.staging.letbuyy.store` | `-staging` | `letbuyy-runtime-cache-staging` | `letbuyy-staging-storage` |
| production | `api.letbuyy.store` | `webhooks.letbuyy.store` | none | `letbuyy-runtime-cache` | `letbuyy-production-storage` |

## Edge Storage

`infrastructure/cloudflare/storage.tf` owns development, staging, and production Cloudflare KV namespaces for runtime cache coordination and R2 buckets for object storage. Worker `wrangler.toml` files bind those resources at runtime; secret values and generated resource IDs stay in Cloudflare/Terraform state, not in git.

## Rollout Commands

- Plan-only validation: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=production --target=all`.
- Plan development Workers: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=dev --target=workers`.
- Execute development Cloudflare primitives: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=dev --target=cloudflare --execute`.
- Execute development Workers: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=dev --target=workers --execute`.
- Execute production rollout: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=production --target=all --execute`.
- Roll back a Worker deployment: `node infrastructure/scripts/deploy/production-rollback.mjs --environment=production --worker=letbuyy-api --version-id=<version-id> --reason=<summary>`.
