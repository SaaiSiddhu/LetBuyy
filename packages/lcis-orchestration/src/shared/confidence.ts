/**
 * ExecutionConfidenceCalculator — structural-only confidence, capped at 0.9, and 0 for any
 * NOT_CONNECTED value (no live tracker → no confidence in a live value, never fabricated).
 */
import type { Evidence } from '@letbuyy/lcis-core';
import type { Connection } from './types';

export class ExecutionConfidenceCalculator {
  fromEvidence(evidence: readonly Evidence[], base = 0.5): number {
    if (evidence.length === 0) return 0;
    return Math.min(0.9, Math.round((base + Math.min(evidence.length, 8) * 0.05) * 100) / 100);
  }
  structural(): number {
    return 0.9;
  }
  /** CONNECTED → evidence-scaled; NOT_CONNECTED → 0 (the live value is unknown). */
  forConnection(connection: Connection, evidence: readonly Evidence[]): number {
    return connection === 'CONNECTED' ? this.fromEvidence(evidence) : 0;
  }
}
