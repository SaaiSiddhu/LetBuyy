/**
 * GrowthMarketingService — LBIS Phase 16. Growth / marketing / coupon intelligence.
 * All magnitudes NOT_CONNECTED. Coupon backing is detected STRUCTURALLY from db-intel
 * (a real coupons/discounts table → CONNECTED backing finding), never a fabricated count.
 */
import { type LcisEngine, evidence, notConnected } from '@letbuyy/lcis-core';
import { createOperationsEngine, type OperationsEngine } from '@letbuyy/lcis-operations';
import { z } from 'zod';
import { defaultNow } from '../shared/envelope';
import { mapFinding, notConnectedMetric, safeFindings, structuralFinding } from '../shared/compose';
import type { BusinessFinding, CouponIntel, GrowthIntel, MarketingIntel } from '../shared/types';

const GROWTH_SOURCE = 'site-scoped merchant timestamps';
const MARKETING_SOURCE = 'marketing/analytics telemetry (not wired)';
const COUPON_SOURCE = 'coupons/discounts ledger';

const DbIntelSchema = z.object({ tables: z.array(z.object({ name: z.string() }).loose()).optional() }).loose();

export class GrowthMarketingService {
  private readonly ops: OperationsEngine;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.ops = createOperationsEngine({ core, now });
  }

  growthIntel(): GrowthIntel {
    const metrics = [
      notConnectedMetric('mom-growth', 'Month-over-month growth', 'ratio', GROWTH_SOURCE, ['merchant']),
      notConnectedMetric('new-merchant-rate', 'New merchant rate', 'merchants/period', GROWTH_SOURCE, ['merchant']),
    ];
    const findings: BusinessFinding[] = safeFindings(() => this.ops.merchantOps.detectGrowth()).map((f) => mapFinding('growth', f));
    return {
      area: 'growth',
      metrics,
      findings,
      summary: `Growth intelligence: ${metrics.length} magnitude(s) NOT_CONNECTED (source: ${GROWTH_SOURCE}). ${findings.length} finding(s).`,
    };
  }

  marketingIntel(): MarketingIntel {
    const metrics = [
      notConnectedMetric('campaign-reach', 'Campaign reach', 'impressions', MARKETING_SOURCE, []),
      notConnectedMetric('attribution', 'Marketing attribution', 'ratio', MARKETING_SOURCE, []),
    ];
    const findings: BusinessFinding[] = [
      structuralFinding(
        'marketing',
        'BI06',
        'low',
        'marketing',
        'Marketing attribution needs telemetry',
        `Marketing reach and attribution are NOT_CONNECTED — they require ${MARKETING_SOURCE}. No marketing number is fabricated.`,
        'NOT_CONNECTED',
        [notConnected('marketing-attribution', MARKETING_SOURCE)],
      ),
    ];
    return {
      area: 'marketing',
      metrics,
      findings,
      summary: `Marketing intelligence: ${metrics.length} magnitude(s) NOT_CONNECTED (source: ${MARKETING_SOURCE}).`,
    };
  }

  couponIntel(): CouponIntel {
    // Structural coupon backing: does a coupons/discounts table actually exist?
    let backed: string[] = [];
    const raw = this.core.store.has('db-intel.json') ? this.core.store.tryRead('db-intel.json') : null;
    if (raw !== null) {
      const parsed = DbIntelSchema.safeParse(raw);
      if (parsed.success) {
        const names = (parsed.data.tables ?? []).map((t) => t.name.toLowerCase());
        backed = ['coupons', 'discounts', 'coupon_redemptions'].filter((c) => names.some((n) => n.includes(c.replace('_redemptions', ''))));
      }
    }
    const metrics = [
      notConnectedMetric('coupon-redemptions', 'Coupon redemptions', 'redemptions', COUPON_SOURCE, backed),
      notConnectedMetric('discount-amount', 'Discount amount', 'INR-minor', COUPON_SOURCE, backed),
    ];
    const findings: BusinessFinding[] =
      backed.length > 0
        ? [
            structuralFinding(
              'coupon',
              'present',
              'info',
              backed.join(','),
              'Coupon domain present',
              `Coupon/discount tables present structurally: ${backed.join(', ')}. Redemption/discount amounts are NOT_CONNECTED (source: ${COUPON_SOURCE}).`,
              'CONNECTED',
              [evidence('artifact-field', 'coupon:tables', backed.join(', '), 'graphify-out/db-intel.json')],
            ),
          ]
        : [
            structuralFinding(
              'coupon',
              'absent',
              'info',
              'coupons',
              'Coupon tables not found',
              'No coupons/discounts table found in db-intel — coupon intelligence is structural-only and magnitudes stay NOT_CONNECTED.',
              'NOT_CONNECTED',
              [notConnected('coupon-tables', 'graphify-out/db-intel.json (run pnpm graph:db)')],
            ),
          ];
    return {
      area: 'coupon',
      metrics,
      findings,
      summary: `Coupon intelligence: ${metrics.length} magnitude(s) NOT_CONNECTED (source: ${COUPON_SOURCE}); ${backed.length > 0 ? `backed by ${backed.join(', ')}` : 'no coupon tables detected'}.`,
    };
  }
}
