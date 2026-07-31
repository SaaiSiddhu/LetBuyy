/**
 * OperationalConfidenceCalculator — structural-only confidence, hard-capped at 0.9 (LCOS never
 * claims certainty), and FORCED to 0 for any NOT_CONNECTED value (no live value → no confidence
 * in a value, never fabricated).
 */
import type { Evidence } from '@letbuyy/lcis-core';
import type { OperationalStatus } from './types';

export class OperationalConfidenceCalculator {
  fromEvidence(evidence: readonly Evidence[], base = 0.5): number {
    if (evidence.length === 0) return 0;
    return Math.min(0.9, Math.round((base + Math.min(evidence.length, 8) * 0.05) * 100) / 100);
  }
  /** A directly-observed structural fact (declared topology). */
  structural(): number {
    return 0.9;
  }
  /** A live value that is not connected — confidence in the VALUE is 0. */
  notConnected(): number {
    return 0;
  }
  /** Confidence for a fact given its connection status. */
  forStatus(status: OperationalStatus, evidence: readonly Evidence[]): number {
    if (status === 'CONNECTED') return this.fromEvidence(evidence);
    if (status === 'PARTIAL') return Math.min(0.5, this.fromEvidence(evidence));
    return 0; // NOT_CONNECTED / UNKNOWN / NOT_DETECTABLE
  }
}
