/**
 * CustomerRetentionService — LBIS Phase 16. Customer / retention / subscription intelligence.
 * All customer magnitudes NOT_CONNECTED; retention curve NOT_CONNECTED; subscriptions are
 * honestly NOT IMPLEMENTED (no subscriptions domain exists — constitutional honesty).
 */
import { type LcisEngine, evidence, notConnected } from '@letbuyy/lcis-core';
import { createOperationsEngine, type OperationsEngine } from '@letbuyy/lcis-operations';
import { defaultNow } from '../shared/envelope';
import { mapFinding, notConnectedMetric, safeFindings, structuralFinding } from '../shared/compose';
import type { BusinessFinding, CustomerIntel, RetentionAnalytics, SubscriptionIntel } from '../shared/types';

const CUSTOMER_SOURCE = 'customer-event telemetry (store_customers + analytics)';
const RETENTION_SOURCE = 'customer-event telemetry (order timestamps per customer)';

export class CustomerRetentionService {
  private readonly ops: OperationsEngine;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.ops = createOperationsEngine({ core, now });
  }

  customerIntel(): CustomerIntel {
    const metrics = [
      notConnectedMetric('customer-count', 'Total customers', 'customers', CUSTOMER_SOURCE, ['customers']),
      notConnectedMetric('new-customers', 'New customers', 'customers', CUSTOMER_SOURCE, ['customers']),
      notConnectedMetric('conversion-rate', 'Conversion rate', 'ratio', CUSTOMER_SOURCE, ['customers', 'orders']),
      notConnectedMetric('repeat-rate', 'Repeat purchase rate', 'ratio', CUSTOMER_SOURCE, ['customers', 'orders']),
    ];
    const findings: BusinessFinding[] = [
      ...safeFindings(() => this.ops.customerOps.detectConversionDrops()),
      ...safeFindings(() => this.ops.customerOps.detectTrafficAnomalies()),
    ].map((f) => mapFinding('customer', f));
    return {
      area: 'customer',
      metrics,
      findings,
      summary: `Customer intelligence: ${metrics.length} magnitude(s) NOT_CONNECTED (source: ${CUSTOMER_SOURCE}). ${findings.length} finding(s).`,
    };
  }

  retention(): RetentionAnalytics {
    return {
      cohortModel: 'monthly cohort (structural model)',
      connection: 'NOT_CONNECTED',
      retentionCurve: null,
      liveSource: RETENTION_SOURCE,
      findings: [
        structuralFinding(
          'retention',
          'BI03',
          'info',
          'retention',
          'Retention requires customer-event data',
          `The monthly-cohort retention model is structural; the retention curve is NOT_CONNECTED — it requires ${RETENTION_SOURCE}. No curve is fabricated.`,
          'NOT_CONNECTED',
          [notConnected('retention-curve', RETENTION_SOURCE)],
        ),
      ],
    };
  }

  subscriptionIntel(): SubscriptionIntel {
    return {
      area: 'subscription',
      implemented: false,
      metrics: [
        notConnectedMetric('subscription-mrr', 'Subscription MRR', 'INR-minor', 'NO subscriptions domain exists — not implemented', []),
      ],
      findings: [
        structuralFinding(
          'subscription',
          'BI05',
          'info',
          'subscription',
          'Subscription intelligence is NOT IMPLEMENTED',
          'Subscription intelligence is honestly NOT IMPLEMENTED — there is no subscriptions domain in the LetBuyy platform. This is a constitutional honesty statement, not a data gap.',
          'NOT_CONNECTED',
          [evidence('artifact-field', 'subscription:absent', 'no subscriptions domain in domain-intel', 'graphify-out/domain-intel.json')],
        ),
      ],
      summary: 'Subscription intelligence: NOT IMPLEMENTED — no subscriptions domain exists.',
    };
  }
}
