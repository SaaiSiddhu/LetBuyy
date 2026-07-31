/**
 * CapacityService — structural capacity forecast delegating to the lcis-operations
 * OLS linear-trend primitive. READ-ONLY, deterministic, injectable clock.
 *
 * No-fabrication law: when no series is provided the forecast is NOT_CONNECTED with
 * forecastValues null and evidence citing the exact missing live source.
 * When a series is provided the forecast is CONNECTED with forecastValues = the OLS
 * linear-trend projection (delegated, never re-implemented here).
 */
import { evidence as makeEvidence, notConnected, type LcisEngine } from '@letbuyy/lcis-core';
import { linearTrend } from '@letbuyy/lcis-operations';
import { performance, defaultNow } from '../shared/envelope';
import type { CapacityForecast } from '../shared/types';

const METHOD = 'ols-linear-trend (lcis-operations)';
const SOURCE = 'packages/lcis-operations/src/forecast/methods.ts#linearTrend';

export class CapacityService {
  private readonly now: () => string;

  /** `core` is accepted for symmetry with sibling services (store access). */
  constructor(_core: LcisEngine, now: () => string = defaultNow) {
    this.now = now;
  }

  /**
   * Forecast capacity for `subject` over `horizon` periods.
   *
   * @param subject  Human-readable name of the thing being forecast
   *                 (e.g. 'cloudflare-workers-requests', 'supabase-db-size-gb').
   * @param series   Caller-provided historical observations (non-null, non-empty →
   *                 CONNECTED); null or empty → NOT_CONNECTED, forecastValues null.
   * @param horizon  Number of future periods to project (default 6).
   */
  forecastCapacity(
    subject: string,
    series: readonly number[] | null,
    horizon = 6,
  ): CapacityForecast {
    const nowFn = this.now;

    if (series !== null && series.length > 0) {
      // ── CONNECTED path ───────────────────────────────────────────────────────
      const mutable = [...series];
      const result = linearTrend(mutable);
      const forecastValues = result.forecast(horizon);

      const ev = [
        makeEvidence(
          'artifact-field',
          subject,
          `Caller-provided ${series.length}-point series used as input to ${METHOD}.`,
          'caller-provided',
        ),
        makeEvidence(
          'doc',
          SOURCE,
          `linearTrend delegated from lcis-operations; slope=${result.slope.toFixed(4)}, intercept=${result.intercept.toFixed(4)}.`,
          SOURCE,
        ),
      ];

      return performance(
        {
          subject,
          connection: 'CONNECTED' as const,
          forecastValues,
          horizon,
          method: METHOD,
          summary:
            `Capacity forecast for '${subject}': ${horizon} forward projections via ${METHOD}. ` +
            `Slope ${result.slope.toFixed(4)} per period. Input: ${series.length} caller-provided observations.`,
        },
        {
          evidence: ev,
          liveConnected: true,
          now: nowFn,
        },
      );
    }

    // ── NOT_CONNECTED path ─────────────────────────────────────────────────────
    const ev = [
      notConnected(subject, 'live usage series (telemetry adapters)'),
    ];

    return performance(
      {
        subject,
        connection: 'NOT_CONNECTED' as const,
        forecastValues: null,
        horizon,
        method: METHOD,
        summary:
          `Capacity forecast for '${subject}' NOT_CONNECTED — no series provided. ` +
          `No values are fabricated. Supply caller-provided historical observations to enable the ${METHOD} projection.`,
      },
      {
        evidence: ev,
        liveConnected: false,
        now: nowFn,
      },
    );
  }
}
