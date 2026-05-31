# LetBuyy Worker Inventory

Generated during environment setup Phase 0 from the current `wrangler.toml` files.

| Worker | Entry | R2 | KV | Queue | Hyperdrive | DO |
|--------|-------|----|----|-------|------------|----|
| `services/api-gateway` / `letbuyy-api` | `src/index.ts` | `R2_BUCKET` (`letbuyy-local-storage`, env buckets currently `letbuyy-dev-r2`, `letbuyy-staging-r2`, `letbuyy-production-r2`) | `CACHE` in dev/staging/production env blocks | Producers: `EVENT_QUEUE`, `ANALYTICS_QUEUE`, `SEARCH_QUEUE`, `NOTIFICATION_QUEUE`, `RUNTIME_QUEUE` | None currently configured | `RUNTIME_COORDINATOR` -> `LetbuyyRuntimeDurableObject` |
| `services/webhook-service` / `letbuyy-webhooks` | `src/index.ts` | None | None | None | None | None |
| `services/queue-workers` / `letbuyy-queue-workers` | `src/index.ts` | None | None | Consumers: events, analytics, search-indexing, notifications, dead-letter, runtime queue per env | None currently configured | None |

## Current Routes And Service Bindings

| Worker | Routes / Domains | Service Bindings |
|--------|------------------|------------------|
| `api-gateway` | Dev: `api-dev.letbuyy.store`; staging: `api.staging.letbuyy.store`; production: `api.letbuyy.store` | `WEBHOOK_SERVICE` in dev/staging/production |
| `webhook-service` | Dev: `webhooks-dev.letbuyy.store`; staging: `webhooks.staging.letbuyy.store`; production: `webhooks.letbuyy.store` | `API_GATEWAY_SERVICE` in dev/staging/production |
| `queue-workers` | No HTTP route configured; queue consumer only | `API_GATEWAY_SERVICE` in dev/staging/production |

## Reserved Service Roots Without Wrangler Configs

These service roots have `AGENTS.md` and runtime governance manifests but no `wrangler.toml` or deployable package surface at Phase 0:

| Reserved Service Root | Current Status |
|-----------------------|----------------|
| `services/analytics-pipeline` | Governance/reserved root only |
| `services/checkout-runtime` | Governance/reserved root only |
| `services/event-bus` | Governance/reserved root only |
| `services/media-service` | Governance/reserved root only |
| `services/notification-service` | Governance/reserved root only |
| `services/search-service` | Governance/reserved root only |
