/**
 * governance() — stamps the mandatory provenance (evidence / confidence / sources /
 * timestamp) onto every GDIS output, exactly like lcis-execution's plan(). Confidence is
 * structural-only and capped at 0.95; a zero-evidence report is honestly confidence 0.
 */
import type { Evidence } from '@letbuyy/lcis-core';
import { ConfidenceCalculator } from './confidence';
import type { GovernanceArtifact } from './types';

export const defaultNow = (): string => new Date().toISOString();

const conf = new ConfidenceCalculator();

function dedupeSources(evidence: readonly Evidence[]): string[] {
  return [...new Set(evidence.map((e) => e.source).filter((s): s is string => typeof s === 'string'))];
}

export function governance<T extends object>(
  body: T,
  opts: { evidence: readonly Evidence[]; sources?: readonly string[]; confidence?: number; now?: () => string },
): T & GovernanceArtifact {
  return {
    ...body,
    evidence: opts.evidence,
    confidence: opts.confidence ?? conf.fromEvidence(opts.evidence),
    sources: opts.sources ?? dedupeSources(opts.evidence),
    timestamp: (opts.now ?? defaultNow)(),
  };
}
