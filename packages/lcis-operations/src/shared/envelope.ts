/**
 * operations() — stamps the mandatory provenance (evidence / confidence / sources / timestamp)
 * plus the honest `liveConnected` flag onto every LCOS report. Confidence is structural-only
 * (cap 0.9) and 0 without evidence; liveConnected defaults to false (no live values in this env).
 * Re-exports lcis-core's envelope() verbatim for the access layer (no duplication).
 */
import { type Evidence, envelope } from '@letbuyy/lcis-core';
import { OperationalConfidenceCalculator } from './confidence';
import type { OperationalArtifact } from './types';

export const defaultNow = (): string => new Date().toISOString();

const conf = new OperationalConfidenceCalculator();

function dedupeSources(evidence: readonly Evidence[]): string[] {
  return [...new Set(evidence.map((e) => e.source).filter((s): s is string => typeof s === 'string'))];
}

export function operations<T extends object>(
  body: T,
  opts: {
    evidence: readonly Evidence[];
    sources?: readonly string[];
    confidence?: number;
    liveConnected?: boolean;
    now?: () => string;
  },
): T & OperationalArtifact {
  return {
    ...body,
    evidence: opts.evidence,
    confidence: opts.confidence ?? conf.fromEvidence(opts.evidence),
    sources: opts.sources ?? dedupeSources(opts.evidence),
    timestamp: (opts.now ?? defaultNow)(),
    liveConnected: opts.liveConnected ?? false,
  };
}

export { envelope };
