/**
 * tracking() — stamps the mandatory provenance (evidence / confidence / sources / timestamp)
 * plus the honest `liveConnected` flag onto every LCTS output. Confidence derives from
 * evidence (cap 0.9 structural), 0 without evidence; liveConnected defaults to false.
 */
import { type Evidence } from '@letbuyy/lcis-core';
import type { TrackingArtifact } from './types';

export const defaultNow = (): string => new Date().toISOString();

function dedupeSources(evidence: readonly Evidence[]): string[] {
  return [...new Set(evidence.map((e) => e.source).filter((s): s is string => typeof s === 'string'))];
}

export function confidenceFrom(evidence: readonly Evidence[]): number {
  if (evidence.length === 0) return 0;
  const connected = evidence.filter((e) => e.kind !== 'not-connected').length;
  if (connected === 0) return 0;
  return Math.min(0.9, 0.5 + 0.1 * connected);
}

export function tracking<T extends object>(
  body: T,
  opts: {
    evidence: readonly Evidence[];
    sources?: readonly string[];
    confidence?: number;
    liveConnected?: boolean;
    now?: () => string;
  },
): T & TrackingArtifact {
  return {
    ...body,
    evidence: opts.evidence,
    confidence: opts.confidence ?? confidenceFrom(opts.evidence),
    sources: opts.sources ?? dedupeSources(opts.evidence),
    timestamp: (opts.now ?? defaultNow)(),
    liveConnected: opts.liveConnected ?? false,
  };
}
