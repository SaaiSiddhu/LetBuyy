/**
 * ExecutionSeverityScorer — deterministic severity for execution findings. Money exposure or a
 * failed required validation is critical; a blocked task is high; missing artifact / stale is medium.
 */
import type { Severity } from './types';

const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

export class ExecutionSeverityScorer {
  forFinding(opts: {
    money?: boolean;
    failedValidation?: boolean;
    blocked?: boolean;
    missingArtifact?: boolean;
    stale?: boolean;
    base?: Severity;
  }): Severity {
    if (opts.money || opts.failedValidation) return 'critical';
    if (opts.blocked) return 'high';
    if (opts.missingArtifact || opts.stale) return 'medium';
    return opts.base ?? 'low';
  }
  rank(s: Severity): number {
    return RANK[s];
  }
  max(a: Severity, b: Severity): Severity {
    return RANK[a] >= RANK[b] ? a : b;
  }
}
