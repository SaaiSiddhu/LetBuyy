# LetBuyy Worker Inventory

Generated during environment setup Phase 0 from the current `wrangler.toml` files.

| Worker | Entry | R2 | KV | Queue | Hyperdrive | DO |
|--------|-------|----|----|-------|------------|----|
| `services/api-gateway` / `letbuyy-api` | `src/index.ts` | `R2_BUCKET` (`letbuyy-media-staging`, `letbuyy-media-production`) | `CACHE` in staging/production env blocks | Producers: `EVENT_QUEUE`, `ANALYTICS_QUEUE`, `SEARCH_QUEUE`, `NOTIFICATION_QUEUE`, `RUNTIME_QUEUE` | `HYPERDRIVE` in staging/production env blocks | `RUNTIME_COORDINATOR` -> `LetbuyyRuntimeDurableObject` |
| `services/webhook-service` / `letbuyy-webhook` | `src/index.ts` | None | None | None | None | None |
| `services/queue-workers` / `letbuyy-queue-workers` | `src/index.ts` | None | None | Consumers: events, analytics, search-indexing, notifications, dead-letter, runtime queue per env | None currently configured | None |

## Current Routes And Service Bindings

| Worker | Routes / Domains | Service Bindings |
|--------|------------------|------------------|
| `api-gateway` | Staging: `api-staging.letbuyy.com`; production: `api.letbuyy.com` | `WEBHOOK_SERVICE` in staging/production |
| `webhook-service` | Staging: `webhooks-staging.letbuyy.com`; production: `webhooks.letbuyy.com` | `API_GATEWAY_SERVICE` in staging/production |
| `queue-workers` | No HTTP route configured; queue consumer only | `API_GATEWAY_SERVICE` in staging/production |

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
