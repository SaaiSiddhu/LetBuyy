# Query Layer Governance

Status: Phase 2 foundation.

Query layers live in `packages/runtime-composition`.

## Responsibilities

- Read orchestration.
- Aggregation contracts.
- Projection assembly.
- Cache policy contracts.
- Runtime response shaping.
- Tenant-scoped cache keys and projection versions.

## Query Layers

- `storefront-query-layer`
- `merchant-query-layer`
- `analytics-query-layer`
- `mobile-query-layer`

## Rules

- Query projections must include tenant scope where merchant or shopper data is involved.
- Cache tags must be invalidatable by store/site and projection version.
- Pages may render projections but should not become canonical aggregation owners.
- Mutation workflows belong in application services, not query layers.
