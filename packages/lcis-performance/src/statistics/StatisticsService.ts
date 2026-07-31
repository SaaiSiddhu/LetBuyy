/**
 * StatisticsService — pure, constructor-only, no IO, no clock, no side effects.
 *
 * All methods operate on CALLER-PROVIDED arrays. The no-fabrication law:
 * - An empty input always returns null (never throw, never invent a value).
 * - Statistics are computed only over the exact values provided.
 * - trendOf and movingAverageOf delegate entirely to the @letbuyy/lcis-operations
 *   forecast primitives; this service adds no math of its own beyond statsOf.
 *
 * Percentile method (statsOf):
 *   Sort the values ascending.  For percentile p over an array of length len:
 *     index = min(len - 1, max(0, ceil(p / 100 * len) - 1))
 *   i.e. ceil-based nearest-rank with clamping to [0, len-1].
 *   This formula is applied for p50, p95, and p99.
 *
 * Standard deviation (statsOf):
 *   Population stddev (divide by N, not N-1):
 *     stddev = sqrt( Σ(x_i - mean)² / N )
 */

import { movingAverage, linearTrend } from '@letbuyy/lcis-operations';
import type { SeriesStatistics } from '../shared/types';

export class StatisticsService {
  /**
   * Compute descriptive statistics over a provided array of numbers.
   *
   * Returns null for empty input — never fabricates statistics.
   *
   * Percentile formula: sort ascending, then for percentile p:
   *   index = min(len - 1, max(0, ceil(p / 100 * len) - 1))
   *
   * Standard deviation: population stddev (divide by N).
   */
  statsOf(values: readonly number[]): SeriesStatistics | null {
    if (values.length === 0) return null;

    const count = values.length;

    // Mean
    let sum = 0;
    for (const v of values) sum += v;
    const mean = sum / count;

    // Min / Max
    let min = values[0]!;
    let max = values[0]!;
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }

    // Population stddev
    let variance = 0;
    for (const v of values) variance += (v - mean) ** 2;
    const stddev = Math.sqrt(variance / count);

    // Sorted copy for percentiles
    const sorted = [...values].sort((a, b) => a - b);
    const pct = (p: number): number => {
      const idx = Math.min(count - 1, Math.max(0, Math.ceil((p / 100) * count) - 1));
      return sorted[idx]!;
    };

    return {
      count,
      mean,
      min,
      max,
      p50: pct(50),
      p95: pct(95),
      p99: pct(99),
      stddev,
    };
  }

  /**
   * Compute a linear (OLS) trend forecast over the provided values.
   *
   * Delegates entirely to `linearTrend` from @letbuyy/lcis-operations.
   * Returns null for empty input — never fabricates a forecast.
   *
   * For a non-empty series, returns exactly horizon forecast values starting
   * at x = series.length (i.e. the next horizon steps after the last point).
   */
  trendOf(values: readonly number[], horizon: number): readonly number[] | null {
    if (values.length === 0) return null;
    return linearTrend([...values]).forecast(horizon);
  }

  /**
   * Compute a simple moving average over the provided values.
   *
   * Delegates entirely to `movingAverage` from @letbuyy/lcis-operations.
   * Returns null for empty input (no fabrication).
   *
   * The delegate returns [] when series.length < window; this service
   * preserves that as-is (non-null empty array) so callers can distinguish
   * "no input" (null) from "window larger than series" ([]).
   *
   * Throws (via the delegate) when window <= 0.
   */
  movingAverageOf(values: readonly number[], window: number): readonly number[] | null {
    if (values.length === 0) return null;
    return movingAverage([...values], window);
  }
}
