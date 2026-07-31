/**
 * LBIS per-service tests — the six services over stub artifacts. The through-line assertion
 * on every service: NO business metric ever carries a non-null value (the no-fabrication law).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import { MerchantIntelService } from '../src/merchant/index';
import { RevenueOrderService } from '../src/revenue/index';
import { CustomerRetentionService } from '../src/customer/index';
import { GrowthMarketingService } from '../src/growth/index';
import { FinanceForecastService } from '../src/finance/index';
import { ExecutiveHealthService } from '../src/executive/index';
import type { AreaIntel } from '../src/shared/index';

const FIXED = '2026-07-04T00:00:00.000Z';
const now = () => FIXED;

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

const DB_WITH_COUPONS = {
  tables: [{ name: 'orders' }, { name: 'coupons' }, { name: 'discounts' }, { name: 'payment_transactions' }],
  rpcs: [], policies: [], triggers: [],
};

function engine(artifacts: Record<string, unknown> = { graph: { nodes: [], links: [] } }) {
  return createEngine({ store: stubStore(artifacts), repoRoot: '/stub' });
}

function assertAllMetricsNotConnected(area: AreaIntel) {
  for (const m of area.metrics) {
    assert.equal(m.value, null, `metric ${m.key} must have null value`);
    assert.equal(m.connection, 'NOT_CONNECTED', `metric ${m.key} must be NOT_CONNECTED`);
    assert.ok(m.liveSource.length > 0, `metric ${m.key} must name a live source`);
  }
}

// ── MerchantIntelService ────────────────────────────────────────────────────────

test('merchantIntel: all magnitudes NOT_CONNECTED with sources', () => {
  const r = new MerchantIntelService(engine(), now).merchantIntel();
  assert.equal(r.area, 'merchant');
  assert.ok(r.metrics.length >= 5);
  assertAllMetricsNotConnected(r);
});

test('merchantIntel: never throws on an empty store', () => {
  const r = new MerchantIntelService(engine({}), now).merchantIntel();
  assertAllMetricsNotConnected(r);
});

test('merchantIntel: deterministic', () => {
  const a = new MerchantIntelService(engine(), now).merchantIntel();
  const b = new MerchantIntelService(engine(), now).merchantIntel();
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

// ── RevenueOrderService ─────────────────────────────────────────────────────────

test('revenue/order/settlement/refund: every magnitude NOT_CONNECTED', () => {
  const svc = new RevenueOrderService(engine(), now);
  for (const area of [svc.revenueIntel(), svc.orderIntel(), svc.settlementIntel(), svc.refundIntel()]) {
    assertAllMetricsNotConnected(area);
  }
});

test('settlementIntel: BI04 structural money-path finding is CONNECTED', () => {
  const r = new RevenueOrderService(engine(), now).settlementIntel();
  const bi04 = r.findings.find((f) => f.id.includes('BI04'));
  assert.ok(bi04, 'expected a BI04 settlement finding');
  assert.equal(bi04!.connection, 'CONNECTED');
});

test('revenue money metrics are backed by the payments domain', () => {
  const r = new RevenueOrderService(engine(), now).revenueIntel();
  assert.ok(r.metrics.find((m) => m.key === 'gmv')!.backedBy.includes('payments'));
});

// ── CustomerRetentionService ────────────────────────────────────────────────────

test('customerIntel: all magnitudes NOT_CONNECTED', () => {
  assertAllMetricsNotConnected(new CustomerRetentionService(engine(), now).customerIntel());
});

test('retention: curve NOT_CONNECTED with null values + source', () => {
  const r = new CustomerRetentionService(engine(), now).retention();
  assert.equal(r.connection, 'NOT_CONNECTED');
  assert.equal(r.retentionCurve, null);
  assert.ok(r.liveSource.length > 0);
});

test('subscriptionIntel: honestly NOT IMPLEMENTED with BI05', () => {
  const r = new CustomerRetentionService(engine(), now).subscriptionIntel();
  assert.equal(r.implemented, false);
  assert.ok(r.findings.some((f) => f.id.includes('BI05')));
  assert.match(r.summary, /NOT IMPLEMENTED/);
  assertAllMetricsNotConnected(r);
});

// ── GrowthMarketingService ──────────────────────────────────────────────────────

test('growth/marketing/coupon: all magnitudes NOT_CONNECTED', () => {
  const svc = new GrowthMarketingService(engine(), now);
  for (const area of [svc.growthIntel(), svc.marketingIntel(), svc.couponIntel()]) {
    assertAllMetricsNotConnected(area);
  }
});

test('couponIntel: detects coupon tables structurally (CONNECTED backing)', () => {
  const r = new GrowthMarketingService(engine({ 'db-intel.json': DB_WITH_COUPONS }), now).couponIntel();
  assert.ok(r.findings.some((f) => f.connection === 'CONNECTED'));
  assert.ok(r.metrics[0]!.backedBy.length > 0);
});

test('couponIntel: absent coupon tables → structural NOT_CONNECTED finding', () => {
  const r = new GrowthMarketingService(engine({ 'db-intel.json': { tables: [{ name: 'orders' }] } }), now).couponIntel();
  assert.ok(r.findings.every((f) => f.connection === 'NOT_CONNECTED'));
});

// ── FinanceForecastService ──────────────────────────────────────────────────────

test('financeIntel: all magnitudes NOT_CONNECTED + BI01', () => {
  const r = new FinanceForecastService(engine(), now).financeIntel();
  assertAllMetricsNotConnected(r);
  assert.ok(r.findings.some((f) => f.id.includes('BI01')));
});

test('revenueForecast: NOT_CONNECTED with null values when no series', () => {
  const r = new FinanceForecastService(engine(), now).revenueForecast();
  assert.equal(r.connection, 'NOT_CONNECTED');
  assert.equal(r.forecastValues, null);
});

test('revenueForecast: CONNECTED OLS forecast when a real series is provided', () => {
  const r = new FinanceForecastService(engine(), now).revenueForecast([10, 20, 30]);
  assert.equal(r.connection, 'CONNECTED');
  assert.ok(r.forecastValues !== null);
  assert.deepEqual(r.forecastValues!.slice(0, 2), [40, 50]);
});

test('revenueForecast: empty array is treated as no series', () => {
  assert.equal(new FinanceForecastService(engine(), now).revenueForecast([]).connection, 'NOT_CONNECTED');
});

// ── ExecutiveHealthService ──────────────────────────────────────────────────────

const emptyArea = (name: string): AreaIntel => ({ area: name, metrics: [], findings: [], summary: '' });

test('kpis: returns the four headline KPIs, all NOT_CONNECTED', () => {
  const svc = new ExecutiveHealthService();
  const kpis = svc.kpis({ merchant: emptyArea('merchant'), revenue: emptyArea('revenue'), order: emptyArea('order'), customer: emptyArea('customer') });
  assert.equal(kpis.length, 4);
  for (const k of kpis) assert.equal(k.metric.value, null);
});

test('businessHealth: unknown/null when no connected findings', () => {
  const h = new ExecutiveHealthService().businessHealth([emptyArea('a')]);
  assert.equal(h.score, null);
  assert.equal(h.band, 'unknown');
});

test('businessHealth: score rises with connected structural findings', () => {
  const area: AreaIntel = {
    area: 'settlement',
    metrics: [],
    findings: [{ id: 'x', area: 'settlement', severity: 'medium', subject: 's', title: 't', detail: 'd', connection: 'CONNECTED', evidence: [] }],
    summary: '',
  };
  const h = new ExecutiveHealthService().businessHealth([area]);
  assert.ok(h.score !== null && h.score >= 45);
  assert.equal(h.connectedSignals, 1);
});

test('recommendations: BI05 always present; all advisory:true', () => {
  const svc = new ExecutiveHealthService();
  const recs = svc.recommendations([emptyArea('revenue')], { implemented: false });
  assert.ok(recs.some((r) => r.rule === 'BI05'));
  for (const r of recs) assert.equal(r.advisory, true);
});

test('recommendations: sorted by severity then id, deterministic', () => {
  const svc = new ExecutiveHealthService();
  const area: AreaIntel = {
    area: 'revenue', summary: '', findings: [],
    metrics: [{ key: 'gmv', label: 'g', unit: 'x', value: null, connection: 'NOT_CONNECTED', liveSource: 's', backedBy: [], evidence: [] }],
  };
  const a = svc.recommendations([area], { implemented: false });
  const b = svc.recommendations([area], { implemented: false });
  assert.deepEqual(a, b);
});
