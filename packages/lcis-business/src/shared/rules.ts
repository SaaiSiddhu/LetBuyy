/**
 * LBIS business rules BI01..BI08 — declarative metadata. Recommendations are ADVISORY ONLY.
 * Because every business magnitude is NOT_CONNECTED, most rules fire on STRUCTURAL signals
 * (a domain exists but its metric has no source) — never on a fabricated number.
 */
import type { Severity } from './types';

export interface BusinessRule {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  readonly description: string;
}

export const BUSINESS_RULES: readonly BusinessRule[] = [
  { id: 'BI01', title: 'Revenue telemetry not connected', severity: 'info', description: 'Revenue/GMV magnitudes require a live ledger/analytics source.' },
  { id: 'BI02', title: 'Merchant metrics not connected', severity: 'info', description: 'Merchant counts/activation require a site-scoped data source.' },
  { id: 'BI03', title: 'Customer funnel not connected', severity: 'info', description: 'Conversion/retention require customer-event telemetry.' },
  { id: 'BI04', title: 'Refund/settlement risk path', severity: 'medium', description: 'The refund/settlement money path exists structurally and must be monitored.' },
  { id: 'BI05', title: 'Subscription not implemented', severity: 'info', description: 'No subscriptions domain exists — subscription intelligence is honestly NOT IMPLEMENTED.' },
  { id: 'BI06', title: 'Growth signal structural-only', severity: 'low', description: 'Growth is inferred structurally; magnitudes need telemetry.' },
  { id: 'BI07', title: 'Forecast without series', severity: 'info', description: 'A forecast cannot run without a real historical series.' },
  { id: 'BI08', title: 'Provider status unverified', severity: 'medium', description: 'A payment provider (Razorpay/Stripe) status is unverified without credentials.' },
];

export class BusinessRuleRegistry {
  list(): readonly BusinessRule[] {
    return BUSINESS_RULES;
  }
  get(id: string): BusinessRule | undefined {
    return BUSINESS_RULES.find((r) => r.id === id);
  }
}
