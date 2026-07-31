/**
 * LRAS (Root Cause Analysis System) type vocabulary — the FROZEN contract. LRAS turns a
 * symptom into a ranked, evidence-cited diagnosis by composing the twin (propagation),
 * change tracking (what changed), governance (owners), engineering (rollback/verification),
 * and operations (area context). Deterministic rule evaluation — no AI, no guessing.
 *
 * Anti-hallucination law: every CauseHypothesis MUST carry ≥1 evidence item — evidence-free
 * hypotheses are dropped before ranking; zero surviving hypotheses → verdict UNKNOWN with
 * the exact missing signals named. Confidence is rule-derived, never invented.
 */
import type { Evidence } from '@letbuyy/lcis-core';

export type Connection = 'CONNECTED' | 'NOT_CONNECTED';

/** The six mandated symptom kinds + the honest fallback. */
export type SymptomKind =
  | 'orders-failing' | 'checkout-broken' | 'queue-backlog'
  | 'high-latency' | 'deployment-failed' | 'worker-crashed'
  | 'unknown';

export interface Symptom {
  /** The raw text the caller reported. */
  readonly text: string;
  readonly kind: SymptomKind;
  /** Domain keys the symptom maps to (deterministic taxonomy). */
  readonly domains: readonly string[];
  /** Twin entity ids the symptom anchors to (e.g. 'domain:payments', 'queue:order-events'). */
  readonly anchors: readonly string[];
  /** Terms extracted from the text that matched the taxonomy. */
  readonly matchedTerms: readonly string[];
}

export type CauseCategory =
  | 'change' | 'dependency' | 'infrastructure' | 'configuration' | 'external' | 'unknown';

export interface CauseHypothesis {
  readonly id: string;
  /** The rule that produced it (RC01..). */
  readonly rule: string;
  readonly category: CauseCategory;
  readonly cause: string;
  readonly detail: string;
  /** 0..1, rule-derived (base per rule ± evidence adjustments). Never invented. */
  readonly confidence: number;
  readonly connection: Connection;
  /** NEVER empty — evidence-free hypotheses are dropped before ranking. */
  readonly evidence: readonly Evidence[];
}

/** Base provenance carried by every LRAS output. */
export interface RootCauseArtifact {
  readonly evidence: readonly Evidence[];
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
  readonly liveConnected: boolean;
}

export interface AffectedSummary {
  /** Twin node ids reached from the symptom anchors. */
  readonly systems: readonly string[];
  readonly byLayer: Readonly<Record<string, number>>;
  readonly domains: readonly string[];
  /** Deployment surfaces affected (twin deployment/infrastructure nodes; empty when none derivable). */
  readonly deployments: readonly string[];
}

export interface RecentChangeSummary {
  /** Change records correlated to the affected systems (from LCTS). */
  readonly changes: readonly { readonly id: string; readonly kind: string; readonly subject: string; readonly detail: string }[];
  readonly migrations: readonly string[];
  readonly connection: Connection;
}

/** The deterministic context the hypothesis rules evaluate over (assembled by the facade). */
export interface HypothesisInput {
  readonly symptom: Symptom;
  readonly affected: AffectedSummary;
  readonly recentChanges: RecentChangeSummary;
  /** Twin structural signals relevant to the affected set. */
  readonly structure: {
    /** Cycles that intersect the affected systems (node-id lists). */
    readonly cycles: readonly (readonly string[])[];
    /** SPOF node ids that intersect the affected systems. */
    readonly spofs: readonly string[];
    /** Affected queue node ids with zero consumers (structural). */
    readonly consumerlessQueues: readonly string[];
  };
  /** Live signals relevant to the affected area that are NOT_CONNECTED (signal key + source). */
  readonly notConnectedSignals: readonly { readonly signal: string; readonly source: string }[];
  /** External providers on the affected path (e.g. 'Razorpay'). */
  readonly externalProviders: readonly string[];
}

export type DiagnosisVerdict = 'DIAGNOSED' | 'PARTIAL' | 'UNKNOWN';

export interface Diagnosis extends RootCauseArtifact {
  readonly symptom: Symptom;
  readonly verdict: DiagnosisVerdict;
  /** Ranked by confidence desc, then rule id asc. Empty iff verdict UNKNOWN. */
  readonly hypotheses: readonly CauseHypothesis[];
  readonly affected: AffectedSummary;
  readonly recentChanges: RecentChangeSummary;
  /** Owners of the most affected domains (empty when unowned — honest). */
  readonly likelyOwners: readonly string[];
  /** Rollback recommendation from EINS (null when no change-hypothesis survives). */
  readonly recommendedRollback: { readonly readiness: string; readonly steps: readonly string[] } | null;
  /** Verification steps from EINS. */
  readonly verificationPlan: readonly string[];
  /** When verdict is UNKNOWN/PARTIAL: the exact signals that would sharpen the diagnosis. */
  readonly missingSignals: readonly { readonly signal: string; readonly source: string }[];
  readonly summary: string;
}
