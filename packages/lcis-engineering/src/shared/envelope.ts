/**
 * engineering() — stamps the mandatory provenance (evidence / confidence / sources / timestamp)
 * onto every EINS output. Confidence is structural-only (cap 0.9) and 0 without evidence.
 * Re-exports lcis-core's envelope() verbatim for the access layer (no duplication).
 */
import { type Evidence, envelope } from '@letbuyy/lcis-core';
import { EngineeringConfidenceCalculator } from './confidence';
import type { EngineeringArtifact } from './types';

export const defaultNow = (): string => new Date().toISOString();

const conf = new EngineeringConfidenceCalculator();

function dedupeSources(evidence: readonly Evidence[]): string[] {
  return [...new Set(evidence.map((e) => e.source).filter((s): s is string => typeof s === 'string'))];
}

export function engineering<T extends object>(
  body: T,
  opts: { evidence: readonly Evidence[]; sources?: readonly string[]; confidence?: number; now?: () => string },
): T & EngineeringArtifact {
  return {
    ...body,
    evidence: opts.evidence,
    confidence: opts.confidence ?? conf.fromEvidence(opts.evidence),
    sources: opts.sources ?? dedupeSources(opts.evidence),
    timestamp: (opts.now ?? defaultNow)(),
  };
}

export { envelope };
