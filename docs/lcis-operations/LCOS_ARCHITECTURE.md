# LCOS Architecture — `packages/lcis-operations`

**LetBuyy Central Operations System — Phase 6 Blueprint**
Generated: 2026-06-21
Mode: DESIGN DOCUMENT — describes what is to be built. Write NO code until this doc is approved.

---

## 1. Principle

LCOS = `packages/lcis-operations` is the **READ-ONLY operational intelligence layer**.

It answers: *"What is happening right now?"* across 8 areas: runtime, commerce, merchant, customer, deployment, incident, security, and forecast.

LCOS **observes / analyzes / correlates / explains / reports**. It **NEVER deploys / executes / mutates / writes / fixes / remediates**.

It composes `lcis-core`, `lcis-live`, `lcis-execution`, and `lcis-governance` — **no duplication** of graph traversal, readiness scoring, compliance rules, live adapter connections, or rollback plans.

Deterministic: no AI, no embeddings, no vector DB. Every live value is `NOT_CONNECTED` + exact env-var until adapters are credentialed. Confidence cap: 0.9 for structural findings; 0 for any `NOT_CONNECTED` metric.

---

## 2. Layered Diagram

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                          ACCESS SURFACES                                              │
│  CLI: lcis runtime|commerce|merchant|…|operations                                     │
│  MCP: 8 lcis_* tools   API: 8 POST routes   PR-check V4: operational-impact verdict  │
└───────────────────────────────────────────────────────┬───────────────────────────────┘
                                                        │
┌───────────────────────────────────────────────────────▼───────────────────────────────┐
│                           OperationsEngine  (facade)                                  │
│  runtime() · commerce() · merchant() · customer() · deployment()                      │
│  incident() · security() · forecast() · operationsReport()                            │
└───────┬───────────┬──────────┬──────────┬──────────┬──────────┬──────────┬───────────┘
        │           │          │          │          │          │          │
┌───────▼──┐ ┌──────▼──┐ ┌────▼────┐ ┌───▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼──────────┐
│ Runtime  │ │Commerce │ │Merchant │ │Cust-  │ │Deploy  │ │Incident│ │Security      │
│Operations│ │Operati- │ │Operati- │ │omer   │ │Operati-│ │Operati-│ │Operations    │
│Service   │ │onsService│ │onsService│ │Operati│ │ons     │ │ons     │ │Service       │
│          │ │         │ │         │ │ons    │ │Service │ │Service │ │              │
│          │ │         │ │         │ │Service│ │        │ │        │ │              │
└───────┬──┘ └──────┬──┘ └────┬────┘ └───┬───┘ └───┬────┘ └───┬────┘ └───┬──────────┘
        │           │          │          │          │          │          │
┌───────▼───────────▼──────────▼──────────▼──────────▼──────────▼──────────▼───────────┐
│                          FOUNDATION LAYER                                             │
│  OperationsArtifactStore   LiveSignalRegistry   TelemetryNormalizer                  │
│  SignalCorrelator           OperationalFinding / Evidence / Severity                  │
│  OperationalHealth          operations() envelope                                     │
└───────┬───────────────────────────────────────────────────────────────────────────────┘
        │  composes (no duplication)
┌───────▼───────────────────────────────────────────────────────────────────────────────┐
│                          PRIOR PACKAGES (frozen contracts)                            │
│  @letbuyy/lcis-core    ArtifactStore · BlastRadiusService · VerificationService      │
│                        envelope<T> · notConnected() · confidenceFor()                │
│  @letbuyy/lcis-live    LivePlatform · AdapterSnapshot · LiveFact · notConnected      │
│  @letbuyy/lcis-execution  RollbackIntelligenceService · LaunchIntelligenceService    │
│  @letbuyy/lcis-governance SecurityDriftService · ReadinessService · ComplianceService │
└───────────────────────────────────────────────────────────────────────────────────────┘
        │  reads (graphify-out/*.json — gitignored)
┌───────▼───────────────────────────────────────────────────────────────────────────────┐
│                     11 OPERATIONAL ARTIFACTS                                          │
│  runtime-intel.json · runtime-observability.json · operations-center.json            │
│  telemetry-intelligence.json · incident-intelligence-v5.json                         │
│  deployment-intelligence-v5.json · deployment-state.json                             │
│  security-intelligence-v5.json · cost-intelligence.json                              │
│  merchant-intelligence.json + 5 merchant-*.json                                      │
│  customer-intelligence.json · customer-journey-intelligence.json                     │
│  revenue-intelligence-v2.json                                                         │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Foundation Contract (frozen types and primitives)

These are the shared contracts all 8 services build on.

### 3.1 OperationsArtifactStore

A typed read-only reader over the 11 ops artifacts. Delegates to `lcis-core` `ArtifactStore.tryRead(name)`. Provides named accessors (`runtimeIntel()`, `operationsCenter()`, `telemetryIntel()`, `deploymentIntel()`, `incidentIntel()`, `securityIntel()`, `costIntel()`, `merchantIntel()`, `customerIntel()`, `revenueIntel()`) that return typed shapes or surface `ArtifactMissingError` gracefully — so services never parse raw JSON.

```typescript
interface OperationsArtifactStore {
  runtimeIntel(): RuntimeIntel | null;
  operationsCenter(): OperationsCenter | null;
  telemetryIntel(): TelemetryIntel | null;
  deploymentIntel(): DeploymentIntel | null;
  deploymentState(): DeploymentState | null;
  incidentIntel(): IncidentIntel | null;
  securityIntel(): SecurityIntel | null;
  costIntel(): CostIntel | null;
  merchantIntel(): MerchantIntel | null;
  customerIntel(): CustomerIntel | null;
  revenueIntel(): RevenueIntel | null;
}
```

### 3.2 LiveSignalRegistry

The authoritative mapping from every operational metric to its exact binding / env-var / Cloudflare dataset / Supabase RPC / Vercel API endpoint and its current `CONNECTED | NOT_CONNECTED | PARTIAL` state. This is the detectability matrix encoded as a runtime registry — not a document.

Each entry is an `OperationalSignal`:

```typescript
interface OperationalSignal {
  metric: string;            // e.g. "worker.errorRate"
  area: OperationsArea;      // runtime | commerce | merchant | customer | deployment | incident | security | forecast
  classification: 'DETECTABLE' | 'PARTIAL' | 'UNKNOWN' | 'NOT_DETECTABLE';
  dataSource: string;        // structural artifact field path
  liveSource: string;        // plain-language description of the live source
  requiresEnvVar: string[];  // e.g. ["CF_API_TOKEN", "RUNTIME_TELEMETRY"]
  status: 'CONNECTED' | 'NOT_CONNECTED';
}

type LiveSignal = OperationalSignal & { value?: unknown }; // value only present if adapter CONNECTED
```

Backed by 61 entries from the Detectability Matrix: 16 DETECTABLE / 37 PARTIAL / 5 UNKNOWN / 3 NOT_DETECTABLE.

### 3.3 TelemetryNormalizer

Normalizes heterogeneous artifact payloads and `AdapterSnapshot` results (from `lcis-live`) into a uniform `OperationalFact[]` stream. Each fact is domain-scoped so `SignalCorrelator` can correlate across areas.

```typescript
interface OperationalFact {
  area: OperationsArea;
  metric: string;
  domain?: string;           // e.g. "payments", "orders" — 22 business domains
  value: 'NOT_CONNECTED' | number | string | boolean;
  requiresEnvVar?: string[];
  timestamp: string;         // ISO-8601
  source: string;            // artifact field path or adapter name
}
```

### 3.4 SignalCorrelator

Reuses `lcis-core` `BlastRadiusService` to correlate `OperationalFact[]` items to their blast radius. Does not re-implement graph traversal. Input: a signal (e.g., `ANALYTICS_QUEUE backed up`) → domain key → `BlastRadiusService.crossDomain(key)` → set of affected domains, routes, RPCs, tables.

### 3.5 Builders

```typescript
interface OperationalFinding {
  id: string;
  area: OperationsArea;
  title: string;
  description: string;
  severity: OperationalSeverity;    // CRITICAL | HIGH | MEDIUM | LOW | INFO
  confidence: OperationalConfidence; // 0–0.9 structural; 0 for NOT_CONNECTED
  evidence: OperationalEvidence[];
  blastRadius?: BlastRadiusResult;  // from lcis-core BlastRadiusService
  signals: OperationalSignal[];
}

type OperationalEvidence = Evidence & {
  connectionStatus: 'CONNECTED' | 'NOT_CONNECTED' | 'PARTIAL';
  requiresEnvVar?: string[];
};

// OperationalEvidence wraps lcis-core Evidence + notConnected() builder

type OperationalSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
type OperationalConfidence = number; // 0.0–0.9; hard cap enforced
```

### 3.6 OperationalHealth

```typescript
interface OperationalHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'FAILING' | 'UNKNOWN';
  score: number;          // 0–100; structural only; drops to UNKNOWN if all live signals NOT_CONNECTED
  liveConnected: boolean; // true only when at least one adapter is CONNECTED
  connectedAdapters: string[];
  notConnectedAdapters: string[];
}
```

### 3.7 operations() Envelope

Every LCOS response is an `LcisEnvelope<T>` (from `lcis-core` `envelope<T>(opts)`) extended with operational metadata:

```typescript
interface OperationsEnvelope<T> extends LcisEnvelope<T> {
  liveConnected: boolean;
  notConnectedSignals: string[];    // list of metric names NOT_CONNECTED with exact env-var
  structuralOnly: boolean;          // true when all live values NOT_CONNECTED
  timestamp: string;
}
```

`operations()` is the builder function that stamps evidence, confidence (capped at 0.9), sources, and the `liveConnected` flag.

### 3.8 Frozen Types

```typescript
// Area enum
type OperationsArea = 'runtime' | 'commerce' | 'merchant' | 'customer' | 'deployment' | 'incident' | 'security' | 'forecast';

// Per-area report shapes (one per service)
interface RuntimeOperationsReport { /* workers, queues, DLQs, crons, SPOF findings */ }
interface CommerceOperationsReport { /* GMV model, ledger health, refund spike, payment failures */ }
interface MerchantOperationsReport { /* activation/growth/churn, health score, risk score, founding-program */ }
interface CustomerOperationsReport { /* journey stages, funnel topology, abandonment topology */ }
interface DeploymentOperationsReport { /* deploy targets, pipeline order, SPOFs, rollback availability */ }
interface IncidentOperationsReport { /* runbook index, blast topology, recovery protocols, outage patterns */ }
interface SecurityOperationsReport { /* trust boundaries, 11 controls, 20 cross-tenant candidates, 4 non-SD functions */ }
interface ForecastOperationsReport { /* forecast methods, cost model, capacity model, 0-series warnings */ }

// Top-level composition
interface OperationsReport {
  health: OperationalHealth;
  runtime: RuntimeOperationsReport;
  commerce: CommerceOperationsReport;
  merchant: MerchantOperationsReport;
  customer: CustomerOperationsReport;
  deployment: DeploymentOperationsReport;
  incident: IncidentOperationsReport;
  security: SecurityOperationsReport;
  forecast: ForecastOperationsReport;
  openQuestions: string[];   // the 8 canonical questions answered
  launchVerdict: string;     // from operations-center.json (NO-GO / GO)
}
```

---

## 4. Eight Services

### Per-Service Design Table

| Area | Service Class | Artifacts Read | Prior Package Reuse | DETECTABLE Signals | NOT_CONNECTED Signals |
|------|--------------|----------------|--------------------|--------------------|----------------------|
| **Runtime** | `RuntimeOperationsService` | `runtime-intel.json`, `runtime-observability.json`, `operations-center.json`, `telemetry-intelligence.json` | `lcis-core` BlastRadiusService (queue→domain blast); `lcis-live` LivePlatform + Cloudflare adapter | 4-worker topology, 5-queue graph, 2-DLQ topology, 2-cron schedules, `RUNTIME_TELEMETRY` binding declared, single-consumer SPOF (`letbuyy-queue-workers`) | Worker error-rate (`CF_API_TOKEN`), queue backlog depth (`CF_API_TOKEN`), DLQ count (`CF_API_TOKEN`), cron last-run (`CF_API_TOKEN`), latency percentiles (`CF_API_TOKEN`) |
| **Commerce** | `CommerceOperationsService` | `revenue-intelligence-v2.json`, `commerce-control-intel.json` | `lcis-core` BlastRadiusService (`blast("create_checkout_order")`); `lcis-governance` ComplianceService (R001 canonical-ledger); `lcis-live` Supabase adapter | Canonical ledger model (6 write-path RPCs), 34 money RPC inventory, 4 non-SECURITY-DEFINER functions, revenue funnel topology (GMV→captured→net→payout), 8 money domains with table maps | GMV amount (`SUPABASE_SERVICE_ROLE_KEY`), orders count, refund rate, payment failure rate, gift-card liability, per-site reconciliation drift |
| **Merchant** | `MerchantOperationsService` | `merchant-intelligence.json`, `merchant-health.json`, `merchant-risk.json`, `merchant-growth.json`, `merchant-adoption.json`, `merchant-churn.json` | `lcis-core` BlastRadiusService (`blast("verifySiteOwnership")`); `lcis-governance` SecurityDriftService (RLS on 256 tenant tables) | 8-state lifecycle model, 5-dimension health model (with weights), risk chain topology, 6 founding-program RPCs, single-tenant SPOF (M-1), 256 tenant-table map | Health scores per site, risk scores per site, GMV per merchant, active/inactive/churned counts, founding-program remaining slots |
| **Customer** | `CustomerOperationsService` | `customer-intelligence.json`, `customer-journey-intelligence.json` | `lcis-core` BlastRadiusService (`blast("checkout_sessions")`); `lcis-execution` VerificationPlanner (Payment/Refund stage changes) | 8-stage journey taxonomy (Landing→Refund), stage failure points, route-group→stage mapping, 8-graph model inventory, Payment stage (16 tables, 25 RPCs) + Refund stage (7 tables, 2 RPCs) structural topology | Conversion rate, cart abandonment, funnel dropoff rates, session-to-order rate, retention cohort, loyalty metrics (all require `SUPABASE_SERVICE_ROLE_KEY` or `CF_API_TOKEN`) |
| **Deployment** | `DeploymentOperationsService` | `deployment-intelligence-v5.json`, `deployment-state.json` | `lcis-execution` RollbackIntelligenceService (rollback plan construction); `lcis-governance` GovernanceEngine.generateReadinessHealth() (107-validator gate) | 4 Workers declared, 5 Vercel apps, 19 secrets required, 3 SPOFs (single-pipeline/shared-DB/migrate-before-deploy), migrate gate ON, rollback scripts present, pipeline order (branch-lag→validate-governance→migrate→workers→apps) | Live deployed worker version (`CF_API_TOKEN`), Vercel build id (`VERCEL_TOKEN`), applied migration in production (`SUPABASE_SERVICE_ROLE_KEY`), GitHub Actions run status (`GITHUB_TOKEN`), branch lag |
| **Incident** | `IncidentOperationsService` | `incident-intelligence-v5.json`, `runbooks.json`, `production-readiness-v2.json` | `lcis-core` BlastRadiusService (blast propagation per domain); `lcis-execution` RollbackIntelligenceService (rollback plan); `lcis-governance` ReadinessService (production readiness) | 22-domain runbook index, 2 recovery protocols (money vs non-money), blast topology for payments (11 domains, 49 routes, 103 RPCs, 205 tables), queue-consumer SPOF, open blockers (LB-7: shipping+GST −8pts) | Active incident records (no incident store wired), worker error rate for detection, DLQ depth for queue-driven detection, `ledger_balance_breaks()` for money-domain detection |
| **Security** | `SecurityOperationsService` | `security-intelligence-v5.json`, `db-intel.json` | `lcis-governance` SecurityDriftService.generateSecurityDriftReport() (8 structural checks); `lcis-core` VerificationService.verifyRls() / verifyPayments(); `lcis-live` Supabase adapter (when CONNECTED) | 5 trust boundaries, 11 controls (all present:true), 651 RLS policies, 20 cross-tenant candidate tables, 4 non-SECURITY-DEFINER money functions, two-issuer model (HS256+ES256), webhook HMAC topology, queue envelope HMAC topology | Auth anomalies (`SUPABASE_SERVICE_ROLE_KEY`), Turnstile pass/fail rate (`CF_API_TOKEN`), rate-limit breach counts (`UPSTASH_REDIS_REST_URL`), live policy USING-clause SQL (`SUPABASE_ACCESS_TOKEN`), secret presence/rotation (`CF_API_TOKEN` Secrets API) |
| **Forecast** | `ForecastOperationsService` | `cost-intelligence.json`, `merchant-growth.json`, `revenue-intelligence-v2.json`, `telemetry-intelligence.json`, `runtime-intel.json` | `lcis-core` ArtifactStore (cost model); `lcis-live` adapters (when CONNECTED, supply time-series points) | Cost rate model (10 services, published rates, 4 hotspot rankings, formula), scaling dependency graph, saturation topology (5 queues, 4 workers, 2 DLQs, cron 6h window), infra capacity ceiling structural | ALL forecast values NOT_CONNECTED (0 historical data points in any artifact); methods ready (OLS/SMA-3/SMA-7/confidence-interval) — each forecast returns method + source + NOT_CONNECTED until ≥3 monthly data points |

### Service Detail: Critical Design Notes

**RuntimeOperationsService — Key SPOF: DLQ 6h Gap**
The `17 */6 * * *` cron on `letbuyy-queue-workers` is the sole DLQ processor. A DLQ backlog can accumulate for up to 6 hours. LCOS surfaces this as structural finding `F-2` (highest ops risk) alongside the NOT_CONNECTED DLQ depth signal. The service must expose this regardless of whether the live adapter is connected.

**CommerceOperationsService — Canonical Ledger Model**
The service reads the ledger model from `revenue-intelligence-v2.json` — never touches money tables directly. It surfaces the 6 canonical write-path RPCs, the 4 non-SECURITY-DEFINER money functions (structural risk), and the reconciliation RPC chain. All amounts are `NOT_CONNECTED`. Honesty: subscriptions domain is NOT IMPLEMENTED (no commerce domain in artifact, table exists as churn signal only).

**MerchantOperationsService — Single-Tenant SPOF**
All merchants share one schema / one deploy pipeline / one DB. Finding M-1 is structural and always surfaced (no live adapter required). Health and risk scores are 5-dimension/composite models with named source tables — the models are fully specified but the per-site values are NOT_CONNECTED.

**CustomerOperationsService — Two Missing Artifacts**
`customer-funnel.json` and `customer-retention.json` do not exist in `graphify-out/`. Their data is subsumed by `customer-intelligence.json` → `graphs.funnel` and `graphs.retention`. The service reads the two present artifacts and does not surface the absence as an error.

**DeploymentOperationsService — Artifact Staleness**
`deployment-intelligence-v5.json` was generated 2026-06-14; current git HEAD is `742192cf`. The service must surface this delta with `ArtifactAgeWarning` so callers know the structural state may lag. Live HEAD and live deployed version are NOT_CONNECTED.

**IncidentOperationsService — No Incident Store**
There is no live incident table or integration in the repo. `incident-intelligence-v5.json` is a structural model with one payments example. The service surfaces: 22-domain runbook index (DETECTABLE), blast radius per domain (DETECTABLE via BlastRadiusService), recovery protocol per domain (DETECTABLE), and all live detection signals (NOT_CONNECTED). Active incident count is NOT_DETECTABLE until an incident-store adapter is added.

**SecurityOperationsService — Delegates to SecurityDriftService**
Does NOT re-implement the 8 structural drift checks. Calls `SecurityDriftService.generateSecurityDriftReport()` from `lcis-governance` and wraps the result in `OperationsEnvelope`. Adds the operational frame: which live signals would confirm/deny the structural posture, and which env-vars are needed to wire them.

**ForecastOperationsService — Deterministic, Zero Series**
Uses only deterministic arithmetic (OLS, SMA, confidence interval). Zero historical data points exist in any `graphify-out/` artifact for merchant counts, customer counts, funnel rates, or GMV series. Every forecast must return: (1) the method that will apply, (2) the exact source table/query/env-var, (3) the minimum data points required, and (4) `NOT_CONNECTED` for the value. No simulation or estimation is performed. The cost rate model (10 services, published rates, formula) is DETECTABLE and returned as structural output.

---

## 5. OperationsEngine Facade

```typescript
interface OperationsEngine {
  // Individual area reports
  runtime(): Promise<OperationsEnvelope<RuntimeOperationsReport>>;
  commerce(): Promise<OperationsEnvelope<CommerceOperationsReport>>;
  merchant(): Promise<OperationsEnvelope<MerchantOperationsReport>>;
  customer(): Promise<OperationsEnvelope<CustomerOperationsReport>>;
  deployment(): Promise<OperationsEnvelope<DeploymentOperationsReport>>;
  incident(): Promise<OperationsEnvelope<IncidentOperationsReport>>;
  security(): Promise<OperationsEnvelope<SecurityOperationsReport>>;
  forecast(): Promise<OperationsEnvelope<ForecastOperationsReport>>;

  // Full composition — all 8 areas + operational health score
  operationsReport(): Promise<OperationsEnvelope<OperationsReport>>;
}
```

`operationsReport()` composition:

1. Calls all 8 services in parallel (`Promise.all`).
2. Derives `OperationalHealth` from:
   - `status`: HEALTHY if `operations-center.json` launchVerdict blockers = 0 and no CRITICAL finding; DEGRADED if blockers > 0 or live signals NOT_CONNECTED; FAILING if structural CRITICAL findings; UNKNOWN if no artifacts loaded.
   - `score`: weighted average of structural readiness scores from `production-readiness-v2.json` (via ReadinessService). Cap at 90 (0.9) while any live signal NOT_CONNECTED.
   - `liveConnected`: true only when at least one `lcis-live` adapter returns CONNECTED.
3. Populates `openQuestions` — the 8 canonical questions answered in plain language (see Section 7).
4. Populates `launchVerdict` from `operations-center.json → summary.launchVerdict`.

---

## 6. Access Surfaces

### CLI (extends existing `lcis` CLI binary)

```
lcis runtime          → RuntimeOperationsReport (JSON or --pretty)
lcis commerce         → CommerceOperationsReport
lcis merchant         → MerchantOperationsReport
lcis customer         → CustomerOperationsReport
lcis deployment       → DeploymentOperationsReport
lcis incident         → IncidentOperationsReport
lcis security         → SecurityOperationsReport
lcis forecast         → ForecastOperationsReport
lcis operations       → full OperationsReport
```

Each command prints `NOT_CONNECTED` with the exact env-var for every live signal not wired. Exit code 0 always (read-only; no failure state for missing live data).

### MCP Tools (8 new tools)

| Tool name | Returns |
|-----------|---------|
| `lcis_runtime` | `RuntimeOperationsReport` |
| `lcis_commerce` | `CommerceOperationsReport` |
| `lcis_merchant` | `MerchantOperationsReport` |
| `lcis_customer` | `CustomerOperationsReport` |
| `lcis_deployment` | `DeploymentOperationsReport` |
| `lcis_incident` | `IncidentOperationsReport` |
| `lcis_security` | `SecurityOperationsReport` |
| `lcis_operations` | `OperationsReport` (full composition) |

Each tool is registered in the MCP server alongside existing `lcis_blast`, `lcis_deps`, etc.

### API Routes (8 new POST routes on the LCIS API server)

```
POST /api/operations/runtime      → RuntimeOperationsReport
POST /api/operations/commerce     → CommerceOperationsReport
POST /api/operations/merchant     → MerchantOperationsReport
POST /api/operations/customer     → CustomerOperationsReport
POST /api/operations/deployment   → DeploymentOperationsReport
POST /api/operations/incident     → IncidentOperationsReport
POST /api/operations/security     → SecurityOperationsReport
POST /api/operations/forecast     → ForecastOperationsReport
POST /api/operations              → OperationsReport
```

All routes return `OperationsEnvelope<T>` with `liveConnected`, `notConnectedSignals`, and `timestamp` at the top level.

### PR-Check V4 — Operational Impact Verdict

Adds an `operational-impact` step to the existing `lcis-pr-analysis.yml` workflow:

1. Read changed files from the PR diff.
2. For each changed file:
   a. Call `BlastRadiusService.blast(symbol)` for affected symbols.
   b. Map blast domains to operation areas.
   c. Call the relevant service (e.g., a change to `create_checkout_order` → CommerceOperationsService + IncidentOperationsService).
3. Output a PR comment section: `OPERATIONAL IMPACT` — which areas are affected, blast radius size, structural readiness score delta, and which live signals would detect regression.

---

## 7. Honesty and Read-Only Model

### Read-Only Enforcement

Every public method on every service is `async` and returns `OperationsEnvelope<T>`. No method accepts write parameters. The package exports no function that calls `db.rpc`, `.from(table).insert/update/delete`, `wrangler deploy`, Vercel deploy API, or GitHub Actions dispatch.

The `security` area tests (`*.readonly.test.ts`) scan the compiled source of `packages/lcis-operations/` for any of the following patterns and fail the build if found:

```
\.insert(   \.update(   \.delete(   \.upsert(
db\.rpc.*insert   wrangler deploy   vercel deploy
fetch.*POST.*api/deploy
```

This is the P0 read-only guard.

### NOT_CONNECTED Honesty Contract

1. Every `OperationalFact` with a live source has `value: 'NOT_CONNECTED'` when the adapter is not credentialed.
2. Every `OperationalSignal` carries `requiresEnvVar[]` — the exact variable names needed.
3. `confidence` is hard-capped at 0.9 for structural findings; forced to 0 for any finding that depends on a NOT_CONNECTED fact.
4. `operationsReport()` includes `notConnectedSignals: string[]` listing every metric that could not be resolved, with its env-var.
5. No fabricated numbers. No simulated metrics. No estimated values.

### Detectable vs NOT_CONNECTED — full signal inventory

61 signals across 8 areas:
- 16 DETECTABLE (structural, always available from `graphify-out/`)
- 37 PARTIAL (topology known; value needs adapter credential)
- 5 UNKNOWN (topology partial; source identified but no adapter mapping yet)
- 3 NOT_DETECTABLE (no declared source; future adapter needed)

The `LiveSignalRegistry` is the runtime encoding of this matrix.

---

## 8. Test Strategy

**500+ new tests across the package.** Real artifacts from `graphify-out/` are used — no mocks of artifact content.

| Category | What is tested | Count target |
|----------|---------------|-------------|
| Foundation unit tests | `OperationsArtifactStore`, `LiveSignalRegistry`, `TelemetryNormalizer`, `SignalCorrelator`, builders, `operations()` envelope | ~100 |
| Per-service unit tests | Each of 8 services: finds correct structural data, returns NOT_CONNECTED for live values, does not duplicate prior package logic | ~240 (30 per service) |
| Read-only security tests | `*.readonly.test.ts` — source-scan for write patterns; confirms P0 guard passes | ~16 (2 per service) |
| OperationsEngine integration tests | `operationsReport()` composes all 8 correctly; health scoring; launch verdict; `openQuestions` populated | ~50 |
| CLI command tests | Each of 9 CLI commands produces valid JSON; exit code 0; NOT_CONNECTED signals present | ~45 |
| MCP tool schema tests | 8 tools registered; input/output types correct | ~24 |
| API route tests | 9 routes return valid `OperationsEnvelope<T>`; status 200; no write side effects | ~45 |

---

## 9. Success Criteria — The 8 Canonical Questions

`operationsReport()` must produce answers to all 8 without a repo scan, in `openQuestions[]`:

| # | Question | Answered by |
|---|----------|-------------|
| Q1 | What is happening right now? | `OperationalHealth.status` + `runtime.summary` + `operations-center.json` areas |
| Q2 | What is failing? | `incident.openFindings` (structural) + `runtime.workerFindings` (NOT_CONNECTED if no adapter) |
| Q3 | What will fail next? | `forecast.capacityProjections` (topology-derived ceiling) + `runtime.dqlRiskWindow` (6h gap) |
| Q4 | Who is affected? | `incident.blastRadius` (BlastRadiusService) + `merchant.spofFinding` (all tenants, shared schema) |
| Q5 | How much revenue is at risk? | `commerce.revenueModel` (ledger topology) + amounts NOT_CONNECTED with exact Supabase source |
| Q6 | How do I recover? | `incident.recoveryProtocols` (22 runbooks, 2 protocols) + `deployment.rollbackAvailability` (script present, structural) |
| Q7 | What should I fix next? | `deployment.openBlockers` (production-readiness-v2.json: LB-7) + `security.crossTenantCandidates` (20 tables) |
| Q8 | Is it production-ready? | `deployment.launchVerdict` (NO-GO / 5 open blockers) + `deployment.governanceGate` (107 validators) |

---

## 10. Implementation Notes for Builders

### What LCOS Must NOT Do

- Re-implement graph traversal → always call `BlastRadiusService`
- Re-compute readiness score → always call `ReadinessService` / `GovernanceEngine.generateReadinessHealth()`
- Re-run compliance rules → always call `ComplianceService` / `DriftDetectionService`
- Produce change/rollback plans inline → always delegate to `RollbackIntelligenceService`
- Open HTTP connections to providers → only via `LivePlatform` + existing `lcis-adapters`
- Set `confidence > 0.9` or emit a metric value when adapter NOT_CONNECTED
- Cache or store live metric values

### Package Boundaries

```
packages/
  lcis-operations/         ← NEW (this package)
    src/
      foundation/          ← OperationsArtifactStore, LiveSignalRegistry, TelemetryNormalizer,
      │                       SignalCorrelator, builders, operations() envelope
      services/
        runtime/           ← RuntimeOperationsService
        commerce/          ← CommerceOperationsService
        merchant/          ← MerchantOperationsService
        customer/          ← CustomerOperationsService
        deployment/        ← DeploymentOperationsService
        incident/          ← IncidentOperationsService
        security/          ← SecurityOperationsService
        forecast/          ← ForecastOperationsService
      engine/              ← OperationsEngine facade (createOperationsEngine / getOperationsEngine)
      access/
        cli/               ← 9 CLI commands
        mcp/               ← 8 MCP tools
        api/               ← 9 API routes
        pr-check/          ← operational-impact verdict
    test/
      foundation/
      services/
        *.readonly.test.ts ← P0 read-only guard per service
      engine/
      access/
    package.json           ← name: "@letbuyy/lcis-operations"
                              dependencies: @letbuyy/lcis-core, @letbuyy/lcis-live,
                                           @letbuyy/lcis-execution, @letbuyy/lcis-governance
```

### Singleton pattern (mirrors prior packages)

```typescript
export function createOperationsEngine(opts?: OperationsEngineOptions): OperationsEngine
export function getOperationsEngine(): OperationsEngine  // throws if not initialized
export function resetOperationsEngine(): void             // test teardown only
```

### Adapter Connection Map (what to wire to unlock PARTIAL signals)

| Adapter | Env-vars | Signals unlocked |
|---------|----------|-----------------|
| Cloudflare (Analytics Engine + Queues) | `CF_API_TOKEN`, `RUNTIME_TELEMETRY` | Worker error-rate, queue backlog, DLQ count, cron last-run, cold-start, traffic/sessions, search queue depth |
| Supabase service-role | `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` | GMV, orders, refunds, payment failures, gift-card liability, merchant health/risk/growth/churn, customer refunds |
| Supabase Management API | `SUPABASE_ACCESS_TOKEN` | Live RLS policy USING-clause SQL, migration state in production, auth audit log entries |
| GitHub Actions | `GITHUB_TOKEN` | Deploy status, failed deploys, release health, deployment frequency |
| Vercel | `VERCEL_TOKEN` | Deploy health, secrets presence in Vercel env |
| Razorpay | `RAZORPAY_KEY_SECRET` | Payment failure webhook events, payout queue depth |
| Incident store (future) | TBD | Active incidents, time-to-recovery |
| Secret-audit adapter (future) | TBD | Credential rotation events |

---

*This document is the authoritative design blueprint for Phase 6 implementation. No code is written in this doc. The implementation agent reads this document and the 11 discovery docs as its full context.*
