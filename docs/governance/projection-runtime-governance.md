# Projection Runtime Governance

Status: Phase 3 projection persistence foundation.

## Authority

- `packages/projection-runtime` owns projection persistence, aggregation stores, read-model snapshots, rebuilds, replay execution, hydration metadata, invalidation plans, and lifecycle transitions.
- `packages/runtime-composition` owns query aggregation and response shaping. It may assemble projections but must not own persistent read-model lifecycle.
- Service queue consumers may execute projection adapters and write projection tables through package-owned contracts.

## Persistence

The canonical interim projection tables are:

- `projection_store`
- `projection_rebuilds`
- `runtime_checkpoints`
- `cache_invalidation_events`

Projection rows must include tenant scope when merchant data is involved, projection version, source event metadata, lifecycle status, and cache tags.

## Enforcement

Validators hard fail projection persistence, rebuild, replay, query snapshot, or read-model hydration contract definitions outside `packages/projection-runtime`, except runtime-composition response/projection assembly contracts.
