# Service Governance

Services are runtime-isolated execution layers. They own worker bindings, provider integrations, queues, webhooks, request validation facades, orchestration, side effects, idempotency, and tenant enforcement.

## Allowed Service Ownership

- Hono route registration and middleware.
- Provider SDK adapters and worker binding access.
- Service-layer orchestration and database execution.
- Queue/webhook execution and retry handling.
- Local facades over package-owned validation contracts.

## Forbidden Service Ownership

- Canonical shared DTOs or schemas that are reused across runtimes.
- UI rendering, app imports, or app route imports.
- Package-level business contracts that could be consumed by apps or other services.
- Direct coupling to another service runtime source tree.

## Current Extraction

The API gateway keeps its existing `src/schemas/*.schema.ts` import paths, but the extracted schema files now re-export from domain packages:

- commerce and customer contracts from `@letbuyy/commerce-core`
- checkout, shipping, tax, coupon, order, refund, and payment contracts from `@letbuyy/checkout-core`
- auth contracts from `@letbuyy/auth-core`
- tenant/store contracts from `@letbuyy/tenant-core`
- page/navigation/content contracts from `@letbuyy/cms-core`
- theme contracts from `@letbuyy/theme-engine`
- event/webhook/usage contracts from `@letbuyy/event-core`

## Enforcement

`domain-boundary-validator` fails if extracted service schema facades start defining Zod contracts locally again.
