/**
 * LPAS (Performance Analytics System) type vocabulary — the FROZEN contract. LPAS models
 * performance: a per-entity metric catalog bound to exact live sources, pure statistics
 * over PROVIDED series, structural latency models (clearly models, never measurements),
 * capacity/growth/cost forecasts, and ADVISORY-ONLY recommendations.
 *
 * The no-fabrication law: a MetricSeries with no provided values is NOT_CONNECTED with
 * `values: null` — LPAS never synthesizes a measurement, a percentile of nothing, or a
 * forecast from an empty series. Recommendations are literally `advisory: true` and no
 * code path mutates anything.
 */
import type { Evidence } from '@letbuyy/lcis-core';

export type Connection = 'CONNECTED' | 'NOT_CONNECTED';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type MetricKind = 'latency' | 'throughput' | 'ratio' | 'resource' | 'cold-start' | 'scaling';

/** One catalogued metric: what it measures, on which twin entity, and where its truth lives. */
export interface MetricDescriptor {
  /** Stable key, e.g. 'latency.api./v1/orders' or 'ratio.cache.redis'. */
  readonly key: string;
  readonly kind: MetricKind;
  /** Twin node id the metric attaches to ('<layer>:<name>'). */
  readonly entity: string;
  readonly unit: string;
  /** The exact live source that would supply values. */
  readonly liveSource: string;
  /** Env vars needed to connect the source (empty when structurally unreachable). */
  readonly requiredEnv: readonly string[];
  /** False when the source is structurally unreachable via the GET boundary. */
  readonly reachable: boolean;
  readonly unreachableReason?: string;
}

/** A metric with (optionally) provided values. Values are NEVER synthesized. */
export interface MetricSeries {
  readonly descriptor: MetricDescriptor;
  readonly connection: Connection;
  /** Provided sample values (caller-supplied from a real source) or null when NOT_CONNECTED. */
  readonly values: readonly number[] | null;
  readonly evidence: readonly Evidence[];
}

export interface SeriesStatistics {
  readonly count: number;
  readonly mean: number;
  readonly min: number;
  readonly max: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly stddev: number;
}

/** A structural latency MODEL entry — expectations from topology, never a measurement. */
export interface LatencyModelEntry {
  readonly entity: string;
  /** Hop chain the request traverses (twin node ids). */
  readonly chain: readonly string[];
  /** Number of network/system hops — the structural driver of latency. */
  readonly hops: number;
  /** Qualitative band derived from hops: 'single-hop' | 'multi-hop' | 'deep-chain'. */
  readonly band: 'single-hop' | 'multi-hop' | 'deep-chain';
  readonly note: string;
  readonly evidence: readonly Evidence[];
}

export interface PerformanceFinding {
  readonly id: string;
  readonly rule: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  readonly connection: Connection;
  readonly evidence: readonly Evidence[];
}

/** Base provenance carried by every LPAS output. */
export interface PerformanceArtifact {
  readonly evidence: readonly Evidence[];
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
  readonly liveConnected: boolean;
}

export interface CapacityForecast extends PerformanceArtifact {
  readonly subject: string;
  readonly connection: Connection;
  /** Forecast points (from the operations forecast methods) or null when no series provided. */
  readonly forecastValues: readonly number[] | null;
  readonly horizon: number;
  readonly method: string;
  readonly summary: string;
}

export interface CostForecast extends PerformanceArtifact {
  readonly connection: Connection;
  /** Cost model inputs present structurally; totals are query-bound. */
  readonly modeledComponents: readonly string[];
  readonly forecastValues: readonly number[] | null;
  readonly horizon: number;
  readonly summary: string;
}

export interface Recommendation {
  readonly id: string;
  readonly rule: string;
  /** ALWAYS true — LPAS never acts. */
  readonly advisory: true;
  readonly action: string;
  readonly rationale: string;
  readonly severity: Severity;
  readonly evidence: readonly Evidence[];
}

/** The flagship report. */
export interface PerformanceReport extends PerformanceArtifact {
  readonly catalog: readonly MetricDescriptor[];
  readonly connectedMetrics: number;
  readonly notConnectedMetrics: number;
  readonly latencyModel: readonly LatencyModelEntry[];
  readonly findings: readonly PerformanceFinding[];
  readonly recommendations: readonly Recommendation[];
  readonly capacity: CapacityForecast | null;
  readonly cost: CostForecast | null;
  readonly summary: string;
}
