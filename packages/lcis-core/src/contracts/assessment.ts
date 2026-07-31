/**
 * Assessment vocabulary — findings, risks, decisions, recommendations, incidents.
 * All scores are EXPLAINABLE: every Risk/RankedFix carries its formula + factor breakdown.
 */
import type { Evidence } from './evidence';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** A discrete, evidenced observation. */
export interface Finding {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  readonly domain?: string;
  readonly evidence: readonly Evidence[];
}

/** A ranked risk with a transparent score (no black box). */
export interface Risk {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  readonly score: number;
  /** The literal formula used, e.g. "(severity*40)+(money*30)+...". */
  readonly formula: string;
  /** The named factor values that fed the formula. */
  readonly factors: Readonly<Record<string, number>>;
  readonly evidence: readonly Evidence[];
}

export type InrImpactTier = 'critical' | 'high' | 'medium' | 'low';

export interface Recommendation {
  readonly id: string;
  readonly title: string;
  readonly rationale: string;
  readonly inrImpact?: InrImpactTier;
  readonly evidence: readonly Evidence[];
}

export interface RankedRisk extends Risk {
  readonly rank: number;
}

export interface RankedFix extends Recommendation {
  readonly rank: number;
  readonly score: number;
  readonly formula: string;
  readonly factors: Readonly<Record<string, number>>;
}

export interface Decision {
  readonly id: string;
  readonly statement: string;
  readonly rationale: string;
  readonly date?: string;
  readonly evidence: readonly Evidence[];
}

export interface Incident {
  readonly id: string;
  readonly domain: string;
  readonly summary: string;
  readonly severity: Severity;
  readonly evidence: readonly Evidence[];
}
