# LPAS Architecture — Performance Analytics System (Phase 13)

**Package:** `@letbuyy/lcis-performance` · **Source root:** `packages/lcis-performance/src/`
**Date verified:** 2026-07-04 · All claims grounded in real source; nothing inferred.

---

## 1. What LPAS Is

LPAS is a read-only performance intelligence layer. It builds a per-entity metric catalog bound to exact live sources, computes pure statistics over caller-provided series, produces structural latency models (clearly labeled models, never measurements), delegates forecasts to `lcis-operations` primitives, and emits advisory-only recommendations. Nothing in LPAS mutates infrastructure or synthesizes a value.

The `PerformanceEngine` facade (`src/engine.ts`) is the single composition point. Every output is stamped by the `performance()` envelope (`src/shared/envelope.ts`).

---

## 2. The No-Fabrication Law

Defined at the top of `src/shared/types.ts`:

> "The no-fabrication law: a MetricSeries with no provided values is NOT_CONNECTED with `values: null` — LPAS never synthesizes a measurement, a percentile of nothing, or a forecast from an empty series."

This law propagates through every service:

| Path | Behaviour |
|---|---|
| `MetricCatalogService.resolveSeries()` — no provided series | `connection: 'NOT_CONNECTED'`, `values: null`, evidence cites `descriptor.liveSource` |
| `MetricCatalogService.resolveSeries()` — non-empty provided array | `connection: 'CONNECTED'`, `values: provided`, evidence cites `'caller-provided series'` |
| `StatisticsService.statsOf([])` | Returns `null` — never fabricates statistics |
| `StatisticsService.trendOf([], h)` | Returns `null` |
| `CapacityService.forecastCapacity(subject, null)` | `connection: 'NOT_CONNECTED'`, `forecastValues: null` |
| `CostService.forecastCost(null)` | `connection: 'NOT_CONNECTED'`, `forecastValues: null` |

The `confidenceFrom()` function in `envelope.ts` returns `0` when the evidence array is empty or contains only `not-connected` evidence, ensuring report confidence reflects honest connectivity.

---

## 3. The Metric Catalog Model

Built by `MetricCatalogService.buildCatalog()` (`src/catalog/MetricCatalogService.ts`). The catalog is deterministic: it walks every node in the `lcis-twin` dependency graph and emits one or more `MetricDescriptor` records per layer, plus two twin-independent entries that are always present.

### 3.1 MetricDescriptor

```typescript
interface MetricDescriptor {
  readonly key: string;           // Stable key, e.g. 'latency.api./v1/orders'
  readonly kind: MetricKind;      // 'latency' | 'throughput' | 'ratio' | 'resource' | 'cold-start' | 'scaling'
  readonly entity: string;        // Twin node id ('<layer>:<name>')
  readonly unit: string;
  readonly liveSource: string;    // The exact source that would supply values
  readonly requiredEnv: readonly string[];
  readonly reachable: boolean;    // false when structurally unreachable via GET boundary
  readonly unreachableReason?: string;
}
```

`liveSource` is always the real source name — never a placeholder. `reachable: false` means no environment variable or runtime wiring change can make it reachable given the current API boundary; the `unreachableReason` states exactly why.

### 3.2 Descriptor Emission Rules (per twin node layer)

| Twin layer | Metric key prefix | Kind | Live source | Reachable | Reason if not |
|---|---|---|---|---|---|
| `api` / `route` | `latency.api.<name>` | `latency` | Analytics Engine SQL API (POST `/analytics_engine/sql`) | **false** | AE SQL API is POST-only — unreachable via the GET boundary |
| `rpc` | `latency.rpc.<name>` | `latency` | Analytics Engine SQL API (POST `/analytics_engine/sql`) | **false** | AE SQL API is POST-only — unreachable via the GET boundary |
| `table` | `latency.db.<name>` | `latency` | `pg_stat_statements` (SQL access) | **false** | `pg_stat_statements` requires SQL access — not exposed over the GET-only Management API |
| `queue` | `throughput.queue.<name>` | `throughput` | Cloudflare GraphQL Analytics API (POST-only) | **false** | Queue metrics are served by the Cloudflare GraphQL Analytics API (POST-only) |
| `queue` | `scaling.queue.<name>` | `scaling` | Cloudflare Queues REST API (queues adapter — per-queue consumers) | **true** | Requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| `worker` | `cold-start.worker.<name>` | `cold-start` | Analytics Engine SQL API (POST `/analytics_engine/sql`) | **false** | AE SQL API is POST-only — unreachable via the GET boundary |
| `worker` | `resource.worker.<name>` | `resource` | Analytics Engine SQL API (POST `/analytics_engine/sql`) | **false** | AE SQL API is POST-only — unreachable via the GET boundary |

### 3.3 Twin-Independent Fixed Metrics (always present)

These two descriptors are appended unconditionally after twin traversal:

```
ratio.cache.redis
  kind: ratio, entity: 'infrastructure:redis', unit: 'ratio'
  liveSource: 'redis INFO (not in the read-only command allowlist)'
  reachable: false
  unreachableReason: 'INFO is not in the read-only command allowlist (unbounded response)'

resource.db.postgres
  kind: resource, entity: 'database:postgres', unit: 'percent'
  liveSource: 'postgres adapter (Supabase Management API)'
  requiredEnv: ['SUPABASE_MGMT_TOKEN', 'SUPABASE_PROJECT_REF']
  reachable: true
```

The catalog is sorted by key and deduplicated (first occurrence wins).

### 3.4 MetricSeries Resolution

`resolveSeries(descriptor, provided?)` (`src/catalog/MetricCatalogService.ts:209`) applies the no-fabrication law at the individual descriptor level:

- `provided !== undefined && provided.length > 0` → `CONNECTED`, `values: provided`
- otherwise → `NOT_CONNECTED`, `values: null`

No computation is performed on `null` values. The evidence on a `NOT_CONNECTED` series is produced by `notConnected(descriptor.key, descriptor.liveSource)` from `@letbuyy/lcis-core`, so the series always names the real source.

---

## 4. The Structural Latency Model

Produced by `LatencyModelService.modelFor()` (`src/latency/LatencyModelService.ts`).

### 4.1 Contract

From the source contract comment:

> "Structural model only — never a measurement. Every note MUST state this."

Every `LatencyModelEntry` carries a `note` field whose runtime value is:

```
"Structural model from topology (<n> hop[s]) — not a measurement;
live latency requires Cloudflare Analytics Engine (AE_DATASET)."
```

The engine test at line 122–127 asserts this: `assert.match(entry.note.toLowerCase(), /not a measurement/)`.

### 4.2 LatencyModelEntry

```typescript
interface LatencyModelEntry {
  readonly entity: string;        // Twin node id
  readonly chain: readonly string[];  // Full hop path (twin node ids)
  readonly hops: number;          // Number of network/system hops
  readonly band: 'single-hop' | 'multi-hop' | 'deep-chain';
  readonly note: string;          // Always states "not a measurement"
  readonly evidence: readonly Evidence[];
}
```

### 4.3 Algorithm

Applied to every twin node whose layer is `api`, `route`, or `rpc`:

1. Build BFS adjacency once from the twin graph (cached by `TwinEngine`).
2. For each `table:*` node, compute `shortestPath(entity → table)` via `@letbuyy/lcis-twin`.
3. Keep the **longest** found shortest-path (structural worst-case).
4. If no table is reachable: `chain = [entity]`, `hops = 0`.
5. Derive `band` from `hops`: `hops <= 1` → `'single-hop'`; `hops <= 3` → `'multi-hop'`; otherwise `'deep-chain'`.
6. Sort entries by entity ascending for determinism.

Empty twin returns `[]` (no throw). An entity with no reachable table gets `hops = 0`, `band = 'single-hop'`.

---

## 5. Statistics Service

`StatisticsService` (`src/statistics/StatisticsService.ts`) is pure: no constructor dependencies, no IO, no clock, no side effects.

### 5.1 statsOf(values)

Returns `SeriesStatistics | null`. Returns `null` on empty input — never fabricates.

```typescript
interface SeriesStatistics {
  count, mean, min, max, p50, p95, p99, stddev
}
```

**Percentile formula (exact, from source):**
```
index = min(len - 1, max(0, ceil(p / 100 * len) - 1))
```
Applied to the ascending-sorted copy for p50, p95, p99.

**Standard deviation:** population stddev (`sqrt(Σ(x_i - mean)² / N)`).

### 5.2 trendOf and movingAverageOf

Both return `null` on empty input and delegate entirely to `@letbuyy/lcis-operations`:
- `trendOf` → `linearTrend([...values]).forecast(horizon)`
- `movingAverageOf` → `movingAverage([...values], window)`

LPAS adds no math beyond `statsOf`.

---

## 6. Forecast Delegation to lcis-operations

LPAS never re-implements a forecasting algorithm. Both `CapacityService` and `CostService` delegate to `linearTrend` from `@letbuyy/lcis-operations`.

### 6.1 CapacityService

`forecastCapacity(subject, series, horizon = 6)` (`src/capacity/CapacityService.ts`):

- `series` non-null and non-empty → calls `linearTrend([...series])`, takes `result.forecast(horizon)`. Evidence records `slope` and `intercept` from the OLS fit. `method` field is `'ols-linear-trend (lcis-operations)'`.
- `series` null or empty → `connection: 'NOT_CONNECTED'`, `forecastValues: null`. Evidence cites `'live usage series (telemetry adapters)'`.

The OLS primitive is sourced from `packages/lcis-operations/src/forecast/methods.ts#linearTrend`.

Engine test (line 84–88) asserts the linear projection:
```typescript
const r = engine().generatePerformanceReport({ 'throughput.queue.order-events': [10, 20, 30] });
assert.equal(r.capacity!.connection, 'CONNECTED');
assert.deepEqual(r.capacity!.forecastValues!.slice(0, 2), [40, 50]);
```

### 6.2 CostService

`forecastCost(series, horizon = 6)` (`src/cost/CostService.ts`):

- Reads `cost-intelligence.json` via `ArtifactStore.tryRead`. Parses `pricing[].service` with a zod-loose schema. Absent or malformed artifact → `modeledComponents: []` with `NOT_CONNECTED` evidence.
- Forecast delegation identical to `CapacityService`: `linearTrend` when series non-empty, `forecastValues: null` when not.

---

## 7. Advisory-Only Recommendations — PA01..PA06

Rules are declared in `src/shared/rules.ts` as immutable constants. The `Recommendation` type in `src/shared/types.ts` requires `advisory: true` as a **literal type** — not a boolean, not computed:

```typescript
interface Recommendation {
  readonly id: string;
  readonly rule: string;
  readonly advisory: true;   // ALWAYS true — LPAS never acts.
  readonly action: string;
  readonly rationale: string;
  readonly severity: Severity;
  readonly evidence: readonly Evidence[];
}
```

`RecommendationService.recommend()` (`src/recommend/RecommendationService.ts`) has `advisory: true` on every `recs.push({…})` call — the value is a literal, never a variable. Action wording always begins with `'Consider …'`.

### 7.1 Rule Registry

| Rule | Severity | Fires when |
|---|---|---|
| PA01 — Deep dependency chain | `medium` | `LatencyModelEntry.band === 'deep-chain'` (one per entry) |
| PA02 — High fan-in hotspot | `high` | `fanTop` entry with `fanIn >= 5` (one per entry) |
| PA03 — Telemetry not connected | `info` | `notConnectedMetricKeys.length > 0` (fires ONCE) |
| PA04 — Queue without consumer | `high` | Queue id present in `consumerlessQueueIds` (one per queue) |
| PA05 — Cache layer unobserved | `medium` | `!cacheObserved` (fires ONCE) |
| PA06 — SPOF on a hot path | `critical` | SPOF id also appears in `fanTop` with `fanIn >= 3` (one per such SPOF) |

PA06 cross-references: it reads `spofIds` from `twin.spof()` and `fanTop` from `twin.fan(20)`, then fires only when both conditions hold simultaneously.

Output is sorted: severity critical → high → medium → low → info, then by id lexicographically. Id format: `'<rule>-<n>'` where n is 1-based within the rule.

`cacheObserved` is determined in `engine.ts` by checking whether `seriesInput['ratio.cache.redis']` has length > 0.

---

## 8. The PerformanceEngine Facade

`createPerformanceEngine(opts?)` (`src/engine.ts`) wires all six services. A process-wide singleton is available via `getPerformanceEngine()` / `resetPerformanceEngine()` (reset for tests only).

### 8.1 Service Map

```typescript
interface PerformanceEngine {
  statistics: StatisticsService     // pure math over caller-provided arrays
  catalog:    MetricCatalogService  // descriptor catalog from the twin
  latency:    LatencyModelService   // structural hop-chain model
  capacity:   CapacityService       // OLS capacity forecast
  cost:       CostService           // OLS cost forecast + cost-intel artifact
  recommend:  RecommendationService // advisory rules PA01..PA06
}
```

### 8.2 generatePerformanceReport(seriesInput?) — Composition Order

The flagship report is assembled in this order (`engine.ts:99`):

1. `generateCatalog()` — descriptor list from the twin
2. `analyze(seriesInput)` — resolve each descriptor against caller input
3. `latencyModel()` — structural hop-chain entries
4. Count `connectedMetrics` and collect `notConnectedKeys`
5. Build twin graph; compute `fanTop` (top 20), `spofIds`, `queueIds`, `consumerlessQueueIds`, `cacheObserved`
6. `recommend.recommend({latencyModel, fanTop, spofIds, consumerlessQueueIds, notConnectedMetricKeys, cacheObserved})`
7. Map recommendations → findings 1:1 (id `'F-<rec.id>'`, same rule/severity/evidence; PA03 findings get `connection: 'NOT_CONNECTED'`)
8. Capacity forecast: uses `seriesInput['throughput.queue.order-events']` if non-empty, otherwise `forecastCapacity('platform', null)`
9. Cost forecast: uses `seriesInput['cost.total']` if non-empty, otherwise `forecastCost(null)`
10. Compose `summary` string — quotes `ADVISORY-ONLY` and `models, not measurements`
11. Stamp everything via `performance()` envelope

Findings mirror recommendations exactly: `r.findings.length === r.recommendations.length`; `findings[i].id === 'F-' + recommendations[i].id`.

### 8.3 The performance() Envelope

`performance<T>(body, opts)` (`src/shared/envelope.ts`) merges `PerformanceArtifact` provenance onto any object:

```typescript
interface PerformanceArtifact {
  evidence:     readonly Evidence[]
  confidence:   number             // confidenceFrom(evidence) unless overridden
  sources:      readonly string[]  // deduped from evidence[].source
  timestamp:    string             // ISO-8601 from injected now()
  liveConnected: boolean
}
```

`confidenceFrom(evidence)`:
- `0` when evidence is empty
- `0` when all evidence is `not-connected`
- `min(0.9, 0.5 + 0.1 * connectedCount)` otherwise

`defaultNow` (`new Date().toISOString()`) is defined once in `envelope.ts` — the single sanctioned clock boundary. No other source file calls `Date.now()` or `new Date()` without arguments (enforced by security scan).

---

## 9. Measured Benchmarks

From `test/engine.test.ts` (line 155–161), the benchmark is asserted inside the test suite — never fabricated in documentation:

```typescript
test('benchmark: full report over the fixture twin completes under 2s', () => {
  const e = engine();
  const t0 = process.hrtime.bigint();
  e.generatePerformanceReport();
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1_000_000;
  assert.ok(elapsedMs < 2000, `report took ${elapsedMs.toFixed(1)}ms (ceiling 2000ms)`);
});
```

The fixture twin contains: 1 domain (orders), 1 table (`orders`), 1 RPC (`create_checkout_order`), 1 worker (`queue-worker`), 1 queue (`order-events`), 1 route (`/v1/orders`). The ceiling is **2000 ms**; the actual measured time is reported in the test output, never asserted as a specific value here.

---

## 10. Dependency Map

The `package.json` `dependencies` field is enforced by the security test to be exactly:

| Dependency | Role in LPAS |
|---|---|
| `@letbuyy/lcis-adapters` | Named as real live-source adapters (not called directly — sources are named in `liveSource` fields) |
| `@letbuyy/lcis-core` | `LcisEngine`, `ArtifactStore`, `evidence()`, `notConnected()`, `Evidence` type |
| `@letbuyy/lcis-operations` | `linearTrend`, `movingAverage` — the forecasting substrate |
| `@letbuyy/lcis-twin` | `TwinEngine`, `buildAdjacency`, `shortestPath`, twin node/edge graph |
| `zod` | Zod-loose parsing of `cost-intelligence.json` in `CostService` |

`devDependencies`: `@types/node`, `typescript`. No database client, no HTTP client, no AI/LLM library.

---

## 11. What LPAS Does Not Do

- Does not measure anything. Every latency figure, throughput count, or cache ratio must be supplied by the caller from a real source.
- Does not apply any recommendation. `advisory: true` is a literal type; no code path calls `.deploy(`, `applyRecommendation`, or `execute(`.
- Does not reach out over the network (`fetch(`, `http.request`, etc. are banned by the security scan).
- Does not write to the filesystem.
- Does not call any AI/LLM/embedding API.
- Does not call `Date.now()` or `new Date()` outside `envelope.ts`.
- Does not fabricate a forecast from an empty series; `forecastValues` is `null` in that case.
