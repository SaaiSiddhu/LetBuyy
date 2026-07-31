/**
 * BusinessIntelligenceEngine — the LBIS composition facade. Assembles merchant / revenue /
 * order / customer / subscription / settlement / refund / coupon / growth / marketing /
 * finance intelligence, executive KPIs, the revenue forecast, retention analytics, and
 * business + merchant health from the operations services, the twin, and the money adapters.
 * Pure composition — no new intelligence, no mutation, advisory-only. NEVER fabricates a
 * business magnitude: every value stays NOT_CONNECTED with its exact source.
 */
import { type LcisEngine, evidence, getEngine } from '@letbuyy/lcis-core';
import { CustomerRetentionService } from './customer/index';
import { ExecutiveHealthService } from './executive/index';
import { FinanceForecastService } from './finance/index';
import { GrowthMarketingService } from './growth/index';
import { MerchantIntelService } from './merchant/index';
import { RevenueOrderService } from './revenue/index';
import {
  business,
  defaultNow,
  type AreaIntel,
  type BusinessFinding,
  type BusinessReport,
} from './shared/index';

export interface BusinessIntelligenceEngine {
  readonly core: LcisEngine;
  readonly merchant: MerchantIntelService;
  readonly revenue: RevenueOrderService;
  readonly customer: CustomerRetentionService;
  readonly growth: GrowthMarketingService;
  readonly finance: FinanceForecastService;
  readonly executive: ExecutiveHealthService;
  generateBusinessReport(): BusinessReport;
}

export interface BusinessIntelligenceEngineOptions {
  readonly core?: LcisEngine;
  readonly now?: () => string;
}

function countNotConnected(...areas: readonly AreaIntel[]): number {
  return areas.reduce((n, a) => n + a.metrics.filter((m) => m.connection === 'NOT_CONNECTED').length, 0);
}

class BusinessIntelligenceEngineImpl implements BusinessIntelligenceEngine {
  readonly core: LcisEngine;
  readonly merchant: MerchantIntelService;
  readonly revenue: RevenueOrderService;
  readonly customer: CustomerRetentionService;
  readonly growth: GrowthMarketingService;
  readonly finance: FinanceForecastService;
  readonly executive: ExecutiveHealthService;
  private readonly now: () => string;

  constructor(opts: BusinessIntelligenceEngineOptions = {}) {
    this.core = opts.core ?? getEngine();
    this.now = opts.now ?? defaultNow;
    const core = this.core;
    const now = this.now;
    this.merchant = new MerchantIntelService(core, now);
    this.revenue = new RevenueOrderService(core, now);
    this.customer = new CustomerRetentionService(core, now);
    this.growth = new GrowthMarketingService(core, now);
    this.finance = new FinanceForecastService(core, now);
    this.executive = new ExecutiveHealthService();
  }

  /** The LBIS flagship: the unified business-intelligence report. */
  generateBusinessReport(): BusinessReport {
    const merchant = this.merchant.merchantIntel();
    const revenue = this.revenue.revenueIntel();
    const order = this.revenue.orderIntel();
    const settlement = this.revenue.settlementIntel();
    const refund = this.revenue.refundIntel();
    const customer = this.customer.customerIntel();
    const retention = this.customer.retention();
    const subscription = this.customer.subscriptionIntel();
    const growth = this.growth.growthIntel();
    const marketing = this.growth.marketingIntel();
    const coupon = this.growth.couponIntel();
    const finance = this.finance.financeIntel();
    const revenueForecast = this.finance.revenueForecast();

    const areas = [merchant, revenue, order, customer, settlement, refund, coupon, growth, marketing, finance, subscription];
    const executiveKpis = this.executive.kpis({ merchant, revenue, order, customer });
    const businessHealth = this.executive.businessHealth(areas);
    const merchantHealth = this.executive.merchantHealth(merchant, growth);
    const recommendations = this.executive.recommendations(areas, subscription);

    const notConnectedMetrics = countNotConnected(...areas);

    const summary =
      `Business intelligence: ${executiveKpis.length} executive KPI(s); business health ${businessHealth.band}` +
      `${businessHealth.score !== null ? ` (${businessHealth.score})` : ''}, merchant health ${merchantHealth.band}; ` +
      `${notConnectedMetrics} business magnitude(s) NOT_CONNECTED (exact sources named); ` +
      `subscriptions NOT IMPLEMENTED (no subscriptions domain). ` +
      `${recommendations.length} advisory recommendation(s). No business number is fabricated.`;

    return business(
      {
        merchant,
        revenue,
        order,
        customer,
        subscription,
        settlement,
        refund,
        coupon,
        growth,
        marketing,
        finance,
        executiveKpis,
        revenueForecast,
        retention,
        businessHealth,
        merchantHealth,
        recommendations,
        notConnectedMetrics,
        summary,
      },
      {
        evidence: [
          evidence('artifact-field', 'lcis-business:report', `${areas.length} area(s), ${notConnectedMetrics} NOT_CONNECTED metric(s)`, 'packages/lcis-business'),
          ...merchant.findings.slice(0, 2).flatMap((f: BusinessFinding) => [...f.evidence].slice(0, 1)),
        ],
        liveConnected: false,
        now: this.now,
      },
    );
  }
}

export function createBusinessIntelligenceEngine(opts?: BusinessIntelligenceEngineOptions): BusinessIntelligenceEngine {
  return new BusinessIntelligenceEngineImpl(opts);
}

let shared: BusinessIntelligenceEngine | null = null;

/** Process-wide singleton LBIS engine. */
export function getBusinessIntelligenceEngine(opts?: BusinessIntelligenceEngineOptions): BusinessIntelligenceEngine {
  if (shared === null) shared = createBusinessIntelligenceEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetBusinessIntelligenceEngine(): void {
  shared = null;
}
