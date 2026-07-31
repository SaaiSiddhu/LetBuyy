/**
 * The Governance & Drift Intelligence (GDIS) type vocabulary — the FROZEN contract
 * every governance service implements against. Every output carries its own provenance
 * (evidence / confidence / sources / timestamp). LCIS observes/analyzes/verifies/plans/
 * enforces — these types describe FINDINGS and REPORTS, never executed actions.
 *
 * Nothing here imports a service (no cycles). All data comes from lcis-core's read-only
 * artifacts; this vocabulary is the shape of the governance facts read from them.
 */
import type { Evidence } from '@letbuyy/lcis-core';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Base provenance carried by EVERY GDIS output. */
export interface GovernanceArtifact {
  readonly evidence: readonly Evidence[];
  /** 0..1 — structural-only; never claims certainty, never fabricated. */
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
}

export type FindingCategory = 'drift' | 'compliance' | 'ownership' | 'security' | 'readiness';

/** The atomic unit of governance intelligence: a drift, a violation, or a gap. */
export interface Finding {
  /** Stable, deterministic id, e.g. 'DRIFT-TABLE-orders' or 'R002-store_customers'. */
  readonly id: string;
  readonly category: FindingCategory;
  /** Sub-kind, e.g. 'table-drift', 'missing-rls', 'unowned-domain', 'R002'. */
  readonly kind: string;
  readonly severity: Severity;
  /** The entity the finding is about (table/rpc/domain/worker/...). */
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  /** Compliance rule id (R001..R008) when this is a rule violation. */
  readonly rule?: string;
  readonly confidence: number;
  readonly evidence: readonly Evidence[];
}

// ── Drift (Phase 3) ──────────────────────────────────────────────────────────

export type DriftKind =
  | 'architecture' | 'domain' | 'service' | 'table' | 'rpc' | 'worker' | 'queue'
  | 'event' | 'runbook' | 'test' | 'documentation' | 'migration' | 'validator'
  | 'ownership' | 'security';

export interface DriftReport extends GovernanceArtifact {
  /** What was scanned, e.g. 'all' or a domain key. */
  readonly scope: string;
  readonly findings: readonly Finding[];
  readonly byKind: Readonly<Record<string, number>>;
  readonly summary: string;
}

// ── Compliance (Phase 4) ─────────────────────────────────────────────────────

export interface ComplianceRule {
  readonly id: string; // R001..R008
  readonly title: string;
  readonly description: string;
  readonly severity: Severity;
  readonly category: 'architecture' | 'security' | 'governance' | 'operational' | 'testing' | 'ownership';
}

export type ComplianceStatus = 'COMPLIANT' | 'VIOLATED' | 'PARTIAL' | 'UNKNOWN';

export interface RuleEvaluation {
  readonly rule: ComplianceRule;
  readonly status: ComplianceStatus;
  readonly violations: readonly Finding[];
  /** Number of entities evaluated for the rule. */
  readonly checked: number;
  readonly passed: number;
  readonly evidence: readonly Evidence[];
}

export interface ComplianceReport extends GovernanceArtifact {
  readonly evaluations: readonly RuleEvaluation[];
  /** 0..100 weighted compliance score (UNKNOWN rules excluded from the denominator). */
  readonly score: number;
  readonly violations: readonly Finding[];
  readonly summary: string;
}

// ── Ownership (Phase 5) ──────────────────────────────────────────────────────

export type OwnedEntityType = 'domain' | 'service' | 'worker' | 'queue' | 'rpc' | 'table' | 'runbook';

export interface OwnershipGap {
  readonly entityType: OwnedEntityType;
  readonly subject: string;
  readonly severity: Severity;
  readonly evidence: readonly Evidence[];
}

export interface OwnershipCoverage {
  readonly total: number;
  readonly owned: number;
  /** 0..1. */
  readonly coverage: number;
}

export interface OwnershipReport extends GovernanceArtifact {
  readonly gaps: readonly OwnershipGap[];
  readonly coverage: Readonly<Record<string, OwnershipCoverage>>;
  readonly summary: string;
}

// ── Security drift (Phase 6) ─────────────────────────────────────────────────

export interface SecurityDriftReport extends GovernanceArtifact {
  readonly findings: readonly Finding[];
  readonly byKind: Readonly<Record<string, number>>;
  readonly summary: string;
}

// ── Readiness (Phase 7) ──────────────────────────────────────────────────────

export type ReadinessFactorKey =
  | 'owner' | 'runbook' | 'tests' | 'rollback' | 'coverage' | 'documentation'
  | 'healthcheck' | 'monitoring' | 'alerts' | 'security';

export interface ReadinessFactor {
  readonly key: ReadinessFactorKey;
  /** true / false / 'UNKNOWN' — an undeterminable factor stays UNKNOWN, never assumed present. */
  readonly present: boolean | 'UNKNOWN';
  readonly weight: number;
  readonly evidence: readonly Evidence[];
}

export type ReadinessBand = 'ready' | 'conditional' | 'not-ready' | 'unknown';

export interface ReadinessScore extends GovernanceArtifact {
  readonly subject: string;
  /** 0..100 over the KNOWN factors; UNKNOWN factors are surfaced, not counted as pass. */
  readonly score: number;
  readonly factors: readonly ReadinessFactor[];
  readonly band: ReadinessBand;
  readonly unknowns: readonly ReadinessFactorKey[];
  readonly summary: string;
}

export interface ReadinessReport extends GovernanceArtifact {
  readonly scores: readonly ReadinessScore[];
  readonly overall: number;
  readonly summary: string;
}

// ── Governance composite (Phase 8) ───────────────────────────────────────────

export interface GovernanceReport extends GovernanceArtifact {
  readonly drift: DriftReport;
  readonly compliance: ComplianceReport;
  readonly ownership: OwnershipReport;
  readonly security: SecurityDriftReport;
  readonly readiness: ReadinessReport;
  /** 0..100 composite constitutional-health score. */
  readonly healthScore: number;
  readonly summary: string;
}

export interface HealthView extends GovernanceArtifact {
  readonly area: 'architecture' | 'domain' | 'security' | 'ownership' | 'readiness';
  readonly score: number;
  readonly findings: readonly Finding[];
  readonly summary: string;
}

// ── PR Intelligence V3 verdict (Phase 9) ─────────────────────────────────────

export type GovernanceDimension =
  | 'architecture-drift' | 'compliance' | 'ownership' | 'security-drift' | 'readiness' | 'governance';

export interface GovernanceVerdict {
  readonly dimension: GovernanceDimension;
  readonly verdict: 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';
  readonly summary: string;
  readonly findings: readonly string[];
  readonly evidence: readonly Evidence[];
}
