/**
 * The live-adapter contract. Every adapter is a READ-ONLY observer of an external
 * source of truth (Supabase/GitHub/Cloudflare/Vercel). LCIS normalises + cites the
 * facts; it is never the source of truth and never mutates.
 */
import type { Evidence } from '@letbuyy/lcis-core';

export type AdapterStatus = 'CONNECTED' | 'NOT_CONNECTED' | 'ERROR' | 'DEGRADED';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AdapterMetadata {
  /** Stable key, e.g. 'supabase'. */
  readonly name: string;
  readonly displayName: string;
  /** Env vars whose PRESENCE is required (values are never read into LCIS output). */
  readonly requiredEnv: readonly string[];
  readonly capabilities: readonly string[];
  /** The system that owns the truth. LCIS only observes it. */
  readonly sourceOfTruth: string;
}

export interface HealthResult {
  readonly adapter: string;
  readonly status: AdapterStatus;
  readonly latencyMs: number | null;
  /** Env vars that must be set to connect this adapter (the honest "what to set" list). Empty when connected. */
  readonly missingEnvVars: readonly string[];
  readonly checkedAt: string;
  readonly evidence: readonly Evidence[];
  readonly detail: string;
}

export interface AdapterSnapshot<T = unknown> {
  readonly adapter: string;
  /** The source of truth this snapshot was observed from. */
  readonly source: string;
  readonly timestamp: string;
  readonly status: AdapterStatus;
  /** 0..1. Structural/observed facts cap at 0.95; NOT_CONNECTED → 0. */
  readonly confidence: number;
  readonly evidence: readonly Evidence[];
  /** Normalised, read-only facts. Empty/default when NOT_CONNECTED. */
  readonly payload: T;
  readonly ttlMs: number;
}

export interface VerificationFinding {
  /** e.g. 'missing-rls', 'schema-drift', 'broken-migration', 'failed-deployment'. */
  readonly kind: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly detail: string;
  readonly evidence: readonly Evidence[];
}

export interface AdapterVerification {
  readonly adapter: string;
  readonly status: AdapterStatus;
  readonly findings: readonly VerificationFinding[];
  readonly checkedAt: string;
  readonly evidence: readonly Evidence[];
}

/**
 * A normalized, evidence-cited fact observed from a source of truth. Adapters emit these
 * (in their snapshot payload) so the CorrelationEngine can intersect them with lcis-core's
 * structural intelligence. `subject` is normalized to a table / domain key / file path /
 * service / symbol so it can be matched against a blast radius.
 */
export interface LiveFact {
  readonly adapter: string;
  readonly kind: string;
  readonly subject: string;
  readonly detail: string;
  /** ISO timestamp for timeline correlation, or null. */
  readonly at: string | null;
  readonly evidence: readonly Evidence[];
}

/**
 * Every adapter implements exactly this. No adapter may bypass the contract,
 * and no method performs a mutation.
 */
export interface LiveAdapter {
  metadata(): AdapterMetadata;
  health(): Promise<HealthResult>;
  collect(): Promise<AdapterSnapshot>;
  verify(): Promise<AdapterVerification>;
}
