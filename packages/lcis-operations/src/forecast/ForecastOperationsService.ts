/**
 * ForecastOperationsService — "What is likely next?"
 *
 * READ-ONLY. Answers deterministically from structural artifacts.
 * HONESTY CONTRACT: 0 historical time-series points exist in any graphify-out artifact.
 * Every ForecastSeries is NOT_CONNECTED with EMPTY points + the exact source table
 * and env var. The deterministic math (methods.ts) is real and unit-tested on
 * synthetic arrays; it is never applied to fabricated data.
 *
 * No fetch, spawn, eval, writeFile, network, or DB writes — ever.
 */

import { type LcisEngine, evidence as makeEvidence, notConnected } from '@letbuyy/lcis-core';
import {
  defaultNow,
  LiveSignalRegistry,
  OperationalEvidenceBuilder,
  OperationalFindingBuilder,
  OperationalHealthCalculator,
  OperationsArtifactStore,
  TelemetryNormalizer,
  operations,
  type ForecastReport,
  type ForecastSeries,
  type OperationalFact,
} from '../shared/index';

const SUPA = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const CF_Q = ['CLOUDFLARE_API_TOKEN', 'CF_ACCOUNT_ID'] as const;
const CF_AE = ['CF_ANALYTICS_API_TOKEN', 'CF_ACCOUNT_ID'] as const;

export class ForecastOperationsService {
  private readonly store: OperationsArtifactStore;
  private readonly registry: LiveSignalRegistry;
  private readonly norm: TelemetryNormalizer;
  private readonly eb: OperationalEvidenceBuilder;
  private readonly fb: OperationalFindingBuilder;
  private readonly health: OperationalHealthCalculator;
  private readonly now: () => string;

  constructor(core: LcisEngine, now: () => string = defaultNow) {
    this.store = new OperationsArtifactStore(core);
    this.registry = new LiveSignalRegistry();
    this.norm = new TelemetryNormalizer();
    this.eb = new OperationalEvidenceBuilder();
    this.fb = new OperationalFindingBuilder();
    this.health = new OperationalHealthCalculator();
    this.now = now;
  }

  // ── Individual series ───────────────────────────────────────────────────────

  /**
   * Traffic forecast — sessions/requests trend.
   * Source: analytics_event_stream (Cloudflare Analytics Engine).
   * Method: moving-average (SMA-7 on daily sessions).
   * Status: NOT_CONNECTED — no historical series in any graphify-out artifact.
   */
  forecastTraffic(): ForecastSeries {
    const sig = this.registry.get('forecast.traffic-trend');
    const ev = [
      this.eb.artifact(
        'customer-intelligence',
        'customer-intelligence.json',
        '0 historical session data points present — live-query-required for all metric values',
      ),
      notConnected(
        'analytics_event_stream time-series',
        'CF_ANALYTICS_API_TOKEN',
      ),
    ];
    return {
      key: 'forecast.traffic',
      label: 'Traffic / sessions trend',
      method: 'moving-average',
      points: [],
      status: 'NOT_CONNECTED',
      source: sig?.liveSource ?? 'analytics_event_stream (Cloudflare Analytics Engine)',
      requiresEnvVar: [...CF_AE],
      evidence: ev,
    };
  }

  /**
   * Order / GMV forecast — monthly order count and GMV trend.
   * Source: orders.total_minor, orders.created_at (Supabase).
   * Method: linear-trend (OLS on monthly GMV).
   * Status: NOT_CONNECTED — no historical GMV series in any artifact.
   */
  forecastOrders(): ForecastSeries {
    const sig = this.registry.get('forecast.order-trend');
    const ev = [
      this.eb.artifact(
        'revenue-intelligence-v2',
        'revenue-intelligence-v2.json:models.funnel',
        '0 historical monthly GMV data points — all amounts live-query-required',
      ),
      notConnected(
        'orders.total_minor monthly series',
        'SUPABASE_SERVICE_ROLE_KEY',
      ),
    ];
    return {
      key: 'forecast.orders',
      label: 'Order / GMV trend forecast',
      method: 'linear-trend',
      points: [],
      status: 'NOT_CONNECTED',
      source:
        sig?.liveSource ??
        'Table orders (columns: total_minor bigint, created_at, site_id) via Supabase service role; cross-check: refresh_money_ledger_site_reconciliation RPC',
      requiresEnvVar: [...SUPA],
      evidence: ev,
    };
  }

  /**
   * Queue growth forecast — queue backlog depth trend.
   * Source: Cloudflare Queues metrics API (5 queues: EVENT, ANALYTICS, SEARCH, NOTIFICATION, RUNTIME).
   * Method: moving-average (SMA-7 on daily peak depth).
   * Status: NOT_CONNECTED — queue depth is ephemeral and not stored in any artifact.
   */
  forecastQueueGrowth(): ForecastSeries {
    const sig = this.registry.get('forecast.queue-growth');
    // Enumerate workers from the real artifact for evidence provenance
    const workers = this.store.workers();
    const workerNames = workers.map((w) => w.name).join(', ');
    const queues = this.store.queueGraph();
    const queueNames = queues.map((q) => q.queue).join(', ');

    const ev = [
      this.eb.artifact(
        'runtime-intel',
        'runtime-intel.json:queueGraph',
        `Queue topology: ${queues.length} queues (${queueNames || 'see runtime-intel.json'}); workers: ${workerNames || 'see runtime-intel.json'}`,
      ),
      notConnected(
        'Cloudflare Queues daily peak depth time-series',
        'CLOUDFLARE_API_TOKEN',
      ),
    ];
    return {
      key: 'forecast.queue-growth',
      label: 'Queue growth / backlog trend',
      method: 'moving-average',
      points: [],
      status: 'NOT_CONNECTED',
      source:
        sig?.liveSource ??
        'Cloudflare Queues metrics API; queues: EVENT_QUEUE, ANALYTICS_QUEUE, SEARCH_QUEUE, NOTIFICATION_QUEUE, RUNTIME_QUEUE (all in runtime-intel.json:queueGraph)',
      requiresEnvVar: [...CF_Q],
      evidence: ev,
    };
  }

  /**
   * Merchant growth forecast — new stores per month trend.
   * Source: sites.created_at (Supabase).
   * Method: linear-trend (OLS on monthly new-store counts).
   * Status: NOT_CONNECTED — no historical merchant-count series in any artifact.
   */
  forecastMerchantGrowth(): ForecastSeries {
    const sig = this.registry.get('forecast.merchant-growth');
    // Read merchant artifact to confirm honest absence
    const merchantArtifact = this.store.merchant();
    const hasTimeSeries =
      merchantArtifact !== null &&
      typeof merchantArtifact === 'object' &&
      'timeSeries' in merchantArtifact;

    const ev = [
      this.eb.artifact(
        'merchant-intelligence',
        'merchant-intelligence.json',
        hasTimeSeries
          ? 'timeSeries field present'
          : '0 historical merchant-count data points — remainingSlots/conversionRate: connected:false',
      ),
      this.eb.artifact(
        'merchant-growth',
        'merchant-growth.json',
        'growthRate, growingMerchants, stalledMerchants all live-query-required; 0 stored data points',
      ),
      notConnected(
        'sites.created_at monthly series',
        'SUPABASE_SERVICE_ROLE_KEY',
      ),
    ];
    return {
      key: 'forecast.merchant-growth',
      label: 'Merchant growth (new stores/month) forecast',
      method: 'linear-trend',
      points: [],
      status: 'NOT_CONNECTED',
      source:
        sig?.liveSource ??
        'Table sites (column: created_at timestamp) via Supabase service role; SQL: SELECT date_trunc(\'month\', created_at), count(*) FROM sites GROUP BY 1 ORDER BY 1',
      requiresEnvVar: [...SUPA],
      evidence: ev,
    };
  }

  // ── Composite report ────────────────────────────────────────────────────────

  generateForecastReport(): ForecastReport {
    const ts = this.now();
    const FIXED_NOW = () => ts;

    const traffic = this.forecastTraffic();
    const orders = this.forecastOrders();
    const queueGrowth = this.forecastQueueGrowth();
    const merchantGrowth = this.forecastMerchantGrowth();
    const series = [traffic, orders, queueGrowth, merchantGrowth] as const;

    // ── facts ────────────────────────────────────────────────────────────────
    const facts: OperationalFact[] = [
      this.norm.fact('forecast', 'series-status', 'traffic', 'Traffic series status', {
        value: null,
        status: 'NOT_CONNECTED',
        at: ts,
        evidence: traffic.evidence,
      }),
      this.norm.fact('forecast', 'series-status', 'orders', 'Orders/GMV series status', {
        value: null,
        status: 'NOT_CONNECTED',
        at: ts,
        evidence: orders.evidence,
      }),
      this.norm.fact('forecast', 'series-status', 'queue-growth', 'Queue backlog series status', {
        value: null,
        status: 'NOT_CONNECTED',
        at: ts,
        evidence: queueGrowth.evidence,
      }),
      this.norm.fact('forecast', 'series-status', 'merchant-growth', 'Merchant growth series status', {
        value: null,
        status: 'NOT_CONNECTED',
        at: ts,
        evidence: merchantGrowth.evidence,
      }),
      // Structural fact: math methods ARE ready
      this.norm.fact('forecast', 'method-readiness', 'math-functions', 'Forecast math functions ready (moving-average, linear-trend, confidence-interval)', {
        value: 'READY',
        status: 'CONNECTED',
        at: ts,
        evidence: [
          makeEvidence(
            'doc',
            'LCOS_FORECAST_DISCOVERY.md §4',
            'OLS + SMA-3/7 methods specified and unit-tested; apply when ≥3 monthly data points are connected',
            'docs/lcis-operations/LCOS_FORECAST_DISCOVERY.md',
          ),
        ],
      }),
    ];

    // ── signals ──────────────────────────────────────────────────────────────
    const forecastSignals = this.registry.byArea('forecast');
    const liveSignals = forecastSignals.map((sig) =>
      this.norm.signalToLive(sig, []),
    );

    // ── finding ──────────────────────────────────────────────────────────────
    const connSources =
      'sites.created_at (Supabase), orders.total_minor (Supabase), analytics_event_stream (Cloudflare Analytics Engine), Cloudflare Queues metrics API';

    const readinessFinding = this.fb.build({
      id: 'FORECAST-METHODS-READY',
      area: 'forecast',
      kind: 'forecast-readiness',
      severity: 'info',
      subject: 'forecast-service',
      title: 'Forecasting methods ready; historical series NOT_CONNECTED',
      detail: `All four deterministic forecast methods (moving-average for traffic + queue-growth, linear-trend for orders/GMV + merchant-growth) are implemented and unit-tested. All series status: NOT_CONNECTED — zero historical time-series data points are present in any graphify-out artifact. Wire the following sources to unlock live forecasts: ${connSources}. Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for orders + sites); CF_ANALYTICS_API_TOKEN + CF_ACCOUNT_ID (for analytics_event_stream + Cloudflare Queues).`,
      status: 'CONNECTED', // the finding itself is a structural observation, not a live value
      evidence: [
        makeEvidence(
          'doc',
          'LCOS_FORECAST_DISCOVERY.md §6 (Connectivity Table)',
          '0 historical data points across all 4 series; exact sources and SQL documented',
          'docs/lcis-operations/LCOS_FORECAST_DISCOVERY.md',
        ),
      ],
    });

    // ── health ───────────────────────────────────────────────────────────────
    const areaHealth = this.health.forArea('forecast', [readinessFinding], liveSignals);

    // ── all evidence ─────────────────────────────────────────────────────────
    const allEvidence = [
      ...traffic.evidence,
      ...orders.evidence,
      ...queueGrowth.evidence,
      ...merchantGrowth.evidence,
      ...readinessFinding.evidence,
    ];

    const summary =
      'Forecast service operational. 4 series declared (traffic, orders/GMV, queue-growth, merchant-growth). ' +
      'All series NOT_CONNECTED: 0 historical data points in any artifact. ' +
      'Deterministic math (OLS linear-trend, SMA moving-average, std-error CI) is ready and unit-tested. ' +
      'Wire SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (orders/sites) and ' +
      'CF_ANALYTICS_API_TOKEN + CF_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (analytics/queues) to enable live forecasts.';

    return operations(
      {
        area: 'forecast' as const,
        series,
        facts,
        findings: [readinessFinding],
        signals: liveSignals,
        health: areaHealth,
        summary,
      },
      {
        evidence: allEvidence,
        liveConnected: false,
        now: FIXED_NOW,
      },
    ) as ForecastReport;
  }
}
