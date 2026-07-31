/**
 * EngineeringSeverityScorer — deterministic severity for engineering gates/risks. Money exposure
 * is critical; tenant exposure or a broad blast is at least high. Pure, no IO.
 */
import type { Severity } from './types';

const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

export class EngineeringSeverityScorer {
  forFeature(opts: { money?: boolean; tenant?: boolean; broadBlast?: boolean; base?: Severity }): Severity {
    if (opts.money) return 'critical';
    if (opts.tenant || opts.broadBlast) return 'high';
    return opts.base ?? 'medium';
  }
  rank(s: Severity): number {
    return RANK[s];
  }
  max(a: Severity, b: Severity): Severity {
    return RANK[a] >= RANK[b] ? a : b;
  }
}
