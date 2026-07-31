/**
 * BusinessIntelligenceEngine (LBIS facade) tests — the flagship report composition, the
 * no-fabrication ledger (notConnectedMetrics), the honest subscription NOT_IMPLEMENTED,
 * determinism, and provenance.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import {
  createBusinessIntelligenceEngine,
  getBusinessIntelligenceEngine,
  resetBusinessIntelligenceEngine,
} from '../src/index';

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
  graph: { nodes: [], links: [] },
  'domain-intel.json': { domains: [{ key: 'orders', dependsOn: [], tables: ['orders'], rpcs: [], owners: [] }] },
  'db-intel.json': { tables: [{ name: 'orders' }, { name: 'coupons' }, { name: 'payment_transactions' }], rpcs: [], policies: [], triggers: [] },
  'infra-intel.json': { workers: [], queues: [], routes: [] },
};

function engine(artifacts: Record<string, unknown> = FIXTURES) {
  const core = createEngine({ store: stubStore(artifacts), repoRoot: '/stub' });
  return createBusinessIntelligenceEngine({ core, now: () => FIXED });
}

test('engine exposes the six services; singleton get/reset works', () => {
  const e = engine();
  for (const svc of ['merchant', 'revenue', 'customer', 'growth', 'finance', 'executive'] as const) {
    assert.ok(e[svc], `service ${svc} missing`);
  }
  resetBusinessIntelligenceEngine();
  const core = createEngine({ store: stubStore({}), repoRoot: '/stub' });
  const a = getBusinessIntelligenceEngine({ core, now: () => FIXED });
  assert.equal(getBusinessIntelligenceEngine(), a);
  resetBusinessIntelligenceEngine();
});

test('report composes all 11 area intels + KPIs + health', () => {
  const r = engine().generateBusinessReport();
  for (const k of ['merchant', 'revenue', 'order', 'customer', 'subscription', 'settlement', 'refund', 'coupon', 'growth', 'marketing', 'finance'] as const) {
    assert.ok(r[k], `area ${k} missing`);
  }
  assert.ok(r.executiveKpis.length >= 4);
  assert.equal(r.businessHealth.area, 'business');
  assert.equal(r.merchantHealth.area, 'merchant');
});

test('report is honest: every business magnitude across every area is NOT_CONNECTED', () => {
  const r = engine().generateBusinessReport();
  const areas = [r.merchant, r.revenue, r.order, r.customer, r.subscription, r.settlement, r.refund, r.coupon, r.growth, r.marketing, r.finance];
  let total = 0;
  for (const a of areas) {
    for (const m of a.metrics) {
      assert.equal(m.value, null, `metric ${m.key} must be null`);
      total++;
    }
  }
  assert.equal(r.notConnectedMetrics + countConnected(areas), total);
  assert.equal(countConnected(areas), 0, 'no business metric may be CONNECTED (no source wired)');
});

function countConnected(areas: readonly { metrics: readonly { connection: string }[] }[]): number {
  return areas.reduce((n, a) => n + a.metrics.filter((m) => m.connection === 'CONNECTED').length, 0);
}

test('subscription is honestly NOT IMPLEMENTED', () => {
  const r = engine().generateBusinessReport();
  assert.equal(r.subscription.implemented, false);
  assert.match(r.summary, /NOT IMPLEMENTED/);
});

test('revenue forecast is NOT_CONNECTED at the facade level (no series wired)', () => {
  const r = engine().generateBusinessReport();
  assert.equal(r.revenueForecast.connection, 'NOT_CONNECTED');
  assert.equal(r.revenueForecast.forecastValues, null);
});

test('recommendations are all advisory and include BI05', () => {
  const r = engine().generateBusinessReport();
  assert.ok(r.recommendations.length > 0);
  for (const rec of r.recommendations) assert.equal(rec.advisory, true);
  assert.ok(r.recommendations.some((rec) => rec.rule === 'BI05'));
});

test('report carries provenance: fixed timestamp, evidence, liveConnected false', () => {
  const r = engine().generateBusinessReport();
  assert.equal(r.timestamp, FIXED);
  assert.equal(r.liveConnected, false);
  assert.ok(r.evidence.length > 0);
  assert.match(r.summary, /No business number is fabricated/);
});

test('empty store: report never throws and stays honest', () => {
  const r = engine({ graph: { nodes: [], links: [] } }).generateBusinessReport();
  assert.equal(r.subscription.implemented, false);
  assert.ok(r.notConnectedMetrics > 0);
});

test('deterministic replay: identical fixtures → byte-identical report', () => {
  const a = engine().generateBusinessReport();
  const b = engine().generateBusinessReport();
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});
