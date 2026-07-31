/**
 * Public types for @letbuyy/lcis-pr-check — LCIS PR Intelligence.
 * All types are zod-validated at runtime; the schemas live alongside the types.
 */
import { z } from 'zod';
import type { Evidence } from '@letbuyy/lcis-core';
import type { ReviewVerdict } from '@letbuyy/lcis-execution';
import type { GovernanceVerdict } from '@letbuyy/lcis-governance';
import type { OperationalVerdict } from '@letbuyy/lcis-operations';
import type { EngineeringVerdict } from '@letbuyy/lcis-engineering';
import type { ExecutionVerdict } from '@letbuyy/lcis-orchestration';

// Re-export ReviewVerdict, GovernanceVerdict, OperationalVerdict, EngineeringVerdict and
// ExecutionVerdict so consumers can import from this package
export type { ReviewVerdict };
export type { GovernanceVerdict };
export type { OperationalVerdict };
export type { EngineeringVerdict };
export type { ExecutionVerdict };

// ── Input ────────────────────────────────────────────────────────────────────

export const PrInputSchema = z.object({
  /** Changed file paths (relative to repo root) */
  changedFiles: z.array(z.string()).min(0),
  /** Optional: named symbols to run blast-radius against (e.g. exported function names) */
  changedSymbols: z.array(z.string()).optional(),
});

export type PrInput = z.infer<typeof PrInputSchema>;

// ── Sensitivity flags ────────────────────────────────────────────────────────

export interface SensitivityFlags {
  /** Changes span more than one LCIS domain */
  crossDomain: boolean;
  /** Files touching auth / identity / session / OAuth / credentials */
  authRelated: boolean;
  /** Files touching payments / ledger / razorpay / refunds / payouts */
  paymentRelated: boolean;
  /** Files touching RLS policies, Supabase policies, or row-level security */
  rlsRelated: boolean;
  /** Files touching database migrations / Supabase migrations */
  migrationRelated: boolean;
  /** Files touching tenant isolation: site_id, tenant, RLS, verifySiteOwnership */
  tenantIsolation: boolean;
  /** Files touching scripts/validators or governance (CLAUDE.md, AGENTS.md, validate-governance) */
  validatorImpact: boolean;
  /** Files touching security: HMAC, JWT, signing, turnstile, webhooks, CORS */
  securitySensitive: boolean;
}

// ── Per-domain detail ────────────────────────────────────────────────────────

export interface AffectedDomain {
  key: string;
  label: string;
  /** Evidence files from this PR that map to the domain */
  fromFiles: string[];
  /** Did blast-radius expansion pull this domain in (not just from file path)? */
  fromBlast: boolean;
  /** Is this a money domain? */
  money: boolean;
  /** Is this a tenant-scoped domain? */
  tenant: boolean;
}

// ── Risk ─────────────────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskDerivation {
  level: RiskLevel;
  /**
   * Ordered list of reasons that determined the final risk level (deterministic, evidence-cited).
   * Each item cites the file or flag that triggered it.
   */
  reasons: string[];
}

// ── Output ───────────────────────────────────────────────────────────────────

export interface PrReport {
  /** Sensitivity flags — each flag cites the triggering file in validationWarnings */
  sensitivity: SensitivityFlags;
  /** Risk level + deterministic derivation reasons */
  risk: RiskDerivation;
  /** Domains directly mapped from changed files + blast-radius expansion */
  affectedDomains: AffectedDomain[];
  /** Canonical service/app names affected (from domain → service mapping) */
  affectedServices: string[];
  /** Domain owners + CODEOWNERS matches for all affected domains */
  recommendedReviewers: string[];
  /** Warnings from sensitivity detection (file-cited) */
  validationWarnings: string[];
  /** Structural architecture warnings (layer violations, frozen-app touches, etc.) */
  architectureWarnings: string[];
  /** Blast radius aggregate stats */
  blastRadius: {
    /** Total impacted files across all changed symbols */
    affectedFiles: number;
    /** Total impacted nodes across all changed symbols */
    affectedNodes: number;
    /** Domains that appear in any blast-radius expansion */
    topDomains: string[];
  };
  /** LCIS evidence trail for every finding */
  evidence: Evidence[];
  /** ISO-8601 timestamp when the report was generated */
  generatedAt: string;
  /**
   * Six LCIS review verdicts: architecture / security / migration / coverage / launch / rollback.
   * Empty array in the synchronous analyze() path; populated by analyzeWithVerdicts().
   * Never fabricated — UNKNOWN is returned when a signal cannot be determined.
   */
  verdicts: ReviewVerdict[];
  /**
   * Six LCIS governance verdicts: architecture-drift / compliance / ownership / security-drift /
   * readiness / governance. Empty array in the synchronous analyzePr() path; populated by
   * analyzeWithGovernance() or analyzeWithVerdicts(). Never fabricated — UNKNOWN is returned
   * when nothing in the PR's affected entities can be matched.
   */
  governanceVerdicts: GovernanceVerdict[];
  /**
   * LCOS operational-impact verdict — does this PR touch an area with operational risk
   * (SPOF, critical finding, NOT_CONNECTED telemetry blind spot)?
   * Null in the synchronous analyzePr() path (back-compat). Populated by
   * analyzeWithOperations(). Never fabricated — UNKNOWN when no operational signal maps.
   */
  operationalVerdict: OperationalVerdict | null;
  /**
   * Six EINS (Engineering Intelligence System) verdicts: engineering-readiness /
   * engineering-complexity / engineering-risk / engineering-coverage /
   * engineering-rollback / engineering-verification.
   * Empty array in the synchronous analyzePr() path (back-compat). Populated by
   * analyzeWithEngineering(). Never fabricated — UNKNOWN when a signal cannot be
   * determined.
   */
  engineeringVerdicts: EngineeringVerdict[];
  /**
   * Six EAOS (Execution & Agent Orchestration System) verdicts: execution-readiness /
   * execution-health / validation-health / rollout-health / artifact-health / agent-health.
   * Empty array in all prior paths (back-compat). Populated by analyzeWithExecution().
   * Never fabricated — UNKNOWN when a signal cannot be determined.
   */
  executionVerdicts: ExecutionVerdict[];
}
