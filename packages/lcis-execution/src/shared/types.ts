/**
 * The Execution Intelligence (EIS) type vocabulary — the FROZEN contract every
 * service implements against. Every plan artifact carries its own provenance:
 * `evidence`, `confidence`, `sources`, `timestamp`. LCIS plans/analyzes/verifies/
 * recommends — these types describe PLANS, never executed actions.
 *
 * Nothing here imports a service (no cycles). All reasoning is delegated to
 * @letbuyy/lcis-core; these types are the shape of what that reasoning produces.
 */
import type { Evidence } from '@letbuyy/lcis-core';

/** Base provenance carried by EVERY EIS output (the mandatory evidence/confidence/sources/timestamp). */
export interface PlanArtifact {
  readonly evidence: readonly Evidence[];
  /** 0..1 — structural-only; never claims certainty, never fabricated. */
  readonly confidence: number;
  /** Artifact / file provenance (e.g. "graphify-out/domain-intel.json"). */
  readonly sources: readonly string[];
  /** ISO-8601 timestamp this artifact was generated. */
  readonly timestamp: string;
}

// ── Request + seed resolution ────────────────────────────────────────────────

/** A change request — natural language plus optional explicit seeds for precision. */
export interface ChangeRequest {
  /** e.g. "Add GST Filing", "Implement Shipping Zones", "Migrate Checkout". */
  readonly text: string;
  readonly domains?: readonly string[];
  readonly symbols?: readonly string[];
  readonly tables?: readonly string[];
  readonly files?: readonly string[];
}

export type SeedKind = 'domain' | 'symbol' | 'table' | 'file';

/** A request term resolved to a real graph entity (deterministic match; no LLM). */
export interface ResolvedSeed {
  readonly kind: SeedKind;
  /** The matched entity: domain key, symbol/node id, table name, or file path. */
  readonly ref: string;
  /** Why it matched (e.g. token "gst" matched table "gst_invoices"). */
  readonly reason: string;
  /** 0..1 match strength: explicit seed = 1; exact token = high; fuzzy = lower. */
  readonly score: number;
  readonly evidence: readonly Evidence[];
}

// ── Complexity + risk ────────────────────────────────────────────────────────

export type ComplexityBand = 'trivial' | 'low' | 'moderate' | 'high' | 'severe';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ComplexityAssessment {
  readonly band: ComplexityBand;
  /** Unitless score (sum of weighted structural factors). */
  readonly score: number;
  readonly factors: readonly { readonly factor: string; readonly weight: number; readonly note: string }[];
}

export interface RiskAssessment {
  readonly level: RiskLevel;
  readonly score: number;
  /** True if a money-ledger table is in the blast radius. */
  readonly money: boolean;
  /** True if a tenant table is touched (affects ALL merchants on the shared schema). */
  readonly tenant: boolean;
  readonly drivers: readonly { readonly driver: string; readonly severity: RiskLevel; readonly note: string }[];
}

/** The aggregated structural footprint of a change. */
export interface AffectedSets {
  readonly domains: readonly string[];
  readonly services: readonly string[];
  readonly apis: readonly string[];
  readonly rpcs: readonly string[];
  readonly tables: readonly string[];
  readonly workers: readonly string[];
  readonly queues: readonly string[];
  readonly events: readonly string[];
  readonly tests: readonly string[];
  readonly docs: readonly string[];
}

// ── Deliverable 2: the Change Plan ───────────────────────────────────────────

/** The ChangePlanner output. The single source feeding every downstream plan. */
export interface ChangeAnalysis extends PlanArtifact {
  readonly request: ChangeRequest;
  readonly seeds: readonly ResolvedSeed[];
  readonly affected: AffectedSets;
  readonly complexity: ComplexityAssessment;
  readonly risk: RiskAssessment;
  /** Cross-domain consumedBy order — the safe implementation sequence. */
  readonly suggestedSequence: readonly string[];
  /** Domains/entities this change depends on (must exist/stable first). */
  readonly dependencies: readonly string[];
  /** One-line summaries of the downstream strategies (full plans are separate artifacts). */
  readonly rollbackStrategy: string;
  readonly verificationStrategy: string;
  readonly launchImpact: string;
  /** True when no seed resolved — the analysis is honestly empty, not fabricated. */
  readonly unresolved: boolean;
}

// ── Deliverable 1 + 8: Execution plan + graph ────────────────────────────────

export type WorkCategory =
  | 'schema'
  | 'rpc'
  | 'api'
  | 'worker'
  | 'ui'
  | 'test'
  | 'docs'
  | 'migration'
  | 'config'
  | 'verification';

export interface WorkItem {
  readonly id: string;
  readonly title: string;
  readonly category: WorkCategory;
  readonly domain: string | null;
  /** WorkItem ids this depends on (must complete first). */
  readonly dependsOn: readonly string[];
  readonly risk: RiskLevel;
  readonly evidence: readonly Evidence[];
}

export interface Milestone {
  readonly id: string;
  readonly title: string;
  /** WorkItem ids in this milestone. */
  readonly items: readonly string[];
  readonly gate: string;
}

export interface ExecutionGraphNode {
  readonly id: string;
  readonly title: string;
  readonly category: WorkCategory;
  /** Earliest dependency layer (0 = no prerequisites). */
  readonly layer: number;
  readonly onCriticalPath: boolean;
}

export interface ExecutionGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: 'depends-on';
}

export interface ExecutionGraph extends PlanArtifact {
  readonly nodes: readonly ExecutionGraphNode[];
  readonly edges: readonly ExecutionGraphEdge[];
  /** Topologically ordered WorkItem ids — the implementation order. */
  readonly implementationOrder: readonly string[];
  /** Longest dependency chain (the critical path) as WorkItem ids. */
  readonly criticalPath: readonly string[];
  /** WorkItem ids with no unmet dependencies — safe to start in parallel. */
  readonly parallelizable: readonly string[];
  /** WorkItem ids blocked by an unresolved/cyclic dependency. */
  readonly blocked: readonly string[];
}

export interface ExecutionChecklistItem {
  readonly step: string;
  readonly category: WorkCategory;
  readonly done: false;
  readonly evidence: readonly Evidence[];
}

export interface ExecutionPlan extends PlanArtifact {
  readonly request: ChangeRequest;
  readonly summary: string;
  readonly complexity: ComplexityAssessment;
  readonly risk: RiskAssessment;
  readonly workBreakdown: readonly WorkItem[];
  readonly milestones: readonly Milestone[];
  readonly graph: ExecutionGraph;
  readonly checklist: readonly ExecutionChecklistItem[];
  readonly dependencies: readonly string[];
}

// ── Deliverable 3: Migration intelligence ────────────────────────────────────

export type MigrationTarget = 'supabase' | 'sql' | 'worker' | 'kv' | 'r2' | 'queue' | 'internal-api' | 'domain-model';

export interface MigrationStep {
  readonly order: number;
  readonly target: MigrationTarget;
  readonly description: string;
  readonly reversible: boolean;
  readonly evidence: readonly Evidence[];
}

export interface DataLossRiskFinding {
  readonly table: string;
  readonly risk: RiskLevel;
  readonly reason: string;
  readonly evidence: readonly Evidence[];
}

export interface MigrationReadiness extends PlanArtifact {
  readonly ready: boolean;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export interface MigrationPlan extends PlanArtifact {
  readonly request: ChangeRequest;
  readonly targets: readonly MigrationTarget[];
  readonly steps: readonly MigrationStep[];
  readonly dependencyOrder: readonly string[];
  readonly risk: RiskAssessment;
  readonly dataLossRisks: readonly DataLossRiskFinding[];
  readonly irreversibleSteps: readonly MigrationStep[];
  readonly readiness: MigrationReadiness;
  /** Plain-language impact if these migrations run (NOT executed by LCIS). */
  readonly simulatedImpact: string;
}

// ── Deliverable 4: Test intelligence ─────────────────────────────────────────

export type TestKind = 'unit' | 'integration' | 'regression' | 'smoke' | 'load' | 'security' | 'acceptance' | 'contract';

export interface TestTarget {
  readonly kind: TestKind;
  readonly target: string;
  readonly reason: string;
  readonly evidence: readonly Evidence[];
}

export interface CoverageGap {
  readonly subject: string;
  readonly kind: TestKind;
  readonly severity: RiskLevel;
  readonly note: string;
  readonly evidence: readonly Evidence[];
}

export interface TestPlan extends PlanArtifact {
  readonly request: ChangeRequest;
  /** Existing tests that must run (affected by the change). */
  readonly required: readonly TestTarget[];
  /** Coverage that does not exist yet and should be added. */
  readonly missing: readonly CoverageGap[];
  /** Recommended additional tests (defense in depth). */
  readonly recommended: readonly TestTarget[];
  readonly regressionPlan: readonly TestTarget[];
  readonly smokePlan: readonly TestTarget[];
  readonly loadPlan: readonly TestTarget[];
  readonly securityPlan: readonly TestTarget[];
  readonly acceptancePlan: readonly TestTarget[];
  readonly riskLevel: RiskLevel;
  /** 0..1 — how confident we are the affected surface is covered. */
  readonly coverageConfidence: number;
}

// ── Deliverable 5: Rollback intelligence ─────────────────────────────────────

export interface RollbackStep {
  readonly order: number;
  readonly action: string;
  readonly reversible: boolean;
  readonly evidence: readonly Evidence[];
}

export interface IrreversibleChange {
  readonly subject: string;
  readonly reason: string;
  readonly severity: RiskLevel;
  readonly evidence: readonly Evidence[];
}

export type RollbackComplexity = 'simple' | 'moderate' | 'complex' | 'irreversible';

export interface RollbackPlan extends PlanArtifact {
  readonly request: ChangeRequest;
  readonly readiness: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  readonly complexity: RollbackComplexity;
  readonly steps: readonly RollbackStep[];
  readonly irreversible: readonly IrreversibleChange[];
  readonly dependencies: readonly string[];
  /** Estimated recovery time band, structurally derived (never a fabricated number). */
  readonly estimatedRecovery: string;
  readonly risk: RiskAssessment;
}

// ── Deliverable 6: Launch intelligence ───────────────────────────────────────

export type GoNoGo = 'GO' | 'CONDITIONAL_GO' | 'NO_GO';

export interface LaunchBlocker {
  readonly id: string;
  readonly title: string;
  readonly severity: RiskLevel;
  /** 'KNOWN' (evidenced) vs 'UNKNOWN' (cannot determine — stays unknown, never assumed pass). */
  readonly state: 'KNOWN' | 'UNKNOWN';
  readonly evidence: readonly Evidence[];
}

export interface LaunchChecklistItem {
  readonly area: string;
  readonly requirement: string;
  readonly status: 'MET' | 'UNMET' | 'UNKNOWN';
  readonly evidence: readonly Evidence[];
}

export interface GoNoGoDecision extends PlanArtifact {
  readonly decision: GoNoGo;
  readonly rationale: string;
  readonly blockers: readonly LaunchBlocker[];
  /** Items that could not be determined — surfaced, never silently passed. */
  readonly unknowns: readonly string[];
}

export interface LaunchPlan extends PlanArtifact {
  readonly request: ChangeRequest;
  /** 0..1 structural readiness — never fabricated; unknown stays unknown. */
  readonly readiness: number;
  readonly decision: GoNoGoDecision;
  readonly blockers: readonly LaunchBlocker[];
  readonly checklist: readonly LaunchChecklistItem[];
}

// ── Deliverable 7: Verification plan ─────────────────────────────────────────

export interface VerificationCheck {
  readonly id: string;
  readonly description: string;
  readonly method: string;
  readonly evidence: readonly Evidence[];
}

export interface VerificationPlan extends PlanArtifact {
  readonly request: ChangeRequest;
  readonly checks: readonly VerificationCheck[];
  readonly preMergeGates: readonly string[];
  readonly postDeployChecks: readonly string[];
}

// ── PR Intelligence V2 verdicts ──────────────────────────────────────────────

export type Verdict = 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';

export interface ReviewVerdict {
  readonly dimension: 'architecture' | 'security' | 'migration' | 'coverage' | 'launch' | 'rollback';
  readonly verdict: Verdict;
  readonly summary: string;
  readonly findings: readonly string[];
  readonly evidence: readonly Evidence[];
}
