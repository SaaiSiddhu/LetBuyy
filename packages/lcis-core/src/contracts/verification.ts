/**
 * Verification vocabulary. The engine refuses to rubber-stamp:
 * a single authoritative contradiction → REFUTED; zero evidence → UNVERIFIED.
 * Verification is ADVISORY; the 108-validator gate stays authoritative.
 */
import type { Evidence } from './evidence';

export type VerificationStatus = 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED' | 'REFUTED';

export interface Gap {
  readonly what: string;
  readonly detail?: string;
  readonly evidence?: readonly Evidence[];
}

export interface Verification {
  readonly subject: string;
  readonly status: VerificationStatus;
  /** 0..1 — capped at 0.95 for structural-only evidence. */
  readonly confidence: number;
  readonly evidence: readonly Evidence[];
  readonly gaps: readonly Gap[];
}
