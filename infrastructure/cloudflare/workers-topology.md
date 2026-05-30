# Cloudflare Workers and Queue Topology

LetBuyy uses Cloudflare Workers for service ingress and Cloudflare Queues for production async delivery.

## Workers

| Worker | Runtime root | Role | Queue bindings |
|---|---|---|---|
| `letbuyy-api-dev` | `services/api-gateway` | Development Hono `/v1` API, scheduled dispatch, operational control-plane producer | Producers for `letbuyy-events-dev`, `letbuyy-analytics-dev`, `letbuyy-search-indexing-dev`, `letbuyy-notifications-dev`, `letbuyy-dev-queue` |
| `letbuyy-api-staging` | `services/api-gateway` | Staging Hono `/v1` API, scheduled dispatch, operational control-plane producer | Producers for `letbuyy-events-staging`, `letbuyy-analytics-staging`, `letbuyy-search-indexing-staging`, `letbuyy-notifications-staging`, `letbuyy-staging-queue` |
| `letbuyy-api` | `services/api-gateway` | Hono `/v1` API, scheduled dispatch, operational control-plane producer | Producers for `letbuyy-events`, `letbuyy-analytics`, `letbuyy-search-indexing`, `letbuyy-notifications`, `letbuyy-production-queue` |
| `letbuyy-webhooks-dev` | `services/webhook-service` | Development provider webhook ingress | Produces events through API/outbox contracts scoped to development |
| `letbuyy-webhooks-staging` | `services/webhook-service` | Staging provider webhook ingress | Produces events through API/outbox contracts scoped to staging |
| `letbuyy-webhooks` | `services/webhook-service` | Provider webhook ingress | Produces events through API/outbox contracts |
| `letbuyy-queue-workers-dev` | `services/queue-workers` | Development Cloudflare Queue consumer, DLQ persistence, telemetry emission | Consumers for development runtime queues and `letbuyy-dead-letters-dev` |
| `letbuyy-queue-workers-staging` | `services/queue-workers` | Staging Cloudflare Queue consumer, DLQ persistence, telemetry emission | Consumers for staging runtime queues and `letbuyy-dead-letters-staging` |
| `letbuyy-queue-workers` | `services/queue-workers` | Cloudflare Queue consumer, DLQ persistence, telemetry emission | Consumers for runtime queues and `letbuyy-dead-letters` |

## Queues

| Queue | Purpose | DLQ | Consumer |
|---|---|---|---|
| `letbuyy-events-dev` | Development commerce event fanout | `letbuyy-dead-letters-dev` | `letbuyy-queue-workers-dev` |
| `letbuyy-analytics-dev` | Development analytics rollups and telemetry jobs | `letbuyy-dead-letters-dev` | `letbuyy-queue-workers-dev` |
| `letbuyy-search-indexing-dev` | Development product/order search projection updates | `letbuyy-dead-letters-dev` | `letbuyy-queue-workers-dev` |
| `letbuyy-notifications-dev` | Development email and customer notification fanout | `letbuyy-dead-letters-dev` | `letbuyy-queue-workers-dev` |
| `letbuyy-dead-letters-dev` | Development poison message retention and redrive source | None | `letbuyy-queue-workers-dev` |
| `letbuyy-dev-queue` | Development provider execution, replay and deployment lineage jobs | `letbuyy-dev-dead-letter-queue` | `letbuyy-queue-workers-dev` |
| `letbuyy-dev-dead-letter-queue` | Development provider execution poison message retention | None | `letbuyy-queue-workers-dev` |
| `letbuyy-events-staging` | Staging commerce event fanout | `letbuyy-dead-letters-staging` | `letbuyy-queue-workers-staging` |
| `letbuyy-analytics-staging` | Staging analytics rollups and telemetry jobs | `letbuyy-dead-letters-staging` | `letbuyy-queue-workers-staging` |
| `letbuyy-search-indexing-staging` | Staging product/order search projection updates | `letbuyy-dead-letters-staging` | `letbuyy-queue-workers-staging` |
| `letbuyy-notifications-staging` | Staging email and customer notification fanout | `letbuyy-dead-letters-staging` | `letbuyy-queue-workers-staging` |
| `letbuyy-dead-letters-staging` | Staging poison message retention and redrive source | None | `letbuyy-queue-workers-staging` |
| `letbuyy-staging-queue` | Staging provider execution, replay and deployment lineage jobs | `letbuyy-staging-dead-letter-queue` | `letbuyy-queue-workers-staging` |
| `letbuyy-staging-dead-letter-queue` | Staging provider execution poison message retention | None | `letbuyy-queue-workers-staging` |
| `letbuyy-events` | Durable commerce event fanout | `letbuyy-dead-letters` | `letbuyy-queue-workers` |
| `letbuyy-analytics` | Analytics rollups and telemetry jobs | `letbuyy-dead-letters` | `letbuyy-queue-workers` |
| `letbuyy-search-indexing` | Product/order search projection updates | `letbuyy-dead-letters` | `letbuyy-queue-workers` |
| `letbuyy-notifications` | Email and customer notification fanout | `letbuyy-dead-letters` | `letbuyy-queue-workers` |
| `letbuyy-dead-letters` | Poison message retention and redrive source | None | `letbuyy-queue-workers` |
| `letbuyy-production-queue` | Production provider execution, replay and deployment lineage jobs | `letbuyy-production-dead-letter-queue` | `letbuyy-queue-workers` |
| `letbuyy-production-dead-letter-queue` | Production provider execution poison message retention | None | `letbuyy-queue-workers` |

Queue creation is owned by `infrastructure/cloudflare/queues.tf`. Runtime bindings are owned by each service `wrangler.toml`.

## Environment Deployment

Development, staging, and production use explicit Wrangler environments. Queue producer and consumer bindings are repeated under each `[env.*]` block because Wrangler environment configuration does not inherit queue bindings from the top-level Worker configuration.

| Environment | API route | Webhook route | Queue suffix | KV namespace | R2 bucket | D1 database | Telemetry dataset |
|---|---|---|---|---|---|---|---|
| dev | `api-dev.letbuyy.store` | `webhooks-dev.letbuyy.store` | `-dev` | `letbuyy-dev-kv` | `letbuyy-dev-r2` | `letbuyy-dev-d1` | `letbuyy-dev-telemetry` |
| staging | `api.staging.letbuyy.store` | `webhooks.staging.letbuyy.store` | `-staging` | `letbuyy-staging-kv` | `letbuyy-staging-r2` | `letbuyy-staging-d1` | `letbuyy-staging-telemetry` |
| production | `api.letbuyy.store` | `webhooks.letbuyy.store` | none | `letbuyy-production-kv` | `letbuyy-production-r2` | `letbuyy-production-d1` | `letbuyy-production-telemetry` |

## Edge Storage

`infrastructure/cloudflare/storage.tf` owns development, staging, and production Cloudflare KV namespaces, R2 buckets, and D1 databases. Worker `wrangler.toml` files bind those resources at runtime; secret values and generated resource IDs stay in Cloudflare/Terraform state, not in git.

Durable Object namespaces are created through the API Gateway Worker deployment and the `v1-runtime-coordinator` migration. They are governed by `config/runtime/cloudflare-topology.json` and must remain isolated by Worker environment.

## Rollout Commands

- Plan-only validation: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=production --target=all`.
- Plan development Workers: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=dev --target=workers`.
- Execute development Cloudflare primitives: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=dev --target=cloudflare --execute`.
- Execute development Workers: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=dev --target=workers --execute`.
- Execute production rollout: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=production --target=all --execute`.
- Roll back a Worker deployment: `node infrastructure/scripts/deploy/production-rollback.mjs --environment=production --worker=letbuyy-api --version-id=<version-id> --reason=<summary>`.
