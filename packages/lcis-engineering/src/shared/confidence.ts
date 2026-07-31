/**
 * EngineeringConfidenceCalculator — structural-only confidence, capped at 0.9 (EINS never
 * claims certainty). Because EINS composes prior plans, it can also derive confidence as the
 * mean of the composed plans' confidences (a faithful aggregate, never inflated).
 */
import type { Evidence } from '@letbuyy/lcis-core';

export class EngineeringConfidenceCalculator {
  fromEvidence(evidence: readonly Evidence[], base = 0.5): number {
    if (evidence.length === 0) return 0;
    return Math.min(0.9, Math.round((base + Math.min(evidence.length, 8) * 0.05) * 100) / 100);
  }
  /** Aggregate the confidences of the composed prior-system plans (mean, capped). */
  fromComposed(confidences: readonly number[]): number {
    const vals = confidences.filter((c) => typeof c === 'number');
    if (vals.length === 0) return 0;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.min(0.9, Math.round(avg * 100) / 100);
  }
  structural(): number {
    return 0.9;
  }
}
