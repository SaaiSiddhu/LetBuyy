/**
 * MerchantIntelService — LBIS Phase 16. Composes the operations merchant service into
 * merchant business intelligence. Every merchant MAGNITUDE is NOT_CONNECTED (value null +
 * exact source); merchant findings are mapped from the ops detectors, preserving their
 * honest connection status. Read-only, deterministic, injectable clock, no fabrication.
 */
import { type LcisEngine } from '@letbuyy/lcis-core';
import { createOperationsEngine, type OperationsEngine } from '@letbuyy/lcis-operations';
import { defaultNow } from '../shared/envelope';
import { mapFinding, notConnectedMetric, safeFindings } from '../shared/compose';
import type { BusinessFinding, BusinessMetric, MerchantIntel } from '../shared/types';

const MERCHANT_SOURCE = 'site-scoped rows (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)';

export class MerchantIntelService {
  private readonly ops: OperationsEngine;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.ops = createOperationsEngine({ core, now });
  }

  merchantIntel(): MerchantIntel {
    const metrics: BusinessMetric[] = [
      notConnectedMetric('merchant-count', 'Total merchants', 'merchants', MERCHANT_SOURCE, ['merchant', 'sites']),
      notConnectedMetric('active-merchants', 'Active merchants', 'merchants', MERCHANT_SOURCE, ['merchant', 'sites']),
      notConnectedMetric('activation-rate', 'Merchant activation rate', 'ratio', MERCHANT_SOURCE, ['merchant']),
      notConnectedMetric('churn-rate', 'Merchant churn rate', 'ratio', MERCHANT_SOURCE, ['merchant']),
      notConnectedMetric('retention-rate', 'Merchant retention rate', 'ratio', MERCHANT_SOURCE, ['merchant']),
    ];

    const raw = [
      ...safeFindings(() => this.ops.merchantOps.detectActivation()),
      ...safeFindings(() => this.ops.merchantOps.detectGrowth()),
      ...safeFindings(() => this.ops.merchantOps.detectChurn()),
      ...safeFindings(() => this.ops.merchantOps.detectDormancy()),
      ...safeFindings(() => this.ops.merchantOps.detectRetention()),
    ];
    const findings: BusinessFinding[] = raw.map((f) => mapFinding('merchant', f));

    return {
      area: 'merchant',
      metrics,
      findings,
      summary:
        `Merchant intelligence: ${metrics.length} magnitude(s) NOT_CONNECTED (source: ${MERCHANT_SOURCE}), ` +
        `${findings.length} structural finding(s). No merchant number is fabricated.`,
    };
  }
}
