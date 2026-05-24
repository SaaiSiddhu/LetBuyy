# Domain Governance

## Domain Package Targets

| Package | Owns | Must not own |
|---|---|---|
| `packages/commerce-core` | Products, variants, inventory concepts, orders, fulfillment primitives | Auth implementation, provider SDK details |
| `packages/checkout-core` | Cart, totals, discounts, tax/shipping interfaces, checkout state | Client-submitted totals as authority |
| `packages/auth-core` | Session contracts, auth claims, identity helpers | Storefront customer privileges mixed with merchant auth |
| `packages/tenant-core` | Tenant context, `sites` mapping, ownership contracts | Product/order mutation rules |
| `packages/cms-core` | Pages, navigation, blogs, policies, form-submission contracts | Payment or provider logic |
| `packages/theme-engine` | Theme schemas, renderer keys, templates, releases | Arbitrary tenant JavaScript execution |
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

Business logic should move from apps into packages only when the package can express a stable domain contract without importing an app. Handlers and components may call package contracts, but packages must never reach into handlers or pages.

## Database Naming Rule

Database tables use `sites`. Merchant-facing URLs and UI may say `store`. Do not create a `stores` table.

