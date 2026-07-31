# LCOS Forecast Guide — "What is likely next?"

**Phase:** 6 — LCOS (LetBuyy Central Operations System)
**Service:** `ForecastOperationsService` (`packages/lcis-operations/src/forecast/ForecastOperationsService.ts`)
**Math:** `packages/lcis-operations/src/forecast/methods.ts`
**Honesty contract:** deterministic math is implemented and unit-tested (CONNECTED); all 4 forecast series are NOT_CONNECTED (0 historical data points in any graphify-out artifact; value=null, points=[]).

---

## 1. What This Service Does

`ForecastOperationsService` answers "What is likely next?" using deterministic statistical methods (no AI). It declares 4 forecast series and their exact data sources. Because no historical time-series data is stored in any `graphify-out` artifact, every series is currently NOT_CONNECTED — but the math is ready to apply the moment live data is connected.

NEVER fetches data, never calls the network, never uses a DB, never writes files.

---

## 2. The 3 Deterministic Methods (`methods.ts`)

All functions are pure TypeScript with no imports. They are unit-tested on synthetic arrays with known expected outputs.

### 2.1 `movingAverage(series: number[], window: number): number[]`

Simple Moving Average (SMA).

**Contract:**
- Input: `series` (array of numbers), `window` (positive integer)
- Output: array of length `series.length - window + 1`; each element is the arithmetic mean of the preceding `window` elements
- Edge cases:
  - `window <= 0` → throws `RangeError`
  - `series.length < window` → returns `[]`
  - `window === 1` → returns a copy of `series`

**Used for:** traffic/sessions trend (SMA-7 on daily sessions), queue growth (SMA-7 on daily peak depth).

**Worked example:**
```
series = [100, 110, 120, 130, 140], window = 3
→ [(100+110+120)/3, (110+120+130)/3, (120+130+140)/3]
→ [110, 120, 130]
Length = 5 - 3 + 1 = 3
```

### 2.2 `linearTrend(series: number[]): LinearTrendResult`

Ordinary Least-Squares (OLS) linear regression: `y = intercept + slope * x`.
`series[0]` is `x=0`, `series[1]` is `x=1`, etc.

**Contract:**
- Returns: `{ slope, intercept, forecast(n: number): number[] }`
- `forecast(n)` returns `n` predicted values starting at `x = series.length` (the next point after the series)
- Edge cases:
  - `series.length === 0` → slope=0, intercept=0
  - `series.length === 1` → slope=0, intercept=series[0]
  - Degenerate denominator (all x identical; impossible for distinct indices but guarded) → slope=0

**OLS formula:**
```
b (slope) = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²)
a (intercept) = (Σy − b·Σx) / n
```

**Used for:** orders/GMV trend (OLS on monthly GMV), merchant growth (OLS on monthly new-store counts).

**Worked example:**
```
series = [100, 150, 200, 250]  (monthly GMV, months 0–3)
n=4, Σx=6, Σy=700, Σxy=1*150+2*200+3*250=1450, Σx²=0+1+4+9=14
denom = 4*14 - 6*6 = 56 - 36 = 20
slope = (4*1450 - 6*700) / 20 = (5800 - 4200) / 20 = 80
intercept = (700 - 80*6) / 4 = (700 - 480) / 4 = 55
forecast(2) → [55 + 80*4, 55 + 80*5] = [375, 455]
```

### 2.3 `confidenceInterval(series: number[], point: number, z = 1.96): { lo, hi }`

Symmetric interval around a forecast point using sample standard deviation (Bessel-corrected) as a proxy for residual spread.

**Formula:** `lo = point - z·σ`, `hi = point + z·σ`
where `σ = sqrt(Σ(v - mean)² / (n-1))` (sample std dev).

**Contract:**
- Default `z = 1.96` (95% normal approximation)
- `series.length < 2` → returns `{ lo: point, hi: point }` (zero margin — no meaningful σ)
- Note: this uses full-series σ (conservative upper bound), not fitted residual σ

**Used for:** wrapping any forecast point from `movingAverage` or `linearTrend`.

**Worked example (continuing linearTrend example above):**
```
series = [100, 150, 200, 250], point = 375
mean = 175, variance = ((−75)²+(−25)²+25²+75²) / 3 = (5625+625+625+5625)/3 = 4166.7
σ = 64.55
CI at 95%: lo = 375 - 1.96*64.55 = 375 - 126.5 = 248.5
            hi = 375 + 126.5 = 501.5
```

---

## 3. The 4 Forecast Series

Each `ForecastSeries` carries: `key`, `label`, `method`, `points: []`, `status: 'NOT_CONNECTED'`, `source` (exact table/dataset), `requiresEnvVar`, `evidence`.

### 3.1 Traffic Forecast (`forecast.traffic`)

| Field | Value |
|-------|-------|
| Key | `forecast.traffic` |
| Method | `moving-average` (SMA-7 on daily sessions) |
| Source table | `analytics_event_stream` (Cloudflare Analytics Engine) |
| Required env vars | `CF_ANALYTICS_API_TOKEN`, `CF_ACCOUNT_ID` |
| Status | NOT_CONNECTED |

Evidence: `customer-intelligence.json` has 0 historical session data points.

### 3.2 Orders / GMV Forecast (`forecast.orders`)

| Field | Value |
|-------|-------|
| Key | `forecast.orders` |
| Method | `linear-trend` (OLS on monthly GMV) |
| Source table | `orders` columns: `total_minor bigint`, `created_at`, `site_id` (Supabase) |
| Verification RPC | `refresh_money_ledger_site_reconciliation` |
| Required env vars | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Status | NOT_CONNECTED |

Evidence: `revenue-intelligence-v2.json:models.funnel` has 0 historical monthly GMV data points.

### 3.3 Queue Growth Forecast (`forecast.queue-growth`)

| Field | Value |
|-------|-------|
| Key | `forecast.queue-growth` |
| Method | `moving-average` (SMA-7 on daily peak depth) |
| Source | Cloudflare Queues metrics API; queues: EVENT_QUEUE, ANALYTICS_QUEUE, SEARCH_QUEUE, NOTIFICATION_QUEUE, RUNTIME_QUEUE (all in `runtime-intel.json:queueGraph`) |
| Required env vars | `CLOUDFLARE_API_TOKEN`, `CF_ACCOUNT_ID` |
| Status | NOT_CONNECTED |

Evidence: queue depth is ephemeral and not stored in any artifact; `runtime-intel.json:queueGraph` confirms topology (CONNECTED) but not time-series.

### 3.4 Merchant Growth Forecast (`forecast.merchant-growth`)

| Field | Value |
|-------|-------|
| Key | `forecast.merchant-growth` |
| Method | `linear-trend` (OLS on monthly new-store counts) |
| Source table | `sites` column: `created_at timestamp` (Supabase) |
| Example SQL | `SELECT date_trunc('month', created_at), count(*) FROM sites GROUP BY 1 ORDER BY 1` |
| Required env vars | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Status | NOT_CONNECTED |

Evidence: `merchant-intelligence.json` and `merchant-growth.json` have `growthRate`, `growingMerchants`, `stalledMerchants` all live-query-required with 0 stored data points.

---

## 4. Why All Series Are NOT_CONNECTED

The LCOS Forensics Report and discovery confirmed: **zero historical time-series data points exist in any `graphify-out` artifact**. The artifacts (`revenue-intelligence-v2.json`, `customer-intelligence.json`, `merchant-growth.json`) carry structural topology (funnel stages, merchant counts by category) but no time-series snapshots.

Queue depth is ephemeral (Cloudflare Queues does not persist historical depth to any artifact). Session counts and GMV amounts are live Supabase queries only.

The `generateForecastReport()` method:
- Emits one structural CONNECTED finding: `FORECAST-METHODS-READY` — the math is implemented and unit-tested; it will be applied when ≥3 monthly data points are available.
- Emits four `ForecastSeries` with `points: []`, `status: 'NOT_CONNECTED'`.
- Sets `liveConnected: false` on the report envelope.

---

## 5. No AI Guarantee

The forecast module has no AI, no ML models, no LLM calls, no statistical libraries beyond the pure functions in `methods.ts`. Every prediction is: `intercept + slope * x` (OLS) or `mean(window)` (SMA). The methods.ts file has zero imports. This is enforced by the module's read-only contract comment on line 1.

---

## 6. `ForecastReport` Shape

```typescript
{
  area: 'forecast',
  liveConnected: false,
  series: [
    {
      key: 'forecast.traffic',
      label: 'Traffic / sessions trend',
      method: 'moving-average',
      points: [],               // empty — NOT_CONNECTED
      status: 'NOT_CONNECTED',
      source: 'analytics_event_stream (Cloudflare Analytics Engine)',
      requiresEnvVar: ['CF_ANALYTICS_API_TOKEN', 'CF_ACCOUNT_ID'],
      evidence: [...]
    },
    { key: 'forecast.orders',        method: 'linear-trend',   points: [], status: 'NOT_CONNECTED' },
    { key: 'forecast.queue-growth',  method: 'moving-average', points: [], status: 'NOT_CONNECTED' },
    { key: 'forecast.merchant-growth', method: 'linear-trend', points: [], status: 'NOT_CONNECTED' },
  ],
  facts: [
    { kind: 'series-status', subject: 'traffic',          value: null, status: 'NOT_CONNECTED' },
    { kind: 'series-status', subject: 'orders',           value: null, status: 'NOT_CONNECTED' },
    { kind: 'series-status', subject: 'queue-growth',     value: null, status: 'NOT_CONNECTED' },
    { kind: 'series-status', subject: 'merchant-growth',  value: null, status: 'NOT_CONNECTED' },
    { kind: 'method-readiness', subject: 'math-functions', value: 'READY', status: 'CONNECTED' },
  ],
  findings: [
    {
      id: 'FORECAST-METHODS-READY',
      kind: 'forecast-readiness',
      severity: 'info',
      status: 'CONNECTED',  // the structural finding that methods are ready
      detail: 'All four deterministic forecast methods implemented and unit-tested. ...'
    }
  ],
  summary: 'Forecast service operational. 4 series declared. All NOT_CONNECTED: ...'
}
```

---

## 7. How to Connect Live Forecasts

When credentials are wired, the forecast workflow becomes:
1. Query the source (e.g., `SELECT date_trunc('month', created_at), count(*) FROM sites GROUP BY 1 ORDER BY 1`)
2. Map rows to `number[]` (monthly counts)
3. Call `linearTrend(series).forecast(3)` for 3-month projection
4. Wrap each forecast point in `confidenceInterval(series, point)` for lo/hi bounds
5. Return as `ForecastSeries.points[{at, value, lo, hi}]`

Required credentials per series:

| Series | Credentials |
|--------|------------|
| Traffic | `CF_ANALYTICS_API_TOKEN` + `CF_ACCOUNT_ID` |
| Orders/GMV | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| Queue growth | `CLOUDFLARE_API_TOKEN` + `CF_ACCOUNT_ID` |
| Merchant growth | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |

Minimum data threshold: ≥3 monthly data points before OLS trend is meaningful (more = better CI). The math functions handle 0 or 1 points gracefully (returning empty array or flat forecast) but the results have no statistical value.

---

## 8. Cross-References

- Source: `packages/lcis-operations/src/forecast/ForecastOperationsService.ts`
- Math: `packages/lcis-operations/src/forecast/methods.ts`
- Forecast discovery: `docs/lcis-operations/LCOS_FORECAST_DISCOVERY.md`
- Detectability matrix: `docs/lcis-operations/LCOS_DETECTABILITY_MATRIX.md`
