/**
 * EINS (Engineering Intelligence System) type vocabulary — the FROZEN contract every
 * engineering service implements against. EINS COMPOSES the five prior LCIS systems:
 * the blueprint EMBEDS their plan types directly (explicit reuse, never redefinition).
 * The net-new EINS types are the normalized impact, the ordered engineering tasks, the
 * agent task graph, the engineering dependency graph, and the unified blueprint/package.
 *
 * EINS plans/analyzes/verifies/recommends — it never executes, generates code, modifies
 * files, runs migrations, or deploys. Every output carries evidence/confidence/sources/timestamp.
 */
import type { Evidence } from '@letbuyy/lcis-core';
import type {
  ChangeAnalysis,
  ExecutionGraph,
  LaunchPlan,
  MigrationPlan,
  RollbackPlan,
  TestPlan,
  VerificationPlan,
} from '@letbuyy/lcis-execution';
import type { ComplianceReport, OwnershipReport, ReadinessReport, SecurityDriftReport } from '@letbuyy/lcis-governance';
import type { OperationsReport } from '@letbuyy/lcis-operations';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ComplexityBand = 'trivial' | 'low' | 'moderate' | 'high' | 'severe';

/** Base provenance on EVERY EINS output. */
export interface EngineeringArtifact {
  readonly evidence: readonly Evidence[];
  /** 0..1 — derived from the composed plans' confidences; never claims certainty. */
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
}

/** A feature request (same shape as lcis-execution's ChangeRequest). */
export interface FeatureRequest {
  readonly text: string;
  readonly domains?: readonly string[];
  readonly tables?: readonly string[];
  readonly symbols?: readonly string[];
  readonly files?: readonly string[];
}

/** The construction layers of the LetBuyy feature anatomy (build order). */
export type EngineeringLayer =
  | 'migration' | 'rpc' | 'gateway' | 'proxy' | 'ui' | 'worker' | 'queue'
  | 'event' | 'test' | 'docs' | 'verification' | 'launch';

export type AgentType = 'backend' | 'database' | 'frontend' | 'testing' | 'documentation' | 'verification' | 'devops';

// ── Impact (normalized over ChangeAnalysis) ──────────────────────────────────

export interface EngineeringImpact extends EngineeringArtifact {
  readonly request: FeatureRequest;
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
  readonly complexity: { readonly band: ComplexityBand; readonly score: number };
  readonly risk: { readonly level: Severity; readonly money: boolean; readonly tenant: boolean; readonly drivers: readonly string[] };
  /** True when no seed resolved — honestly empty, not fabricated. */
  readonly unresolved: boolean;
}

// ── Findings (gates / risks / gaps / blockers) ───────────────────────────────

export interface EngineeringFinding {
  readonly id: string;
  readonly category: 'gate' | 'risk' | 'gap' | 'blocker';
  readonly kind: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  /** Originating governance rule (R001..R008) or engineering rule (E001..), when applicable. */
  readonly rule?: string;
  readonly confidence: number;
  readonly evidence: readonly Evidence[];
}

// ── Engineering tasks (ordered, human-executable) ────────────────────────────

export interface EngineeringTask {
  readonly id: string;
  readonly title: string;
  readonly layer: EngineeringLayer;
  readonly domain: string | null;
  /** EngineeringTask ids that must complete first. */
  readonly dependsOn: readonly string[];
  /** Lower = earlier in the build order. */
  readonly priority: number;
  /** The validation gate that must pass for this task (e.g. "canonical-ledger-only-validator"). */
  readonly gate: string;
  readonly agentType: AgentType;
  readonly evidence: readonly Evidence[];
}

// ── Agent task graph (what a fleet would execute) ────────────────────────────

export interface AgentTask {
  readonly id: string;
  readonly agentType: AgentType;
  readonly title: string;
  /** The EngineeringTask this agent task fulfils. */
  readonly taskRef: string;
  readonly dependsOn: readonly string[];
  readonly inputs: readonly string[];
  readonly acceptance: string;
  readonly evidence: readonly Evidence[];
}

export interface AgentPlan extends EngineeringArtifact {
  readonly tasks: readonly AgentTask[];
  readonly byAgentType: Readonly<Record<string, number>>;
  readonly summary: string;
}

// ── Engineering dependency graph ─────────────────────────────────────────────

export interface EngineeringGraphNode {
  readonly id: string;
  readonly title: string;
  readonly layer: EngineeringLayer;
  readonly depth: number;
  readonly onCriticalPath: boolean;
}
export interface EngineeringGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: 'depends-on';
}
export interface EngineeringMilestone {
  readonly id: string;
  readonly title: string;
  readonly tasks: readonly string[];
  readonly gate: string;
}
export interface EngineeringGraph extends EngineeringArtifact {
  readonly nodes: readonly EngineeringGraphNode[];
  readonly edges: readonly EngineeringGraphEdge[];
  readonly implementationOrder: readonly string[];
  readonly criticalPath: readonly string[];
  readonly parallelizable: readonly string[];
  readonly blocked: readonly string[];
  readonly milestones: readonly EngineeringMilestone[];
}

// ── The unified blueprint (embeds the reused plans — explicit composition) ───

export interface EngineeringBlueprint extends EngineeringArtifact {
  readonly request: FeatureRequest;
  readonly impact: EngineeringImpact;
  /** Reused verbatim from lcis-execution. */
  readonly change: ChangeAnalysis;
  readonly migration: MigrationPlan;
  readonly tests: TestPlan;
  readonly verification: VerificationPlan;
  readonly rollback: RollbackPlan;
  readonly launch: LaunchPlan;
  readonly executionGraph: ExecutionGraph;
  /** Reused from lcis-governance (the engineering gates). */
  readonly ownership: OwnershipReport;
  readonly compliance: ComplianceReport;
  readonly security: SecurityDriftReport;
  readonly readiness: ReadinessReport;
  /** Reused from lcis-operations (the operational impact). */
  readonly operations: OperationsReport;
  /** Synthesized engineering gates/blockers over all of the above. */
  readonly gates: readonly EngineeringFinding[];
  readonly summary: string;
}

// ── The full engineering package (the EINS flagship output) ───────────────────

export interface EngineeringPackage extends EngineeringArtifact {
  readonly request: FeatureRequest;
  readonly blueprint: EngineeringBlueprint;
  readonly tasks: readonly EngineeringTask[];
  readonly agentPlan: AgentPlan;
  readonly graph: EngineeringGraph;
  readonly decision: { readonly verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO'; readonly blockers: readonly string[] };
  readonly summary: string;
}

// ── PR Intelligence V5 verdict ───────────────────────────────────────────────

export type EngineeringDimension =
  | 'engineering-readiness' | 'engineering-complexity' | 'engineering-risk'
  | 'engineering-coverage' | 'engineering-rollback' | 'engineering-verification';

export interface EngineeringVerdict {
  readonly dimension: EngineeringDimension;
  readonly verdict: 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';
  readonly summary: string;
  readonly findings: readonly string[];
  readonly evidence: readonly Evidence[];
}
