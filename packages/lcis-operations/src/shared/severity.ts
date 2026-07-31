/**
 * OperationalSeverityScorer — deterministic severity from operational context. Money/SPOF
 * exposure is critical; tenant/dead-letter exposure is at least high. Pure, no IO.
 */
import type { Severity } from './types';

const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

export class OperationalSeverityScorer {
  forSignal(opts: { money?: boolean; tenant?: boolean; spof?: boolean; deadLetter?: boolean; base?: Severity }): Severity {
    if (opts.money || opts.spof) return 'critical';
    if (opts.tenant || opts.deadLetter) return 'high';
    return opts.base ?? 'medium';
  }
  rank(s: Severity): number {
    return RANK[s];
  }
  max(a: Severity, b: Severity): Severity {
    return RANK[a] >= RANK[b] ? a : b;
  }
}
