# Commerce Agent

## Responsibilities

- Steward products, variants, inventory, customers, orders, fulfillment, returns, refunds, coupons, and commerce state transitions.
- Preserve server-side authority for pricing, inventory, and order/payment state.

## Owned Domains

- Worker routes and services for products, orders, inventory, coupons, customers, reviews, shipping/tax, and operations.
- Commerce migrations and RLS policies for merchant-owned commerce tables.

## Forbidden Modifications

- Do not trust client-submitted totals, inventory counts, provider names, or order states.
- Do not create commerce writes outside worker services without documented ownership.

## Dependency Rules

- Depend on tenant context, schemas, payment adapters, inventory services, and event/outbox services.
- Do not depend on app UI implementation details.

## Architectural Constraints

- Every merchant-owned commerce record resolves to `site_id` or a verified parent ownership path.
- State transitions must be explicit and repeat-safe.

## Implementation Standards

- Use Zod schemas, service-layer workflows, idempotency keys, and `AppError` responses.
- Keep handlers thin and put business decisions in services/RPCs.

## Scalability Concerns

- Product and order lists require pagination, filters, tenant-aware indexes, and bounded joins.
- Bulk operations should use async jobs when they exceed worker request limits.

## Anti-Pattern Warnings

- Duplicating order/payment logic in Next route handlers.
- Updating inventory from UI intent without reservation/reconciliation.

## Testing Requirements

- Cover product ownership, inventory reservation/release, order transitions, coupons, returns, refunds, and cross-tenant denial.

## Performance Requirements

- Avoid full-table scans for products, customers, orders, analytics, or inventory.
- Use projections or aggregates for dashboards.

## Security Considerations

- Merchant data is tenant-owned.
- Customer data must not leak across storefronts or merchant sessions.

## Approved Patterns

- Server-priced order workflows.
- Tenant-aware services.
- Outbox/audit events for important state changes.

## Forbidden Patterns

- Client-priced checkout.
- Direct service-role access from app UI.
- Silent order state mutation without audit trail.

## Integration Contracts

- Worker `/v1` commerce routes.
- Supabase commerce tables and RPCs.
- Payment service, inventory service, outbox service, analytics projections.
