# Multi-Tenant SaaS Architecture Analysis

## Executive Summary

LetBuyy's tenant architecture is built around `sites` as the database tenant root and `store` as the merchant-facing URL/UI term. This is the correct architectural decision and is explicitly enforced by repository governance. The worker and admin apps show several tenant-aware patterns:

- admin store resolution through `resolve-owned-store.ts`;
- worker store context middleware in `middleware/store-context.ts`;
- site ownership checks in services;
- protected worker routes after auth middleware;
- internal signed session proxy from Next apps to the worker;
- Supabase RLS policies across many tables.

The architecture is promising but not yet enterprise SaaS-grade. Tenant enforcement is not uniformly centralized, RBAC is shallow, billing enforcement is limited, quota/metering is missing, and several public storefront/customer endpoints manually implement tenant lookup. The platform needs a tenant context contract that every route, service, table, event, job, webhook, storage object, and admin action follows.

## Tenant Identity

### Canonical Rule

Database tables use `sites`; URLs and merchant UI use `store`.

### Tenant Roots

Primary tenant root:

```text
sites.id
```

Merchant ownership fields observed:

```text
sites.custom_user_id
sites.user_id
```

This dual ownership exists for backward compatibility and must be normalized behind service helpers.

## Current Tenant Boundary Map

```text
Accounts app
  -> merchant auth/onboarding/store selection

Admin app
  -> /[store] routes
  -> resolve-owned-store
  -> signed worker request

Worker
  -> auth middleware
  -> store-context middleware for protected store routes
  -> service-level ownership checks

Storefront
  -> public subdomain lookup
  -> worker public /storefront routes

Supabase
  -> site_id columns
  -> RLS policies
```

## Current Security Boundaries

### Accounts

The accounts app owns merchant authentication, signup, password, OTP, OAuth callback, session, onboarding, and store selection surfaces.

### Admin

Admin app uses local Next API routes to proxy to the worker. It should not become a parallel backend. Current proxy signing in `apps/web/consumer/admin/src/lib/api/worker-client.ts` is a good pattern as long as secrets remain server-only.

### Storefront

Storefront customer auth is separate from merchant auth. Customer session handling uses httpOnly cookies in `apps/web/consumer/storefront/src/lib/session.ts`.

### Worker

Worker global auth middleware protects most routes after public route mounts. Internal signed sessions are accepted through `X-LetBuyy-Internal-Session-Token`.

### Webhooks

Payment webhooks are in `backend/workers/webhooks/src/index.ts`. They verify provider signatures and write idempotency records.

## Tenant Isolation Strengths

- `sites` is the accepted tenant root.
- Worker routes commonly require `site_id` or store context.
- `ProductService` and `OrderService` scope product/order operations by site.
- Storefront order route resolves subdomain/site and does not trust client store IDs/prices.
- Admin Next proxies resolve owned store before worker calls.
- Supabase migrations enable RLS across many tables.
- Service role usage appears server/worker side, not client side.

## Tenant Isolation Flaws

### Inconsistent Enforcement Location

Some routes rely on middleware. Some do manual site lookups. Some services do ownership checks. Enterprise SaaS needs all three layers, but the contract must be explicit:

```text
route must resolve tenant
service must require tenant context
database must enforce tenant predicate/RLS
events/jobs must carry tenant id
```

### Dual User Ownership Fields

`sites.custom_user_id` and `sites.user_id` are both considered in helpers. This can preserve compatibility, but it increases authorization complexity.

### Public Storefront Surface

Public storefront routes are necessarily unauthenticated, but every read/write must still resolve the site and prevent cross-store access:

- customer lookup by email,
- reviews,
- coupon validation,
- order lookup,
- wishlist,
- addresses.

These routes need extra scrutiny because they mix public customer identity and tenant-scoped data.

### Admin Proxy Trust

The signed internal proxy pattern is strong, but every app-local route must:

- resolve owned store,
- never accept arbitrary `site_id` from the browser,
- never forward service role tokens,
- not leak worker errors.

### Service Role Blast Radius

Worker service-role Supabase client can bypass RLS. That is acceptable for backend-only execution, but it makes service-layer tenant checks mandatory.

## RBAC Analysis

### Current Backend Evidence

- `backend/workers/api/src/middleware/rbac.ts`
- role helpers such as `requireRole`, `requireStoreOwner`, `requireSuperAdmin`
- super admin allowlist logic

### Missing Enterprise RBAC

- tenant staff users,
- store invitations,
- role table,
- permission table,
- role-permission matrix,
- resource/action permission checks,
- staff audit events,
- privilege escalation protections,
- MFA requirement by role,
- session revocation,
- IP/device policies for console/team apps.

### Required Permission Model

```text
users_custom
site_memberships
roles
permissions
role_permissions
membership_roles
audit_activity_events
```

Permission examples:

```text
products.read
products.write
products.publish
inventory.adjust
orders.read
orders.capture_payment
orders.refund
orders.fulfill
discounts.manage
gift_cards.issue
settings.billing
staff.manage
```

## Billing and Subscription Architecture

### Current Evidence

- `store-context.ts` checks frozen trials/subscription plan-style fields.
- `payments.ts` handles subscription order/verify/cancel/history.
- `subscriptions` and `billing_history` are used in payment flows.

### Missing SaaS Billing Systems

- plan entitlement catalog,
- quota ledger,
- usage metering,
- billing enforcement middleware,
- overage handling,
- dunning lifecycle,
- invoice model,
- plan migration history,
- trial conversion workflow,
- per-feature gates,
- app/theme marketplace revenue sharing.

### Required Entitlement Model

```text
plans
plan_features
site_subscriptions
site_entitlements
usage_meters
usage_meter_events
billing_invoices
billing_invoice_lines
billing_payment_attempts
```

### Example Quotas

- products count,
- monthly orders,
- staff seats,
- themes installed,
- storage/media bytes,
- API calls,
- webhook deliveries,
- storefront bandwidth,
- locations/warehouses,
- app installations.

## Store Isolation and Cross-Tenant Risk

| Surface | Risk | Required Control |
|---|---|---|
| Admin APIs | Store param tampering | Resolve store to site and ownership on every route |
| Worker service role | RLS bypass | Service requires tenant context and checks site ownership |
| Storefront customer APIs | Email lookup across stores | Always include site predicate and avoid revealing existence across tenants |
| Coupons | Code collision across tenants | Unique per site normalized code |
| Gift cards | Cross-store code redemption | Site-scoped hashed code and ledger |
| Media/storage | Object path guessing | Tenant-prefixed storage keys and signed URLs |
| Webhooks | Event delivery to wrong tenant endpoint | Webhook subscription owns site_id and secret |
| Analytics | Aggregate bleed | Queries must filter by site_id at base relation |
| Search index | Index contamination | Tenant field and per-tenant ACL filters |

## Missing Tenant Middleware

### Required Contract

Every protected merchant route should produce:

```ts
tenantContext = {
  siteId,
  userId,
  membershipId,
  roles,
  permissions,
  plan,
  entitlements,
  requestId
}
```

Every service method should accept this context rather than raw `siteId` and `userId` strings.

### Required Enforcement

- reject missing tenant context,
- reject suspended/frozen site,
- enforce billing entitlements,
- enforce RBAC permission,
- attach tenant to logs/audit/events,
- pass tenant to Supabase queries.

## SaaS Scalability Analysis

### Current Bottlenecks

- Single shared Supabase database without documented sharding/partitioning.
- Order/customer analytics query operational tables.
- Customer list derived from orders in one route.
- No background job system.
- No search index.
- No event delivery pipeline.
- No quota enforcement.

### Required Scale Pattern

```text
Shared application tier
  -> tenant context middleware
  -> regional edge read routing for storefront/catalog
  -> authoritative write region for checkout/inventory
  -> event bus
  -> async projections
  -> search/analytics stores
  -> per-tenant quotas and rate limits
```

## Multi-Region Readiness

Current architecture is not multi-region ready for writes. That is acceptable at current maturity, but the design must avoid future traps.

### Must Stay Single-Writer

- inventory reservation,
- order placement,
- payment state confirmation,
- gift card redemption,
- coupon usage redemption.

### Can Become Multi-Region Read-Optimized

- product catalog reads,
- theme assets,
- storefront pages,
- collection pages,
- media delivery,
- search replicas.

### Required Future Controls

- region-aware request routing,
- globally unique IDs,
- idempotency keys,
- event replication,
- deterministic conflict policies,
- tenant shard mapping.

## App and Extension Isolation

LetBuyy has app-store and theme-marketplace apps. To become a true platform:

- app installations must be tenant-scoped;
- apps must receive scoped tokens, not service role access;
- app permissions must be explicit;
- app webhooks must be isolated;
- app data storage must be namespaced;
- app extension points must be versioned;
- app uninstalls must revoke tokens and remove webhooks.

## Console and Team Apps

The repository includes:

- `apps/web/administrative/console`
- `apps/web/administrative/team`
- Flutter super admin/team scaffolds.

Governance requires allowlists, 2FA/TOTP, IP/VPN controls, and audit logging for console/team auth. These are not yet mature enough for production platform operations.

## Compliance and Data Protection

Required before enterprise SaaS:

- tenant data export,
- tenant deletion workflow,
- customer PII erasure,
- audit log retention policy,
- encrypted secrets storage,
- provider token rotation,
- admin access logging,
- privacy webhooks for apps,
- data residency roadmap.

## Infrastructure Gaps

| Infrastructure | Current | Gap |
|---|---|---|
| Rate limits | Worker Redis/in-memory middleware | Tenant plan-aware quotas |
| Queues | None found | Durable event/job queues |
| Observability | Request ID/timing | Tracing, metrics, SLOs |
| Search | None found | Tenant-isolated search index |
| Analytics | SQL aggregates | Event pipeline/warehouse |
| Billing | Subscriptions/payment routes | Entitlements/metering/dunning |
| RBAC | Middleware helpers | Full membership/permission system |
| Webhooks | Provider inbound | Tenant app outbound webhooks |

## Recommendations

### Immediate

1. Create a formal `TenantContext` type in API worker.
2. Require `TenantContext` in services handling merchant-owned records.
3. Audit all public storefront customer endpoints for site predicate and information disclosure.
4. Feature-gate pages whose backend systems do not exist.
5. Add site-aware normalized uniqueness for coupon/gift-card/order identifiers.

### Near Term

1. Add memberships/roles/permissions.
2. Add plan entitlements and quota middleware.
3. Add audit UI and API.
4. Add tenant-scoped background job/event architecture.
5. Add search index with tenant filters.

### Enterprise

1. Tenant shard map.
2. Region-aware read replicas.
3. App OAuth/token system.
4. Webhook subscription/delivery platform.
5. Data residency and compliance controls.

## Production Readiness Score

| Area | Score |
|---|---:|
| Tenant root model | 6/10 |
| Admin ownership checks | 5/10 |
| Storefront isolation | 4/10 |
| Worker tenant context | 4/10 |
| Database RLS posture | 5/10 |
| RBAC | 2/10 |
| Billing enforcement | 2/10 |
| Quotas/metering | 0/10 |
| App isolation | 1/10 |
| Overall multi-tenant readiness | 3.2/10 |

## Scalability Score

| Dimension | Score |
|---|---:|
| Thousands of stores | 4/10 |
| Millions of products | 3/10 |
| Millions of orders | 3/10 |
| Multi-region reads | 2/10 |
| Multi-region writes | 1/10 |
| Tenant quota enforcement | 0/10 |

## SaaS Maturity Score

Multi-tenant SaaS maturity: **3/10**.

LetBuyy has the right tenant root and several good ownership patterns. The next maturity jump is to make tenant context, permissions, billing entitlements, and audit events unavoidable across every route and service.
