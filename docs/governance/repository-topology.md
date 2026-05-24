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
  checkout-runtime/
  webhook-service/
  queue-workers/
  notification-service/
  search-service/
  media-service/
  analytics-pipeline/
  event-bus/

packages/
  commerce-core/
  checkout-core/
  auth-core/
  tenant-core/
  cms-core/
  theme-engine/
  app-engine/
  analytics-core/
  event-core/
  search-core/
  notification-core/
  billing-core/
  ui-system/
  shared-types/
  shared-utils/
  mobile-core/
  mobile-models/
  mobile-services/
  mobile-ui-kit/

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
    templates/
    schemas/

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
| Theme marketplace | Partners and merchants | `apps/theme-marketplace` | Theme catalog, purchases, acquisition and install workflows |
| Marketing site | Public visitors | `apps/marketing-site` | Public marketing and pricing surface |
| Platform console | Platform operators | `apps/platform-console` | Super admin platform operations |
| Platform operations portal | Platform employees | `apps/platform-operations-portal` | Employee support, moderation, marketing operations, and invite workflows |
| Mobile shopper app | Shoppers | `apps/mobile/shopper-app` | Reserved native shopper runtime |
| Mobile merchant app | Merchants | `apps/mobile/merchant-app` | Flutter merchant builder and store management |
| Mobile operator app | Platform operators | `apps/mobile/operator-app` | Reserved native operator companion |
| API gateway | All actors through contracts | `services/api-gateway` | Hono `/v1` API, auth, tenant context, domain services |
| Webhook service | Providers | `services/webhook-service` | Provider callbacks and reconciliation |
| Supabase database | Platform-owned data layer | `database/supabase` | Migrations, seeds, verification, RLS policies |
| Firebase legacy | Deprecated | `legacy/firebase` | Historical Cloud Functions and Firebase rules only |

## Non-Negotiable Shape Rules

- Active runtimes live under `apps/` or `services/`.
- Shared code lives under `packages/`.
- Database state lives under `database/`.
- Provider, deployment, DNS, security, monitoring, and CI config live under `infrastructure/`.
- Environment templates, schemas, and runtime env ownership rules live under `config/env/`.
- Deprecated systems live under `legacy/`.
- Generated or lifecycle-owned docs live under explicit `docs/` lifecycle directories.
- Deprecated runtime aliases are forbidden and must not coexist with canonical runtimes.
- The forbidden app alias roots are `apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, and `apps/analytics`.
- `apps/mobile/operator-team-app` is retired; employee operations belong in `apps/platform-operations-portal`, and native operator work belongs in `apps/mobile/operator-app`.
- `apps/storefront-runtime/consumer-storefront` is retired; storefront source authority belongs under `apps/storefront-runtime/src`.
- New app roots require a governance doc update, validator update, CI enforcement, and an ownership decision before source is added.
