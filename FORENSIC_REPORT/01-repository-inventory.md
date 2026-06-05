# Repository Inventory

Working tree: **5,422 files** (excluding `node_modules`, `.git`). Git-tracked per the repo's own environment validator: **2,827 files**. Workspace: pnpm (`pnpm-workspace.yaml`) + Turbo (`turbo.json`) + Melos Dart workspace (root `pubspec.yaml`, name `letbuyy_workspace`).

## Top-level structure map

```
Letbuyy_Store/
├── apps/                  10 web/mobile application roots
│   └── mobile/            3 Flutter app roots (1 implemented)
├── services/              9 service roots (3 implemented Cloudflare Workers, 6 manifest-only)
├── packages/              22 TS package roots + typescript/{api-client,api-types,ui,utils} + dart/ (5 Dart pkgs)
├── database/
│   ├── supabase/          migrations (000_baseline.sql 27,740 lines + 073–078), seeds, verification/ (031–042)
│   └── cloudflare/d1/     0001_provider_execution_foundation.sql (operational lineage DB)
├── supabase/              CLI config + .temp linked-project refs (separate from database/supabase)
├── infrastructure/        ci-cd, cloudflare (Terraform), deployment (Helm/K8s), dns, monitoring,
│                          observability, scripts (real deploy orchestrators), security
├── scripts/               validate-governance.mjs, validate-architecture.mjs, validators/ (132 .mjs),
│                          generators, migration, staging, supabase, utilities
├── config/                runtime/ governance-contract JSONs, env/ *.example, supabase/{staging,production}.json
├── tests/                 28 suites, 132 *.test.mjs (governance meta-tests)
├── load/  chaos/          evidence runners (default --mode=plan) + static scenario manifests
├── artifacts/             shopify-ux/ ~100 PNG before/after screenshots
├── docs/                  ~100 subdirs incl. governance/, archive/ (migrations-history 001–065, flutter-legacy)
├── Audit/                 6 prior audit report parts (markdown)
├── legacy/firebase/       ~40 files: rules, 30+ Cloud Functions, migration script (unreferenced)
├── memory/  tasks/  .codex/  .github/workflows/ (10 workflows)
└── 73 root-level .md files (AGENTS.md constitution 32 KB + 72 ledgers/reports, largest 270 KB)
```

## Application inventory (10 web + 3 mobile)

| App | Framework | Files | Status | Role |
|-----|-----------|-------|--------|------|
| `apps/storefront-runtime` | Next.js 16.1.6 | 154 (131 TS/TSX), 29 page routes, 21 API routes | Implemented | Customer storefront, theme rendering, checkout UI |
| `apps/merchant-control-plane` | Next.js 16.1.6 | 195 (174 TS/TSX), 78+ pages, 62 API routes | Implemented | Merchant admin (products/orders/themes/settings) |
| `apps/identity-platform` | Next.js 16.1.6 | 75 (51 TS/TSX), 13 pages, 19 API routes | Implemented | Central auth: login/signup/OTP/reset, store creation |
| `apps/app-marketplace` | Next.js 16.1.6 | 39 src files, 20 pages, 8 API routes | Implemented | App catalog + developer submission |
| `apps/theme-marketplace` | Next.js 16.1.6 | — | Implemented | Theme catalog, purchase, install, dashboard |
| `apps/developer-portal` | Next.js 16.1.6 | 9 src files | Implemented (docs-only) | Static API/SDK docs; `@letbuyy/ui` only; honest `[SKIP - NEEDS SDK/CLI]` badges |
| `apps/marketing-site` | Next.js 16.1.6 | — | Implemented | Static marketing; GSAP/Framer/Lenis; no API calls |
| `apps/platform-console` | Next.js 16.1.6 | — | Scaffold-level | Super-admin (users/stores/audit/MFA) via `PLATFORM_CONSOLE_API_TOKEN` |
| `apps/platform-operations-portal` | Next.js 16.1.6 | — | Implemented | Ops: merchant health scoring, CRM, support, onboarding |
| `apps/mobile/merchant-app` | Flutter 3.10 | 100+ Dart files | Implemented | Merchant dashboard + theme editor, Provider state, Dio client |
| `apps/mobile/operator-app` | Flutter | 1 Dart file | **Placeholder** | Default Flutter counter demo (`lib/main.dart`) |
| `apps/mobile/shopper-app` | — | 2 files | **Manifest-only** | `runtime.manifest.json` + `AGENTS.md`, no code |

(11th root `apps/mobile` is a container. `developer-portal` is absent from the `CLAUDE.md` canonical runtime map but carries a full runtime manifest — see violations report.)

## Service inventory (9)

| Service | Reality | Contents |
|---------|---------|----------|
| `services/api-gateway` | **Real** Cloudflare Worker (Hono) | 90 TS files; `src/index.ts` 362 lines mounting 30+ routers; `src/routes/` 20,340 LOC total — largest: `storefront.ts` 4,320, `app-store.ts` 2,721, `operations.ts` 1,436, `payments.ts` 916, `auth.ts` 872, `themes.ts` 858, `inventory.ts` 851, `pages.ts` 811. Bindings: 5 queues, D1, R2, KV, Durable Object (`LetbuyyRuntimeDurableObject`), Hyperdrive, Analytics Engine. Routes `api.letbuyy.store` |
| `services/webhook-service` | **Real** Worker | 2 src files; HMAC-SHA256 signed delivery (`X-LetBuyy-Hmac-SHA256`, `v1=<hex>`, ts+body), exp. backoff 2^n·120 s cap 1 h, 8 attempts. Routes `webhooks.letbuyy.store` |
| `services/queue-workers` | **Real** Worker | 2 src files (188 + consumer); persists batches to `distributed_queue_messages`, telemetry to `runtime_telemetry_metrics`, DLQ detection |
| `services/analytics-pipeline` | Manifest-only | `runtime.manifest.json` + `AGENTS.md` ("Reserved analytics ingestion… authority") |
| `services/checkout-runtime` | Manifest-only | same pattern; checkout actually lives in api-gateway `/orders`,`/payments` |
| `services/event-bus` | Manifest-only | events actually via outbox + Cloudflare Queues in api-gateway |
| `services/media-service` | Manifest-only | media actually in api-gateway `routes/media.ts` + R2 |
| `services/notification-service` | Manifest-only | notification queue produced by gateway; consumer in queue-workers |
| `services/search-service` | Manifest-only | `SEARCH_QUEUE` producer exists in gateway; no consumer service found |

## Package inventory (26 TS + 5 Dart)

Verified consumer counts = number of importing files across repo.

| Package | LOC (src) | Nature | Consumers |
|---------|-----------|--------|-----------|
| `shared-types` | 2,081 (single index.ts) | Zod schemas + types for all entities | 113 files |
| `theme-engine` | 286 across 5 modules | Real: JSON-contract + Liquid renderers (liquidjs 10.27), bundle validation | 68 |
| `auth-core` | 1,434 | Real: sessions, HMAC internal headers, RBAC, cookie contracts | 54 |
| `commerce-core` | 26 | Interface-only (op schemas) | 45 |
| `tenant-core` | 85 | Interface-only (incl. `rzp_(test|live)` validation regex) | 45 |
| `infrastructure` | 156 across 19 files | Adapter factories: stripe/razorpay/cashfree/phonepe/upi/cod/paypal/supabase/cloudflare/resend/storage/queue/analytics/cache/search/logistics/resilience | 43 |
| `event-core` | 739 | Real: 22 domain event contracts, envelopes, outbox/webhook/audit contracts | 35 |
| `checkout-core` | 108 | Interface-only | 29 |
| `cms-core` | 47 | Interface-only | 29 |
| `distributed-runtime` | 5,744 across 32 files | Real: event persistence, queues, CQRS, replay, checkpoints, clocks, CRDT | 26 |
| `orchestration` | 2,160 across 15 files | Real: workflows, sagas, outbox runtime, retries | 22 |
| `app-engine` | 1,385–1,779 (index.ts) | Real: app manifest schema v`2026-06-05.ws13`, lifecycle, scopes | 18 |
| `notification-core` | 47 | Interface-only | 17 |
| `application-services` | 234 across 15 files | Façade aggregating 9 domain services | 17 |
| `billing-core` | 120 | Interface-only (plans, entitlements, app charges) | 15 |
| `payments` | 230 | Real: provider contracts, idempotency, money | 13 |
| `search-core` | 94 | Interface-only | 12 |
| `runtime-composition` | 298 across 18 files | Query-layer façades (storefront/merchant/mobile/analytics) | 12 |
| `extension-host` | ~250 | Real: sandbox policies, bridge contracts | 8 |
| `projection-runtime` | 2,815 across 15 files | Real: projections, snapshots, rebuilds | 8 (lowest) |
| `typescript/ui` | ~1,200, 42 files | Real design system + Storybook | 10 |
| `typescript/api-client` | ~400+ | Single client factory + GraphQL SDK | 8 wrappers |
| `typescript/api-types` | ~150 | Compatibility shim | apps |
| `typescript/utils` | ~120 | Wrapper over infrastructure | 9 |
| `dart/{core,models,api_client,ui_kit}` | — | Real Flutter foundation/models/Dio client/UI kit | merchant-app |
| `dart/services` | ~50 | **Stub façade** | merchant-app |

**Zero test files in any package** (no `*.test.ts`, `*.spec.ts`, `__tests__` under `packages/`).

## Infrastructure & tooling inventory

- **Terraform**: `infrastructure/cloudflare/{dns,storage,queues}.tf` — real IaC.
- **Helm/K8s**: `infrastructure/deployment/helm/letbuyy-production/`, `kubernetes/` manifests (note: nothing in services targets K8s; Workers deploy via wrangler — see violations).
- **Deploy orchestrators**: `infrastructure/scripts/deploy/production-deploy.mjs` (validates governance → terraform → wrangler deploy ×3 workers; requires `CLOUDFLARE_API_TOKEN`, fails closed), `deploy-worker-runtime.mjs`, `cloudflare/bootstrap-{staging,production}.mjs`.
- **CI**: 10 GitHub workflows; `ci.yml` runs turbo typecheck/lint/test (differential `--filter="...[HEAD^1]"`) + `validate:governance`; others: production-deploy, staging variants, live-production-certification, production-rollout, architecture-governance, environment-lifecycle.
- **Validators**: 132 scripts in `scripts/validators/` (see Dead Code & Technical Debt reports for what they actually check).
- **Root npm scripts**: ~40 `validate:*`/`certify:*` aggregates chaining 10–50 validators each (`package.json`).

## Database inventory

- **Supabase**: `000_baseline.sql` — 27,740 lines, **233 `CREATE TABLE`**, **352 RLS policies**, 230/233 tables RLS-enabled. Post-baseline migrations 073–078 (order-item compat, COD status, Cashfree provider, app extension registry, customer reset tokens, password set intents). `verification/` 031–042 alignment-check SQL. Seeds: `001_seed.sql`, `urban-kicks-theme.sql`.
- **Migration gap**: 001–072 squashed into baseline; originals archived at `docs/archive/migrations-history/`.
- **Cloudflare D1**: `provider_execution_evidence`, `d1_migration_lineage`, `replay_restoration_lineage`, `rollback_lineage` — operational lineage only, no Supabase overlap.

## Dependency map (verified direction)

```
apps (9 web) ──@letbuyy/api-client──▶ services/api-gateway ──▶ Supabase (service-role/RLS)
   │                                        │ ├─▶ Cloudflare Queues ─▶ queue-workers
   │                                        │ └─▶ webhook-service (service binding)
   └──@letbuyy/{ui,auth-core,shared-types,theme-engine,…}
mobile/merchant-app ──dart api_client(Dio)──▶ api-gateway /v1
packages layering: shared-types → *-core → {infrastructure, distributed-runtime, orchestration,
                   projection-runtime} → application-services → runtime-composition → apps/services
```
No app→app, app→service-source, service→app, or package→app imports detected (grep-verified).
