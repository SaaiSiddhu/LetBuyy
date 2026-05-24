# Production Readiness Audit

## Executive Summary

LetBuyy is not production-ready as a Shopify-class commerce OS yet. It is a serious prototype with several production-oriented parts: Cloudflare Hono worker, request ID middleware, signed admin/storefront proxying, Supabase migrations, RLS intent, payment webhook signature verification, payment event idempotency, and a transactional inventory reservation RPC.

The production gap is system completeness and operational control. Commerce production readiness requires more than successful CRUD and checkout demos. It requires provable tenant isolation, idempotent transactional workflows, durable queues, structured observability, complete payment/refund ledgers, inventory reconciliation, security controls, deployment rollback, disaster recovery, and admin tools for failure cases.

The most important production blockers are:

1. Incomplete checkout financial calculation: discounts, gift cards, shipping, and tax are not committed as one canonical server-side transaction.
2. Unsafe fallback order creation in `OrderService.createOrder`.
3. No real outbox dispatcher/queue despite `outbox_events`.
4. No fulfillment order/shipment/return/refund ledgers.
5. No promotion/gift-card redemption ledger.
6. No full RBAC/tenant quota/billing entitlement enforcement.
7. No production observability stack: traces, metrics, SLOs, alerting, queue dashboards, webhook replay.
8. Incomplete admin operation surfaces for inventory/order/payment failures.

## Scope

Audited areas:

- Security
- Reliability
- Scalability
- Performance
- DevOps/deployment
- Observability
- Database safety
- Payment and webhook safety
- Tenant isolation
- Admin operations
- Disaster recovery

Primary code references:

- `backend/workers/api/src/index.ts`
- `backend/workers/api/src/middleware/*.ts`
- `backend/workers/api/src/routes/*.ts`
- `backend/workers/api/src/services/*.ts`
- `backend/workers/webhooks/src/index.ts`
- `backend/supabase/migrations/*.sql`
- `apps/web/consumer/admin/src/app/**`
- `apps/web/consumer/storefront/src/app/**`
- `infrastructure/dns.tf`
- `tasks/todo.md`
- `memory/lessons.md`
- root `AGENTS.md`

## Security Audit

### Strengths

- Worker uses auth middleware for protected routes.
- Auth rate limit exists for `/auth`.
- Sensitive route rate-limit middleware exists.
- Admin proxy signs internal requests rather than exposing service keys.
- Storefront customer session uses httpOnly cookie in `session.ts`.
- Payment webhook worker verifies Razorpay and Stripe signatures.
- Payment webhook events are stored idempotently with provider event IDs.
- Root governance explicitly forbids service-role keys in client components and auth tokens in `localStorage`.

### Critical Security Risks

| Risk | Evidence | Impact |
|---|---|---|
| Service role blast radius | Worker uses Supabase admin client | Any missing tenant predicate becomes cross-tenant risk |
| Public storefront customer endpoints | `storefront.ts` contains many customer/order lookup endpoints | Enumeration/cross-tenant leakage risk if predicates fail |
| Input validation body consumption | `middleware/security.ts` reads `c.req.text()` on mutating JSON | Can interfere with downstream parsing or produce inconsistent request handling |
| Raw error leakage | Some routes return DB error messages | Internal schema/details exposed |
| Incomplete RBAC | only helper middleware found | Staff/role isolation not production-ready |
| Incomplete CSRF posture | task register calls it out | Browser-admin mutations need documented CSRF defense |
| Hardcoded provider key debt | root scan notes hardcoded Razorpay/Stripe-style ids | Secret/key hygiene risk |

### Required Security Controls

- Formal `TenantContext` required by every service.
- Centralized error serializer that never exposes raw DB/provider internals.
- Full RBAC with memberships/roles/permissions.
- MFA/TOTP for console/team apps.
- CSRF protection for browser-originating mutations if cookie auth is used.
- WAF/rate-limit rules per public surface.
- Gift card/coupon brute-force protection.
- Secret rotation and secret scanning.
- Storage path tenant isolation and signed URL enforcement.

## Reliability Audit

### Strengths

- Request ID middleware exists.
- Known errors use `AppError`/`formatAppError`.
- Payment webhook idempotency is present.
- SQL checkout RPC is transactionally strong.
- Payment failure RPC can release inventory.

### Reliability Blockers

| Blocker | Evidence | Impact |
|---|---|---|
| No queue/job system | outbox table only | Side effects are synchronous or missing |
| No outbox dispatcher | `outbox_events` exists, no consumer found | Events are not delivered |
| Unsafe fallback | `createOrderCompat` | Non-atomic order/inventory mutation |
| No reconciliation jobs | no scheduled checks found | Silent drift in inventory/payment/order state |
| Partial workflow writes | product create variants/options/inventory after product insert | Incomplete product state |
| No saga/workflow engine | services manually sequence operations | Hard rollback and retry semantics |
| No dead-letter/replay | no queue runtime | Permanent failure handling absent |

## Scalability Audit

### Current Scale Ceiling

LetBuyy can likely support low-volume merchants and demos if infrastructure is correctly deployed. It is not ready for:

- high-concurrency flash sales,
- large catalogs with faceted search,
- high-volume order management,
- multi-location warehouse operations,
- many app integrations/webhooks,
- multi-region checkout,
- enterprise staff permissions.

### Bottlenecks

- Product/storefront search relies on database query patterns, not a search index.
- Customer list derives customers from paginated orders in `customers.ts`.
- Analytics are direct aggregate queries against operational tables.
- Bulk inventory adjustment loops sequentially in route handler.
- No async import/export/bulk job architecture.
- No cache invalidation/event projection system beyond theme cache tag tables.
- Hot product inventory writes serialize on row locks.

## Performance Audit

### Frontend

Admin pages are clean but simple. Large stores need:

- table virtualization,
- cursor pagination,
- debounced filters,
- server-rendered initial page data,
- route-level caching where safe,
- background jobs for bulk operations.

Storefront needs:

- server-authoritative cart/checkout totals,
- cached catalog/theme rendering,
- CDN-friendly product/collection pages,
- image optimization,
- predictable cache invalidation on product/theme changes.

### Backend

Worker concerns:

- Some routes are large and multi-responsibility, especially `storefront.ts`.
- Storefront public routes do many manual JSON parse/validation flows.
- Service-role DB access requires careful query optimization and indexes.
- Checkout RPC row locks can become bottlenecks under hot SKU demand.

### Database

Needs:

- query plans for top product/order/storefront routes,
- indexes for every tenant-scoped list/filter,
- partition/archive strategy for events/orders/webhooks,
- migration cleanup for duplicate/non-standard prefixes,
- removal of generated artifacts from tracked source.

## Payment and Checkout Audit

### Strengths

- Server does not trust client item prices in storefront order creation.
- Razorpay and Stripe webhooks verify signatures in webhooks worker.
- Stripe/PayPal Next routes integrate with worker internal payment APIs.
- Payment webhooks are idempotency-recorded.

### Critical Gaps

- No canonical payment transaction ledger wired across all providers.
- No normalized auth/capture/refund/void model.
- COD is not represented as a payment workflow with risk/collection states.
- Checkout RPC does not compute shipping/tax/discount/gift-card amounts.
- Coupon redemption is not atomic.
- Gift card redemption absent.
- Refunds are incomplete and not provider-normalized.

## Inventory and Fulfillment Audit

### Strengths

- Order placement RPC locks inventory.
- Reservation/release tables exist.
- Inventory levels and locations exist.
- Inventory adjustments history exists.

### Critical Gaps

- No purchase order system.
- No transfer system.
- No incoming/unavailable/on-hand state model.
- No fulfillment order model.
- No shipment table/carrier events.
- No partial fulfillment.
- No returns/RMA processing.
- No reconciliation.

## Observability Audit

### Current

- Request ID and timing middleware exist.
- Unexpected worker errors are logged internally.
- Webhook worker logs warnings/errors.

### Missing

- Structured logs with tenant/request/user fields.
- Distributed tracing across Next -> worker -> Supabase -> provider.
- Metrics for route latency/error rates.
- Business metrics for checkout conversion/payment failures/inventory releases.
- SLOs and alerting.
- Webhook delivery dashboards.
- Queue/job dashboards.
- Admin-visible request IDs.
- Redaction policy.

### Required Baseline

```text
Logs:
  request_id, trace_id, site_id, user_id, route, status, latency_ms

Metrics:
  http_requests_total
  http_request_duration
  checkout_attempts
  checkout_failures
  payment_webhook_failures
  inventory_reservation_failures
  queue_lag
  outbox_backlog

Traces:
  Next route -> worker route -> service -> Supabase RPC -> provider API

Alerts:
  checkout error rate
  payment confirmation lag
  webhook failure spike
  inventory negative stock
  outbox backlog
```

## DevOps and CI/CD Audit

### Current Concerns

- Generated artifacts such as `backend/workers/api/dist/*` are tracked debt per governance.
- Vercel install command workaround removes app-local Next copies.
- No production rollback/runbook docs were identified in the inspected paths.
- No explicit migration promotion/rollback strategy was found.

### Required Protections

- CI checks for typecheck/lint/test/build per affected package.
- Migration linting for sequential prefixes, reversible behavior, RLS, indexes.
- Preview deployments with seeded smoke checks.
- Worker deployment canary.
- Database backup before migrations.
- Rollback plan for worker and Next apps.
- Secret scanning.
- Generated artifact exclusion.
- Docs regeneration after architecture changes.

## Disaster Recovery and Backup Audit

Missing or not evident:

- RPO/RTO definitions.
- Supabase backup verification.
- Point-in-time restore drill.
- R2 backup lifecycle.
- Payment event replay runbook.
- Webhook redelivery runbook.
- Inventory reconciliation after restore.
- Tenant export/restore.
- Incident roles/escalation.

## CI/CD Gate Recommendations

Minimum gates:

```text
pnpm typecheck affected apps/packages
pnpm lint affected apps/packages
worker tests
migration validation
RLS policy check
secret scan
no generated dist tracked
Playwright smoke for admin orders/coupons/checkout when frontend changes
```

## Production Launch Minimum Bar

Before real merchants:

- Remove or hard-disable unsafe order fallback.
- Make checkout idempotent.
- Compute discount/shipping/tax server-side.
- Add payment transaction ledger.
- Add order detail/admin timeline.
- Add inventory reconciliation job.
- Add structured logs/metrics/alerts.
- Add tenant context enforcement.
- Add CSRF/RBAC hardening.
- Create incident/runbook docs.

Before scale:

- Add queues/outbox dispatcher.
- Add search index.
- Add promotion/gift card ledger.
- Add fulfillment orders.
- Add purchase orders/transfers.
- Add background bulk jobs.
- Add webhook subscription platform.

## Risk Register

| Severity | Risk | Owner Area | Required Action |
|---|---|---|---|
| Critical | Incorrect checkout totals | Checkout/order | Server-side pricing workflow |
| Critical | Oversell fallback | Order service | Remove unsafe fallback |
| Critical | Gift card future double-spend | Gift card | Ledger before redemption |
| Critical | Coupon usage race | Promotion | Redemption ledger |
| High | Cross-tenant leakage | Tenant/security | TenantContext/service enforcement |
| High | Payment/refund drift | Payments | Payment transaction ledger |
| High | Fulfillment absent | Orders/warehouse | Fulfillment order model |
| High | No event dispatcher | Platform | Queue/outbox runtime |
| Medium | Admin placeholders | UX/product | Feature-gate or implement |
| Medium | Analytics load | Data | Event pipeline/warehouse |

## Production Readiness Score

| Domain | Score |
|---|---:|
| Security | 3/10 |
| Tenant isolation | 4/10 |
| Checkout/order | 4/10 |
| Payments | 5/10 |
| Inventory | 3/10 |
| Fulfillment | 1/10 |
| Discounts/gift cards | 2/10 |
| Observability | 2/10 |
| DevOps | 2/10 |
| Disaster recovery | 1/10 |
| Overall | 2.7/10 |

## Scalability Score

| Scale Target | Score |
|---|---:|
| Hundreds of stores | 4/10 |
| Thousands of stores | 3/10 |
| Millions of products | 3/10 |
| Millions of orders | 2/10 |
| Distributed inventory | 1/10 |
| Enterprise integrations | 1/10 |

## SaaS Maturity Score

Production SaaS maturity: **2.5/10**.

LetBuyy has a credible architectural foundation. It needs platform hardening and domain ledgers before it should be trusted with high-volume merchant money, inventory, and customer data.

