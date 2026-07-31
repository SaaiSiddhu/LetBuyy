# LPAS Discovery — Performance Analytics System (Phase 13)

**Date:** 2026-07-04 · Verified against the real repository. **No coding before this discovery.**

## 1. What already exists (LPAS composes)

| Capability | Where (verified) | LPAS reuse |
|---|---|---|
| Deterministic forecasting methods | `lcis-operations` `forecast/methods.ts` (`forecast(n)` interfaces) + `ForecastOperationsService` (`forecastTraffic/forecastOrders/forecastQueueGrowth` — honest `notConnected` series) | THE forecasting substrate — LPAS never re-implements a forecaster |
| Live telemetry sources (values query-bound) | **Phase 9 `lcis-adapters`**: `AnalyticsEngineAdapter` (datasets; values NOT_CONNECTED, POST-only SQL API named), `WorkersAdapter`, `QueuesAdapter`, `RedisAdapter` (cache size), `PostgresAdapter` (db health), `AdapterObservability` (adapter-op p50/p95) | The exact per-metric source map |
| Topology to hang metrics on | **Phase 11 `lcis-twin`** (api/rpc/worker/queue/table nodes) | Metric attachment points + hotspot propagation |
| Cost model | `graphify-out/cost-intelligence.json` via `ArtifactStore` (usage query-bound) | Cost forecasting inputs |
| Runtime emission points | `lcis-operations` `RuntimeOperationsService` | Where latency WOULD be measured |

**Net-new in LPAS (verified absent):** the performance MODEL layer — a per-entity `MetricDescriptor` catalog (api/rpc/db/queue/worker latency, cache hit ratio, memory, CPU, bandwidth, cold starts, scaling) each bound to its exact live source and honest connection state; percentile/statistics utilities; capacity/growth/cost forecasts built by feeding whatever series exist into the *existing* forecast methods; and ADVISORY-ONLY recommendations (never mutating anything). No existing package catalogs metrics or produces performance recommendations.

## 2. Phase 13 scope

**New package `packages/lcis-performance`** (LPAS). Foundation: `MetricDescriptor` `{ key, kind: latency|throughput|ratio|resource|cold-start|scaling, entity (twin node ref), unit, liveSource, requiredEnv, connection }`, `MetricSeries` (values present only when a live series is injected; otherwise NOT_CONNECTED + null values — never fabricated), `PerformanceFinding`, `CapacityForecast`, `CostForecast`, `Recommendation` `{ advisory: true (literal), action, rationale, evidence }`, `PerformanceReport` — provenance-stamped via `performance()` envelope.

Services: MetricCatalogService (builds the descriptor catalog from the twin + adapter signal registry), StatisticsService (pure percentile/mean/stddev/trend utilities — exact-value tested), LatencyModelService (per-layer expected-latency structural model, clearly labeled MODEL not measurement), CapacityService + GrowthService + CostService (delegate series math to lcis-operations forecast methods), RecommendationService (rule registry PA01.. — advisory only), facade `PerformanceEngine` → `generateCatalog`, `analyze(seriesInput?)`, `forecastCapacity`, `forecastCost`, `generatePerformanceReport`.

Benchmark requirement: measured inside tests (op-count bounds + wall-time ceilings on generated fixtures) — never fabricated numbers in docs.

## 3. Verification plan

`pnpm typecheck test --filter=@letbuyy/lcis-performance`. Target ≥400 tests: statistics ~80 (exact values), catalog ~60, models ~60, forecasts ~60, recommendations ~50, facade ~40, honesty (no fabricated values anywhere) ~25, security scan ~25.
