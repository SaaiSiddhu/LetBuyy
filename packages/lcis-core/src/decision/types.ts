/**
 * DecisionService types — all scores are EXPLAINABLE.
 * Every RankedRisk / RankedFix carries a filled-in formula string + factors object.
 *
 * NOTE: The spec defines a local Evidence type (source-tagged) that is distinct from
 * the canonical contracts/evidence.ts Evidence (kind-tagged). Both coexist — the local
 * type models decision provenance, the contract type models graph provenance.
 */

/** Severity labels used in the raw artifact JSON (emoji + text). */
export type Severity = '🔴' | '🟠' | '🟡' | '🟢' | 'critical' | 'unknown';

/**
 * Named factor values that fed a scoring formula.
 * All fields are present on every scored item — no hidden fallbacks.
 */
export interface ScoringFactors {
  /** 3 = critical/🔴, 2 = 🟠, 1 = 🟡, 0 = 🟢/unknown */
  readonly severityWeight: 0 | 1 | 2 | 3;
  /** 1 if domain is a money domain (payments/refunds/payouts/gift-cards/orders), else 0 */
  readonly moneyDomain: 0 | 1;
  /** Per-system structural readiness score (0–100; 0 = unknown) */
  readonly systemReadiness: number;
  /** 1 if item id appears in the open-blockers list, else 0 */
  readonly openBlockerRef: 0 | 1;
}

/** Decision-layer evidence — source-tagged provenance record. */
export interface Evidence {
  readonly source:
    | 'blocker-report'
    | 'domain-intel'
    | 'db-intel'
    | 'infra-intel'
    | 'discovery'
    | 'execution-intel'
    | 'revenue-intel'
    | 'security-intel'
    | 'merchant-intel'
    | 'cert-doc';
  readonly ref: string;
  readonly value: string;
  readonly timestamp?: string;
}

/** A risk item scored and ranked by the DecisionService. */
export interface RankedRisk {
  readonly rank: number;
  readonly id: string;
  readonly type: 'blocker' | 'money' | 'tenant' | 'spof' | 'structural';
  readonly severity: Severity;
  readonly title: string;
  readonly status: string;
  readonly score: number;
  readonly factors: ScoringFactors;
  /** e.g. "severityWeight(3)×40 + moneyDomain(0)×30 + readinessPenalty((100-88)×0.2=2.4) + openBlockerRef(1)×10 = 132.4" */
  readonly formula: string;
  readonly evidence: readonly Evidence[];
}

/** ₹ impact tier for fix ordering. */
export type InrImpactTier = 'critical' | 'high' | 'medium' | 'low';

/** A fix plan scored and ranked by the DecisionService. */
export interface RankedFix {
  readonly rank: number;
  readonly id: string;
  readonly finding: string;
  readonly severity: Severity;
  readonly domain: string;
  readonly inrImpactTier: InrImpactTier;
  readonly fixPlan: string;
  readonly verificationPlan: string;
  readonly testPlan: string;
  readonly rollbackPlan: string;
  readonly score: number;
  readonly factors: ScoringFactors;
  readonly formula: string;
  readonly evidence: readonly Evidence[];
}

/** Full explainable trace for one decision/risk item. */
export interface Decision {
  readonly id: string;
  readonly inputs: {
    readonly blockers: readonly string[];
    readonly artifacts: readonly string[];
    readonly systemReadinessScore: number | null;
  };
  readonly factors: ScoringFactors;
  readonly formula: string;
  readonly score: number;
  readonly rank: number;
  readonly evidence: readonly Evidence[];
}

/** Per-system structural readiness entry (18 systems from production-readiness-intel). */
export interface SystemReadiness {
  readonly system: string;
  readonly key: string;
  readonly score: number;
  readonly evidence: readonly string[];
  readonly blockers: readonly string[];
}

/** One of the 10 program dimensions from production-readiness-v2. */
export interface DimensionReadiness {
  readonly dimension: string;
  readonly score: number;
  readonly evidence: string;
  readonly note?: string;
}

/** Scale tier levers — structural observations, never fabricated capacity numbers. */
export interface ScaleTiers {
  readonly blocks100Merchants: readonly string[];
  readonly blocks10kUsers: readonly string[];
  readonly blocks100kConcurrentUsers: readonly string[];
  readonly blocks1000Merchants: readonly string[];
  readonly blocks10000Merchants: readonly string[];
}

/** Launch go/no-go verdict derived from open blockers + cert docs. */
export interface LaunchVerdict {
  readonly verdict: string;
  readonly openBlockers: number;
  readonly overallReadiness: number;
  readonly certificationDocs: ReadonlyArray<{ readonly doc: string; readonly verdict: string }>;
}

/** Lightweight prioritize() output item. */
export interface PrioritizedItem {
  readonly rank: number;
  readonly id: string;
  readonly score: number;
  readonly factors: ScoringFactors;
}
