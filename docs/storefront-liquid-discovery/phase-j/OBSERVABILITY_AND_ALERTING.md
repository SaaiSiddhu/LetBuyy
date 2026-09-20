# Phase J — Observability and Alerting Design

**Document ID:** PHASE-J-OBSERVABILITY-2026-07-10  
**Date:** 2026-07-10  
**Branch:** stepup/main  
**Author:** Subagent (Phase J observability role)  
**Related documents:** ROLLOUT_READINESS_PACKAGE.md · phase-i/QA_CERTIFICATION.md · phase-f/ (F9 benchmark) · phase-c/ (crash recovery)

---

## Authority and Honesty Law (Read First)

**Authority law.** The platform-wide Liquid flip is ARB-AUTHORITY only. `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` remains `false` (verified: `packages/theme-engine/src/theme-governance.ts:14`). `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status` remains `deferred`. This document designs the observability layer that the ARB package requires; it does not flip any flag, deploy any code, or wire any dashboard.

**Honesty law.** Every signal is classified as:

- **CONNECTED** — emission point exists in committed source on `stepup/main`. The structured log or DB field is written. Live ingestion requires an external pipeline (Cloudflare Logpush, Analytics Engine, or `wrangler tail`) that is not wired in this repository.
- **NOT_CONNECTED** — the value does not exist in the repository. The exact source and required credential/config are stated.

No dashboard screenshot, SLO value, or alert count is presented as live. All threshold values are labeled **PROPOSED** and are candidates for ARB/ops team calibration against real production traffic.

---

## 1. Overview

The Liquid rollout follows a per-store activation path (see ROLLOUT_READINESS_PACKAGE.md §1). The global default is `false`; stores activate via `theme_releases.release_manifest.renderer_engine = 'liquid'`. The safety net degrades any Liquid failure to a React render without a deploy (composition-engine try/catch → React fallback, per Phase C). The observability design must answer five operational questions continuously during rollout:

1. How many stores are rendering Liquid vs React?
2. What fraction of Liquid renders are falling back to React (and why)?
3. Are per-block or per-section errors accumulating above baseline?
4. Is Liquid render latency within the F9 budget (288 ms total for N=25)?
5. Are version-gate rejections (G4) appearing, indicating a bundle schema mismatch?

No mechanism to answer any of these questions at production scale exists today without wiring the log pipeline. This document defines the exact wiring needed.

---

## 2. Metric Catalog

All signals originate in committed source. CONNECTED means the `console.log` / `console.warn` call is present; the signal exits the Cloudflare Worker as a log line only when a Logpush rule or `wrangler tail` session is active.

### 2.1 Primary Render Signal — `lb:canary:render`

| Property | Value |
|---|---|
| **Signal name** | `lb:canary:render` |
| **Status** | **CONNECTED** |
| **Emission point** | `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:663–677` |
| **Log level** | `console.log` (INFO) |
| **Format** | `JSON.stringify({...})` — single structured line per SSR render |
| **Fired on** | Every server-side render of a storefront page — both Liquid and React paths |

**Fields:**

| Field | Type | Description |
|---|---|---|
| `event` | `string` | Literal `"lb:canary:render"` |
| `engine` | `"liquid"` \| `"react"` | Resolved engine for this render. `"liquid"` when `liquidHtml` is non-null; `"react"` otherwise. |
| `subdomain` | `string` | Store subdomain — the tenant identifier for grouping |
| `template` | `string` | Template ID from `plan.template.id` |
| `route_type` | `string` | Route type from `plan.route.type` (e.g. `"index"`, `"product"`, `"collection"`, `"blog"`) |
| `latency_ms` | `number` | Milliseconds from render start to event emission. Includes LiquidJS execution + DOMPurify + section parallelism. |
| `editor_mode` | `boolean` | `true` when rendered inside the theme editor preview iframe |
| `fallback_reason` | `"renderer_returned_null"` \| `null` | Set to `"renderer_returned_null"` **only** when `plan.rendererEngine === 'liquid'` and `liquidHtml === null`. Null on all React-plan renders and all successful Liquid renders. See §2.2 for the upstream trigger. |
| `cache_hit` | `null` | Always `null` in committed source (line 676). Per-request render cache is NOT_CONNECTED. Do not use this field. |

**Derivable metrics from this signal** (all require live ingestion — NOT_CONNECTED today):

| Metric | Derivation |
|---|---|
| Render engine mix | `COUNT(event) GROUP BY engine` |
| Per-store Liquid adoption | `COUNT(event) WHERE engine='liquid' GROUP BY subdomain` |
| Liquid fallback rate | `COUNT(event) WHERE fallback_reason IS NOT NULL / COUNT(event) WHERE engine='react' AND plan_engine='liquid'` (requires tracking the intended engine) |
| p50 / p95 render latency | `PERCENTILE(latency_ms, 50/95) WHERE engine='liquid'` |
| Latency by route type | `PERCENTILE(latency_ms, 95) WHERE engine='liquid' GROUP BY route_type` |
| Editor-mode traffic share | `COUNT(event) WHERE editor_mode=true / COUNT(event)` |

**Live ingestion path (NOT_CONNECTED):**  
Cloudflare Workers emit `console.log` lines to the Logpush pipeline when configured. Required:  
1. Configure Cloudflare Logpush for the storefront-runtime Worker (Workers Logs dataset) pointing to the chosen sink (e.g. R2, Elastic, BigQuery).  
2. Or use `wrangler tail --format=json` for ad-hoc sampling during staged rollout.  
3. The `OTEL_EXPORTER_OTLP_ENDPOINT` env var is referenced in LCIS V2 docs but no OTLP instrumentation exists in storefront-runtime — Logpush is the correct path.

---

### 2.2 Unexpected Fallback Signal — `lb:canary:render:fallback`

| Property | Value |
|---|---|
| **Signal name** | `lb:canary:render:fallback` |
| **Status** | **CONNECTED** |
| **Emission point** | `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:628–633` |
| **Log level** | `console.warn` (WARN) |
| **Format** | `JSON.stringify({...})` |
| **Fired on** | Unexpected `throw` from inside `renderLiquidPlan()` — i.e. an exception that escaped the per-section and per-block try/catch in `theme-renderer.ts`. Examples: OOM in LiquidJS, JSDOM initialization failure. |

**Fields:**

| Field | Type | Description |
|---|---|---|
| `event` | `string` | Literal `"lb:canary:render:fallback"` |
| `reason` | `string` | Error message, truncated to 200 chars |
| `subdomain` | `string` | Store subdomain |
| `template` | `string` | Template ID |

**Important scoping:**  
This signal fires **only** on unhandled throws inside `renderLiquidPlan()`. It does NOT fire for:
- Normal `status: 'error'` returns from `theme-renderer.ts` (all main sections failed — renderer returns without throwing)
- `status: 'unsupported'` returns (missing bundle, G4 version gate — renderer returns without throwing)

When any of those renderer statuses occur, `liquidHtml` is `null`, which triggers `fallback_reason: 'renderer_returned_null'` on the **`lb:canary:render`** INFO event instead. This signal is the "something unexpectedly threw" channel, not the "Liquid degraded gracefully" channel.

**Derivable metric:** Rate of unexpected Liquid throws per unit time (WARN-level escalation signal).

---

### 2.3 Per-Block Crash Signal — `lb:liquid:block-error`

| Property | Value |
|---|---|
| **Signal name** | `lb:liquid:block-error` |
| **Status** | **CONNECTED** |
| **Emission point** | `packages/theme-engine/src/theme-renderer.ts:777` |
| **Log level** | `console.warn` (WARN) |
| **Format** | `JSON.stringify({...})` |
| **Fired on** | Per-block render failure inside a section's block loop. The section continues rendering without that block's HTML (graceful degradation). |

**Fields:**

| Field | Type | Description |
|---|---|---|
| `event` | `string` | Literal `"lb:liquid:block-error"` |
| `blockId` | `string` | The block identifier within the section |
| `blockType` | `string` | The block type (e.g. `"image"`, `"button"`) |
| `error` | `string` | Error message, truncated to 200 chars |

**Note:** This signal does not carry `subdomain` or `template`. Correlation to a specific store requires joining on timestamp + surrounding `lb:canary:render` events in the same Worker invocation. No request ID is threaded through the render pipeline. A future improvement would add a request-scoped correlation ID.

---

### 2.4 Per-Section Error HTML Comment — `lb:section-error`

| Property | Value |
|---|---|
| **Signal** | `<!-- lb:section-error sectionId="..." type="..." -->` HTML comment |
| **Status** | **CONNECTED** |
| **Emission point** | `packages/theme-engine/src/theme-renderer.ts:417` |
| **Channel** | Embedded in rendered HTML output at the position of the failed section |
| **Fired on** | Any section that fails to render (both settled-rejected and try/catch paths in Phase C C1 parallel section render). |

**Behavior:** When a section fails, its HTML slot is replaced by this comment. The surrounding page body renders normally. If ALL main sections fail, `theme-renderer.ts` returns `status: 'error'` (`theme-renderer.ts:592–598`) and `liquidHtml` becomes `null`, triggering the full React fallback without emitting this comment (status:'error' exits before layout rendering).

**Detection methods (NOT_CONNECTED for production):**
- Synthetic monitoring: scrape rendered HTML for the pattern `lb:section-error` after publishing a Liquid theme release.
- Log pipeline: parse Worker log output for the comment text (it appears in raw response body logging if Logpush captures response payloads).

---

### 2.5 Renderer Engine and Readiness in DB — `theme_releases.release_manifest`

| Property | Value |
|---|---|
| **Signal** | `renderer_engine` and `liquid_ready` fields in `theme_releases.release_manifest` (JSONB) |
| **Status** | **CONNECTED** (write-path), **NOT_CONNECTED** (live count query) |
| **Write point** | `services/api-gateway/src/execution/theme-execution.adapter.ts:643–644` (`buildReleaseArtifacts()`) |
| **Written at** | Theme publish time. `renderer_engine = 'liquid'` when `liquidBundle` is present; otherwise `'json-contract'` or `rendererManifest.engine`. `liquid_ready = true` when `liquidBundle` present or `rendererManifest.liquid_ready === true`. |

**Live count query (NOT_CONNECTED — requires production Supabase service-role credentials):**

```sql
-- Count stores actively serving Liquid
SELECT COUNT(DISTINCT s.id) AS liquid_store_count
FROM theme_releases tr
JOIN sites s ON s.current_theme_release_id = tr.id
WHERE tr.release_manifest->>'renderer_engine' = 'liquid';

-- Breakdown by renderer_engine value
SELECT
  tr.release_manifest->>'renderer_engine' AS renderer_engine,
  COUNT(*) AS store_count
FROM theme_releases tr
JOIN sites s ON s.current_theme_release_id = tr.id
GROUP BY 1
ORDER BY 2 DESC;
```

This is the authoritative count of how many stores have Liquid active. The `lb:canary:render` log signal gives per-render counts; the DB query gives the instantaneous store-level count.

---

### 2.6 Global Engine Header — `X-Lb-Render-Engine`

| Property | Value |
|---|---|
| **Signal** | `X-Lb-Render-Engine` HTTP response header |
| **Status** | **CONNECTED** (header written), with a critical limitation |
| **Emission point** | `apps/storefront-runtime/src/proxy.ts:175–176` (middleware `rewriteToStore()`) |
| **Value** | `'liquid'` when `process.env.THEME_LIQUID_RENDERING_DEFAULT_ENABLED === 'true'`; otherwise `'react'` |

**Critical limitation:** This header reflects the **global environment variable**, not the per-store resolved engine. During the staged rollout phase (global default `false`, individual stores activated via `renderer_engine = 'liquid'` in their release manifest), every response will carry `X-Lb-Render-Engine: react` even for stores that are rendering Liquid. This header is NOT usable to measure per-store Liquid adoption. Its only valid use is to confirm that the global platform flip has taken effect after the ARB authorizes it.

Do not use this header in rollout dashboards to measure Liquid traffic share.

---

### 2.7 Version-Gate Rejection Signal (G4)

| Property | Value |
|---|---|
| **Signal** | `fallback_reason: 'renderer_returned_null'` on `lb:canary:render` events where `plan.rendererEngine === 'liquid'` |
| **Status** | **CONNECTED** (signal present; G4 cause not directly distinguished) |
| **Code path** | `UnsupportedLiquidBundleSchemaVersionError` thrown at `packages/theme-engine/src/theme-bundle.ts:1362` → caught at `packages/theme-engine/src/theme-renderer.ts:491` → returns `status: 'unsupported'` → caller receives `liquidHtml === null` → `composition-engine.tsx:675` sets `fallback_reason = 'renderer_returned_null'` |
| **Known version(s)** | `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS = ['2026-06-liquid-sections']` (`packages/theme-engine/src/theme-bundle.ts:14–15`) |

**Ambiguity:** `fallback_reason = 'renderer_returned_null'` is set for **all** cases where the plan requested Liquid but `liquidHtml` was null. This includes G4 version-gate rejections, `status: 'error'` (all sections failed), and `status: 'unsupported'` (no bundle, missing template). There is no dedicated field to distinguish G4 specifically. To detect G4 in production without a code change, correlate a `fallback_reason = 'renderer_returned_null'` event with the absence of `lb:canary:render:fallback` (unexpected throw) and absence of `lb:section-error` HTML comments; the remaining population is primarily G4 + missing-bundle cases.

A future improvement: add a dedicated `fallback_cause` field to `lb:canary:render` with values `'renderer_returned_null'`, `'unsupported_schema_version'`, `'all_sections_failed'`, `'renderer_threw'`.

---

### 2.8 F9 Benchmark Reference (Local Only — NOT_CONNECTED for Production)

| Property | Value |
|---|---|
| **Signal** | F9 benchmark results |
| **Status** | **NOT_CONNECTED** (local benchmark; production CPU/memory is NOT_CONNECTED) |
| **Source** | `packages/theme-engine/test/liquid-render-benchmark.test.ts` |
| **Recorded** | 2026-07-05, JSDOM-backed local run, N=25, warm DOMPurify singleton |

**Recorded local reference values (from test file comments, lines 34–39):**

| Configuration | Cold (ms) | Steady (ms) | p95 (ms) | Total (ms) | Verdict |
|---|---|---|---|---|---|
| cache:true + parallel (F1+F2, production config) | 24 | 11 | 17 | 288 | PASS |

The 288 ms total is the **F9 budget reference** for latency alert thresholds below. This is a local measurement on developer hardware — Cloudflare Worker CPU time will differ. Production latency requires Cloudflare Analytics Engine or Logpush ingestion of `latency_ms` from `lb:canary:render` events.

**Production measurement (NOT_CONNECTED):** Cloudflare Analytics Engine (Workers Analytics dataset), or Logpush sink → aggregate `latency_ms` from `lb:canary:render WHERE engine='liquid'`.

---

### 2.9 Publish and Release Counts

| Property | Value |
|---|---|
| **Signal** | Row inserts into `theme_releases` |
| **Status** | **NOT_CONNECTED** (count is a DB query, not a log event) |
| **Source** | Production Supabase: `SELECT COUNT(*), DATE_TRUNC('hour', created_at) FROM theme_releases WHERE release_manifest->>'renderer_engine'='liquid' GROUP BY 2 ORDER BY 2 DESC LIMIT 24` |
| **Purpose** | Tracks the velocity of Liquid theme releases being published by merchants — the activation rate during rollout |

---

### 2.10 Summary: Signal Status Table

| Signal | Status | Where Emitted | Live Ingestion Required |
|---|---|---|---|
| `lb:canary:render` (engine, latency, fallback_reason) | **CONNECTED** | `composition-engine.tsx:663` | Cloudflare Logpush / `wrangler tail` |
| `lb:canary:render:fallback` (unexpected throw) | **CONNECTED** | `composition-engine.tsx:628` | Cloudflare Logpush / `wrangler tail` |
| `lb:liquid:block-error` (per-block crash) | **CONNECTED** | `theme-renderer.ts:777` | Cloudflare Logpush / `wrangler tail` |
| `lb:section-error` HTML comment | **CONNECTED** | `theme-renderer.ts:417` | Synthetic scrape or response-body Logpush |
| `theme_releases.release_manifest.renderer_engine` | **CONNECTED** (write) | `theme-execution.adapter.ts:643` | Production Supabase query |
| `theme_releases.release_manifest.liquid_ready` | **CONNECTED** (write) | `theme-execution.adapter.ts:644` | Production Supabase query |
| `X-Lb-Render-Engine` header | **CONNECTED** (write, global only) | `proxy.ts:175` | CDN access log — global flip state only |
| Render engine mix % | **NOT_CONNECTED** | Derived from `lb:canary:render` | Logpush + aggregation pipeline |
| p50 / p95 latency (production) | **NOT_CONNECTED** | Derived from `lb:canary:render.latency_ms` | Logpush + aggregation pipeline |
| Live store count by engine | **NOT_CONNECTED** | DB query on `theme_releases` | Production Supabase credentials |
| Production CPU / memory per render | **NOT_CONNECTED** | Cloudflare Analytics Engine | `OTEL_EXPORTER_OTLP_ENDPOINT` or Analytics Engine binding |
| `cache_hit` field | **NOT_CONNECTED** | `composition-engine.tsx:676` (always `null`) | Per-request render cache not implemented |

---

## 3. Proposed Alert Thresholds

All thresholds below are **PROPOSED**. None are wired. They require: (a) live log ingestion from §2, (b) an alerting platform (PagerDuty, Cloudflare Notifications, or custom webhook), and (c) calibration against observed production baseline traffic. The ARB or ops team must ratify these values before the rollout gate opens.

### 3.1 Threshold Table

| Alert Name | Signal Source | Condition | Severity | **PROPOSED** Threshold | Rationale |
|---|---|---|---|---|---|
| **Liquid Fallback Rate — Warning** | `lb:canary:render` | `fallback_reason = 'renderer_returned_null'` rate over 5-min window, for `engine_intended = 'liquid'` renders | WARNING | **> 5% of Liquid-intended renders** | Elevated but not catastrophic — React fallback is operating correctly. Investigate root cause before rate climbs. |
| **Liquid Fallback Rate — Critical** | `lb:canary:render` | Same as above | CRITICAL | **> 20% of Liquid-intended renders** | Systematic Liquid failure. Indicates a bad release, JSDOM crash pattern, or schema incompatibility. Trigger per-store rollback protocol. |
| **Unexpected Throw Rate** | `lb:canary:render:fallback` | Count per 5-min window | WARNING | **> 5 events in 5 minutes** | Any occurrence of `lb:canary:render:fallback` is abnormal (Phase C prevents routine throws). A burst indicates OOM or JSDOM initialization regression. |
| **Unexpected Throw Rate — Critical** | `lb:canary:render:fallback` | Count per 1-min window | CRITICAL | **> 10 events in 1 minute** | Cascading Worker crash. Escalate immediately; consider global rollback. |
| **Per-Block Error Rate** | `lb:liquid:block-error` | Events per 5-min window | WARNING | **> 50 events in 5 minutes** | Block-level crashes are expected to be near-zero in production (blocks render without their HTML if failed). A sustained burst suggests a Liquid template authoring regression in a published theme. |
| **p95 Render Latency — Warning** | `lb:canary:render.latency_ms WHERE engine='liquid'` | p95 over 5-min window | WARNING | **> 400 ms** | F9 local benchmark total is 288 ms (N=25, parallel, warm). 400 ms is a proposed 1.4× headroom for production overhead. |
| **p95 Render Latency — Critical** | `lb:canary:render.latency_ms WHERE engine='liquid'` | p95 over 5-min window | CRITICAL | **> 800 ms** | Severe Liquid render slowdown. Indicates runaway LiquidJS template, degenerate scope, or Worker CPU saturation. |
| **G4 Version-Gate Rejections** | `lb:canary:render WHERE fallback_reason='renderer_returned_null'` correlated with no preceding WARN events | Count per hour | WARNING | **> 3 events from distinct subdomains per hour** | Unexpected schema version in published bundles — indicates a gateway that published a bundle with an unsupported `schema_version`. Requires theme-bundle schema audit. |
| **Liquid Store Count Regression** | `theme_releases.release_manifest->>'renderer_engine'` | DB query: store count drops after a previous increase | WARNING | **Any reduction in active Liquid store count** | Indicates unintended per-store rollback or a theme republish that dropped the `renderer_engine` field. |

### 3.2 Threshold Calibration Notes

- The 5% / 20% fallback-rate thresholds are conservative defaults for a 0→N store activation rollout. If initial stores are internal/canary stores with known-good bundles, zero tolerance (> 1%) may be appropriate for the first cohort.
- The 400 ms / 800 ms latency thresholds assume Cloudflare Workers edge runtime. The F9 benchmark (288 ms) ran on local Node.js with JSDOM. Workers runtime isolation, Miniflare compatibility, and cold-start behavior will shift the baseline. Calibrate against the first 100 production renders before setting final thresholds.
- The `lb:canary:render:fallback` WARN threshold of 5 events per 5 minutes could be set to 0 for canary cohort 1. Any unexpected throw in a controlled cohort is actionable immediately.
- No SLO exists today. The proposed latency budget is a local benchmark reference, not a contractual SLO. The ARB or product team must define the official SLO before public rollout.

---

## 4. Dashboard Layout Proposal

**Status: NOT_CONNECTED. No dashboard exists. The layout below is a design specification.**

A single observability dashboard is proposed with four rows. The data source for all panels is the Cloudflare Logpush sink (§5) aggregating `lb:canary:render` and `lb:canary:render:fallback` events, plus the production Supabase DB for store-count panels.

### Row 1 — Adoption (top of page)

| Panel | Type | Metric | Group By |
|---|---|---|---|
| Engine Mix — All Stores | Pie chart | `COUNT(lb:canary:render) GROUP BY engine` | `engine` |
| Liquid Store Count | Stat (single number) | DB query: `COUNT(sites) WHERE renderer_engine='liquid'` | n/a |
| Liquid Activation Rate (24h) | Time series | New Liquid-engine stores per hour | `DATE_TRUNC('hour', created_at)` on `theme_releases` |
| Liquid Renders / Total Renders | Stat (%) | `COUNT WHERE engine='liquid' / COUNT(*)` | n/a |

### Row 2 — Health (always-on during rollout)

| Panel | Type | Metric | Alert Tie-in |
|---|---|---|---|
| Liquid Fallback Rate (5-min) | Gauge | `fallback_reason IS NOT NULL rate` | §3.1 fallback-rate thresholds |
| Unexpected Throws (1-min) | Stat + alert bar | `COUNT(lb:canary:render:fallback)` per minute | §3.1 unexpected-throw thresholds |
| Per-Block Error Rate (5-min) | Stat | `COUNT(lb:liquid:block-error)` per minute | §3.1 block-error threshold |
| React Fallback Reason Breakdown | Bar chart | `COUNT GROUP BY fallback_reason` | Distinguishes `renderer_returned_null` vs null |

### Row 3 — Latency

| Panel | Type | Metric | Reference Line |
|---|---|---|---|
| p50 Render Latency — Liquid (5-min rolling) | Time series | `PERCENTILE(latency_ms, 50) WHERE engine='liquid'` | F9 steady = 11 ms (local reference only) |
| p95 Render Latency — Liquid (5-min rolling) | Time series | `PERCENTILE(latency_ms, 95) WHERE engine='liquid'` | PROPOSED warning at 400 ms |
| p50 Render Latency — React (5-min rolling) | Time series | `PERCENTILE(latency_ms, 50) WHERE engine='react'` | Baseline comparison |
| Latency by Route Type | Heatmap | `PERCENTILE(latency_ms, 95) GROUP BY route_type` | Identify slow templates |

### Row 4 — Per-Store Drill-Down

| Panel | Type | Metric | Purpose |
|---|---|---|---|
| Fallback Events by Subdomain | Table (top 20) | `COUNT(fallback_reason IS NOT NULL) GROUP BY subdomain` | Identify problem stores |
| Error Events by Subdomain | Table (top 20) | `COUNT(lb:liquid:block-error) GROUP BY subdomain` | Block crash concentration |
| Latency by Subdomain | Table (top 20 slowest) | `MAX(latency_ms) WHERE engine='liquid' GROUP BY subdomain` | Runaway template detection |
| Recent Fallback Events | Log panel | Raw `lb:canary:render` where `fallback_reason IS NOT NULL` | Debugging |

### Dashboard Variables (Template Filters)

- `$subdomain` — filter all panels to a specific store. Used for per-store activation monitoring.
- `$route_type` — filter by page type (index / product / collection / blog / article / page).
- `$time_range` — standard time picker (default: last 1 hour during rollout; 24 hours for daily review).

---

## 5. Wiring Required to Go Live

This section lists the exact steps to transition from CONNECTED-in-code to live production observability. No wiring exists today.

### 5.1 Cloudflare Logpush (Required for All Log-Based Metrics)

1. Create a Cloudflare Logpush job for the `storefront-runtime` Workers script targeting the Workers Logs dataset.
2. Configure the destination (R2 bucket, Elastic cluster, BigQuery dataset, or Datadog).
3. Set the filter to include all log lines containing the string `lb:canary` or `lb:liquid` — this scopes the pipeline to Liquid telemetry events only (reduces volume by excluding unrelated Worker logs).
4. Ensure the log job is scoped to the production zone (not staging/dev) to avoid mixing environments.

**Environment variable not required** — Logpush is configured at the Cloudflare dashboard / API level, not via env vars in the Worker. No code change is needed to emit the signals; they are already emitted.

### 5.2 Analytics Aggregation Layer

Options (choose one):
- **Cloudflare Analytics Engine:** Add an `env.ANALYTICS` binding to the Worker (wrangler.toml `analytics_engine_datasets` block) and replace `console.log(JSON.stringify({...}))` calls with `env.ANALYTICS.writeDataPoint(...)`. This removes the Logpush dependency. Requires a code change to composition-engine.tsx and theme-renderer.ts. Dataset: `lb_render_events`.
- **External sink via Logpush:** Parse Logpush-delivered NDJSON files (e.g. in BigQuery or Elastic) and build aggregations via SQL / Kibana. No code change required.

Cloudflare Analytics Engine is preferred for real-time alerting (sub-minute latency). Logpush to an external sink may have a 1–5 minute delivery lag depending on configuration.

### 5.3 Alerting Platform

1. Connect the chosen sink to an alerting system (PagerDuty, Grafana Alerting, Opsgenie, or Cloudflare Notifications).
2. Implement the alert conditions from §3.1.
3. Define escalation routing: WARNING → on-call ops engineer; CRITICAL → on-call ops + engineering lead.
4. Test alert delivery before the first Liquid cohort activation.

### 5.4 Production Supabase Monitoring Queries

1. Add the store-count SQL queries from §2.5 to a scheduled query runner (e.g. `pg_cron` on the production DB, or a Cloudflare Cron Trigger calling a service-role-authenticated Worker endpoint).
2. Emit results to the same sink as the log pipeline for dashboard unification.
3. Required credential: `SUPABASE_SERVICE_ROLE_KEY` (production). **This is a deploy-time secret and must never be placed in the repository.**

### 5.5 Synthetic Section-Error Scraping

1. Deploy a synthetic monitor (Cloudflare Browser Rendering, Playwright in a cron Worker, or an external uptime tool) that fetches the homepage of each Liquid-activated store.
2. Assert that the response HTML does not contain the string `lb:section-error`.
3. Run every 5 minutes per activated store during initial cohort rollout; reduce frequency after 48-hour clean run.

---

## 6. Runbook Escalation Pointer

### 6.1 Existing Runbook Reference

A domain-specific runbook for Liquid render failures is defined architecturally in the Phase C crash-recovery design (phase-c/) and the ROLLOUT_READINESS_PACKAGE.md §5 (rollback procedures). The LCIS runbook API at `localhost:3333/api/runbook?domain=storefront` (when LCIS is running) generates the escalation chain.

### 6.2 Escalation Chain (Design — NOT_CONNECTED to a live incident system)

| Condition | Initial Action | Escalation |
|---|---|---|
| Fallback rate > 5% (WARNING) | Engineering on-call investigates `lb:canary:render` events for affected subdomains. Check recent theme publishes. | If not resolved in 30 minutes, escalate to platform lead. |
| Fallback rate > 20% (CRITICAL) | Immediate per-store rollback: set `theme_releases.release_manifest.renderer_engine` to a non-`'liquid'` value for affected stores (or revert to a previous release). ISR revalidates within 60 seconds (`apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:10`). | Escalate to ARB. Halt cohort expansion until root cause identified. |
| Unexpected throws > 10/min (CRITICAL) | Declare Liquid render incident. Execute per-store rollback for all active Liquid stores. | Engineering lead + ARB notification. No new Liquid activations until resolved. |
| G4 version-gate rejections (WARNING) | Identify the theme release with the unsupported `schema_version`. Revert that release via the merchant-control-plane or direct DB update. | If widespread (> 10 stores), audit gateway `buildReleaseArtifacts()` for a bad publish. |
| p95 latency > 800 ms (CRITICAL) | Check for runaway Liquid templates (§4 Row 4 per-store latency panel). Roll back the slowest stores. | If global (not store-specific), check for Worker CPU saturation or LiquidJS regression. |

### 6.3 Rollback Execution Time

- **Per-store rollback (fastest, no deploy):** DB update on `theme_releases.release_manifest.renderer_engine`. Takes effect within the 60-second ISR revalidation window (`page.tsx:10`).
- **Canary flag rollback (no deploy):** Set any of the 11 canary aliases to `'false'` / `'0'` / `'disabled'` in `templateConfig` or `releaseManifest` for the affected store.
- **Platform-wide emergency rollback (if ARB authorizes):** Redeploy storefront-runtime with `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` (already the current value — this is the reset state). No code change needed; the constant at `packages/theme-engine/src/theme-governance.ts:14` is already `false`.

---

## 7. Open Items Affecting Observability Completeness

These are carried-forward findings from Phases H and I that affect the observability story. They do not block the ARB readiness package but must be disclosed.

| Item | Severity | Description | Status |
|---|---|---|---|
| **I-F1 — DOMPurify clobbering strips `name="name"`** | ~~HIGH~~ **CLOSED** | `packages/theme-engine/src/theme-bundle.ts:2433` — field renamed from `name="name"` to `name="fullName"` in commit dbcf173a. Register route reads `form.get('fullName') ?? form.get('name')`. A11Y-5 asserts `name="fullName"` survives DOMPurify and `name="name"` is absent (221/221 PASS). | **CLOSED** — no longer an open defect or a GO gate. |
| **H-F2 — Path-traversal risk in `theme-artifact-exporter.ts`** | ~~MEDIUM~~ **CLOSED** | `packages/theme-engine/src/theme-artifact-exporter.ts` (correct path — the file does not exist in `apps/storefront-runtime`): `assertSafeArtifactPath()` (lines 58–68) is called at all path composition points (lines 75, 82, 90, 116, 124). Throws `UnsafeThemeArtifactPathError` on absolute paths or `..` segments. Code on `stepup/main` confirms the fix. | **CLOSED** — no action required. |
| **H-F3 — `settings_data` exported without BLOCKED_DROP_KEYS filter** | LOW | `theme-artifact-exporter.ts:76–79` — `settings_data` exported without the BLOCKED_DROP_KEYS filter applied in the normal render path. | **OPEN** — carries to Phase J. |
| **No per-request correlation ID** | LOW | `lb:liquid:block-error` does not carry `subdomain` or a request ID, making it hard to correlate block failures to specific stores or renders without timestamp proximity. | **NOT_CONNECTED** — future improvement: add a `request_id` parameter threaded through the render pipeline. |
| **Governance validator non-blocker** | INFO | `scripts/validate-governance.mjs` FAIL on tenant-table registry pre-dates Phase B. Confirmed unrelated human-owned non-blocker. `theme-governance-validator.mjs` and `migration-safety-validator.mjs` both PASS. | **Known, pre-existing, non-blocking.** Documented in ROLLOUT_READINESS_PACKAGE.md §7. |
| **H-F1 — Linter `forbidAttrs`** | ~~INFO~~ **CLOSED** | `theme-linter.ts:64` declares `forbidAttrs`; `for (const attr of forbidAttrs)` at line 101 iterates it. Rule name is `forbidden-attr` (not `forbidden-style-attr`). FORBID_ATTR from `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` is the single source of truth. Previously listed as OPEN MEDIUM; code on `stepup/main` confirms closure. | **CLOSED** — no action required. |
| **`FEATURE_LIQUID` gateway flag dormant** | INFO | `services/api-gateway/wrangler.toml:248` declares `FEATURE_LIQUID='false'`. `featureGate('FEATURE_LIQUID', ...)` is never called in any gateway route. This flag has zero runtime effect. ARB should decide whether to wire it as a production kill switch before the platform flip. | **OPEN (design gap)** — not an observability item but relevant to rollback tooling design. |

---

## 8. Honesty Summary

| Dimension | State |
|---|---|
| Structured log events in code | **CONNECTED** — all four signals (`lb:canary:render`, `lb:canary:render:fallback`, `lb:liquid:block-error`, `lb:section-error` comment) are emitted in committed source |
| Live log ingestion | **NOT_CONNECTED** — no Cloudflare Logpush job or Analytics Engine binding is wired |
| Live dashboards | **NOT_CONNECTED** — no dashboard exists; §4 is a layout design specification |
| Live alerts | **NOT_CONNECTED** — no alert rules are wired; §3 is a threshold proposal |
| Production store-level engine counts | **NOT_CONNECTED** — requires production Supabase service-role query |
| Production latency measurements | **NOT_CONNECTED** — F9 288 ms is a local benchmark reference; production p95 is unknown |
| Production fallback rate | **NOT_CONNECTED** — unknown until log pipeline is active |
| All PROPOSED thresholds | **Proposals only** — require calibration against observed production baseline |

The observability infrastructure described in this document represents the minimum viable monitoring layer for a safe staged rollout. The wiring defined in §5 must be completed and validated before the ARB authorizes any merchant-cohort activation beyond internal/canary stores.

---

*Phase J — Observability and Alerting Design | 2026-07-10 | Branch: stepup/main | Author: Subagent (Phase J observability role) | Gate: PLANNING AND DOCUMENTATION ONLY — no source, config, flag, or migration changes made.*
