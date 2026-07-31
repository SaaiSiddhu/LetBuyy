/**
 * plan() — stamps the mandatory provenance (evidence / confidence / sources / timestamp)
 * onto every EIS output. Confidence is structural-only and capped at 0.95 (LCIS never
 * claims certainty); a zero-evidence plan is honestly confidence 0.
 */
import type { Evidence } from '@letbuyy/lcis-core';
import type { PlanArtifact } from './types';

export const defaultNow = (): string => new Date().toISOString();

/** Confidence scales with evidence breadth; 0 when there is no evidence; capped at 0.95. */
export function planConfidence(evidence: readonly Evidence[], base = 0.5): number {
  if (evidence.length === 0) return 0;
  const c = base + Math.min(evidence.length, 9) * 0.05;
  return Math.min(Math.round(c * 100) / 100, 0.95);
}

function dedupeSources(evidence: readonly Evidence[]): string[] {
  return [...new Set(evidence.map((e) => e.source).filter((s): s is string => typeof s === 'string'))];
}

export function plan<T extends object>(
  body: T,
  opts: {
    evidence: readonly Evidence[];
    sources?: readonly string[];
    confidence?: number;
    now?: () => string;
  },
): T & PlanArtifact {
  return {
    ...body,
    evidence: opts.evidence,
    confidence: opts.confidence ?? planConfidence(opts.evidence),
    sources: opts.sources ?? dedupeSources(opts.evidence),
    timestamp: (opts.now ?? defaultNow)(),
  };
}
