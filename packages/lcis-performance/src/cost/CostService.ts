/**
 * CostService — structural cost forecast.
 *
 * Reads `cost-intelligence.json` via ArtifactStore.tryRead to extract the list of
 * modeled service components.  The `pricing` array in that artifact holds the real
 * component objects; component names are extracted from the `service` field of each
 * element (matching the actual shape of graphify-out/cost-intelligence.json).
 *
 * Forecast values are delegated to the lcis-operations OLS linear-trend primitive —
 * never re-implemented here.
 *
 * No-fabrication law:
 *   - Absent artifact → modeledComponents [] + NOT_CONNECTED evidence.
 *   - Present artifact but unexpected shape → modeledComponents [] (zod-loose: tolerate).
 *   - Forecast: series non-empty → CONNECTED, forecastValues = linearTrend.forecast(horizon).
 *   - Forecast: series null/empty → NOT_CONNECTED, forecastValues null.
 */
import { evidence as makeEvidence, notConnected, type LcisEngine } from '@letbuyy/lcis-core';
import { linearTrend } from '@letbuyy/lcis-operations';
import { z } from 'zod';
import { performance, defaultNow } from '../shared/envelope';
import type { CostForecast } from '../shared/types';

const ARTIFACT = 'cost-intelligence';
const METHOD = 'ols-linear-trend (lcis-operations)';
const SOURCE = 'packages/lcis-operations/src/forecast/methods.ts#linearTrend';

/**
 * Zod-loose schema for cost-intelligence.json.
 * We only care about the `pricing` array and its `service` string fields.
 * Unknown extra top-level fields are ignored (passthrough).
 */
const pricingItemSchema = z.object({ service: z.string() }).passthrough();
const costIntelSchema = z
  .object({ pricing: z.array(pricingItemSchema).optional() })
  .passthrough();

function extractComponents(raw: unknown): string[] {
  const parsed = costIntelSchema.safeParse(raw);
  if (!parsed.success) return [];
  return (parsed.data.pricing ?? []).map((p) => p.service);
}

export class CostService {
  private readonly core: LcisEngine;
  private readonly now: () => string;

  constructor(core: LcisEngine, now: () => string = defaultNow) {
    this.core = core;
    this.now = now;
  }

  /**
   * Forecast cost over `horizon` periods.
   *
   * @param series   Caller-provided cost observations (non-null, non-empty → CONNECTED
   *                 forecast); null or empty → NOT_CONNECTED, forecastValues null.
   * @param horizon  Number of future periods (default 6).
   */
  forecastCost(series: readonly number[] | null, horizon = 6): CostForecast {
    const nowFn = this.now;

    // ── Load cost-intelligence artifact (zod-loose) ────────────────────────────
    const raw = this.core.store.tryRead<unknown>(ARTIFACT);
    const modeledComponents = raw !== null ? extractComponents(raw) : [];
    const artifactPresent = raw !== null;

    const artifactEv = artifactPresent
      ? makeEvidence(
          'artifact-field',
          `${ARTIFACT}.json:pricing`,
          `${modeledComponents.length} pricing components loaded: ${modeledComponents.slice(0, 3).join(', ')}${modeledComponents.length > 3 ? ', …' : ''}.`,
          `graphify-out/${ARTIFACT}.json`,
        )
      : notConnected(`${ARTIFACT}.json:pricing`, `graphify-out/${ARTIFACT}.json`);

    // ── Forecast path ──────────────────────────────────────────────────────────
    if (series !== null && series.length > 0) {
      const mutable = [...series];
      const result = linearTrend(mutable);
      const forecastValues = result.forecast(horizon);

      const ev = [
        artifactEv,
        makeEvidence(
          'artifact-field',
          'caller-provided cost series',
          `${series.length}-point series used as input to ${METHOD}.`,
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
          connection: 'CONNECTED' as const,
          modeledComponents,
          forecastValues,
          horizon,
          summary:
            `Cost forecast: ${horizon} forward projections via ${METHOD}. ` +
            `${modeledComponents.length} modeled components from ${ARTIFACT}.json. ` +
            `Slope ${result.slope.toFixed(4)} per period. Input: ${series.length} caller-provided observations.`,
        },
        {
          evidence: ev,
          liveConnected: true,
          now: nowFn,
        },
      );
    }

    // ── NOT_CONNECTED forecast ─────────────────────────────────────────────────
    const ev = [
      artifactEv,
      notConnected(
        'cost time-series',
        'live usage series (telemetry adapters)',
      ),
    ];

    return performance(
      {
        connection: 'NOT_CONNECTED' as const,
        modeledComponents,
        forecastValues: null,
        horizon,
        summary:
          `Cost forecast NOT_CONNECTED — no series provided. ${modeledComponents.length} pricing components ` +
          `modeled structurally from ${ARTIFACT}.json (usage amounts are query-bound). ` +
          `No values are fabricated. Supply caller-provided cost observations to enable the ${METHOD} projection.`,
      },
      {
        evidence: ev,
        liveConnected: false,
        now: nowFn,
      },
    );
  }
}
