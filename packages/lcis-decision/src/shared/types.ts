/**
 * LDSS (Decision Support System) type vocabulary — the FROZEN contract. LDSS is the capstone:
 * it composes ALL prior LCIS systems into structured decisions. For a decision request it
 * generates strategy ALTERNATIVES, scores them on TRADEOFF axes, resolves the AFFECTED
 * SURFACE via the dependency twin, and RECOMMENDS one — with evidence, confidence, and the
 * full alternative/tradeoff set.
 *
 * SAFETY LAW: LDSS is not an execution engine. Every output is a recommendation. There is no
 * apply/execute/deploy path anywhere in this package. Runtime weights are NOT_CONNECTED.
 */
import type { Evidence } from '@letbuyy/lcis-core';

export type Connection = 'CONNECTED' | 'NOT_CONNECTED';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type DecisionKind =
  | 'deploy' | 'migration' | 'rollback' | 'scaling' | 'business' | 'architecture';

/** The four tradeoff axes every alternative is scored on. Scores are 0..1, higher = better. */
export type TradeoffAxis = 'risk' | 'cost' | 'readiness' | 'blast-radius';

export interface DecisionRequest {
  readonly kind: DecisionKind;
  /** The subject entity: a feature name, twin node id, service, table, etc. */
  readonly subject: string;
  /** Optional free-text context (deterministically incorporated into evidence only). */
  readonly context?: string;
}

export interface Alternative {
  readonly id: string;
  readonly strategy: string;
  readonly description: string;
  /** Per-axis score 0..1 (higher = better). Deterministic per-strategy calibration. */
  readonly scores: Readonly<Record<TradeoffAxis, number>>;
  /** Weighted composite (0..1) used for ranking. */
  readonly compositeScore: number;
  readonly evidence: readonly Evidence[];
}

export interface Tradeoff {
  readonly axis: TradeoffAxis;
  /** The alternative id that wins this axis. */
  readonly winner: string;
  readonly comparison: string;
}

export interface AffectedSurface {
  readonly systems: readonly string[];
  readonly services: readonly string[];
  readonly tables: readonly string[];
  readonly apis: readonly string[];
  readonly workers: readonly string[];
  readonly domains: readonly string[];
  /** Runtime blast weights are NOT_CONNECTED — this surface is structural topology only. */
  readonly connection: Connection;
}

export interface ComparisonRow {
  readonly alternative: string;
  /** 0..1 (higher = better on the compared axis). */
  readonly score: number;
  readonly note: string;
}

export interface Comparison {
  readonly axis: TradeoffAxis;
  readonly rows: readonly ComparisonRow[];
  /** The winning alternative id. */
  readonly best: string;
}

export type DecisionVerdict = 'RECOMMENDED' | 'CONDITIONAL' | 'UNKNOWN';

/** Which prior LCIS systems informed this decision (the composition graph). */
export interface CompositionEdge {
  readonly system: string;
  readonly contribution: string;
}

/** Base provenance carried by every LDSS output. */
export interface DecisionArtifact {
  readonly evidence: readonly Evidence[];
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
  readonly liveConnected: boolean;
}

export interface Decision extends DecisionArtifact {
  readonly request: DecisionRequest;
  readonly verdict: DecisionVerdict;
  /** The recommended alternative id (null iff verdict UNKNOWN). */
  readonly recommended: string | null;
  /** Ranked by compositeScore desc, then id asc. */
  readonly alternatives: readonly Alternative[];
  readonly tradeoffs: readonly Tradeoff[];
  readonly affected: AffectedSurface;
  readonly riskComparison: Comparison;
  readonly costComparison: Comparison;
  readonly composedFrom: readonly CompositionEdge[];
  /** Advisory-only rationale (LDSS recommends; it never acts). */
  readonly rationale: string;
  readonly summary: string;
}

export interface DecisionReport extends DecisionArtifact {
  readonly decision: Decision;
  readonly summary: string;
}
