/**
 * FinanceForecastService — "What is the financial posture and revenue trajectory?"
 *
 * READ-ONLY. Deterministic. No fetch, spawn, eval, writeFile, network, or DB.
 * Advisory-only. Injectable clock via constructor.
 *
 * THE NO-FABRICATION LAW (absolute):
 *   - Every finance magnitude (net-revenue, gross-margin, mrr, burn) is NOT_CONNECTED
 *     with value:null and its exact liveSource until a real ledger source is wired.
 *   - Revenue forecast forecastValues is null unless a real series is caller-provided.
 *   - NEVER put a real number in any BusinessMetric.value without a real caller series.
 */
import { type LcisEngine, evidence, notConnected } from '@letbuyy/lcis-core';
import { linearTrend } from '@letbuyy/lcis-operations';
import { defaultNow } from '../shared/envelope';
import { BUSINESS_RULES } from '../shared/rules';
import type {
  BusinessFinding,
  BusinessForecast,
  BusinessMetric,
  FinanceIntel,
} from '../shared/types';

const FINANCE_LIVE_SOURCE =
  'finance ledger (payment_transactions, payouts, refunds reconciliation)';

const FINANCE_BACKED_BY: readonly string[] = ['payments', 'payouts', 'refunds'];

const FINANCE_NOT_CONNECTED_EVIDENCE = [
  notConnected(
    'payment_transactions / payouts / refunds reconciliation',
    'SUPABASE_SERVICE_ROLE_KEY',
  ),
];

function makeFinanceMetric(
  key: string,
  label: string,
  unit: string,
): BusinessMetric {
  return {
    key,
    label,
    unit,
    value: null,
    connection: 'NOT_CONNECTED',
    liveSource: FINANCE_LIVE_SOURCE,
    backedBy: FINANCE_BACKED_BY,
    evidence: FINANCE_NOT_CONNECTED_EVIDENCE,
  };
}

export class FinanceForecastService {
  private readonly core: LcisEngine;
  private readonly now: () => string;

  constructor(core: LcisEngine, now: () => string = defaultNow) {
    this.core = core;
    this.now = now;
  }

  /**
   * Finance intelligence: net-revenue, gross-margin, mrr, burn — all NOT_CONNECTED.
   * Includes a BI01 finding: revenue telemetry not connected.
   */
  financeIntel(): FinanceIntel {
    const metrics: BusinessMetric[] = [
      makeFinanceMetric('finance.net-revenue', 'Net Revenue', 'INR'),
      makeFinanceMetric('finance.gross-margin', 'Gross Margin', '%'),
      makeFinanceMetric('finance.mrr', 'Monthly Recurring Revenue (MRR)', 'INR'),
      makeFinanceMetric('finance.burn', 'Burn Rate', 'INR/month'),
    ];

    const bi01 = BUSINESS_RULES.find((r) => r.id === 'BI01')!;

    const finding: BusinessFinding = {
      id: 'FINANCE-BI01',
      area: 'finance',
      severity: bi01.severity,
      subject: 'finance-ledger',
      title: bi01.title,
      detail:
        'Finance magnitudes (net-revenue, gross-margin, MRR, burn) require a live ledger/analytics source. ' +
        'Source: payment_transactions, payouts, refunds tables via Supabase service role. ' +
        'Wire SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to connect.',
      connection: 'NOT_CONNECTED',
      evidence: [
        evidence(
          'artifact-field',
          'BI01',
          'Revenue/GMV magnitudes require a live ledger/analytics source.',
          'packages/lcis-business/src/shared/rules.ts',
        ),
        notConnected(
          'payment_transactions / payouts / refunds reconciliation',
          'SUPABASE_SERVICE_ROLE_KEY',
        ),
      ],
    };

    const summary =
      'Finance intelligence: 4 metrics declared (net-revenue, gross-margin, MRR, burn-rate). ' +
      'All NOT_CONNECTED — source: finance ledger (payment_transactions, payouts, refunds). ' +
      'Wire SUPABASE_SERVICE_ROLE_KEY to connect live values. No finance magnitude is fabricated.';

    return {
      area: 'finance',
      metrics,
      findings: [finding],
      summary,
    };
  }

  /**
   * Revenue forecast.
   *
   * If a non-empty seriesInput is provided:
   *   - connection CONNECTED
   *   - forecastValues = OLS linear-trend forecast for horizon 6 periods
   *   - liveSource 'caller-provided historical revenue series'
   *
   * Otherwise (null, undefined, or empty array):
   *   - connection NOT_CONNECTED
   *   - forecastValues null
   *   - liveSource 'historical revenue series (ledger reconciliation)'
   *
   * NEVER fabricates forecast values from no data.
   */
  revenueForecast(seriesInput?: readonly number[] | null): BusinessForecast {
    const hasSeries =
      seriesInput !== null &&
      seriesInput !== undefined &&
      seriesInput.length > 0;

    if (hasSeries) {
      const series = [...seriesInput!] as number[];
      const forecastValues = linearTrend(series).forecast(6);
      return {
        subject: 'revenue',
        connection: 'CONNECTED',
        forecastValues,
        horizon: 6,
        method: 'ols-linear-trend (lcis-operations)',
        liveSource: 'caller-provided historical revenue series',
      };
    }

    return {
      subject: 'revenue',
      connection: 'NOT_CONNECTED',
      forecastValues: null,
      horizon: 6,
      method: 'ols-linear-trend (lcis-operations)',
      liveSource: 'historical revenue series (ledger reconciliation)',
    };
  }
}
