# Cloudflare Workers and Queue Topology

LetBuyy uses Cloudflare Workers for service ingress and Cloudflare Queues for async delivery. Staging and production are the only Worker environments.

## Workers

| Worker | Runtime root | Role | Queue bindings |
|---|---|---|---|
| `letbuyy-api-staging` | `services/api-gateway` | Staging Hono `/v1` API, scheduled dispatch, operational control-plane producer | Producers for `letbuyy-events-staging`, `letbuyy-analytics-queue-staging`, `letbuyy-search-queue-staging`, `letbuyy-notifications-queue-staging`, `letbuyy-staging-queue` |
| `letbuyy-api` | `services/api-gateway` | Production Hono `/v1` API, scheduled dispatch, operational control-plane producer | Producers for `letbuyy-events-production`, `letbuyy-analytics-queue-production`, `letbuyy-search-queue-production`, `letbuyy-notifications-queue-production`, `letbuyy-production-queue` |
| `letbuyy-webhook-staging` | `services/webhook-service` | Staging provider webhook ingress | Produces events through API/outbox contracts scoped to staging |
| `letbuyy-webhook` | `services/webhook-service` | Production provider webhook ingress | Produces events through API/outbox contracts scoped to production |
| `letbuyy-queue-workers-staging` | `services/queue-workers` | Staging Cloudflare Queue consumer, DLQ persistence, telemetry emission | Consumers for staging runtime queues and `letbuyy-dead-letters-staging` |
| `letbuyy-queue-workers` | `services/queue-workers` | Production Cloudflare Queue consumer, DLQ persistence, telemetry emission | Consumers for production runtime queues and `letbuyy-dead-letters-production` |

## Queues

| Queue | Purpose | DLQ | Consumer |
|---|---|---|---|
| `letbuyy-events-staging` | Staging commerce event fanout | `letbuyy-dead-letters-staging` | `letbuyy-queue-workers-staging` |
| `letbuyy-analytics-queue-staging` | Staging analytics rollups and telemetry jobs | `letbuyy-dead-letters-staging` | `letbuyy-queue-workers-staging` |
| `letbuyy-search-queue-staging` | Staging product/order search projection updates | `letbuyy-dead-letters-staging` | `letbuyy-queue-workers-staging` |
| `letbuyy-notifications-queue-staging` | Staging email and customer notification fanout | `letbuyy-dead-letters-staging` | `letbuyy-queue-workers-staging` |
| `letbuyy-dead-letters-staging` | Staging poison message retention and redrive source | None | `letbuyy-queue-workers-staging` |
| `letbuyy-staging-queue` | Staging provider execution, replay and deployment lineage jobs | `letbuyy-staging-dead-letter-queue` | `letbuyy-queue-workers-staging` |
| `letbuyy-staging-dead-letter-queue` | Staging provider execution poison message retention | None | `letbuyy-queue-workers-staging` |
| `letbuyy-events-production` | Production commerce event fanout | `letbuyy-dead-letters-production` | `letbuyy-queue-workers` |
| `letbuyy-analytics-queue-production` | Production analytics rollups and telemetry jobs | `letbuyy-dead-letters-production` | `letbuyy-queue-workers` |
| `letbuyy-search-queue-production` | Production product/order search projection updates | `letbuyy-dead-letters-production` | `letbuyy-queue-workers` |
| `letbuyy-notifications-queue-production` | Production email and customer notification fanout | `letbuyy-dead-letters-production` | `letbuyy-queue-workers` |
| `letbuyy-dead-letters-production` | Production poison message retention and redrive source | None | `letbuyy-queue-workers` |
| `letbuyy-production-queue` | Production provider execution, replay and deployment lineage jobs | `letbuyy-production-dead-letter-queue` | `letbuyy-queue-workers` |
| `letbuyy-production-dead-letter-queue` | Production provider execution poison message retention | None | `letbuyy-queue-workers` |

Queue creation is owned by `infrastructure/cloudflare/queues.tf`. Runtime bindings are owned by each service `wrangler.toml`.

## Environment Deployment

Staging and production use explicit Wrangler environments. Queue producer and consumer bindings are repeated under each `[env.*]` block because Wrangler environment configuration does not inherit queue bindings from the top-level Worker configuration.

| Environment | API route | Webhook route | Queue suffix | KV namespace | R2 bucket | D1 database | Telemetry dataset |
|---|---|---|---|---|---|---|---|
| staging | `api.staging.letbuyy.store` | `webhooks.staging.letbuyy.store` | `-staging` | `letbuyy-runtime-cache-staging` | `letbuyy-media-staging` | `letbuyy-staging-d1` | `letbuyy-staging-telemetry` |
| production | `api.letbuyy.store` | `webhooks.letbuyy.store` | `-production` for workload queues | `letbuyy-runtime-cache-production` | `letbuyy-media-production` | `letbuyy-production-d1` | `letbuyy-production-telemetry` |

## Edge Storage

`infrastructure/cloudflare/storage.tf` owns staging and production Cloudflare KV namespaces, R2 buckets, and D1 databases. Worker `wrangler.toml` files bind those resources at runtime; secret values and generated resource IDs stay in Cloudflare/Terraform state, not in git.

Durable Object namespaces are created through the API Gateway Worker deployment and the `v1-runtime-coordinator` migration. They are governed by `config/runtime/cloudflare-topology.json` and must remain isolated by Worker environment.

## Rollout Commands

- Plan-only staging validation: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=staging --target=all`.
- Execute staging Cloudflare primitives: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=staging --target=cloudflare --execute`.
- Execute staging Workers: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=staging --target=workers --execute`.
- Execute production rollout: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=production --target=all --execute`.
- Roll back a Worker deployment: `node infrastructure/scripts/deploy/production-rollback.mjs --environment=production --worker=letbuyy-api --version-id=<version-id> --reason=<summary>`.
