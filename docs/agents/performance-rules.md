# Performance Rules

## Storefront Budgets

- Public storefront reads must be bounded, cacheable, and scoped by tenant and published state.
- Product listing endpoints require pagination, filters, and indexes.
- Theme rendering should avoid unbounded nested data loading.
- Preview mode must not degrade or poison published cache behavior.

## Admin Budgets

- Tables need pagination, server-side filters, search indexes, and bulk operation limits.
- Dashboard analytics should use projections or aggregates, not repeated expensive transactional scans.
- Long-running exports/imports should use asynchronous jobs.

## Worker Budgets

- Keep request payloads bounded.
- Avoid large in-memory fanout inside a single worker request.
- Use queues/outbox for retries and side effects.
- External provider calls need timeouts and retry/idempotency strategy.

## Frontend Budgets

- Minimize unnecessary client components.
- Avoid duplicating heavy UI logic across apps.
- Use shared primitives and predictable loading states.
- Measure storefront and checkout flows before declaring performance work complete.

## Data Budgets

- Every high-volume table needs tenant-aware indexes.
- Analytics/search projections should avoid cross-tenant full scans.
- Soft-deleted records must be filtered consistently.
