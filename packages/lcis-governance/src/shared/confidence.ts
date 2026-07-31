/**
 * ConfidenceCalculator — deterministic, structural-only confidence. A directly-observed
 * artifact fact is high-confidence; a finding with no evidence is 0; nothing is ever
 * fabricated. Confidence is capped at 0.95 (LCIS never claims certainty).
 */
import type { Evidence } from '@letbuyy/lcis-core';

export class ConfidenceCalculator {
  /** Scales with evidence breadth; 0 with no evidence; capped at 0.95. */
  fromEvidence(evidence: readonly Evidence[], base = 0.6): number {
    if (evidence.length === 0) return 0;
    return Math.min(0.95, Math.round((base + Math.min(evidence.length, 7) * 0.05) * 100) / 100);
  }
  /** A fact read directly from an artifact (e.g. table.rls === false). */
  structural(): number {
    return 0.9;
  }
  /** An undeterminable factor — low; the value itself stays UNKNOWN, never assumed. */
  unknown(): number {
    return 0.3;
  }
}
