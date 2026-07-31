/**
 * Deterministic forecast math — pure functions with NO side effects, NO IO, NO AI.
 * Each function operates on plain number arrays and returns exact results.
 * These are the algorithmic primitives ForecastOperationsService uses; they are
 * unit-tested on synthetic arrays with known expected outputs.
 *
 * READ-ONLY contract: no imports touch the network, file system, or DB.
 */

// ── Moving Average ────────────────────────────────────────────────────────────

/**
 * Simple Moving Average (SMA).
 * Returns an array of length `series.length - window + 1` where each element
 * is the arithmetic mean of the preceding `window` elements.
 *
 * Edge cases:
 *   - series.length < window → returns []
 *   - window <= 0 → throws (invalid)
 *   - window === 1 → returns a copy of the series
 */
export function movingAverage(series: number[], window: number): number[] {
  if (window <= 0) throw new RangeError(`window must be >= 1, got ${window}`);
  if (series.length < window) return [];
  const result: number[] = [];
  for (let i = 0; i <= series.length - window; i++) {
    let sum = 0;
    for (let j = 0; j < window; j++) sum += series[i + j]!;
    result.push(sum / window);
  }
  return result;
}

// ── Ordinary Least-Squares Linear Trend ──────────────────────────────────────

export interface LinearTrendResult {
  /** Slope (change per unit index). */
  readonly slope: number;
  /** Y-intercept (value at x=0). */
  readonly intercept: number;
  /**
   * Returns `n` forecast values starting at x = series.length.
   * i.e. forecast(1) gives the next predicted value after the series.
   */
  forecast(n: number): number[];
}

/**
 * OLS linear trend.
 * series[0] = x=0, series[1] = x=1, …
 *
 * Edge cases:
 *   - series.length === 0 → slope=0, intercept=0
 *   - series.length === 1 → slope=0, intercept=series[0]
 *   - series.length >= 2 → full OLS
 */
export function linearTrend(series: number[]): LinearTrendResult {
  const n = series.length;
  if (n === 0) {
    return { slope: 0, intercept: 0, forecast: (k: number) => Array(k).fill(0) };
  }
  if (n === 1) {
    const v = series[0]!;
    return {
      slope: 0,
      intercept: v,
      forecast: (k: number) => Array(k).fill(v),
    };
  }

  // OLS: minimise Σ(y_i - (a + b·x_i))²
  // b = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²)
  // a = (Σy − b·Σx) / n
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const y = series[i]!;
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  // Degenerate case: all x identical (shouldn't happen for distinct indices, but guard)
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return {
    slope,
    intercept,
    forecast(k: number): number[] {
      const out: number[] = [];
      for (let j = 0; j < k; j++) out.push(intercept + slope * (n + j));
      return out;
    },
  };
}

// ── Confidence Interval (std-error based) ────────────────────────────────────

export interface ConfidenceInterval {
  readonly lo: number;
  readonly hi: number;
}

/**
 * Symmetric confidence interval around a forecast point, based on the
 * sample standard deviation of the series (as a proxy for residual spread).
 *
 * `lo = point - z·σ`,  `hi = point + z·σ`
 *
 * Default z = 1.96 (95 % normal approximation).
 * Requires series.length >= 2 to compute a meaningful σ; returns ±0 for shorter series.
 *
 * This is a structural approximation (no fitted residuals — those require a
 * regression residual series). It is deliberately conservative: uses the
 * full-series σ as an upper-bound on spread.
 */
export function confidenceInterval(
  series: number[],
  point: number,
  z = 1.96,
): ConfidenceInterval {
  const n = series.length;
  if (n < 2) return { lo: point, hi: point };

  // Population-corrected std deviation (Bessel's correction)
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const variance = series.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1);
  const sigma = Math.sqrt(variance);
  const margin = z * sigma;

  return { lo: point - margin, hi: point + margin };
}
