/**
 * decision() — stamps the mandatory provenance onto every LDSS output.
 * The single sanctioned clock boundary of this package (defaultNow).
 */
import { type Evidence } from '@letbuyy/lcis-core';
import type { DecisionArtifact, TradeoffAxis } from './types';

export const defaultNow = (): string => new Date().toISOString();

/** The tradeoff axes, in canonical order. */
export const AXES: readonly TradeoffAxis[] = ['risk', 'cost', 'readiness', 'blast-radius'];

/** Weights for the composite score (sum = 1). Deterministic calibration constants. */
export const AXIS_WEIGHTS: Readonly<Record<TradeoffAxis, number>> = {
  risk: 0.35,
  cost: 0.2,
  readiness: 0.3,
  'blast-radius': 0.15,
};

export function composite(scores: Readonly<Record<TradeoffAxis, number>>): number {
  let sum = 0;
  for (const axis of AXES) sum += scores[axis] * AXIS_WEIGHTS[axis];
  return Math.round(sum * 1000) / 1000;
}

function dedupeSources(evidence: readonly Evidence[]): string[] {
  return [...new Set(evidence.map((e) => e.source).filter((s): s is string => typeof s === 'string'))];
}

export function confidenceFrom(evidence: readonly Evidence[]): number {
  if (evidence.length === 0) return 0;
  const connected = evidence.filter((e) => e.kind !== 'not-connected').length;
  if (connected === 0) return 0;
  return Math.min(0.9, 0.5 + 0.1 * connected);
}

export function decision<T extends object>(
  body: T,
  opts: {
    evidence: readonly Evidence[];
    sources?: readonly string[];
    confidence?: number;
    liveConnected?: boolean;
    now?: () => string;
  },
): T & DecisionArtifact {
  return {
    ...body,
    evidence: opts.evidence,
    confidence: opts.confidence ?? confidenceFrom(opts.evidence),
    sources: opts.sources ?? dedupeSources(opts.evidence),
    timestamp: (opts.now ?? defaultNow)(),
    liveConnected: opts.liveConnected ?? false,
  };
}
