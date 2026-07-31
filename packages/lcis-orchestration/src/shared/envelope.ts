/**
 * execution() — stamps the mandatory provenance (evidence / confidence / sources / timestamp)
 * plus the honest `liveConnected` flag onto every EAOS report. Confidence is structural-only
 * (cap 0.9), 0 without evidence; liveConnected defaults to false (no live execution tracker wired).
 * Re-exports lcis-core's envelope() verbatim for the access layer (no duplication).
 */
import { type Evidence, envelope } from '@letbuyy/lcis-core';
import { ExecutionConfidenceCalculator } from './confidence';
import type { OrchestrationArtifact } from './types';

export const defaultNow = (): string => new Date().toISOString();

const conf = new ExecutionConfidenceCalculator();

function dedupeSources(evidence: readonly Evidence[]): string[] {
  return [...new Set(evidence.map((e) => e.source).filter((s): s is string => typeof s === 'string'))];
}

export function execution<T extends object>(
  body: T,
  opts: {
    evidence: readonly Evidence[];
    sources?: readonly string[];
    confidence?: number;
    liveConnected?: boolean;
    now?: () => string;
  },
): T & OrchestrationArtifact {
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
