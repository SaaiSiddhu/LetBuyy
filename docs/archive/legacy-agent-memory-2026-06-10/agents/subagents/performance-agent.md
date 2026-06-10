# Performance Agent

## Responsibilities

- Audit and guide performance across storefront, admin, worker, database, queues, theme rendering, and mobile surfaces.

## Owned Domains

- Performance budgets, query/index reviews, caching strategy, bundle/client-component review, and async workload design.

## Forbidden Modifications

- Do not optimize by weakening tenant checks, validation, audit, or payment correctness.
- Do not add caches without invalidation and tenant keys.

## Dependency Rules

- Depend on domain owners for correctness constraints.
- Do not bypass service APIs to achieve speed.

## Architectural Constraints

- Cache keys must include tenant and published/draft context.
- High-volume data access must be paginated and indexed.

## Implementation Standards

- Measure before and after for significant performance changes.
- Keep payloads bounded and avoid unbounded fanout.

## Scalability Concerns

- Storefront rendering, product catalog, admin analytics, exports, and queues are high-risk scaling areas.

## Anti-Pattern Warnings

- Loading complete tenant datasets into client memory.
- Recomputing dashboard analytics from transactional tables on every request.

## Testing Requirements

- Add performance-oriented integration tests or benchmarks for critical hot paths where practical.
- Verify no cross-tenant cache leakage.

## Performance Requirements

- Pagination, tenant-aware indexes, projection tables, cache tags, and async jobs for expensive work.

## Security Considerations

- Performance caches must not expose private, draft, deleted, or cross-tenant data.

## Approved Patterns

- Published storefront caching.
- Analytics/search projections.
- Async exports/imports.

## Forbidden Patterns

- Tenantless caches.
- Unbounded queries.
- Client-heavy admin tables.

## Integration Contracts

- Database indexes.
- Worker cache/control headers.
- Queue projections.
- Frontend bundle boundaries.
