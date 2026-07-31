/**
 * SeverityScorer — deterministic severity from entity sensitivity. Money exposure is
 * always critical; tenant/public exposure is at least high. Pure, no IO.
 */
import type { Severity } from './types';

const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

export class SeverityScorer {
  /** money → critical; tenant/public → high; otherwise the provided base (default medium). */
  forEntity(opts: { money?: boolean; tenant?: boolean; public?: boolean; base?: Severity }): Severity {
    if (opts.money) return 'critical';
    if (opts.tenant || opts.public) return 'high';
    return opts.base ?? 'medium';
  }
  rank(s: Severity): number {
    return RANK[s];
  }
  max(a: Severity, b: Severity): Severity {
    return RANK[a] >= RANK[b] ? a : b;
  }
}
