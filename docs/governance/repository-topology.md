# Repository Topology Governance

## Purpose

LetBuyy is governed as a multi-runtime commerce platform, not as a collection of unrelated apps. The repository topology must make actor ownership, runtime ownership, domain ownership, and infrastructure ownership visible from the directory tree.

## Canonical Topology

```text
apps/
  storefront-runtime/
  merchant-control-plane/
  identity-platform/
  app-marketplace/
  developer-portal/
  theme-marketplace/
  marketing-site/
  platform-console/
  platform-operations-portal/
  mobile/
    shopper-app/
    merchant-app/
    operator-app/

services/
  api-gateway/
  webhook-service/
  queue-workers/
  checkout-runtime/        # reserved, not implemented
  notification-service/
  search-service/
  media-service/
  analytics-pipeline/
  event-bus/

packages/
  shared-types/
  tenant-core/
  commerce-core/
  checkout-core/
  payments/
  auth-core/
  cms-core/
  theme-engine/
  event-core/
  notification-core/
  billing-core/
  infrastructure/
  typescript/api-client/
  typescript/api-types/
  typescript/ui/
  typescript/utils/
  dart/core/
  dart/models/
  dart/ui_kit/

database/
  supabase/
    migrations/
    seeds/
    verification/

infrastructure/
  cloudflare/
  deployment/
  observability/
  monitoring/
  dns/
  security/
  ci-cd/

config/
  env/
    governance/
    ownership/
    templates/
    schemas/
  runtime/
    runtime-manifest.schema.json

scripts/
  validators/
  governance/
  generators/
  migration/
  utilities/

legacy/
  firebase/

docs/
  governance/
  architecture/
  implementation/
  runtime/
  audits/
  research/
  archive/
```

## Runtime Mapping

| Runtime | Actor | Canonical root | Current responsibility |
|---|---|---|---|
| Storefront runtime | Shoppers | `apps/storefront-runtime` | Public tenant storefronts, customer accounts, cart, checkout, policies, theme previews |
| Merchant control plane | Merchants | `apps/merchant-control-plane` | Merchant dashboard, CMS, products, orders, settings, themes, analytics |
| Identity platform | Merchants and operators | `apps/identity-platform` | Login, signup, onboarding, store selection, password and OTP flows |
| App marketplace | Partners and merchants | `apps/app-marketplace` | App catalog, developer submission, app install workflows |
| Developer portal | Partners and developers | `apps/developer-portal` | API, OAuth, webhook, SDK, and developer dashboard documentation |
| Theme marketplace | Partners and merchants | `apps/theme-marketplace` | Theme catalog, purchases, acquisition and install workflows |
| Marketing site | Public visitors | `apps/marketing-site` | Public marketing and pricing surface |
| Platform console | Platform operators | `apps/platform-console` | Super admin platform operations |
| Platform operations portal | Platform employees | `apps/platform-operations-portal` | Employee support, moderation, marketing operations, and invite workflows |
| Mobile merchant app | Merchants | `apps/mobile/merchant-app` | Flutter merchant builder and store management |
| Mobile shopper app | Reserved | `apps/mobile/shopper-app` | Reserved/not-implemented native shopper root; manifest-and-AGENTS only |
| Mobile operator app | Reserved | `apps/mobile/operator-app` | Reserved/not-implemented native operator companion; manifest-and-AGENTS only |
| API gateway | All actors through contracts | `services/api-gateway` | Hono `/v1` API, auth, tenant context, domain services |
| Webhook service | Providers | `services/webhook-service` | Provider callbacks and reconciliation |
| Queue workers | Platform async jobs | `services/queue-workers` | Implemented Cloudflare Queue consumers for event, notification, search, analytics, outbox, and dead-letter work |
| Checkout runtime | Reserved | `services/checkout-runtime` | Manifest-only placeholder; active checkout execution remains in `services/api-gateway` |
| Notification service | Reserved | `services/notification-service` | Manifest-only placeholder; active notification APIs/queue work remain in `services/api-gateway` and `services/queue-workers` |
| Search service | Reserved | `services/search-service` | Manifest-only placeholder; active search APIs/queue work remain in `services/api-gateway` and `services/queue-workers` |
| Media service | Reserved | `services/media-service` | Manifest-only placeholder; active media APIs remain in `services/api-gateway` |
| Analytics pipeline | Reserved | `services/analytics-pipeline` | Manifest-only placeholder; active analytics APIs/queue work remain in `services/api-gateway` and `services/queue-workers` |
| Event bus | Reserved | `services/event-bus` | Manifest-only placeholder; active event execution uses package-owned contracts through implemented runtimes |
| Supabase database | Platform-owned data layer | `database/supabase` | Migrations, seeds, verification, RLS policies |
| Firebase legacy | Archived | `docs/archive/firebase-legacy` | Historical Cloud Functions and Firebase rules only |

## Non-Negotiable Shape Rules

- Active runtimes live under `apps/` or `services/`.
- Shared code lives under `packages/`.
- Database state lives under `database/`.
- Provider, deployment, DNS, security, monitoring, and CI config live under `infrastructure/`.
- Environment templates, schemas, and runtime env ownership rules live under `config/env/`.
- Runtime manifest schemas live under `config/runtime/`.
- Reusable tooling lives under canonical `scripts/` subdirectories; root scripts are stable entrypoints only.
- Deprecated systems live under `legacy/`.
- Generated or lifecycle-owned docs live under explicit `docs/` lifecycle directories.
- Deprecated runtime aliases are forbidden and must not coexist with canonical runtimes.
- The forbidden app alias roots are `apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, and `apps/analytics`.
- `apps/mobile/operator-team-app` is retired; employee operations belong in `apps/platform-operations-portal`, and future native operator work belongs in reserved `apps/mobile/operator-app` only after activation governance.
- `apps/storefront-runtime/consumer-storefront` is retired; storefront source authority belongs under `apps/storefront-runtime/src`.
- Every app/service runtime must include `runtime.manifest.json`.
- Runtime-local `node_modules`, generated output, and local build caches are not topology and must not survive governance validation.
- New app roots require a governance doc update, validator update, CI enforcement, and an ownership decision before source is added.
