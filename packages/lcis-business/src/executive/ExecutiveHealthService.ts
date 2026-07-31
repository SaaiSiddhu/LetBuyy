/**
 * ExecutiveHealthService — pure, deterministic executive KPIs, business/merchant health,
 * and advisory recommendations. No constructor dependencies; no clock; no IO.
 *
 * THE NO-FABRICATION LAW: every BusinessMetric.value is null / NOT_CONNECTED. Structural
 * relationships are CONNECTED via backedBy + evidence. This service measures structural
 * readiness, NOT business performance — documented on every HealthBand result.
 */
import { evidence, notConnected } from '@letbuyy/lcis-core';
import { BUSINESS_RULES } from '../shared/rules';
import type {
  AreaIntel,
  BusinessHealth,
  BusinessMetric,
  BusinessRecommendation,
  ExecutiveKpi,
  HealthBand,
  SubscriptionIntel,
} from '../shared/types';

// ─── Public input shape ──────────────────────────────────────────────────────

export interface ExecutiveKpiInput {
  merchant: AreaIntel;
  revenue: AreaIntel;
  order: AreaIntel;
  customer: AreaIntel;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a NOT_CONNECTED placeholder metric when a key is absent from an area. */
function syntheticMetric(key: string, label: string, unit: string, backedBy: readonly string[], liveSource: string): BusinessMetric {
  return {
    key,
    label,
    unit,
    value: null,
    connection: 'NOT_CONNECTED',
    liveSource,
    backedBy,
    evidence: [
      notConnected(key, liveSource),
    ],
  };
}

/** Resolve a metric by key from an area; synthesize NOT_CONNECTED if missing. */
function pickMetric(area: AreaIntel, key: string, label: string, unit: string, backedBy: readonly string[], liveSource: string): BusinessMetric {
  const found = area.metrics.find((m) => m.key === key);
  return found ?? syntheticMetric(key, label, unit, backedBy, liveSource);
}

function band(score: number | null): HealthBand {
  if (score === null) return 'unknown';
  if (score >= 80) return 'healthy';
  if (score >= 50) return 'degraded';
  return 'failing';
}

/**
 * Compute structural health over a set of areas.
 *
 * Business metrics are NOT_CONNECTED by law, so we count FINDINGS with CONNECTED status as
 * "connected structural signals" — they represent structurally-proven facts. NOT_CONNECTED
 * metrics are the "not connected" signal count.
 *
 * Score rule: connectedSignals > 0 ? min(100, 40 + 5 * connectedSignals) : null
 * This measures STRUCTURAL readiness (topology/findings), NOT business performance.
 */
function computeHealth(area: 'business' | 'merchant', areas: readonly AreaIntel[]): BusinessHealth {
  let connectedSignals = 0;
  let notConnectedSignals = 0;

  const driverMap: Map<string, number> = new Map();

  for (const a of areas) {
    // Count CONNECTED findings as positive structural signals
    for (const f of a.findings) {
      if (f.connection === 'CONNECTED') {
        connectedSignals++;
      }
    }
    // Count NOT_CONNECTED metrics as negative structural signals (honest gap)
    const ncMetrics = a.metrics.filter((m) => m.connection === 'NOT_CONNECTED').length;
    notConnectedSignals += ncMetrics;
    if (ncMetrics > 0) {
      driverMap.set(a.area, (driverMap.get(a.area) ?? 0) + ncMetrics);
    }
  }

  const score: number | null = connectedSignals > 0
    ? Math.min(100, 40 + 5 * connectedSignals)
    : null;

  // Sort drivers by NOT_CONNECTED count descending, take top 3
  const drivers = [...driverMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([areaName]) => areaName);

  return {
    area,
    score,
    band: band(score),
    connectedSignals,
    notConnectedSignals,
    drivers,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ExecutiveHealthService {
  /** Pure constructor — no dependencies, no clock. */
  constructor() {
    // intentionally empty — pure deterministic service
  }

  /**
   * kpis — one ExecutiveKpi per headline KPI:
   *   merchant-count, gmv, order-count, conversion-rate
   * Each metric is NOT_CONNECTED (the no-fabrication law).
   */
  kpis(input: ExecutiveKpiInput): readonly ExecutiveKpi[] {
    const merchantMetric = pickMetric(
      input.merchant,
      'merchant-count',
      'Active merchants',
      'count',
      ['sites', 'merchant domain'],
      'supabase:sites table / merchant telemetry',
    );

    const revenueMetric = pickMetric(
      input.revenue,
      'gmv',
      'Gross Merchandise Value',
      'INR',
      ['orders', 'order_items', 'payment_transactions', 'revenue domain'],
      'supabase:orders + payment_transactions / analytics ledger',
    );

    const orderMetric = pickMetric(
      input.order,
      'order-count',
      'Total orders',
      'count',
      ['orders', 'order_items', 'order domain'],
      'supabase:orders table / analytics pipeline',
    );

    const customerMetric = pickMetric(
      input.customer,
      'conversion-rate',
      'Checkout conversion rate',
      '%',
      ['store_customers', 'orders', 'customer domain'],
      'customer-event telemetry / analytics funnel',
    );

    const makeNote = (m: BusinessMetric): string =>
      `Structurally backed by ${m.backedBy.join(', ')}; value NOT_CONNECTED (${m.liveSource})`;

    return [
      { key: 'merchant-count', label: 'Active merchants',            metric: merchantMetric, note: makeNote(merchantMetric) },
      { key: 'gmv',            label: 'Gross Merchandise Value',     metric: revenueMetric,  note: makeNote(revenueMetric) },
      { key: 'order-count',    label: 'Total orders',                metric: orderMetric,    note: makeNote(orderMetric) },
      { key: 'conversion-rate',label: 'Checkout conversion rate',    metric: customerMetric, note: makeNote(customerMetric) },
    ] as const;
  }

  /**
   * businessHealth — structural readiness across all business areas.
   * connectedSignals = count of CONNECTED findings across all areas.
   * notConnectedSignals = count of NOT_CONNECTED metrics across all areas.
   * Score measures STRUCTURAL readiness, NOT business performance.
   */
  businessHealth(areas: readonly AreaIntel[]): BusinessHealth {
    return computeHealth('business', areas);
  }

  /**
   * merchantHealth — structural readiness over the merchant + growth areas.
   */
  merchantHealth(merchant: AreaIntel, growth: AreaIntel): BusinessHealth {
    return computeHealth('merchant', [merchant, growth]);
  }

  /**
   * recommendations — one advisory BusinessRecommendation per applicable BI rule.
   *
   * BI01 fires when the revenue area has NOT_CONNECTED metrics.
   * BI02 fires when the merchant area has NOT_CONNECTED metrics.
   * BI03 fires when the customer area has NOT_CONNECTED metrics.
   * BI05 ALWAYS fires (subscription is never implemented).
   * BI07 fires when a forecast-area or finance area has NOT_CONNECTED metrics.
   * BI08 fires when a settlement or revenue area has NOT_CONNECTED metrics (provider gap).
   *
   * Results are sorted by severity (critical→info) then id. advisory:true always.
   */
  recommendations(
    areas: readonly AreaIntel[],
    subscription: Pick<SubscriptionIntel, 'implemented'>,
  ): readonly BusinessRecommendation[] {
    const recs: BusinessRecommendation[] = [];

    const byArea = (areaName: string): AreaIntel | undefined => areas.find((a) => a.area === areaName);
    const ncMetrics = (a: AreaIntel | undefined): BusinessMetric[] =>
      a ? a.metrics.filter((m) => m.connection === 'NOT_CONNECTED') : [];
    const firstEv = (metrics: BusinessMetric[]) =>
      metrics.length > 0 && metrics[0].evidence.length > 0
        ? metrics[0].evidence
        : [notConnected('metrics', 'data-source')];

    const SEVERITY_ORDER: Record<string, number> = {
      critical: 0, high: 1, medium: 2, low: 3, info: 4,
    };

    // BI01 — revenue/GMV magnitudes
    const revenueArea = byArea('revenue') ?? byArea('gmv');
    const revenueNc = ncMetrics(revenueArea);
    if (revenueNc.length > 0) {
      const rule = BUSINESS_RULES.find((r) => r.id === 'BI01')!;
      recs.push({
        id: 'BI01-rec',
        rule: 'BI01',
        advisory: true,
        action: 'Connect revenue/GMV analytics source to enable revenue metrics',
        rationale: rule.description,
        severity: rule.severity,
        evidence: firstEv(revenueNc),
      });
    }

    // BI02 — merchant counts
    const merchantArea = byArea('merchant');
    const merchantNc = ncMetrics(merchantArea);
    if (merchantNc.length > 0) {
      const rule = BUSINESS_RULES.find((r) => r.id === 'BI02')!;
      recs.push({
        id: 'BI02-rec',
        rule: 'BI02',
        advisory: true,
        action: 'Connect merchant site-scoped data source to enable merchant metrics',
        rationale: rule.description,
        severity: rule.severity,
        evidence: firstEv(merchantNc),
      });
    }

    // BI03 — customer funnel
    const customerArea = byArea('customer');
    const customerNc = ncMetrics(customerArea);
    if (customerNc.length > 0) {
      const rule = BUSINESS_RULES.find((r) => r.id === 'BI03')!;
      recs.push({
        id: 'BI03-rec',
        rule: 'BI03',
        advisory: true,
        action: 'Connect customer-event telemetry source to enable customer funnel metrics',
        rationale: rule.description,
        severity: rule.severity,
        evidence: firstEv(customerNc),
      });
    }

    // BI05 — subscription NOT IMPLEMENTED — ALWAYS present
    void subscription; // documented: always fires regardless of input
    {
      const rule = BUSINESS_RULES.find((r) => r.id === 'BI05')!;
      recs.push({
        id: 'BI05-rec',
        rule: 'BI05',
        advisory: true,
        action: 'Subscription intelligence is not implemented — no action, honest gap',
        rationale: rule.description,
        severity: rule.severity,
        evidence: [evidence('artifact-field', 'subscription.implemented', 'No subscriptions domain exists', 'packages/lcis-business')],
      });
    }

    // BI07 — forecast without series
    const financeArea = byArea('finance') ?? byArea('forecast');
    const financeNc = ncMetrics(financeArea);
    if (financeNc.length > 0) {
      const rule = BUSINESS_RULES.find((r) => r.id === 'BI07')!;
      recs.push({
        id: 'BI07-rec',
        rule: 'BI07',
        advisory: true,
        action: 'Connect historical revenue series to enable revenue forecasting',
        rationale: rule.description,
        severity: rule.severity,
        evidence: firstEv(financeNc),
      });
    }

    // BI08 — provider status unverified (settlement or revenue area without connection)
    const settlementArea = byArea('settlement');
    const settlementNc = ncMetrics(settlementArea);
    // Also fires if revenue area has NOT_CONNECTED metrics (provider loop)
    const providerNc = settlementNc.length > 0 ? settlementNc : revenueNc;
    if (providerNc.length > 0) {
      const rule = BUSINESS_RULES.find((r) => r.id === 'BI08')!;
      recs.push({
        id: 'BI08-rec',
        rule: 'BI08',
        advisory: true,
        action: 'Connect payment provider credentials (Razorpay/Stripe) to enable settlement metrics',
        rationale: rule.description,
        severity: rule.severity,
        evidence: firstEv(providerNc),
      });
    }

    // Sort by severity then id
    recs.sort((a, b) => {
      const sd = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
      if (sd !== 0) return sd;
      return a.id.localeCompare(b.id);
    });

    return recs;
  }
}
