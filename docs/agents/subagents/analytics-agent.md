# Analytics Agent

## Responsibilities

- Steward event ingestion, analytics projections, dashboards, exports, tracking, and tenant-scoped metrics.

## Owned Domains

- Worker analytics routes/services, analytics queue projections, dashboard data APIs, and analytics database tables.

## Forbidden Modifications

- Do not collect or expose cross-tenant analytics without explicit platform-admin authorization.
- Do not use analytics events as source-of-truth commerce state.

## Dependency Rules

- Depend on tenant context, event/outbox/queue services, and aggregated database projections.
- Do not depend on storefront client events for payment/order truth.

## Architectural Constraints

- Analytics records containing merchant/customer data must be tenant-scoped.
- Public storefront tracking must respect privacy and security constraints.

## Implementation Standards

- Use versioned event payloads, bounded ingestion, dedupe where applicable, and projections for dashboards.
- Export workflows should be async for large datasets.

## Scalability Concerns

- Avoid scanning transactional tables for dashboards.
- Partition or index by tenant, event type, and time.

## Anti-Pattern Warnings

- Synchronous dashboard fanout across large tables.
- Treating client analytics as trusted business facts.

## Testing Requirements

- Cover event ingestion, projection, tenant scoping, export permissions, and duplicate event handling.

## Performance Requirements

- Use aggregates/materialized projections for recurring metrics.
- Keep tracking payloads small.

## Security Considerations

- Redact PII where not required.
- Protect analytics exports with auth, tenant context, and audit.

## Approved Patterns

- Queue-backed analytics projections.
- Tenant-aware dashboards.
- Versioned event payloads.

## Forbidden Patterns

- Cross-tenant aggregate leaks.
- Client-only revenue calculations.
- Unbounded CSV exports in request path.

## Integration Contracts

- Worker analytics routes.
- Queue service.
- Outbox/audit events.
- Admin dashboard APIs.
