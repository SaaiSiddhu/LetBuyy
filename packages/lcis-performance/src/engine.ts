/**
 * PerformanceEngine — the LPAS composition facade. Catalogs metrics over the twin, resolves
 * caller-provided series (never synthesizing values), builds the structural latency model,
 * delegates forecasts to the lcis-operations methods, and derives advisory-only
 * recommendations from structural signals. Pure composition — nothing here measures,
 * fabricates, or mutates.
 */
import { type LcisEngine, evidence, getEngine, notConnected } from '@letbuyy/lcis-core';
import { createTwinEngine, type TwinEngine } from '@letbuyy/lcis-twin';
import { CapacityService } from './capacity/index';
import { MetricCatalogService } from './catalog/index';
import { CostService } from './cost/index';
import { LatencyModelService } from './latency/index';
import { RecommendationService } from './recommend/index';
import {
  defaultNow,
  performance as perf,
  type CapacityForecast,
  type CostForecast,
  type LatencyModelEntry,
  type MetricDescriptor,
  type MetricSeries,
  type PerformanceFinding,
  type PerformanceReport,
  type Recommendation,
} from './shared/index';
import { StatisticsService } from './statistics/index';

/** Caller-provided real series keyed by metric key. Values are never synthesized. */
export type SeriesInput = Readonly<Record<string, readonly number[]>>;

export interface PerformanceEngine {
  readonly core: LcisEngine;
  readonly statistics: StatisticsService;
  readonly catalog: MetricCatalogService;
  readonly latency: LatencyModelService;
  readonly capacity: CapacityService;
  readonly cost: CostService;
  readonly recommend: RecommendationService;
  generateCatalog(): readonly MetricDescriptor[];
  analyze(seriesInput?: SeriesInput): readonly MetricSeries[];
  latencyModel(): readonly LatencyModelEntry[];
  forecastCapacity(subject: string, series?: readonly number[] | null, horizon?: number): CapacityForecast;
  forecastCost(series?: readonly number[] | null, horizon?: number): CostForecast;
  generatePerformanceReport(seriesInput?: SeriesInput): PerformanceReport;
}

export interface PerformanceEngineOptions {
  readonly core?: LcisEngine;
  readonly now?: () => string;
}

class PerformanceEngineImpl implements PerformanceEngine {
  readonly core: LcisEngine;
  readonly statistics: StatisticsService;
  readonly catalog: MetricCatalogService;
  readonly latency: LatencyModelService;
  readonly capacity: CapacityService;
  readonly cost: CostService;
  readonly recommend: RecommendationService;
  private readonly twin: TwinEngine;
  private readonly now: () => string;

  constructor(opts: PerformanceEngineOptions = {}) {
    this.core = opts.core ?? getEngine();
    this.now = opts.now ?? defaultNow;
    const core = this.core;
    const now = this.now;
    this.statistics = new StatisticsService();
    this.catalog = new MetricCatalogService(core, now);
    this.latency = new LatencyModelService(core, now);
    this.capacity = new CapacityService(core, now);
    this.cost = new CostService(core, now);
    this.recommend = new RecommendationService();
    this.twin = createTwinEngine({ core, now });
  }

  generateCatalog(): readonly MetricDescriptor[] {
    return this.catalog.buildCatalog();
  }

  analyze(seriesInput: SeriesInput = {}): readonly MetricSeries[] {
    return this.generateCatalog().map((d) => this.catalog.resolveSeries(d, seriesInput[d.key] ?? undefined));
  }

  latencyModel(): readonly LatencyModelEntry[] {
    return this.latency.modelFor();
  }

  forecastCapacity(subject: string, series: readonly number[] | null = null, horizon = 6): CapacityForecast {
    return this.capacity.forecastCapacity(subject, series, horizon);
  }

  forecastCost(series: readonly number[] | null = null, horizon = 6): CostForecast {
    return this.cost.forecastCost(series, horizon);
  }

  /** The LPAS flagship: catalog + honest series + structural model + advisory intelligence. */
  generatePerformanceReport(seriesInput: SeriesInput = {}): PerformanceReport {
    const catalog = this.generateCatalog();
    const series = this.analyze(seriesInput);
    const latencyModel = this.latencyModel();

    const connectedMetrics = series.filter((s) => s.connection === 'CONNECTED').length;
    const notConnectedKeys = series.filter((s) => s.connection === 'NOT_CONNECTED').map((s) => s.descriptor.key);

    // Structural signals from the twin (composition — nothing re-derived).
    const graph = this.twin.buildTwin();
    const fanTop = this.twin.fan(20).top.map((f) => ({ id: f.id, fanIn: f.fanIn, fanOut: f.fanOut }));
    const spofIds = this.twin.spof().spofs.map((s) => s.id);
    const queueIds = graph.nodes.filter((n) => n.layer === 'queue').map((n) => n.id);
    const consumingEdges = new Set(
      graph.edges.filter((e) => e.relation === 'consumes').flatMap((e) => [e.from, e.to]),
    );
    const consumerlessQueueIds = queueIds.filter((q) => !consumingEdges.has(q));
    const cacheObserved = (seriesInput['ratio.cache.redis'] ?? []).length > 0;

    const recommendations: readonly Recommendation[] = this.recommend.recommend({
      latencyModel,
      fanTop,
      spofIds,
      consumerlessQueueIds,
      notConnectedMetricKeys: notConnectedKeys,
      cacheObserved,
    });

    // Findings mirror the recommendations 1:1 (observation ↔ advisory action; same evidence).
    const findings: readonly PerformanceFinding[] = recommendations.map((r) => ({
      id: `F-${r.id}`,
      rule: r.rule,
      severity: r.severity,
      subject: r.action.slice(0, 80),
      title: r.rule,
      detail: r.rationale,
      connection: r.rule === 'PA03' ? 'NOT_CONNECTED' : 'CONNECTED',
      evidence: r.evidence,
    }));

    const capacitySeries = seriesInput['throughput.queue.order-events'] ?? null;
    const capacity =
      capacitySeries !== null && capacitySeries.length > 0
        ? this.forecastCapacity('queue:order-events', capacitySeries)
        : this.forecastCapacity('platform', null);
    const cost = this.forecastCost(seriesInput['cost.total'] ?? null);

    const summary =
      `Performance report: ${catalog.length} catalogued metric(s) — ${connectedMetrics} CONNECTED (caller-provided series), ` +
      `${notConnectedKeys.length} NOT_CONNECTED (sources named, values never fabricated); ` +
      `${latencyModel.length} structural latency model entr(ies) — models, not measurements; ` +
      `${recommendations.length} ADVISORY-ONLY recommendation(s). Nothing here mutates infrastructure.`;

    return perf(
      {
        catalog,
        connectedMetrics,
        notConnectedMetrics: notConnectedKeys.length,
        latencyModel,
        findings,
        recommendations,
        capacity,
        cost,
        summary,
      },
      {
        evidence: [
          evidence('artifact-field', 'lcis-performance:report', `${catalog.length} metrics, ${recommendations.length} advisories`, 'packages/lcis-performance'),
          ...notConnectedKeys.slice(0, 3).map((k) => notConnected(k, 'see MetricDescriptor.liveSource')),
        ],
        liveConnected: connectedMetrics > 0,
        now: this.now,
      },
    );
  }
}

export function createPerformanceEngine(opts?: PerformanceEngineOptions): PerformanceEngine {
  return new PerformanceEngineImpl(opts);
}

let shared: PerformanceEngine | null = null;

/** Process-wide singleton LPAS engine. */
export function getPerformanceEngine(opts?: PerformanceEngineOptions): PerformanceEngine {
  if (shared === null) shared = createPerformanceEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetPerformanceEngine(): void {
  shared = null;
}
