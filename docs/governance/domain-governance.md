# Domain Governance

## Canonical Domain Package Targets

| Package | Owns | Must not own |
|---|---|---|
| `packages/shared-types` | Common primitives, pagination, money, address, SEO, API responses | Runtime side effects |
| `packages/commerce-core` | Products, variants, catalog, inventory, customers, merchant commerce contracts | Auth implementation, provider SDK details |
| `packages/checkout-core` | Cart, order, totals, discounts, tax/shipping interfaces, checkout state | Client-submitted totals as authority |
| `packages/auth-core` | Session contracts, auth claims, actor identity, RBAC, OTP/password validation | Storefront customer privileges mixed with merchant auth |
| `packages/tenant-core` | Tenant context, `sites` mapping, store model, navigation, subdomain ownership contracts | Product/order mutation rules |
| `packages/cms-core` | Pages, navigation, policies, portfolio/resume content, dynamic content contracts | Payment or provider logic |
| `packages/theme-engine` | Theme schemas, section/block contracts, renderer keys, templates, releases, hydration contracts | Arbitrary tenant JavaScript execution |
| `packages/app-engine` | App marketplace contracts, installs, app webhooks | Unscoped merchant data mutation |
| `packages/analytics-core` | Event schemas, metrics, dashboard contracts | Checkout or payment authority |
| `packages/event-core` | Outbox, queues, event envelopes, idempotency contracts | UI rendering |
| `packages/search-core` | Search document contracts and indexing policy | Source-of-truth product mutation |
| `packages/notification-core` | Notification templates, channels, preferences | Provider secrets in client code |
| `packages/billing-core` | Plans, entitlements, usage, subscription contracts | Checkout product catalog authority |
| `packages/shared-types` | Cross-runtime TypeScript contracts | Runtime side effects |
| `packages/shared-utils` | Small runtime-safe utilities | Business decisions or app routing |
| `packages/ui-system` | Shared React UI primitives and tokens | Supabase service role, routing, business logic |

## Extraction Rule

Business logic graduates into packages when it is shared, cross-runtime, or domain-authoritative. Apps and services may consume package public exports, but packages must never import app, service, infrastructure, legacy, generated, or runtime-local env source.

API worker schema files under `services/api-gateway/src/schemas` are compatibility facades for existing imports. New shared Zod contracts belong in the domain package first, then may be re-exported from the worker facade.

`packages/typescript/api-types` is now a backward-compatible aggregate. It must not regain source authority for commerce, checkout, auth, tenant, CMS, theme, event, notification, search, or billing contracts.

## Database Naming Rule

Database tables use `sites`. Merchant-facing URLs and UI may say `store`. Do not create a `stores` table.

## Enforcement

- `scripts/validators/domain-boundary-validator.mjs` verifies domain package manifests, required exports, schema facades, and storefront type facade ownership.
- `scripts/validators/dependency-graph-validator.mjs` prevents reverse dependencies, package-to-runtime imports, runtime coupling, and package cycles.
- `scripts/validate-governance.mjs` runs domain validation in CI with the rest of the governance suite.
