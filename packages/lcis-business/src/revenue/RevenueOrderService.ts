/**
 * RevenueOrderService — LBIS Phase 16. Composes the operations commerce service into
 * revenue / order / settlement / refund intelligence. Every money MAGNITUDE is
 * NOT_CONNECTED (value null + exact source) — the canonical ledger stays authoritative;
 * LBIS observes structurally and never fabricates a money number.
 */
import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import { createOperationsEngine, type OperationsEngine } from '@letbuyy/lcis-operations';
import { defaultNow } from '../shared/envelope';
import { mapFinding, notConnectedMetric, safeFindings, structuralFinding } from '../shared/compose';
import type { BusinessFinding, OrderIntel, RefundIntel, RevenueIntel, SettlementIntel } from '../shared/types';

const LEDGER_SOURCE = 'ledger reconciliation RPCs (payment_transactions, payouts)';
const ORDER_SOURCE = 'orders + order_items rows (site-scoped)';
const SETTLEMENT_SOURCE = 'Razorpay settlements API + payouts ledger';
const REFUND_SOURCE = 'refunds ledger + payment_transactions reconciliation';

export class RevenueOrderService {
  private readonly ops: OperationsEngine;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.ops = createOperationsEngine({ core, now });
  }

  revenueIntel(): RevenueIntel {
    const metrics = [
      notConnectedMetric('gmv', 'Gross merchandise value', 'INR-minor', LEDGER_SOURCE, ['payments', 'orders']),
      notConnectedMetric('revenue', 'Net revenue', 'INR-minor', LEDGER_SOURCE, ['payments']),
      notConnectedMetric('aov', 'Average order value', 'INR-minor', LEDGER_SOURCE, ['orders', 'payments']),
    ];
    const findings: BusinessFinding[] = [
      ...safeFindings(() => this.ops.commerceOps.detectGmvTrend()),
      ...safeFindings(() => this.ops.commerceOps.detectPaymentFailures()),
    ].map((f) => mapFinding('revenue', f));
    return {
      area: 'revenue',
      metrics,
      findings,
      summary: `Revenue intelligence: ${metrics.length} money magnitude(s) NOT_CONNECTED (source: ${LEDGER_SOURCE}); canonical ledger authoritative. ${findings.length} finding(s).`,
    };
  }

  orderIntel(): OrderIntel {
    const metrics = [
      notConnectedMetric('order-count', 'Order count', 'orders', ORDER_SOURCE, ['orders']),
      notConnectedMetric('orders-per-day', 'Orders per day', 'orders/day', ORDER_SOURCE, ['orders']),
      notConnectedMetric('conversion-to-order', 'Conversion to order', 'ratio', ORDER_SOURCE, ['orders', 'customers']),
    ];
    const findings: BusinessFinding[] = [
      ...safeFindings(() => this.ops.commerceOps.detectOrderTrend()),
      ...safeFindings(() => this.ops.commerceOps.detectCheckoutDegradation()),
    ].map((f) => mapFinding('order', f));
    return {
      area: 'order',
      metrics,
      findings,
      summary: `Order intelligence: ${metrics.length} magnitude(s) NOT_CONNECTED (source: ${ORDER_SOURCE}). ${findings.length} finding(s).`,
    };
  }

  settlementIntel(): SettlementIntel {
    const metrics = [
      notConnectedMetric('settlement-amount', 'Settlement amount', 'INR-minor', SETTLEMENT_SOURCE, ['payouts', 'payments']),
      notConnectedMetric('payout-count', 'Payout count', 'payouts', SETTLEMENT_SOURCE, ['payouts']),
    ];
    // BI04: the settlement/payout money path exists structurally and must be monitored.
    const findings: BusinessFinding[] = [
      structuralFinding(
        'settlement',
        'BI04',
        'medium',
        'payouts',
        'Settlement/payout money path present',
        'The settlement and payout money path exists structurally (payouts + payment_transactions). Amounts are NOT_CONNECTED — the canonical ledger is authoritative; live settlement values require the Razorpay settlements API.',
        'CONNECTED',
        [evidence('artifact-field', 'settlement:payouts', 'payouts money path present', 'graphify-out/db-intel.json')],
      ),
    ];
    return {
      area: 'settlement',
      metrics,
      findings,
      summary: `Settlement intelligence: ${metrics.length} magnitude(s) NOT_CONNECTED (source: ${SETTLEMENT_SOURCE}). Money path monitored structurally.`,
    };
  }

  refundIntel(): RefundIntel {
    const metrics = [
      notConnectedMetric('refund-amount', 'Refund amount', 'INR-minor', REFUND_SOURCE, ['refunds', 'payments']),
      notConnectedMetric('refund-rate', 'Refund rate', 'ratio', REFUND_SOURCE, ['refunds', 'orders']),
    ];
    const findings: BusinessFinding[] = safeFindings(() => this.ops.commerceOps.detectRefundSpikes()).map((f) => mapFinding('refund', f));
    return {
      area: 'refund',
      metrics,
      findings,
      summary: `Refund intelligence: ${metrics.length} magnitude(s) NOT_CONNECTED (source: ${REFUND_SOURCE}). ${findings.length} finding(s).`,
    };
  }
}
