# IMPORT_GRAPH

Generated: 2026-06-09T19:21:18Z  
Branch: `stepup/main`  
Baseline commit: `41b6ea49c5da30a1409d4cc587d989d459288e45`  
Source of truth: committed `HEAD` using `git grep` over `apps`, `services`, `packages`, and `tests`. Counts are file counts excluding the package's own directory where applicable.

## Package Importer Counts

These counts include source, test, manifest, and local governance files under the searched roots. Source-only spot checks were also run for key quarantine candidates and are called out below.

| Package | Importer files | Representative importers |
|---|---:|---|
| `@letbuyy/api-client` | 98 | app marketplace, developer portal, identity platform, app configs/tests |
| `@letbuyy/api-types` | 16 | Next configs, API gateway schema adapter, federation tests |
| `@letbuyy/app-engine` | 30 | storefront sections/theme composition, API gateway app routes, API types |
| `@letbuyy/application-services` | 18 | API gateway execution adapters, runtime-composition manifests/config |
| `@letbuyy/audit-core` | 7 | API gateway identity-foundation code/tests |
| `@letbuyy/auth-core` | 116 | apps, API clients, identity platform, services |
| `@letbuyy/billing-core` | 37 | app marketplace, application-services, API types |
| `@letbuyy/checkout-core` | 40 | storefront cart/orders, application-services, API gateway |
| `@letbuyy/cms-core` | 41 | merchant control plane, storefront runtime, application-services |
| `@letbuyy/commerce-core` | 52 | storefront runtime, application-services, API gateway |
| `@letbuyy/distributed-runtime` | 27 | orchestration, projection-runtime, app/service tsconfigs |
| `@letbuyy/event-core` | 42 | application-services, billing-core, distributed-runtime |
| `@letbuyy/extension-host` | 14 | merchant control plane embedded apps, storefront extension host, API gateway |
| `@letbuyy/identity-core` | 28 | audit/organization/permission/session/token packages |
| `@letbuyy/infrastructure` | 70 | runtime-composition, API gateway, infrastructure adapter tests |
| `@letbuyy/notification-core` | 20 | application-services, API types, API gateway |
| `@letbuyy/orchestration` | 22 | application-services and API gateway/queue worker execution paths |
| `@letbuyy/organization-core` | 6 | API gateway identity-foundation code/tests |
| `@letbuyy/payments` | 18 | infrastructure payment adapters, API types |
| `@letbuyy/permission-core` | 7 | API gateway identity-foundation code/tests |
| `@letbuyy/projection-runtime` | 8 | runtime-composition and app/service tsconfigs |
| `@letbuyy/runtime-composition` | 15 | storefront runtime, API gateway queue adapter, queue-workers |
| `@letbuyy/search-core` | 14 | application-services, runtime-composition, API types |
| `@letbuyy/session-core` | 7 | API gateway identity-foundation code/tests |
| `@letbuyy/shared-types` | 234 | broad app/service/package usage |
| `@letbuyy/tenant-core` | 66 | identity, storefront, merchant, application-services, API gateway |
| `@letbuyy/theme-engine` | 92 | merchant theme editor, storefront renderer, API gateway, docs/tests |
| `@letbuyy/token-core` | 6 | API gateway OAuth/key-service skeletons/tests |
| `@letbuyy/ui` | 329 | broad web app UI usage |

## Source-Only Spot Checks For Quarantine Candidates

The slower source-only scan confirmed these active source imports before it was abandoned for runtime:

- `@letbuyy/app-engine`: active source imports in `apps/storefront-runtime/src/components/sections/app-block-slot.tsx`, `apps/storefront-runtime/src/lib/store-service.ts`, `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx`, and API gateway app routes/middleware.
- `@letbuyy/application-services`: active source imports in API gateway execution adapters including `payment-execution.adapter.ts`, `order-execution.adapter.ts`, `queue-execution.adapter.ts`, and related adapters.

## Quarantine Target 0-Importer Proof

| Target | HEAD reference result | 0-importer proof |
|---|---:|---|
| `packages/distributed-runtime` / `@letbuyy/distributed-runtime` | 27 importer/reference files | FAIL |
| `packages/projection-runtime` / `@letbuyy/projection-runtime` | 8 importer/reference files | FAIL |
| `packages/orchestration` / `@letbuyy/orchestration` | 22 importer/reference files | FAIL |
| `packages/application-services` / `@letbuyy/application-services` | 18 importer/reference files | FAIL |
| `packages/app-engine` / `@letbuyy/app-engine` | 30 importer/reference files | FAIL |
| `packages/extension-host` / `@letbuyy/extension-host` | 14 importer/reference files | FAIL |
| `packages/runtime-composition` / `@letbuyy/runtime-composition` | 15 importer/reference files | FAIL; storefront/API/queue use exists |
| `services/analytics-pipeline` / `analytics-pipeline` | 16 name/path reference files | FAIL |
| `services/checkout-runtime` / `checkout-runtime` | 20 name/path reference files | FAIL |
| `services/event-bus` / `event-bus` | 28 name/path reference files | FAIL |
| `services/media-service` / `media-service` | 15 name/path reference files | FAIL |
| `services/notification-service` / `notification-service` | 13 name/path reference files | FAIL |
| `services/search-service` / `search-service` | 13 name/path reference files | FAIL |
| `apps/mobile/operator-app` / `operator-app` | 19 name/path reference files | FAIL |
| `apps/mobile/shopper-app` / `shopper-app` | 8 name/path reference files | FAIL |
| `legacy/` | 64 path reference files | FAIL |
| `chaos/` | 6 path reference files | FAIL |
| `load/` | 24 path/name reference files | FAIL |

## Interpretation

No V2 quarantine target currently has a complete 0-importer proof at HEAD. Some service/mobile targets are only referenced by topology, manifests, validators, and honesty tests, but package targets are active source/build dependencies. Later quarantine waves must first remove runtime/build references, then re-run this proof at that wave's HEAD before any `git mv` to `quarantine/`.
