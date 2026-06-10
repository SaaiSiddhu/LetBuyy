# Cache Runtime Governance

Status: Phase 3 final cache orchestration foundation.

## Authority

- `packages/distributed-runtime/src/cache-runtime.ts` owns distributed cache keys, stale-while-revalidate metadata, replay-aware invalidation plans, tenant cache partitioning, and cache consistency state.
- `packages/distributed-runtime/src/cache-operations-runtime.ts` owns cache inspection, consistency verification, invalidation execution, and cache operation snapshots.
- `packages/projection-runtime/src/projection-cache-runtime.ts` maps projection records onto distributed cache policy.
- Runtime composition may declare cache policy for read models, but durable invalidation and replay-aware cache orchestration must use the package contracts.

## Rules

- Tenant-owned cache keys must include the tenant partition key.
- Replay invalidation must preserve the source event id when available.
- Projection caches must be invalidated when source events mark projections stale, invalidated, deleted, or rebuilt.
- Stale cache reads are allowed only when a policy explicitly defines `staleWhileRevalidateSeconds`.

## Enforcement

- Runtime manifests must declare `cacheOwnership`.
- Runtime manifests must declare `cacheExecutionOwnership`.
- `scripts/validators/distributed-runtime-validator.mjs` hard fails cache orchestration contracts outside `packages/distributed-runtime`.
- `cache_invalidation_events` is the interim persistence table for service-owned invalidation processing.
- `cache_operation_snapshots` is the interim operational projection for cache lifecycle diagnostics.
