# LCOS Runtime Guide — "What is running?"

**Phase:** 6 — LCOS (LetBuyy Central Operations System)
**Service:** `RuntimeOperationsService` (`packages/lcis-operations/src/runtime/RuntimeOperationsService.ts`)
**Honesty contract:** structural topology CONNECTED; every live value NOT_CONNECTED (value=null, confidence=0) + exact env var. No AI. No mocks.

---

## 1. What This Service Does

`RuntimeOperationsService` observes the declared runtime topology — workers, queues, dead-letter queues, and cron triggers — and produces a `RuntimeReport`. It NEVER deploys, executes, or mutates anything.

Data source: `OperationsArtifactStore` reads `graphify-out/runtime-intel.json` and `graphify-out/runtime-observability.json`. All structural facts come from those JSON artifacts (produced by `pnpm graph:db && pnpm graph:infra`).

---

## 2. The 5 Runtime Detectors

### 2.1 `detectWorkerFailures()`

**What it reads:** `store.workers()` → `graphify-out/runtime-intel.json:workers[]`

Checks each worker for:
- Zero routes + zero crons + no queue role → `worker-no-observability` (medium, CONNECTED)
- `letbuyy-mobile-bff` specifically: has declared HTTP routes but 0 domains/RPCs/tables in `runtime-observability.json` → `worker-under-mapped` (medium, CONNECTED, per forensics F-3)
- Live error rate for every worker → `worker-error-rate` (info, NOT_CONNECTED; requires `CF_ANALYTICS_API_TOKEN` + `CF_ACCOUNT_ID`)

### 2.2 `detectQueueBacklog()`

**What it reads:** `store.queueGraph()` → `graphify-out/runtime-intel.json:queueGraph[]`

- SPOF finding: if `letbuyy-queue-workers` is the sole consumer of every queue → `queue-spof` (severity from `OperationalSeverityScorer.forSignal({spof:true})`, CONNECTED)
- Live backlog depth per queue → `queue-backlog-depth` (info, NOT_CONNECTED; requires `CLOUDFLARE_API_TOKEN` + `CF_ACCOUNT_ID`)

### 2.3 `detectDeadLetters()`

**What it reads:** `store.deadLetterQueues()` → `graphify-out/runtime-observability.json:deadLetterQueues[]`

- **6-hour drain gap structural finding:** neither DLQ has a dedicated alert binding; cleared only by the `letbuyy-queue-workers` cron at `"17 */6 * * *"` → `dlq-monitoring-gap` (severity from scorer `{deadLetter:true}`, CONNECTED). Up to 6 hours of silent DLQ accumulation. See forensics F-2.
- Live DLQ depth per queue → `dlq-depth` (info, NOT_CONNECTED; requires `CLOUDFLARE_API_TOKEN` + `CF_ACCOUNT_ID`)

### 2.4 `detectStuckJobs()`

**What it reads:** `store.queueGraph()` — same as 2.2

- Any queue with a declared producer but zero consumers → `queue-no-consumer` (high, CONNECTED); messages accumulate indefinitely.
- Live stuck-job detection (message age + retry count) → `stuck-job-detection` (info, NOT_CONNECTED; requires `CLOUDFLARE_API_TOKEN` + `CF_ACCOUNT_ID`)

### 2.5 `detectCronFailures()`

**What it reads:** `store.crons()` → `graphify-out/runtime-intel.json:workers[*].crons`

For each cron trigger:
- Declaration is CONNECTED (`cron-declared`, info) — confirmed from wrangler.toml parse.
- Last-run success is NOT_CONNECTED (`cron-last-run`; requires `CF_ANALYTICS_API_TOKEN` + `CF_ACCOUNT_ID`).

Additional structural finding: `letbuyy-api` cron (`*/15 * * * *`) is declared in the `[env.production]` block only — no staging pulse (`cron-env-gap`, low, CONNECTED). See forensics F-4.

---

## 3. Structural Findings (CONNECTED) — Known at All Times

| Finding ID | Severity | What it means |
|-----------|----------|---------------|
| `QUEUE-SPOF-letbuyy-queue-workers` | Critical | Single worker consumes all 5 business queues + 2 DLQs. Worker failure = total async stoppage. |
| `DLQ-DRAIN-GAP-6h-no-alert` | High (via scorer) | DLQs cleared by 6-hour cron only. No dedicated alert. Up to 6h of silent accumulation. |
| `WORKER-UNDER-MAPPED-letbuyy-mobile-bff` | Medium | Serves `bff.letbuyy.com` but has 0 domains/RPCs/tables in observability artifact. |
| `CRON-PROD-ONLY-letbuyy-api` | Low | Health-pulse cron fires in production only; staging has no periodic telemetry emission. |

---

## 4. Live Metrics — All NOT_CONNECTED

| Metric | Source | Env vars required |
|--------|--------|------------------|
| Worker error rate | Cloudflare Analytics Engine (`RUNTIME_TELEMETRY` dataset) | `CF_ANALYTICS_API_TOKEN`, `CF_ACCOUNT_ID` |
| Queue backlog depth | Cloudflare Queues metrics API | `CLOUDFLARE_API_TOKEN`, `CF_ACCOUNT_ID` |
| DLQ depth | Cloudflare Queues metrics API | `CLOUDFLARE_API_TOKEN`, `CF_ACCOUNT_ID` |
| Cron last-run status | Cloudflare Analytics Engine / wrangler tail | `CF_ANALYTICS_API_TOKEN`, `CF_ACCOUNT_ID` |
| Stuck-job message age | Cloudflare Queues metrics API | `CLOUDFLARE_API_TOKEN`, `CF_ACCOUNT_ID` |

All 12 telemetry adapters are NOT_CONNECTED at initial deployment (see `LCOS_TELEMETRY_DISCOVERY.md`).

---

## 5. Real Topology (From Forensics)

**Workers (4 active):**
- `letbuyy-api` (api-gateway) — 3 routes, 1 cron (production only), producer for all 5 queues
- `letbuyy-queue-workers` — 0 HTTP routes, 1 cron (`17 */6 * * *`), consumer for all 5 queues + 2 DLQs
- `letbuyy-webhook` — 3 routes, no crons, no queue role
- `letbuyy-mobile-bff` — 3 routes (no domains/RPCs/tables mapped)

**Queues (5 business + 2 DLQs):**
EVENT_QUEUE, ANALYTICS_QUEUE, SEARCH_QUEUE, NOTIFICATION_QUEUE, RUNTIME_QUEUE.
DLQs: `letbuyy-dead-letters-{staging|production}`, `letbuyy-{staging|production}-dead-letter-queue`.

**Crons (2):**
- `*/15 * * * *` on `letbuyy-api` (production env block only)
- `17 */6 * * *` on `letbuyy-queue-workers`

---

## 6. Example `RuntimeReport` Shape

```typescript
{
  area: 'runtime',
  liveConnected: false,           // always false until CF credentials wired
  confidence: 0.75,               // structural-only; capped at 0.9 per type contract
  timestamp: '2026-06-21T...',
  sources: ['runtime-intel.json', 'runtime-observability.json'],
  evidence: [
    { kind: 'artifact', source: 'runtime-intel', field: 'workers', note: '4 workers' },
    ...
  ],
  facts: [
    { area: 'runtime', kind: 'worker-count',   value: 4,    status: 'CONNECTED' },
    { area: 'runtime', kind: 'queue-count',    value: 7,    status: 'CONNECTED' },   // 5 + 2 DLQs in graph
    { area: 'runtime', kind: 'dlq-count',      value: 2,    status: 'CONNECTED' },
    { area: 'runtime', kind: 'cron-count',     value: 2,    status: 'CONNECTED' },
    { area: 'runtime', kind: 'telemetry-adapter-count', value: 12, status: 'CONNECTED' },
    { area: 'runtime', kind: 'worker-error-rate', value: null, status: 'NOT_CONNECTED' },
    { area: 'runtime', kind: 'queue-backlog',     value: null, status: 'NOT_CONNECTED' },
    { area: 'runtime', kind: 'dlq-depth',         value: null, status: 'NOT_CONNECTED' },
    { area: 'runtime', kind: 'cron-last-run',     value: null, status: 'NOT_CONNECTED' },
  ],
  findings: [
    // CONNECTED structural findings
    { id: 'QUEUE-SPOF-letbuyy-queue-workers', severity: 'critical', status: 'CONNECTED', ... },
    { id: 'DLQ-DRAIN-GAP-6h-no-alert', severity: 'high', status: 'CONNECTED', ... },
    // NOT_CONNECTED live findings (one per worker/queue/DLQ/cron)
    { id: 'WORKER-ERROR-RATE-NOT-CONNECTED-letbuyy-api', severity: 'info', status: 'NOT_CONNECTED', confidence: 0, ... },
    ...
  ],
  signals: [],    // LiveSignalRegistry.byArea('runtime') — none registered at startup
  health: {
    area: 'runtime',
    score: null,   // null: no live signals connected
    band: 'unknown',
    connectedSignals: 0,
    notConnectedSignals: 12
  },
  summary: 'Runtime topology CONNECTED: 4 workers, 7 queues, 2 DLQs, 2 crons, ...'
}
```

---

## 7. How to Connect Live Metrics

```bash
# Cloudflare credentials (worker errors, queue depth, cron tail)
CF_ANALYTICS_API_TOKEN=<token>
CF_ACCOUNT_ID=<account>
CLOUDFLARE_API_TOKEN=<token>  # Queues metrics API uses a separate token
```

Once set, the corresponding findings flip from `NOT_CONNECTED` (confidence=0) to `CONNECTED` with real values. The SPOF and DLQ-gap structural findings remain CONNECTED regardless — they are topology facts.

---

## 8. Cross-References

- Source: `packages/lcis-operations/src/runtime/RuntimeOperationsService.ts`
- Topology facts: `docs/lcis-operations/LCOS_FORENSICS_REPORT.md` (§1.1–§1.5)
- Telemetry adapter map: `docs/lcis-operations/LCOS_TELEMETRY_DISCOVERY.md`
- Detectability matrix: `docs/lcis-operations/LCOS_DETECTABILITY_MATRIX.md`
