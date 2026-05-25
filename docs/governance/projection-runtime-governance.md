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

## Recovery

- `config/runtime/projection-recovery-manifest.json` is the machine-readable projection recovery contract.
- Projection checkpoints must use caller-supplied runtime time, not package-local wall-clock stamping.
- Projection rebuilds must compute deterministic integrity hashes from identity, freshness metadata, and read models.
- Projection recovery snapshots in the repository are fixture contracts only; live recovery evidence requires execute-mode provider data.

## Enforcement

Validators hard fail projection persistence, rebuild, replay, query snapshot, or read-model hydration contract definitions outside `packages/projection-runtime`, except runtime-composition response/projection assembly contracts.
`scripts/validators/projection-recovery-validator.mjs` hard-fails missing checkpoint source metadata, missing recovery hashes, projection source event drift, and hash mismatch.
