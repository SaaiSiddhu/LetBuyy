# LQAS Architecture — Quality Analytics System (Phase 15)

**Package:** `packages/lcis-quality` (`@letbuyy/lcis-quality`)
**Date:** 2026-07-05
**Status:** SHIPPED — read-only, deterministic, advisory-only.

---

## 1. Purpose

LQAS is the quality-analytics layer of the LCIS stack. It composes five upstream
LCIS packages — engineering verification, the dependency twin, change tracking, the
structural artifacts (db-intel / infra-intel / graph.json), and the core graph — into
a single deterministic `QualityReport`. It adds no new data sources and executes no
mutations. Every recommendation carries `advisory: true`.

---

## 2. Honesty Contract (read before interpreting any output)

| Signal class | Connection | Exact source |
|---|---|---|
| Coverage gaps (structural) | CONNECTED | `lcis-engineering` `VerificationIntelligenceService.coverageGaps()` |
| Planned-test count | CONNECTED | `lcis-engineering` `VerificationIntelligenceService.planTests()` |
| Graph complexity (fan-in/out/degree) | CONNECTED | `graphify-out/graph.json` via `lcis-core` graph |
| Architecture cycles / SPOF / high-fan | CONNECTED | `lcis-twin` `TwinEngine.cycles()` / `.spof()` / `.fan()` |
| Maintainability index | CONNECTED | Derived from cycles/SPOF/high-fan (see formula, Section 6) |
| Tech-debt scores | CONNECTED | `lcis-tracking` timeline churn × graph degree |
| Doc quality ratio | CONNECTED when db-intel present; NOT_CONNECTED otherwise | `graphify-out/db-intel.json` |
| API typing coverage | CONNECTED when infra-intel present; NOT_CONNECTED otherwise | `graphify-out/infra-intel.json` |
| Line/branch coverage % | NOT_CONNECTED | Coverage report — c8/istanbul lcov |
| Mutation score | NOT_CONNECTED | Mutation testing run — stryker |
| Flaky test list | NOT_CONNECTED | CI retry history — test-run store |
| Pass rate | NOT_CONNECTED | CI test-run store (node --test / vitest results) |

**The honesty law: structural quality is CONNECTED and deterministic. Coverage, mutation,
and flaky values are null until CI data is wired. Never fabricate a percentage.**

QA07 (`info`, weight 0) is emitted as an advisory recommendation whenever
`coverageConnected === false`, ensuring consumers see the NOT_CONNECTED signal
explicitly rather than silently interpreting a null value as zero.

---

## 3. Composition Map

```
QualityAnalyticsEngine
├── TestAnalyticsService       ← lcis-engineering (VerificationIntelligenceService)
│   ├── analyze()              → TestAnalytics  (coverageGaps CONNECTED, passRate NOT_CONNECTED)
│   ├── coverage()             → CoverageAnalytics (gaps CONNECTED, linePct/branchPct NOT_CONNECTED)
│   ├── mutation()             → MutationAnalytics (mutationScore NOT_CONNECTED)
│   └── flaky()                → FlakyReport (flakyTests NOT_CONNECTED)
│
├── ComplexityService          ← lcis-core graph (graph.json)
│   └── analyze()              → Complexity (fan-in/out/degree per entity, CONNECTED)
│
├── ArchitectureQualityService ← lcis-twin (TwinEngine)
│   ├── analyze()              → ArchitectureQuality (cycles/SPOF/high-fan, CONNECTED)
│   └── maintainability()      → Maintainability (index 0..100, CONNECTED)
│
├── TechDebtService            ← lcis-tracking (TrackingEngine) + lcis-core graph
│   └── hotspots()             → readonly TechDebtItem[] (churn × complexity, CONNECTED)
│
├── DocApiQualityService       ← lcis-core store (db-intel.json, infra-intel.json)
│   ├── docs()                 → DocQuality (doc ratio, CONNECTED when db-intel present)
│   └── api()                  → ApiQuality (typed route coverage, CONNECTED when infra-intel present)
│
├── QualityScoreService        ← pure (no injected deps)
│   └── score(input)           → { score, health, recommendations }
│
└── generateQualityReport()    → QualityReport (stamped by quality() envelope)
```

No service calls Date.now() or `new Date()` directly. The single sanctioned clock
boundary is `shared/envelope.ts:defaultNow`. All services accept an injectable
`now: () => string` parameter for deterministic provenance and test isolation.

---

## 4. Frozen Type Vocabulary (`shared/types.ts`)

These types are the FROZEN contract. Do not modify them without an ARB-gate review.

### 4.1 Connection and signal types

```typescript
type Connection = 'CONNECTED' | 'NOT_CONNECTED'
type Severity   = 'critical' | 'high' | 'medium' | 'low' | 'info'
type QualityBand = 'excellent' | 'good' | 'fair' | 'poor'
type HealthBand  = 'healthy' | 'degraded' | 'failing' | 'unknown'
```

### 4.2 Test / coverage analytics

```typescript
interface TestAnalytics {
  coverageGaps: readonly QualityFinding[]   // CONNECTED — structural
  plannedTests: number                       // CONNECTED — from EINS TestPlan
  passRate: { connection: Connection; value: number | null; liveSource: string }
  summary: string
}

interface CoverageAnalytics {
  connection: Connection
  linePct: number | null      // NOT_CONNECTED until lcov report provided
  branchPct: number | null    // NOT_CONNECTED until lcov report provided
  liveSource: string          // 'coverage report (c8/istanbul lcov)'
  gaps: readonly QualityFinding[]  // CONNECTED structural gaps
}

interface MutationAnalytics {
  connection: Connection
  mutationScore: number | null   // NOT_CONNECTED until stryker run
  liveSource: string             // 'mutation testing run (stryker)'
}

interface FlakyReport {
  connection: Connection
  flakyTests: readonly string[]  // NOT_CONNECTED until CI retry history provided
  liveSource: string             // 'CI retry history (test-run store)'
}
```

### 4.3 Complexity types

```typescript
interface ComplexityEntry {
  entity: string
  fanIn: number
  fanOut: number
  degree: number    // fanIn + fanOut (structural — CONNECTED)
  band: QualityBand
}

interface Complexity {
  entries: readonly ComplexityEntry[]  // top 50 by degree desc
  meanDegree: number   // over ALL graph nodes
  maxDegree: number    // over ALL graph nodes
  connection: Connection
}
```

### 4.4 Architecture quality and maintainability

```typescript
interface ArchitectureQuality {
  cycleCount: number
  spofCount: number
  highFanCount: number          // entities with fan-in+fan-out >= 10
  findings: readonly QualityFinding[]
  band: QualityBand
  connection: Connection        // always CONNECTED (structural)
}

interface Maintainability {
  index: number                 // 0..100 (see formula below)
  band: QualityBand
  drivers: readonly string[]    // human-readable deduction reasons
}
```

### 4.5 Tech debt

```typescript
interface TechDebtItem {
  subject: string
  churn: number       // count of ChangeRecords from lcis-tracking timeline
  complexity: number  // graph degree from lcis-core graph (fallback: 1)
  score: number       // churn × complexity — the debt-hotspot score
  severity: Severity
  evidence: readonly Evidence[]
}
```

### 4.6 Score, health, and recommendations

```typescript
interface QualityScore {
  score: number                        // 0..100 composite (CONNECTED signals only)
  band: QualityBand
  components: Readonly<Record<string, number>>  // rule-id → penalty points
  connectedSignals: number
  notConnectedSignals: number
}

interface QualityHealth {
  band: HealthBand
  score: number | null          // null when connectedSignals === 0 → 'unknown'
  connectedSignals: number
  notConnectedSignals: number
}

interface QualityRecommendation {
  id: string
  rule: string
  advisory: true               // always true — enforced by type and tests
  action: string
  rationale: string
  severity: Severity
  evidence: readonly Evidence[]
}
```

### 4.7 Flagship report

```typescript
interface QualityReport extends QualityArtifact {
  test: TestAnalytics
  coverage: CoverageAnalytics
  mutation: MutationAnalytics
  flaky: FlakyReport
  docs: DocQuality
  api: ApiQuality
  complexity: Complexity
  architecture: ArchitectureQuality
  maintainability: Maintainability
  techDebt: readonly TechDebtItem[]
  score: QualityScore
  health: QualityHealth
  recommendations: readonly QualityRecommendation[]
  summary: string
}
```

`QualityArtifact` adds `evidence`, `confidence`, `sources`, `timestamp`, and
`liveConnected` (always `false` for LQAS — no live telemetry wired).

---

## 5. Service Descriptions

### 5.1 TestAnalyticsService

Composes `lcis-engineering` `VerificationIntelligenceService` to derive structural
coverage gaps and planned-test counts. Live values (pass rate, line/branch coverage,
mutation score, flaky tests) are all NOT_CONNECTED. Degrades gracefully on engine
error: returns a single `QA01-COV-DEGRADED` advisory finding rather than throwing.

Coverage-gap findings use stable IDs of the form `QA01-COV-<subject-slug>`.

### 5.2 ComplexityService

Iterates `core.graph.nodes()` to compute `degree = graph.degree(node.id)` for every
node. Thresholds for `QualityBand`:

| degree | band |
|---|---|
| < 6 | excellent |
| 6–14 | good |
| 15–29 | fair |
| >= 30 | poor |

`meanDegree` and `maxDegree` are computed over ALL nodes. The candidate pool is capped
at the top 200 nodes by degree (deterministic: ties broken by node ID ascending) before
emitting the top 50 `ComplexityEntry` records sorted by degree desc then entity asc.
`connection: 'NOT_CONNECTED'` when `nodeCount === 0`.

### 5.3 ArchitectureQualityService

Composes `lcis-twin` `TwinEngine` via `createTwinEngine()`:

- `twin.cycles()` — dependency cycles (QA02 findings, severity: high)
- `twin.spof()` — articulation-point SPOFs (QA04 findings, severity: high)
- `twin.fan(50)` — top-fan entities; those with fan-in+fan-out >= 10 become QA03
  findings (severity: medium)

`ArchitectureQuality.band` thresholds:

| cycles | SPOFs | band |
|---|---|---|
| 0 | <= 1 | excellent |
| <= 1 | any | good |
| <= 3 | any | fair |
| > 3 | any | poor |

Degrades gracefully on twin error: returns zero counts and `band: 'poor'`.

### 5.4 Maintainability Index Formula

```
raw   = 100 − (6 × cycleCount) − (4 × spofCount) − (2 × highFanCount)
index = clamp(raw, 0, 100)
```

Band from index: >= 80 → excellent; >= 60 → good; >= 40 → fair; < 40 → poor.

### 5.5 TechDebtService

Reads the `lcis-tracking` `TrackingEngine` timeline (`generateTimeline().records`).
Counts churn per subject, then resolves complexity by trying three graph node-ID
candidates in order: `table:<subject>`, `rpc:<subject>`, raw `<subject>`. Uses the
first non-zero degree, or 1 as an honest default when the subject is not in the graph.

```
score = churn × complexity
```

Minimum score threshold: 2. Cap: 30 hotspots. Sorted by score desc then subject asc.
Severity: score >= 20 → high; >= 8 → medium; < 8 → low.

### 5.6 DocApiQualityService

**docs():** Reads `db-intel.json` via `core.store.tryRead('db-intel')`. Parses loosely
with Zod (`z.object({ tables, functions }).passthrough()`). `totalSubjects = tables.length
+ functions.length`. `documentedSubjects` is the union of graph nodes matching the
substrings `'documentation'` and `'.md'` (structural proxy for doc nodes indexed by
Graphify). QA05 finding when `ratio < 0.5`. NOT_CONNECTED when artifact absent.

**api():** Reads `infra-intel.json` via `core.store.tryRead('infra-intel')`. The current
artifact version has no `routes[]` array — `routeCount = 0` and a QA08 finding notes
that typing is not determinable. When a future version adds routes, `typedRoutes` counts
entries with a truthy `handler` or `type` field.

### 5.7 QualityScoreService

Pure (no constructor arguments). Deterministic over a `QualityScoreInput`. Applies the
QA01–QA08 penalty model (see Section 6) and emits `QualityScore`, `QualityHealth`, and
advisory recommendations sorted by severity (critical → high → medium → low → info)
then by ID. Always emits QA07 advisory when `coverageConnected === false`.

---

## 6. Quality Rules and Penalty Model (QA01–QA08)

| Rule | Title | Severity | Weight | Cap | Applied to |
|---|---|---|---|---|---|
| QA01 | Coverage gap | high | 8 | 24 | `coverageGaps.length × 8`, capped at 24 |
| QA02 | Dependency cycle | high | 7 | 21 | `cycleCount × 7`, capped at 21 |
| QA03 | High-complexity hotspot | medium | 5 | 15 | `poorBandEntryCount × 5`, capped at 15 |
| QA04 | Single point of failure | high | 7 | 21 | `spofCount × 7`, capped at 21 |
| QA05 | Documentation gap | low | 3 | — | flat 3 pts when `ratio < 0.5` |
| QA06 | Technical-debt hotspot | medium | 5 | 15 | `highSeverityDebtCount × 5`, capped at 15 |
| QA07 | Coverage telemetry not connected | info | 0 | — | advisory only, no score impact |
| QA08 | API typing gap | medium | 4 | 12 | `apiFindingsCount × 4`, capped at 12 |

```
score = clamp(100 − penQA01 − penQA02 − penQA03 − penQA04 − penQA05 − penQA06 − penQA08, 0, 100)
```

Score bands: >= 85 → excellent; >= 70 → good; >= 50 → fair; < 50 → poor.
Health bands: >= 80 → healthy; >= 50 → degraded; < 50 → failing; no connected signals → unknown.

---

## 7. Provenance Envelope (`shared/envelope.ts`)

Every LQAS output is stamped via `quality<T>(body, opts)`:

```typescript
export function quality<T extends object>(
  body: T,
  opts: {
    evidence: readonly Evidence[]
    sources?: readonly string[]
    confidence?: number
    liveConnected?: boolean
    now?: () => string
  },
): T & QualityArtifact
```

`confidenceFrom(evidence)` computes `min(0.9, 0.5 + 0.1 × connectedCount)` over the
evidence array. `liveConnected` is always `false` for LQAS (no live telemetry).
`defaultNow = () => new Date().toISOString()` is the single sanctioned wall-clock call
in the entire package — all other files receive `now` as a constructor parameter.

---

## 8. Facade: QualityAnalyticsEngine

```typescript
interface QualityAnalyticsEngine {
  readonly core: LcisEngine
  readonly test: TestAnalyticsService
  readonly complexity: ComplexityService
  readonly architecture: ArchitectureQualityService
  readonly techDebt: TechDebtService
  readonly docapi: DocApiQualityService
  readonly score: QualityScoreService
  generateQualityReport(): QualityReport
}

function createQualityAnalyticsEngine(opts?: QualityAnalyticsEngineOptions): QualityAnalyticsEngine
function getQualityAnalyticsEngine(opts?: QualityAnalyticsEngineOptions): QualityAnalyticsEngine  // singleton
function resetQualityAnalyticsEngine(): void  // tests only
```

`generateQualityReport()` calls each service in dependency order, feeds the results into
`QualityScoreService.score()`, builds the summary string, then stamps the output with
`quality(…, { liveConnected: false })`. The summary always includes the NOT_CONNECTED
disclaimer: "Coverage/mutation/flaky values NOT_CONNECTED — structural quality only."

---

## 9. Dependency Chain

```
@letbuyy/lcis-quality
├── @letbuyy/lcis-core        — LcisEngine, graph, store, evidence(), notConnected()
├── @letbuyy/lcis-engineering — createEngineeringEngine(), VerificationIntelligenceService
├── @letbuyy/lcis-governance  — (imported transitively via lcis-engineering)
├── @letbuyy/lcis-tracking    — createTrackingEngine(), ChangeTimeline
├── @letbuyy/lcis-twin        — createTwinEngine(), cycles/spof/fan
└── zod                       — artifact schema validation (DocApiQualityService only)
```

No DB client, no network client, no AI/embedding library, no filesystem-write APIs.

---

## 10. Wiring Coverage, Mutation, and Flaky Values

To connect the NOT_CONNECTED signals:

| Signal | What to wire | Field |
|---|---|---|
| Line/branch coverage % | Provide a parsed lcov report to `TestAnalyticsService.coverage()` | `CoverageAnalytics.linePct`, `.branchPct` |
| Mutation score | Provide a stryker result to `TestAnalyticsService.mutation()` | `MutationAnalytics.mutationScore` |
| Flaky tests | Provide CI retry history to `TestAnalyticsService.flaky()` | `FlakyReport.flakyTests` |
| Pass rate | Provide CI test-run results to `TestAnalyticsService.analyze()` | `TestAnalytics.passRate.value` |

Until wired, all four fields are `null` and `connection: 'NOT_CONNECTED'` with the exact
source string set. QA07 advisory remains in the recommendations list.
