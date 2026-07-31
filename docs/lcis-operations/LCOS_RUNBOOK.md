# LCOS Runbook — Operating the LetBuyy Central Operations System

**Package:** `@letbuyy/lcis-operations`  
**Phase:** LCIS Phase 6  
**Read-only:** LCOS observes, analyzes, correlates, explains, and reports. It never deploys, executes, mutates, writes, fixes, or auto-remediates.

---

## Prerequisites

LCOS reads from `graphify-out/` artifacts built by the LCIS pipeline. Before running any LCOS command, ensure the artifacts are current:

```sh
pnpm graph:omega          # full refresh: db + infra + domain + code + reports
# or incrementally:
pnpm graph:db             # DB intelligence (tables, RPCs, policies, triggers)
pnpm graph:update         # code graph
pnpm graph:v3             # db + infra + domain + reports
```

LCOS reads these artifact files at runtime (via `OperationsArtifactStore` → `lcis-core`'s `ArtifactStore`):

| Artifact file | Used by area |
|---|---|
| `runtime-intel.json` | runtime (workers, queues, crons) |
| `runtime-observability.json` | runtime (dead-letter queues) |
| `operations-center.json` | runtime (ops-center statuses) |
| `telemetry-intelligence.json` | runtime (telemetry adapters) |
| `db-intel.json` | commerce (ledger topology), security (cross-tenant surface) |
| `revenue-intelligence-v2.json` | commerce, forecast |
| `commerce-control-intel.json` | commerce |
| `merchant-intelligence.json` | merchant |
| `merchant-churn.json`, `merchant-adoption.json`, `merchant-growth.json` | merchant, forecast |
| `customer-journey-intelligence.json` | customer |
| `customer-intelligence.json` | customer, forecast |
| `deployment-state.json` | deployment |
| `deployment-intelligence-v5.json` | deployment |
| `runbooks.json` | incident |
| `domain-intel.json` | incident (blast radius), forecast |
| `incident-intelligence-v5.json` | incident |
| `security-intelligence-v5.json` | security |

---

## CLI

All operations commands are accessed via the `lcis` CLI (`packages/lcis-cli`). They share common options:

| Option | Description |
|---|---|
| `--json` | Output as JSON |
| `--yaml` | Output as YAML |
| `--table` | Output as table (default for terminal) |
| `--csv` | Output as CSV |
| `--markdown` | Output as Markdown |
| `--evidence` | Include evidence items in output |
| `--export <path>` | Write output to a file |

### `lcis runtime`

Workers, queues, cron jobs, API health, DB connectivity — what is running right now.

```sh
lcis runtime
lcis runtime --json
lcis runtime --evidence --export /tmp/runtime-report.json
```

Example output (structural only — no live telemetry wired):

```
LCOS Runtime Operations                           [degraded]
──────────────────────────────────────────────────
Workers detected:   5
Queue edges:        5
Cron schedules:     3

FINDINGS (3)
  [critical] Queue worker SPOF — all 5 queues share one worker
    area: runtime | status: CONNECTED | confidence: 0.85
  [NOT_CONNECTED] Worker error rate — needs CF_ANALYTICS_API_TOKEN, CF_ACCOUNT_ID
    area: runtime | status: NOT_CONNECTED | confidence: 0
  [NOT_CONNECTED] Queue backlog depth — needs CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID
    area: runtime | status: NOT_CONNECTED | confidence: 0

liveConnected: false
```

### `lcis commerce`

Orders, checkout, payment transactions, refunds, gift cards, COD, inventory.

```sh
lcis commerce
lcis commerce --json
```

### `lcis merchant`

Active stores, onboarding state, subscription tiers, merchant health.

```sh
lcis merchant
lcis merchant --evidence
```

### `lcis customer`

Sessions, funnel, conversion rate, cart abandonment, retention.

```sh
lcis customer
lcis customer --json --export /tmp/customer-ops.json
```

### `lcis deployment`

Deploy state, versions, migration status, rollback scripts.

```sh
lcis deployment
lcis deployment --markdown
```

### `lcis incident`

Open incidents, root causes, blast radius, runbook coverage.

```sh
lcis incident
lcis incident --evidence
```

### `lcis security`

Security posture, attack surface, RLS coverage, JWT health. (Distinct from `lcis security-drift` which is the Phase-5 governance tool.)

```sh
lcis security
lcis security --json
```

### `lcis forecast`

Deterministic trend projections. Series are `NOT_CONNECTED` when no historical data is available (Supabase or CF Analytics not wired). The math is always real; the inputs are honest about availability.

```sh
lcis forecast
lcis forecast --evidence
```

Example NOT_CONNECTED forecast output:

```json
{
  "area": "forecast",
  "liveConnected": false,
  "findings": [
    {
      "kind": "order-trend",
      "severity": "info",
      "status": "NOT_CONNECTED",
      "title": "Order trend forecast",
      "detail": "No order series available — wire SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY",
      "confidence": 0
    }
  ]
}
```

### `lcis operations`

Composite report — all 8 areas plus the answers object. The canonical "what is happening right now?" command.

```sh
lcis operations
lcis operations --json
lcis operations --evidence --export /tmp/ops-report.json
```

---

## MCP Tools

Nine MCP tools are registered in `packages/lcis-mcp` (registry total: 35 tools). All tools are read-only, accept no input parameters, and return a JSON-formatted text response.

| Tool name | Description |
|---|---|
| `lcis_runtime` | Runtime report: workers, queues, crons, API health |
| `lcis_commerce` | Commerce report: orders, payments, refunds, gift cards |
| `lcis_merchant` | Merchant report: store health, adoption, risk |
| `lcis_customer` | Customer report: sessions, funnel, conversion, retention |
| `lcis_deployment` | Deployment report: deploy state, versions, migration status |
| `lcis_incident` | Incident report: open incidents, root causes, blast radius |
| `lcis_security_ops` | Security ops report: posture, attack surface, RLS, JWT health |
| `lcis_forecast` | Forecast report: deterministic trend projections |
| `lcis_operations` | Composite report: all 8 areas + answers object |

Each tool response includes: `area`, `summary`, `health`, `findingCount`, `findings` (up to 20), `signalCount`, `signals` (up to 12), `liveConnected`, `confidence`, `sources`, `timestamp`, `evidence`.

---

## API Routes

The `lcis-api` package exposes LCOS via HTTP. Routes are `POST` (no body required):

| Route | Report |
|---|---|
| `POST /runtime` | `RuntimeReport` |
| `POST /commerce` | `CommerceReport` |
| `POST /merchant` | `MerchantReport` |
| `POST /customer` | `CustomerReport` |
| `POST /deployment` | `DeploymentReport` |
| `POST /incident` | `IncidentReport` |
| `POST /security-ops` | `SecurityOpsReport` |
| `POST /forecast` | `ForecastReport` |
| `POST /operations` | `OperationsReport` (composite) |

---

## The `operationsReport()` Composite

`ops.operationsReport()` returns an `OperationsReport` that contains all 8 sub-reports plus a synthesized `answers` object and a `summary` string.

### Structure

```typescript
interface OperationsReport {
  runtime: RuntimeReport;
  commerce: CommerceReport;
  merchant: MerchantReport;
  customer: CustomerReport;
  deployment: DeploymentReport;
  incident: IncidentReport;
  security: SecurityOpsReport;
  forecast: ForecastReport;
  answers: {
    healthy: string[];      // areas with health.band === 'healthy'
    degraded: string[];     // areas with health.band === 'degraded'
    failing: string[];      // areas with health.band === 'failing'
    changed: string[];      // deployment findings (capped at 12)
    atRisk: string[];       // critical/high findings across all areas (capped at 12)
    investigate: string[];  // NOT_CONNECTED blind spots + critical findings (capped at 12)
  };
  evidence: Evidence[];
  confidence: number;
  sources: string[];
  timestamp: string;        // ISO 8601
  liveConnected: boolean;   // false when any NOT_CONNECTED signal is present (currently always false)
  summary: string;          // e.g. "Operations: 2 failing, 3 degraded, 5 at-risk finding(s); 8 live signal(s) connected, 19 NOT_CONNECTED. 4 item(s) to investigate."
}
```

### The 6 Answer Categories

| Key | What it contains |
|---|---|
| `healthy` | Area names where `health.band === 'healthy'` (e.g. `"runtime healthy"`) |
| `degraded` | Area names where `health.band === 'degraded'` |
| `failing` | Area names where `health.band === 'failing'` |
| `changed` | Deployment finding titles — what changed recently |
| `atRisk` | Critical and high findings across all 8 areas |
| `investigate` | NOT_CONNECTED blind spots + critical findings — prioritized investigation list |

---

## Reading a Finding

Each `OperationalFinding` has this shape:

```typescript
interface OperationalFinding {
  id: string;           // deterministic: e.g. "QUEUE-BACKLOG-orders-queue"
  area: OperationalArea; // 'runtime' | 'commerce' | 'merchant' | 'customer' |
                         //   'deployment' | 'incident' | 'security' | 'forecast'
  kind: string;          // signal kind, e.g. 'queue-backlog'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  subject: string;       // e.g. 'orders-queue'
  title: string;
  detail: string;
  status: OperationalStatus; // 'CONNECTED' | 'NOT_CONNECTED' | 'PARTIAL' | 'UNKNOWN' | 'NOT_DETECTABLE'
  confidence: number;    // 0 when status === 'NOT_CONNECTED'; ≤ 0.9 for structural findings
  evidence: OperationalEvidence[];
  timestamp: string;
}
```

**Interpreting status:**

| Status | Meaning |
|---|---|
| `CONNECTED` | Finding is backed by real structural data from `graphify-out/` |
| `NOT_CONNECTED` | Live telemetry not available; confidence is always 0; the `detail` field names the env var(s) needed |
| `PARTIAL` | Some signals connected, some not |
| `UNKNOWN` | Signal could not be evaluated |
| `NOT_DETECTABLE` | Signal cannot be observed with any available mechanism |

**Confidence scale:**
- `0` — `NOT_CONNECTED` (always, enforced by `OperationalConfidenceCalculator`)
- `0.1–0.5` — structural inference with limited evidence
- `0.5–0.9` — structural inference with strong evidence (capped at 0.9 — live telemetry would be required for higher)

---

## Reading a Signal

Each area report also contains `signals: LiveSignal[]`, mirroring the `LiveSignalRegistry`:

```typescript
interface LiveSignal {
  key: string;           // e.g. 'runtime.worker-errors'
  area: OperationalArea;
  label: string;         // human label
  status: OperationalStatus;
  source: string;        // artifact file the signal reads from
  liveSource: string | null; // e.g. 'Cloudflare Analytics Engine' (null if CONNECTED structurally)
  requiresEnvVar: string[];  // env vars needed to flip NOT_CONNECTED → CONNECTED
  value: unknown | null; // null when NOT_CONNECTED
  confidence: number;    // 0 when NOT_CONNECTED
}
```

---

## How to Wire Live Telemetry

Signals become `CONNECTED` when the required credentials are present. Set these environment variables in your deployment to flip NOT_CONNECTED signals:

| Provider | Env vars | Signals unlocked |
|---|---|---|
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | GMV, order rate, refund rate, payment failure rate, active merchant count, churn rate, activation rate, cart abandonment, auth failure rate, open incidents, forecast order/merchant series |
| Cloudflare Analytics Engine | `CF_ANALYTICS_API_TOKEN`, `CF_ACCOUNT_ID` | Worker error rate, cron last-run, customer conversion, customer traffic, forecast traffic/queue trends |
| Cloudflare Queues API | `CLOUDFLARE_API_TOKEN`, `CF_ACCOUNT_ID` | Queue backlog depth, dead-letter depth |
| Vercel | `VERCEL_TOKEN` | Deployed version, release health |
| Turnstile | `TURNSTILE_SECRET_KEY` | Abuse/bot signals |

Signals that are already `CONNECTED` (no env var required — backed by structural data):
- `runtime.worker-topology` — `runtime-intel.json`
- `commerce.ledger-topology` — `db-intel.json`
- `merchant.topology` — `merchant-intelligence.json`
- `customer.journey-topology` — `customer-journey-intelligence.json`
- `deployment.git-state` — `deployment-state.json`
- `deployment.rollback-scripts` — `deployment-intelligence-v5.json`
- `incident.runbook-coverage` — `runbooks.json`
- `incident.blast-radius` — `domain-intel.json`
- `security.controls` — `security-intelligence-v5.json`
- `security.cross-tenant-surface` — `db-intel.json`

---

## PR Check V4 — LCOS Operational Impact

`analyzeWithOperations` (in `packages/lcis-pr-check`) runs a full `operationsReport()` and filters findings to the PR's affected operational areas. The result appears as `## LCOS OPERATIONS` in the generated PR comment.

**Verdict levels:**

| Verdict | Condition |
|---|---|
| `FAIL` | Any `critical` finding in an area touched by the PR — SPOF or critical risk; do not ship unreviewed |
| `WARN` | Any `high`/`medium` finding OR `NOT_CONNECTED` blind spots in the affected area — observability gap |
| `PASS` | Affected areas have only `low`/`info` findings and no telemetry blind spots |
| `UNKNOWN` | No changed files, or no operational mapping found for the affected files |

The verdict dimension is always `'operational-impact'`. It does not replace the prior verdicts (blast-radius, governance, EIS) — it is an additional V4 dimension.

---

## Troubleshooting

**"Error: no artifact" / empty findings**

The `graphify-out/` artifacts are missing or stale. Run `pnpm graph:omega` to rebuild.

**All signals NOT_CONNECTED**

This is correct behavior when live credentials are not set. It is not an error. Wire the env vars listed in "How to Wire Live Telemetry" to get live values.

**`liveConnected: false` in all reports**

LCOS sets `liveConnected: true` only when at least one live signal has a non-null value with confidence > 0. Without live adapters credentialed, this is always `false`. This is by design.

**`confidence: 0` everywhere**

Every `NOT_CONNECTED` finding has confidence 0 (enforced by `OperationalConfidenceCalculator`). Structural (CONNECTED) findings have confidence up to 0.9. If you see 0 on a structural finding, it means the artifact had no evidence to draw from.

**`lcis security` vs `lcis security-drift`**

These are distinct commands. `lcis security` (LCOS Phase 6) gives an operational-level security posture snapshot. `lcis security-drift` (LCIS Phase 5 / governance) checks constitutional compliance and rule drift (R001–R008). Both are read-only.

**Singleton reset for testing**

In tests, call `resetOperationsEngine()` from `@letbuyy/lcis-operations` to clear the singleton between test cases.
