# Integration Investigation Report

How the planes actually talk to each other, and where contracts are missing or unproven.

## Verified communication paths

| From → To | Mechanism | Evidence |
|-----------|-----------|----------|
| All web apps → api-gateway | `createLetbuyyApiClient()` (single factory) + per-app wrappers; HMAC internal-session headers via `@letbuyy/auth-core` (`AUTH_SECRET`/`INTERNAL_API_SECRET`) | `packages/typescript/api-client`; each app `src/lib/api/client.ts` |
| merchant-app (Flutter) → gateway | Dio client `packages/dart/api_client` → `/v1` | `lib/config/app_config.dart` |
| platform-console → gateway | static bearer `PLATFORM_CONSOLE_API_TOKEN` → `/internal/console/*` | `src/lib/console-api.ts` |
| gateway → Supabase | service-role + RLS; storefront reads anon-key path | `src/index.ts:10-11`; mig. 076 policies |
| gateway → queue-workers | 5 Cloudflare Queues (EVENT/ANALYTICS/SEARCH/NOTIFICATION/RUNTIME) | wrangler.toml; Env bindings (index.ts 79–83) |
| gateway → webhook-service | Worker service binding `API_GATEWAY_SERVICE` reverse-referenced | both wrangler.toml |
| Theme editor ↔ preview | postMessage protocol (5 message types incl. legacy alias) | `storefront-preview-bridge.tsx:5-10,44` |
| Identity → apps | shared cookie domain `.letbuyy.store` / `.staging.letbuyy.store`; `lb_session`, `lb_accounts`, `lb_device`, `lb_password_set_intent` | `identity-platform/src/lib/auth/cookies.ts` |
| GraphQL | storefront + admin GraphQL routers mounted in gateway; `createLetbuyyGraphQLSdk()` in api-client | `src/index.ts:41-42`; api-client/src/graphql |

## Event flow (traced)

```
Domain action (e.g. app install) → insert outbox row
→ OutboxExecutionAdapter.claimOutboxEvents()  — RPC claim_outbox_events(), 120 s lock
→ dispatchOutboxEvent(): buildDomainEventEnvelope() (@letbuyy/orchestration)
   ├─ enqueuePlatformJobs() → distributed_queue_jobs → Cloudflare Queue → queue-workers
   │    → persistQueueMessage() → distributed_queue_messages; metrics → runtime_telemetry_metrics; DLQ detection
   └─ createWebhookDeliveries() → webhook_deliveries → webhook-service → HMAC POST to app URL (8 retries)
```
Tables exist, adapters exist, consumers exist. **Missing link:** nothing found that *triggers* outbox claiming (no cron schedule in wrangler.toml excerpts, no route invoking dispatchBatch). Either an unexamined scheduled handler exists or the loop is manual — unproven either way (`src/execution/outbox-execution.adapter.ts:109-150`).

## Broken / missing / unproven connections

| # | Connection | Status | Evidence |
|---|-----------|--------|----------|
| I-1 | App install → storefront app-block render | **Broken-by-default** (needs manual theme edit; registry never queried by storefront) | see Apps report; `app-block-slot.tsx` |
| I-2 | Outbox → dispatch trigger | Unproven | above |
| I-3 | SEARCH_QUEUE → consumer | **Missing consumer** — producer binding exists; queue-workers consumer handles platform jobs, no search indexer found; `search-service` is code-free | gateway Env; `services/search-service/` |
| I-4 | Checkout UI extensions → storefront checkout page | Not wired | extension retrieval route exists; no render site found |
| I-5 | Theme marketplace purchase → entitlement enforcement at install | Purchase and install both exist; entitlement check between them not evidenced | `theme-service.ts:112-122`; `theme_purchases` |
| I-6 | K8s/Helm manifests → any runtime | **Orphaned**: all 3 real services deploy via wrangler to Cloudflare; nothing deploys to K8s | `infrastructure/deployment/helm/`, `kubernetes/` |
| I-7 | Email integrations | 3 gateway TODOs: invites/notifications "Send … via Resend" not implemented | `routes/employee.ts:287`, `routes/contacts.ts:48`, `routes/admin.ts:283` |
| I-8 | OAuth callback page (identity) | Empty placeholder | `apps/identity-platform/src/app/auth/callback` |
| I-9 | webhook-service ↔ gateway circularity | webhook-service calls gateway for retrieval while gateway enqueues deliveries — bidirectional coupling of the only two workers | both `src/index.ts` |

## Contract quality

- Single source: `@letbuyy/shared-types` (2,081-line index.ts, 345+ exports) feeds api-types/api-client; Dart `letbuyy_models` mirrors contracts manually (no codegen — drift risk between TS and Dart is process-enforced only).
- Gateway validation: `src/schemas/` (9 files) re-validate at the boundary (e.g. `theme.schema.ts` facade over theme-engine).
- Idempotency: api-client supports `idempotencyKey`; payments tests assert `idempotency.begin()` precedes provider calls (`services/api-gateway/src/__tests__/payments.test.ts`).
- Versioning: REST path `/v1` only; no `/v2` or deprecation headers; GraphQL schemas unversioned. App manifest carries its own date-stamped version (`2026-06-05.ws13`).
