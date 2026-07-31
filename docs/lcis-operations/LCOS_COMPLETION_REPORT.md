# LCOS Completion Report — LCIS Phase 6

**Package:** `@letbuyy/lcis-operations`  
**Completed:** 2026-06-21  
**Test result:** 1,916 pass / 0 fail across 9 LCIS packages; typecheck clean.

---

## What LCOS Is

LCOS (LetBuyy Central Operations System) is the read-only real-time operational intelligence layer over the existing LCIS stack. It answers the question "what is happening right now?" across 8 operational areas by observing, analyzing, correlating, explaining, and reporting.

LCOS composes over the four prior LCIS phases. It adds no new engine, no AI/embedding/vector-DB, no autonomous actions, and no execution capability. Its single responsibility is to surface what the system already knows — structurally from `graphify-out/` and potentially live from external providers — in a consistent, honest, typed operational report.

---

## Architecture

### The 8 Operational Areas

| Area | Service | Key questions answered |
|---|---|---|
| Runtime | `RuntimeOperationsService` | Are workers running? Are queues draining? Are crons firing? |
| Commerce | `CommerceOperationsService` | Is the payment/order/refund pipeline flowing? Are money RPCs safe? |
| Merchant | `MerchantOperationsService` | Are tenants healthy? Which stores are at risk? |
| Customer | `CustomerOperationsService` | Is the funnel converting? What is the abandonment rate? |
| Deployment | `DeploymentOperationsService` | What version is deployed? Is migration current? |
| Incident | `IncidentOperationsService` | Are there open incidents? What is the blast radius? |
| Security | `SecurityOperationsService` | Is the security posture sound? Are there RLS/JWT gaps? |
| Forecast | `ForecastOperationsService` | What are the deterministic trend projections? |

### Shared Layer (`src/shared/`)

| Module | Purpose |
|---|---|
| `OperationsArtifactStore` | Typed, read-only reader over `lcis-core`'s `ArtifactStore`; no IO of its own |
| `LiveSignalRegistry` | The `LCOS_DETECTABILITY_MATRIX.md` encoded at runtime: 32 signals, each declaring detectability + exact env vars required |
| `TelemetryNormalizer` | Null-safe normalization of raw artifact telemetry fields |
| `SignalCorrelator` | Reuses `lcis-core` blast-radius graph to correlate signals to domain impact |
| `OperationalSeverityScorer` | Rules engine: money → critical, SPOF → critical, tenant → high, dead-letter → high |
| `OperationalConfidenceCalculator` | NOT_CONNECTED → 0 (enforced); structural evidence capped at 0.9 |
| `OperationalEvidenceBuilder` | Builds typed evidence items; `.notConnected()` always cites the env var |
| `OperationalFindingBuilder` | Deterministic finding IDs from kind + subject |
| `OperationalHealthCalculator` | Band derivation: critical finding → failing; NOT_CONNECTED → degraded; clean → healthy |
| `operations()` envelope | Standard `OperationsEnvelope` wrapper with evidence/confidence/sources/timestamp/liveConnected |
| `types.ts` | All shared operational types |

### Facade (`src/engine.ts`)

`OperationsEngineImpl` wires the core engine and all 8 services. Singleton via `getOperationsEngine()`; resettable via `resetOperationsEngine()` for tests. `operationsReport()` composes all 8 area reports and derives the `answers` object and summary string.

### Access Layer

| Access | Package | Additions |
|---|---|---|
| CLI | `lcis-cli` | 9 new commands: `runtime`, `commerce`, `merchant`, `customer`, `deployment`, `incident`, `security`, `forecast`, `operations` |
| MCP | `lcis-mcp` | 9 new tools: `lcis_runtime`, `lcis_commerce`, `lcis_merchant`, `lcis_customer`, `lcis_deployment`, `lcis_incident`, `lcis_security_ops`, `lcis_forecast`, `lcis_operations` (registry total: 35) |
| HTTP | `lcis-api` | 9 new routes: `POST /runtime|/commerce|/merchant|/customer|/deployment|/incident|/security-ops|/forecast|/operations` |
| PR-check | `lcis-pr-check` | `analyzeWithOperations` → `OperationalVerdict` (PASS/WARN/FAIL/UNKNOWN) in `## LCOS OPERATIONS` PR comment section (V4) |

---

## Discovery-First Execution

LCOS was built in phases with discovery docs preceding code:

1. **Phase 0 — Discovery (12 docs in `docs/lcis-operations/`):** `LCOS_FORENSICS_REPORT`, `LCOS_TELEMETRY_DISCOVERY`, `LCOS_COMMERCE_DISCOVERY`, `LCOS_MERCHANT_DISCOVERY`, `LCOS_CUSTOMER_DISCOVERY`, `LCOS_DEPLOYMENT_DISCOVERY`, `LCOS_INCIDENT_DISCOVERY`, `LCOS_SECURITY_DISCOVERY`, `LCOS_FORECAST_DISCOVERY`, `LCOS_REUSE_MATRIX`, `LCOS_DETECTABILITY_MATRIX`, `LCOS_ARCHITECTURE`.
2. **Phase 1 — Foundation:** Shared layer (11 foundation tests), `LiveSignalRegistry` encoding the detectability matrix (32 signals).
3. **Phase 2 — 8 parallel service agents:** Each service built and tested independently against real artifacts.
4. **Phase 3 — Facade:** `OperationsEngine` composing all 8 services (8 facade tests).
5. **Phase 4 — Access layer:** CLI, MCP, API, PR-check V4 additions.

---

## Key Decisions and Tradeoffs

### Typed read-only reader over the existing store

`OperationsArtifactStore` wraps `lcis-core`'s existing `ArtifactStore` rather than doing its own IO. This means LCOS has zero IO dependencies of its own — it reads only what the LCIS pipeline has already built. The tradeoff is that LCOS is only as current as the last `pnpm graph:omega` run, but this is the correct tradeoff: LCOS is an intelligence layer, not a live polling agent.

### LiveSignalRegistry as the runtime detectability matrix

The `LCOS_DETECTABILITY_MATRIX.md` (discovery doc) is encoded once in `LiveSignalRegistry` and is the single source of truth at runtime. Every signal declares its detectability status and, if NOT_CONNECTED, the exact env var group required to connect it. This enforces the honesty contract structurally rather than through documentation or convention.

### Confidence 0 + liveConnected false for NOT_CONNECTED

`OperationalConfidenceCalculator.notConnected()` returns exactly 0, unconditionally. This is enforced by type contract and tested in the foundation suite. There is no "estimated" confidence for NOT_CONNECTED signals. The result is that consumers can always trust: if `confidence > 0`, the finding is backed by real data.

### Deterministic-only forecasting with honest empty series

`ForecastOperationsService` uses linear regression over real historical data series. When the series is not available (all signals are NOT_CONNECTED until live adapters are wired), it returns a `NOT_CONNECTED` finding with `confidence: 0` and no projected values. It never fabricates trend lines. The math is correct and reproducible; the inputs are honest about their availability.

### SignalCorrelator reuses lcis-core blast radius

`SignalCorrelator` delegates to `lcis-core`'s blast-radius graph rather than reimplementing domain-impact traversal. This means signal correlations are consistent with blast-radius reports across the entire LCIS stack.

### SecurityOperationsService composes lcis-governance SecurityDrift

`SecurityOperationsService` calls `lcis-governance`'s `SecurityDriftDetector` for the security controls and RLS posture. It does not re-implement security scanning. The operational security report is therefore always consistent with the governance compliance report (R001–R008).

### No new engine, no AI/embeddings/vector-DB

LCOS explicitly does not introduce a new reasoning engine, vector database, embedding pipeline, or autonomous agent. All intelligence is derived from the existing `graphify-out/` artifacts via the typed `OperationsArtifactStore`. This keeps the package fast, deterministic, and testable without external services.

---

## Read-Only Security Posture

LCOS's read-only constraint is enforced at three levels:

1. **Package description:** The `package.json` description explicitly states "LCOS never deploys, executes, mutates, writes, fixes, or auto-remediates."
2. **No write dependencies:** `@letbuyy/lcis-operations` has no `supabase-js`, no `fetch`-to-mutation endpoints, no filesystem write calls.
3. **Test enforcement:** Each service test suite includes a source-scan assertion that the service implementation file contains no mutating verb patterns (`deploy(`, `execute(`, `mutate(`, `write(`, `insert(`, `update(`, `delete(`, `push(`, `merge(`, `remediate(`, `fix(`). This makes read-only a continuously tested property, not a documentation-only claim.

---

## Test Results

| Package | Tests |
|---|---|
| `@letbuyy/lcis-core` | 140 |
| `@letbuyy/lcis-adapters` | 172 |
| `@letbuyy/lcis-live` | 67 |
| `@letbuyy/lcis-execution` | 259 |
| `@letbuyy/lcis-governance` | 298 |
| `@letbuyy/lcis-operations` | **505** |
| `@letbuyy/lcis-cli` | 140 |
| `@letbuyy/lcis-mcp` | 146 |
| `@letbuyy/lcis-pr-check` | 189 |
| **TOTAL** | **1,916** |

Phase 6 added approximately 638 new tests: 505 in `lcis-operations` plus operations-related additions in `lcis-cli` (~22 new), `lcis-mcp` (~18 new), and `lcis-pr-check` (~93 new including 4 test files).

---

## What Was Deliberately NOT Built

| Item | Rationale |
|---|---|
| New reasoning engine | The existing lcis-core engine is sufficient; a new engine would duplicate blast-radius, memory, and verification logic |
| AI / embedding / vector-DB | Deterministic graph traversal from `graphify-out/` is faster, reproducible, and testable without external services |
| Autonomous actions | LCOS observes; LCIS Phase 5 (governance) enforces; human or a separately approved system acts |
| Live polling / long-running agent | LCOS reads artifacts on-demand; it does not maintain a background polling loop |
| Mutation capability | Any write to the database, filesystem, or external provider is outside LCOS scope by design |
| Auto-remediation | Finding a problem and fixing it are separate concerns; LCOS reports, EIS plans, humans decide |
| New graphify-out artifact generation | LCOS reads only; artifact generation is the LCIS pipeline's responsibility |
| Direct Supabase / Cloudflare client | LCOS signals reference the live sources honestly as NOT_CONNECTED; adapters are the lcis-live package's domain |

---

## Workspace and Dependency Changes

- New workspace package: `packages/lcis-operations/` with `package.json`, `tsconfig.json`, `src/`, `test/`
- Dependencies: `@letbuyy/lcis-core`, `@letbuyy/lcis-live`, `@letbuyy/lcis-execution`, `@letbuyy/lcis-governance`, `zod`
- Dev dependencies: `@types/node`, `typescript`
- `lcis-cli`, `lcis-mcp`, `lcis-pr-check`: added `@letbuyy/lcis-operations` as a dependency

---

## Key Real Findings Surfaced by LCOS

These are structural findings from the current codebase that LCOS surfaces as CONNECTED findings (no live telemetry required):

| Finding | Area | Severity | Evidence |
|---|---|---|---|
| Queue-worker SPOF — all 5 queues share one `queue-workers` process | runtime | critical | `runtime-intel.json` |
| 256-tenant single-schema SPOF | merchant | critical/high | `db-intel.json` |
| 6-hour DLQ drain gap | incident | high | `runtime-observability.json` |
| `mobile-bff` has 0 test coverage | customer | high | `deployment-intelligence-v5.json` |
| 4 non-SECURITY-DEFINER money functions | commerce | high | `db-intel.json` |
| Payments blast radius: 11 domains, 103 RPCs, 205 tables | commerce | info | `domain-intel.json` |

---

## Future Roadmap

### Immediate: wire live adapters to flip NOT_CONNECTED → CONNECTED

Set the env vars documented in `LCOS_RUNBOOK.md` ("How to Wire Live Telemetry"). Once wired:
- Supabase adapter → GMV, order rate, refund rate, merchant counts, customer abandonment all become CONNECTED
- Cloudflare Analytics Engine adapter → worker error rate, cron last-run, customer conversion, traffic all become CONNECTED
- Cloudflare Queues adapter → queue backlog depth, dead-letter depth become CONNECTED
- Vercel adapter → deployed version, release health become CONNECTED

### How LCOS + the prior LCIS phases compose

```
Phase 1 — lcis-core          Observe the codebase (blast radius, architecture, memory)
Phase 2 — lcis-live          Live provider adapters (Supabase, Cloudflare, Vercel, GitHub, Razorpay)
Phase 3 — lcis-execution     Understand and plan (EIS: change plans, migration plans, rollback plans, launch GO/NO-GO)
Phase 4 — lcis-governance    Govern and enforce (GDIS: drift detection, compliance R001-R008, ownership, readiness)
Phase 5 — lcis-operations    Observe operations in real-time (LCOS: what is happening right now?)
         ↕
  graphify-out/ artifacts (built by pnpm graph:omega)
         ↕
  External providers (Supabase / Cloudflare / Vercel — wired via env vars, honest NOT_CONNECTED until set)
```

The phases are composable but independent: LCOS can operate without EIS or GDIS (it reads from lcis-core + artifacts directly), but it reuses their outputs (SignalCorrelator → blast radius, SecurityOps → SecurityDrift) when they are available.

### The 8 questions LCOS answers

1. What is running right now? (`lcis runtime`)
2. Is the commerce pipeline flowing? (`lcis commerce`)
3. Which merchants are healthy vs at-risk? (`lcis merchant`)
4. Is the customer funnel converting? (`lcis customer`)
5. What version is deployed and is the migration current? (`lcis deployment`)
6. Are there open incidents and what is the blast radius? (`lcis incident`)
7. Is the security posture sound? (`lcis security`)
8. What are the deterministic trend projections? (`lcis forecast`)

All 8 are composed into: `lcis operations` → "what is happening right now?"
