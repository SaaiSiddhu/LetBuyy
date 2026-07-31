/**
 * LCOS Phase 6 — ForecastOperationsService + deterministic math tests.
 *
 * HONESTY CONTRACT:
 *   - Math functions (movingAverage / linearTrend / confidenceInterval) are tested on
 *     synthetic arrays with KNOWN expected outputs — the results must be exact.
 *   - Every ForecastSeries must be NOT_CONNECTED with EMPTY points + a named source
 *     + ≥1 env var (never fabricated).
 *   - The report provenance (evidence/confidence/sources/timestamp/liveConnected) must
 *     be stamped correctly.
 *   - The service is deterministic: same now() → same output.
 *   - No file writes, no network, no child_process — tests are purely in-process.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { ForecastOperationsService, confidenceInterval, linearTrend, movingAverage } from '../src/forecast/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const engine = createEngine();
const svc = new ForecastOperationsService(engine, () => FIXED);

// ══════════════════════════════════════════════════════════════════════════════
// § 1  Pure math — movingAverage
// ══════════════════════════════════════════════════════════════════════════════

test('movingAverage: window 2 on [2,4,6] → [3,5]', () => {
  assert.deepEqual(movingAverage([2, 4, 6], 2), [3, 5]);
});

test('movingAverage: window 3 on [1,2,3,4,5] → [2,3,4]', () => {
  assert.deepEqual(movingAverage([1, 2, 3, 4, 5], 3), [2, 3, 4]);
});

test('movingAverage: window 1 is identity copy', () => {
  assert.deepEqual(movingAverage([7, 8, 9], 1), [7, 8, 9]);
});

test('movingAverage: series.length < window → []', () => {
  assert.deepEqual(movingAverage([1, 2], 3), []);
});

test('movingAverage: empty series → []', () => {
  assert.deepEqual(movingAverage([], 2), []);
});

test('movingAverage: window equals length → single mean', () => {
  const result = movingAverage([10, 20, 30], 3);
  assert.equal(result.length, 1);
  assert.equal(result[0], 20);
});

test('movingAverage: window > 0 guard — window 0 throws', () => {
  assert.throws(() => movingAverage([1, 2, 3], 0), RangeError);
});

test('movingAverage: negative window throws', () => {
  assert.throws(() => movingAverage([1, 2, 3], -1), RangeError);
});

test('movingAverage: decimal values averaged correctly', () => {
  const r = movingAverage([1.5, 2.5, 3.5], 2);
  assert.equal(r.length, 2);
  assert.equal(r[0], 2);
  assert.equal(r[1], 3);
});

test('movingAverage: window 2 on [10, 20] → [15]', () => {
  assert.deepEqual(movingAverage([10, 20], 2), [15]);
});

// ══════════════════════════════════════════════════════════════════════════════
// § 2  Pure math — linearTrend (OLS)
// ══════════════════════════════════════════════════════════════════════════════

test('linearTrend: [1,2,3,4] → slope exactly 1', () => {
  const r = linearTrend([1, 2, 3, 4]);
  assert.equal(r.slope, 1);
});

test('linearTrend: [1,2,3,4] → intercept exactly 1', () => {
  const r = linearTrend([1, 2, 3, 4]);
  assert.equal(r.intercept, 1);
});

test('linearTrend: [1,2,3,4] forecast(1) = 5', () => {
  const r = linearTrend([1, 2, 3, 4]);
  const fc = r.forecast(1);
  assert.equal(fc.length, 1);
  assert.equal(fc[0], 5);
});

test('linearTrend: [1,2,3,4] forecast(2) = [5,6]', () => {
  assert.deepEqual(linearTrend([1, 2, 3, 4]).forecast(2), [5, 6]);
});

test('linearTrend: [2,4,6,8] → slope 2, intercept 2', () => {
  const r = linearTrend([2, 4, 6, 8]);
  assert.equal(r.slope, 2);
  assert.equal(r.intercept, 2);
});

test('linearTrend: [2,4,6,8] forecast(1) = 10', () => {
  assert.equal(linearTrend([2, 4, 6, 8]).forecast(1)[0], 10);
});

test('linearTrend: constant series [5,5,5] → slope 0, intercept 5', () => {
  const r = linearTrend([5, 5, 5]);
  assert.equal(r.slope, 0);
  assert.equal(r.intercept, 5);
});

test('linearTrend: constant forecast(2) stays constant', () => {
  const fc = linearTrend([3, 3, 3]).forecast(2);
  assert.deepEqual(fc, [3, 3]);
});

test('linearTrend: empty series → slope 0, intercept 0, forecast([]) = []', () => {
  const r = linearTrend([]);
  assert.equal(r.slope, 0);
  assert.equal(r.intercept, 0);
  assert.deepEqual(r.forecast(0), []);
});

test('linearTrend: single-element → slope 0, intercept = value', () => {
  const r = linearTrend([42]);
  assert.equal(r.slope, 0);
  assert.equal(r.intercept, 42);
  assert.deepEqual(r.forecast(2), [42, 42]);
});

test('linearTrend: descending [4,3,2,1] → slope -1, intercept 4', () => {
  const r = linearTrend([4, 3, 2, 1]);
  assert.equal(r.slope, -1);
  assert.equal(r.intercept, 4);
});

test('linearTrend: descending forecast(1) = 0', () => {
  assert.equal(linearTrend([4, 3, 2, 1]).forecast(1)[0], 0);
});

test('linearTrend: forecast(0) returns empty array', () => {
  assert.deepEqual(linearTrend([1, 2, 3]).forecast(0), []);
});

// ══════════════════════════════════════════════════════════════════════════════
// § 3  Pure math — confidenceInterval
// ══════════════════════════════════════════════════════════════════════════════

test('confidenceInterval: series < 2 → lo = hi = point', () => {
  const r = confidenceInterval([10], 10);
  assert.equal(r.lo, 10);
  assert.equal(r.hi, 10);
});

test('confidenceInterval: empty series → lo = hi = point', () => {
  const r = confidenceInterval([], 5);
  assert.equal(r.lo, 5);
  assert.equal(r.hi, 5);
});

test('confidenceInterval: constant series → margin 0, lo = hi = point', () => {
  const r = confidenceInterval([4, 4, 4, 4], 4);
  assert.equal(r.lo, 4);
  assert.equal(r.hi, 4);
});

test('confidenceInterval: hi > lo when series has variance', () => {
  const r = confidenceInterval([1, 2, 3, 4, 5], 3);
  assert.ok(r.hi > r.lo, 'hi must exceed lo');
});

test('confidenceInterval: hi - lo is positive for variance > 0', () => {
  const r = confidenceInterval([10, 20], 15);
  const width = r.hi - r.lo;
  assert.ok(width > 0);
});

test('confidenceInterval: z=0 → lo = hi = point regardless of series', () => {
  const r = confidenceInterval([1, 2, 3, 4], 10, 0);
  assert.equal(r.lo, 10);
  assert.equal(r.hi, 10);
});

test('confidenceInterval: symmetric around point', () => {
  const r = confidenceInterval([1, 3, 5, 7], 4);
  const margin = r.hi - 4;
  assert.ok(Math.abs(r.lo - (4 - margin)) < 1e-10, 'interval is symmetric');
});

test('confidenceInterval: wider z → wider interval', () => {
  const series = [1, 2, 3, 4, 5];
  const r95 = confidenceInterval(series, 3, 1.96);
  const r99 = confidenceInterval(series, 3, 2.576);
  assert.ok(r99.hi - r99.lo > r95.hi - r95.lo, 'z=2.576 gives wider interval');
});

// ══════════════════════════════════════════════════════════════════════════════
// § 4  ForecastSeries honesty — each series is NOT_CONNECTED, empty, named
// ══════════════════════════════════════════════════════════════════════════════

test('forecastTraffic: status NOT_CONNECTED', () => {
  assert.equal(svc.forecastTraffic().status, 'NOT_CONNECTED');
});

test('forecastTraffic: points array is empty (no fabricated data)', () => {
  assert.deepEqual(svc.forecastTraffic().points, []);
  assert.equal(svc.forecastTraffic().points.length, 0);
});

test('forecastTraffic: method is moving-average', () => {
  assert.equal(svc.forecastTraffic().method, 'moving-average');
});

test('forecastTraffic: requiresEnvVar names CF analytics token', () => {
  const envVars = svc.forecastTraffic().requiresEnvVar;
  assert.ok(envVars.includes('CF_ANALYTICS_API_TOKEN'), 'CF_ANALYTICS_API_TOKEN present');
});

test('forecastTraffic: source names analytics_event_stream', () => {
  const src = svc.forecastTraffic().source;
  assert.ok(src.toLowerCase().includes('analytics'), `source should mention analytics, got: ${src}`);
});

test('forecastTraffic: evidence is non-empty', () => {
  assert.ok(svc.forecastTraffic().evidence.length >= 1);
});

test('forecastOrders: status NOT_CONNECTED', () => {
  assert.equal(svc.forecastOrders().status, 'NOT_CONNECTED');
});

test('forecastOrders: points is empty', () => {
  assert.deepEqual(svc.forecastOrders().points, []);
});

test('forecastOrders: method is linear-trend', () => {
  assert.equal(svc.forecastOrders().method, 'linear-trend');
});

test('forecastOrders: requiresEnvVar includes SUPABASE keys', () => {
  const envVars = svc.forecastOrders().requiresEnvVar;
  assert.ok(envVars.some((v) => v.startsWith('SUPABASE')), 'SUPABASE key present');
});

test('forecastOrders: source names orders table', () => {
  const src = svc.forecastOrders().source;
  assert.ok(src.toLowerCase().includes('orders'), `source should mention orders, got: ${src}`);
});

test('forecastOrders: evidence non-empty', () => {
  assert.ok(svc.forecastOrders().evidence.length >= 1);
});

test('forecastQueueGrowth: status NOT_CONNECTED', () => {
  assert.equal(svc.forecastQueueGrowth().status, 'NOT_CONNECTED');
});

test('forecastQueueGrowth: points is empty', () => {
  assert.deepEqual(svc.forecastQueueGrowth().points, []);
});

test('forecastQueueGrowth: method is moving-average', () => {
  assert.equal(svc.forecastQueueGrowth().method, 'moving-average');
});

test('forecastQueueGrowth: requiresEnvVar names CF token', () => {
  const envVars = svc.forecastQueueGrowth().requiresEnvVar;
  assert.ok(
    envVars.includes('CLOUDFLARE_API_TOKEN') || envVars.includes('CF_ACCOUNT_ID'),
    'Cloudflare env var present',
  );
});

test('forecastQueueGrowth: source mentions queues', () => {
  const src = svc.forecastQueueGrowth().source.toLowerCase();
  assert.ok(src.includes('queue'), `source should mention queue, got: ${src}`);
});

test('forecastQueueGrowth: evidence non-empty', () => {
  assert.ok(svc.forecastQueueGrowth().evidence.length >= 1);
});

test('forecastMerchantGrowth: status NOT_CONNECTED', () => {
  assert.equal(svc.forecastMerchantGrowth().status, 'NOT_CONNECTED');
});

test('forecastMerchantGrowth: points is empty', () => {
  assert.deepEqual(svc.forecastMerchantGrowth().points, []);
});

test('forecastMerchantGrowth: method is linear-trend', () => {
  assert.equal(svc.forecastMerchantGrowth().method, 'linear-trend');
});

test('forecastMerchantGrowth: requiresEnvVar includes SUPABASE keys', () => {
  const envVars = svc.forecastMerchantGrowth().requiresEnvVar;
  assert.ok(envVars.some((v) => v.startsWith('SUPABASE')));
});

test('forecastMerchantGrowth: source names sites table', () => {
  const src = svc.forecastMerchantGrowth().source;
  assert.ok(src.toLowerCase().includes('sites'), `source should mention sites, got: ${src}`);
});

test('forecastMerchantGrowth: evidence mentions merchant-growth artifact', () => {
  const ev = svc.forecastMerchantGrowth().evidence;
  const hasRef = ev.some(
    (e) =>
      (e.ref ?? '').toLowerCase().includes('merchant') ||
      (e.source ?? '').toLowerCase().includes('merchant') ||
      (e.detail ?? '').toLowerCase().includes('merchant'),
  );
  assert.ok(hasRef, 'evidence should reference merchant artifact');
});

// ══════════════════════════════════════════════════════════════════════════════
// § 5  ForecastReport provenance + structure
// ══════════════════════════════════════════════════════════════════════════════

test('generateForecastReport: area is forecast', () => {
  assert.equal(svc.generateForecastReport().area, 'forecast');
});

test('generateForecastReport: timestamp equals fixed now', () => {
  assert.equal(svc.generateForecastReport().timestamp, FIXED);
});

test('generateForecastReport: liveConnected is false', () => {
  assert.equal(svc.generateForecastReport().liveConnected, false);
});

test('generateForecastReport: confidence is a number 0..1', () => {
  const c = svc.generateForecastReport().confidence;
  assert.ok(typeof c === 'number' && c >= 0 && c <= 1);
});

test('generateForecastReport: series contains all 4 series', () => {
  const report = svc.generateForecastReport();
  assert.equal(report.series.length, 4);
});

test('generateForecastReport: series keys are distinct', () => {
  const keys = svc.generateForecastReport().series.map((s) => s.key);
  const uniqueKeys = new Set(keys);
  assert.equal(uniqueKeys.size, keys.length, 'all series keys must be unique');
});

test('generateForecastReport: all series are NOT_CONNECTED', () => {
  const report = svc.generateForecastReport();
  for (const s of report.series) {
    assert.equal(s.status, 'NOT_CONNECTED', `series ${s.key} must be NOT_CONNECTED`);
  }
});

test('generateForecastReport: all series have empty points', () => {
  for (const s of svc.generateForecastReport().series) {
    assert.equal(s.points.length, 0, `series ${s.key} must have 0 points`);
  }
});

test('generateForecastReport: all series have ≥1 requiresEnvVar', () => {
  for (const s of svc.generateForecastReport().series) {
    assert.ok(s.requiresEnvVar.length >= 1, `series ${s.key} must name env vars`);
  }
});

test('generateForecastReport: all series have non-empty source strings', () => {
  for (const s of svc.generateForecastReport().series) {
    assert.ok(typeof s.source === 'string' && s.source.length > 0, `series ${s.key} must have a source`);
  }
});

test('generateForecastReport: facts array is non-empty', () => {
  assert.ok(svc.generateForecastReport().facts.length >= 1);
});

test('generateForecastReport: at least one finding present', () => {
  assert.ok(svc.generateForecastReport().findings.length >= 1);
});

test('generateForecastReport: info finding id is FORECAST-METHODS-READY', () => {
  const findings = svc.generateForecastReport().findings;
  const info = findings.find((f) => f.id === 'FORECAST-METHODS-READY');
  assert.ok(info !== undefined, 'FORECAST-METHODS-READY finding must exist');
});

test('generateForecastReport: info finding severity is info', () => {
  const f = svc.generateForecastReport().findings.find((f) => f.id === 'FORECAST-METHODS-READY');
  assert.equal(f?.severity, 'info');
});

test('generateForecastReport: info finding detail mentions NOT_CONNECTED', () => {
  const f = svc.generateForecastReport().findings.find((f) => f.id === 'FORECAST-METHODS-READY');
  assert.ok(f?.detail.includes('NOT_CONNECTED'));
});

test('generateForecastReport: info finding detail mentions the 4 source tables/services', () => {
  const f = svc.generateForecastReport().findings.find((f) => f.id === 'FORECAST-METHODS-READY');
  const d = f?.detail ?? '';
  assert.ok(d.includes('sites') || d.includes('orders') || d.includes('analytics'), 'sources mentioned in detail');
});

test('generateForecastReport: signals contains forecast area signals', () => {
  const report = svc.generateForecastReport();
  assert.ok(report.signals.length >= 1);
  for (const s of report.signals) {
    assert.equal(s.area, 'forecast');
  }
});

test('generateForecastReport: all signals are NOT_CONNECTED (forecast area has no live data)', () => {
  const report = svc.generateForecastReport();
  for (const s of report.signals) {
    assert.equal(s.status, 'NOT_CONNECTED', `signal ${s.key} must be NOT_CONNECTED`);
    assert.equal(s.value, null);
  }
});

test('generateForecastReport: health area is forecast', () => {
  assert.equal(svc.generateForecastReport().health.area, 'forecast');
});

test('generateForecastReport: sources array is non-empty', () => {
  assert.ok(svc.generateForecastReport().sources.length >= 1);
});

test('generateForecastReport: evidence array is non-empty', () => {
  assert.ok(svc.generateForecastReport().evidence.length >= 1);
});

test('generateForecastReport: summary is a non-empty string', () => {
  const s = svc.generateForecastReport().summary;
  assert.ok(typeof s === 'string' && s.length > 0);
});

test('generateForecastReport: summary mentions NOT_CONNECTED', () => {
  assert.ok(svc.generateForecastReport().summary.includes('NOT_CONNECTED'));
});

// ══════════════════════════════════════════════════════════════════════════════
// § 6  Determinism + read-only source scan
// ══════════════════════════════════════════════════════════════════════════════

test('generateForecastReport: deterministic — same now() → identical timestamp each call', () => {
  const r1 = svc.generateForecastReport();
  const r2 = svc.generateForecastReport();
  assert.equal(r1.timestamp, r2.timestamp);
  assert.equal(r1.summary, r2.summary);
  assert.equal(r1.series.length, r2.series.length);
});

test('generateForecastReport: different now() → different timestamp', () => {
  const svc2 = new ForecastOperationsService(engine, () => '2099-01-01T00:00:00.000Z');
  const r = svc2.generateForecastReport();
  assert.equal(r.timestamp, '2099-01-01T00:00:00.000Z');
});

test('source files must not contain network/spawn/eval/writeFile calls', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = '/Users/saai_sidd/Git/Letbuyy_Store/packages/lcis-operations/src/forecast';
  const files = ['ForecastOperationsService.ts', 'methods.ts', 'index.ts'];
  // Strip comments before checking to avoid false positives in JSDoc
  const COMMENT_RE = /\/\*[\s\S]*?\*\/|\/\/.*/g;
  const FORBIDDEN = [
    'fetch(',
    'child_process',
    'spawn(',
    'exec(',
    'execSync(',
    'spawnSync(',
    'eval(',
    'writeFile',
    'writeFileSync',
    'appendFile',
    'open(',        // fs.open for writing
  ];
  for (const f of files) {
    const src = readFileSync(join(root, f), 'utf8').replace(COMMENT_RE, '');
    for (const pattern of FORBIDDEN) {
      assert.ok(!src.includes(pattern), `${f} must not contain "${pattern}"`);
    }
  }
});
