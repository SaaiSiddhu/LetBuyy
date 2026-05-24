# Domain Boundaries

## Core Rule

Domains may integrate through explicit contracts, not through hidden database assumptions or UI-level shortcuts. Every cross-domain call must preserve tenant identity, auth context, validation, and error semantics.

## Domain Ownership Matrix

| Domain | Owns | Must Not Own |
|---|---|---|
| Auth | Merchant identity, custom sessions, onboarding, password/OTP/OAuth flows | Storefront customer identity privileges, payment state transitions |
| Tenant | `sites`, memberships, roles, permissions, entitlements, store handle resolution | Product/order business rules |
| Commerce | Products, variants, inventory, orders, discounts, fulfillment, returns, refunds | Authentication implementation details |
| Checkout | Cart/order creation, price recalculation, tax/shipping/discount application, payment initiation | Client-submitted totals as authority |
| Payments | Provider adapters, signature verification, payment ledgers, subscription states | Product catalog source of truth |
| Storefront | Public published tenant presentation and customer buying flow | Merchant/admin data access |
| Admin | Merchant operations UI and app-boundary API proxies | Canonical business logic that belongs in worker services |
| Theme | Schema registry, template resolution, renderer keys, drafts, releases, preview sessions | Arbitrary runtime code execution |
| CMS | Pages, navigation, policies, blogs, form submissions, content sections | Payment/provider logic |
| App Marketplace | App catalog, developers, installs, app review, outbound webhook lifecycle | Core order mutation without app authorization and tenant scoping |
| Analytics | Event ingestion, projections, dashboards, exports | Checkout authority or payment decisions |
| Infra | DNS, worker bindings, deployment configs, environments | Application domain behavior |

## Boundary Rules

- Handlers adapt protocols; services own business decisions.
- UI components render and collect intent; they do not validate tenant authority.
- Database RLS is required, but service-layer ownership checks are still mandatory.
- App-local APIs should be app-boundary proxies unless a documented runtime requirement prevents it.
- Public catalog reads are not permissionless writes. Mutations always require scoped identity or signed internal context.
- Global reference tables must be explicitly classified and cannot become hidden tenant-owned state.

## Cross-Domain Review Checklist

- What domain owns the write?
- What tenant path proves ownership?
- What schema validates the request?
- Is the operation idempotent if repeated?
- What events, audit rows, projections, or webhook deliveries are emitted?
- What tests prove the boundary does not leak tenant or auth state?
