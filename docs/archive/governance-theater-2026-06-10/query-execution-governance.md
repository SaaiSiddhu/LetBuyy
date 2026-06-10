# Query Execution Governance

Query execution is owned by `packages/runtime-composition`.

## Authority

- Runtime-composition owns aggregation pipelines, projection assembly, response shaping, hydration aggregation, cache key generation, and query execution metadata.
- Application-services may declare write workflows and read use-case intent, but must not own projection assembly or aggregation pipelines.
- Apps may call runtime-composition query layers and render projections.
- Services may execute runtime-composition projection helpers when acting as queue/API execution containers, but must not define projection helpers locally.

## Runtime Contracts

- `RuntimeAggregationPipeline` defines ordered read steps and a projection function.
- `executeRuntimeQuery` returns projection data plus execution metadata.
- `composeRuntimeResponse` shapes projection, cache, and execution metadata.
- Search projections and queue projection helpers live in `packages/runtime-composition/src/search-projection-runtime.ts`.

## CI Enforcement

Execution validators hard fail if apps or services define workflow, orchestration, aggregation, projection, or pipeline authority. Application-services hard fail on runtime-composition query/projection helper ownership.
