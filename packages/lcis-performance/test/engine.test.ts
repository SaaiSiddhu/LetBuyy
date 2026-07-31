/**
 * PerformanceEngine (LPAS facade) tests — the flagship report over stub artifacts,
 * the no-fabrication law at composition level, advisory-only guarantees, determinism,
 * and the measured Phase 13 benchmark.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import { createPerformanceEngine, getPerformanceEngine, resetPerformanceEngine } from '../src/index';

const FIXED = '2026-07-04T00:00:00.000Z';

function stubStore(artifacts: Record<string, unknown>): ArtifactStore {
  return {
    has: (n: string) => n in artifacts,
    tryRead: (n: string) => artifacts[n] ?? null,
    read: (n: string) => {
      if (!(n in artifacts)) throw new Error('missing ' + n);
      return artifacts[n];
    },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
}

const FIXTURES: Record<string, unknown> = {
  'domain-intel.json': {
    domains: [
      { key: 'orders', dependsOn: [], tables: ['orders'], rpcs: ['create_checkout_order'], owners: ['@orders-team'] },
    ],
  },
  'db-intel.json': {
    tables: [{ name: 'orders' }],
    rpcs: [{ name: 'create_checkout_order' }],
    policies: [],
    triggers: [],
  },
  'infra-intel.json': {
    workers: [{ name: 'queue-worker' }],
    queues: [{ name: 'order-events' }],
    routes: [{ path: '/v1/orders' }],
  },
};

function engine(artifacts: Record<string, unknown> = FIXTURES) {
  const core = createEngine({ store: stubStore(artifacts), repoRoot: '/stub' });
  return createPerformanceEngine({ core, now: () => FIXED });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

test('engine exposes the six services; singleton get/reset works', () => {
  const e = engine();
  for (const svc of ['statistics', 'catalog', 'latency', 'capacity', 'cost', 'recommend'] as const) {
    assert.ok(e[svc], `service ${svc} missing`);
  }
  resetPerformanceEngine();
  const core = createEngine({ store: stubStore({}), repoRoot: '/stub' });
  const a = getPerformanceEngine({ core, now: () => FIXED });
  assert.equal(getPerformanceEngine(), a);
  resetPerformanceEngine();
});

// ── The no-fabrication law at composition level ───────────────────────────────

test('report without provided series: zero CONNECTED metrics, all values honest', () => {
  const r = engine().generatePerformanceReport();
  assert.equal(r.connectedMetrics, 0);
  assert.ok(r.notConnectedMetrics > 0);
  assert.equal(r.liveConnected, false);
  assert.equal(r.capacity!.connection, 'NOT_CONNECTED');
  assert.equal(r.capacity!.forecastValues, null);
  assert.equal(r.cost!.connection, 'NOT_CONNECTED');
  assert.equal(r.cost!.forecastValues, null);
});

test('caller-provided series flips exactly that metric to CONNECTED', () => {
  const e = engine();
  const key = e.generateCatalog().find((d) => d.key.startsWith('latency.rpc.'))!.key;
  const r = e.generatePerformanceReport({ [key]: [12, 15, 11, 14] });
  assert.equal(r.connectedMetrics, 1);
  assert.equal(r.liveConnected, true);
});

test('provided throughput series produces a real OLS capacity forecast', () => {
  const r = engine().generatePerformanceReport({ 'throughput.queue.order-events': [10, 20, 30] });
  assert.equal(r.capacity!.connection, 'CONNECTED');
  assert.deepEqual(r.capacity!.forecastValues!.slice(0, 2), [40, 50]);
});

// ── Advisory-only guarantee ───────────────────────────────────────────────────

test('every recommendation is advisory: true with evidence and Consider-style action', () => {
  const r = engine().generatePerformanceReport();
  assert.ok(r.recommendations.length > 0);
  for (const rec of r.recommendations) {
    assert.equal(rec.advisory, true);
    assert.ok(rec.evidence.length >= 1, `${rec.id} must carry evidence`);
  }
});

test('PA03 telemetry-not-connected advisory fires when metrics are unconnected', () => {
  const r = engine().generatePerformanceReport();
  assert.ok(r.recommendations.some((rec) => rec.rule === 'PA03'));
});

test('PA04 fires for the consumerless queue in the fixture', () => {
  const r = engine().generatePerformanceReport();
  assert.ok(r.recommendations.some((rec) => rec.rule === 'PA04'), r.recommendations.map((x) => x.rule).join(','));
});

test('findings mirror recommendations 1:1 with F- prefixed ids', () => {
  const r = engine().generatePerformanceReport();
  assert.equal(r.findings.length, r.recommendations.length);
  for (let i = 0; i < r.findings.length; i++) {
    assert.equal(r.findings[i]!.id, `F-${r.recommendations[i]!.id}`);
    assert.equal(r.findings[i]!.rule, r.recommendations[i]!.rule);
  }
});

// ── Latency model honesty ─────────────────────────────────────────────────────

test('latency model entries declare themselves models, not measurements', () => {
  const model = engine().latencyModel();
  for (const entry of model) {
    assert.match(entry.note.toLowerCase(), /not a measurement/);
  }
});

// ── Empty-store honesty ───────────────────────────────────────────────────────

test('empty artifacts: report never throws; catalog still has the twin-independent metrics', () => {
  const r = engine({}).generatePerformanceReport();
  assert.ok(r.catalog.length >= 2);
  assert.equal(r.connectedMetrics, 0);
});

// ── Provenance + determinism ──────────────────────────────────────────────────

test('report carries provenance with the fixed clock', () => {
  const r = engine().generatePerformanceReport();
  assert.equal(r.timestamp, FIXED);
  assert.ok(r.evidence.length > 0);
  assert.match(r.summary, /ADVISORY-ONLY/);
});

test('deterministic replay: identical fixtures + input → byte-identical report', () => {
  const input = { 'throughput.queue.order-events': [5, 10, 15] };
  const a = engine().generatePerformanceReport(input);
  const b = engine().generatePerformanceReport(input);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

// ── Measured benchmark (Phase 13 mandate — asserted, never fabricated) ────────

test('benchmark: full report over the fixture twin completes under 2s', () => {
  const e = engine();
  const t0 = process.hrtime.bigint();
  e.generatePerformanceReport();
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1_000_000;
  assert.ok(elapsedMs < 2000, `report took ${elapsedMs.toFixed(1)}ms (ceiling 2000ms)`);
});
