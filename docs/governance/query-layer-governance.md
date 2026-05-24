# Query Layer Governance

Status: Phase 2.5 runtime query authority.

Query layers live in `packages/runtime-composition`.

## Responsibilities

- Read orchestration.
- Aggregation contracts.
- Projection assembly.
- Cache policy contracts.
- Runtime response shaping.
- Tenant-scoped cache keys and projection versions.
- Aggregation pipeline execution contracts.
- Hydration aggregation and response shaping.

## Query Layers

- `storefront-query-layer`
- `merchant-query-layer`
- `analytics-query-layer`
- `mobile-query-layer`
- `src/query-runtime.ts`

## Rules

- Query projections must include tenant scope where merchant or shopper data is involved.
- Cache tags must be invalidatable by store/site and projection version.
- Pages may render projections but should not become canonical aggregation owners.
- Mutation workflows belong in application services, not query layers.
- Storefront route entries must delegate storefront read aggregation to `composeStorefrontRuntimeProjection` or a successor runtime-composition query contract.
- Apps and services must not introduce new cross-domain projection assembly outside `packages/runtime-composition`.
