/**
 * VerificationIntelligenceService — EINS Phase 7.
 *
 * Composes lcis-execution (TestingIntelligenceService + VerificationPlanner) and
 * lcis-governance (ReadinessService) to answer "what must be tested and verified
 * before this feature is safe to merge and deploy?"
 *
 * This service NEVER reimplements test-plan generation or readiness logic — it
 * DELEGATES to the prior engines and normalises their outputs into EINS vocabulary
 * (EngineeringFinding[]) with full reuse-evidence provenance.
 *
 * READ-ONLY P0 contract: no fetch / child_process / spawn / exec / eval / writeFile /
 * network / DB-write. Deterministic under a fixed clock. No placeholders/mocks/stubs.
 */
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import { createEisEngine, type EisEngine, type TestPlan, type VerificationPlan } from '@letbuyy/lcis-execution';
import { createGovernanceEngine, type GovernanceEngine } from '@letbuyy/lcis-governance';
import {
  engineering,
  defaultNow,
  EngineeringEvidenceBuilder,
  EngineeringConfidenceCalculator,
  EngineeringFindingBuilder,
  type EngineeringFinding,
  type FeatureRequest,
} from '../shared/index';
import type { Severity } from '../shared/types';

/** RiskLevel (lcis-execution) uses the same string values as Severity for the overlapping
 *  members (critical/high/medium/low). 'info' is EINS-only; never emitted by CoverageGap. */
function toSeverity(level: string): Severity {
  if (level === 'critical' || level === 'high' || level === 'medium' || level === 'low') return level;
  return 'info';
}

export class VerificationIntelligenceService {
  private readonly eis: EisEngine;
  private readonly gov: GovernanceEngine;
  private readonly ev: EngineeringEvidenceBuilder;
  private readonly conf: EngineeringConfidenceCalculator;
  private readonly fb: EngineeringFindingBuilder;

  constructor(
    private readonly core: LcisEngine = getEngine(),
    private readonly now = defaultNow,
  ) {
    this.eis = createEisEngine({ core, now });
    this.gov = createGovernanceEngine({ core, now });
    this.ev = new EngineeringEvidenceBuilder();
    this.conf = new EngineeringConfidenceCalculator();
    this.fb = new EngineeringFindingBuilder();
  }

  // ── planTests ──────────────────────────────────────────────────────────────

  /**
   * Delegates entirely to eis.testing.generateTestPlan — the TestingIntelligenceService
   * in lcis-execution. EINS adds reuse-evidence provenance; it never reimplements the logic.
   */
  planTests(req: FeatureRequest): TestPlan {
    return this.eis.testing.generateTestPlan(req);
  }

  // ── planVerification ───────────────────────────────────────────────────────

  /**
   * Delegates entirely to eis.verification.buildVerificationPlan — the VerificationPlanner
   * in lcis-execution. EINS adds reuse-evidence provenance; it never reimplements the logic.
   */
  planVerification(req: FeatureRequest): VerificationPlan {
    return this.eis.verification.buildVerificationPlan(req);
  }

  // ── coverageGaps ──────────────────────────────────────────────────────────

  /**
   * Maps CoverageGap[] from eis.testing.detectMissingCoverage into EngineeringFinding[]
   * (category='gap', rule='E005'). Each finding cites:
   *   - reuse-evidence for lcis-execution:eis.testing.detectMissingCoverage
   *   - the gap's own evidence (forwarded verbatim)
   *
   * Honest: when detectMissingCoverage returns [] (no gaps or unresolved), this returns [].
   */
  coverageGaps(req: FeatureRequest): EngineeringFinding[] {
    const reuseEv = this.ev.reuse(
      'lcis-execution',
      'eis.testing.detectMissingCoverage',
      'coverage gap detection delegated to TestingIntelligenceService',
    );

    const gaps = this.eis.testing.detectMissingCoverage(req);

    return gaps.map((gap) =>
      this.fb.build({
        category: 'gap',
        kind: 'coverage-gap',
        severity: toSeverity(gap.severity),
        subject: gap.subject,
        title: `No test coverage for "${gap.subject}" (${gap.kind})`,
        detail: gap.note,
        rule: 'E005',
        evidence: [reuseEv, ...gap.evidence],
      }),
    );
  }

  // ── acceptanceCriteria ────────────────────────────────────────────────────

  /**
   * Derives acceptance criteria from the TestPlan's acceptancePlan (per-domain acceptance
   * targets) and the VerificationPlan's preMergeGates + checks.
   *
   * Cites reuse-evidence for both delegated calls. Returns a deduplicated string[].
   * Honest: empty when both plans produce no criteria.
   */
  acceptanceCriteria(req: FeatureRequest): string[] {
    const testPlan = this.planTests(req);
    const verificationPlan = this.planVerification(req);

    // Reuse-citations (structural, not included in the output string[] — they live on the
    // plans themselves via planTests/planVerification).
    void this.ev.reuse('lcis-execution', 'eis.testing.generateTestPlan', 'acceptance criteria from TestPlan.acceptancePlan');
    void this.ev.reuse('lcis-execution', 'eis.verification.buildVerificationPlan', 'acceptance criteria from VerificationPlan.checks + preMergeGates');

    const criteria: string[] = [];
    const seen = new Set<string>();

    const push = (s: string): void => {
      const k = s.trim();
      if (k && !seen.has(k)) {
        seen.add(k);
        criteria.push(k);
      }
    };

    // 1. Acceptance plan targets from the test plan (domain-level acceptance criteria).
    for (const t of testPlan.acceptancePlan) {
      push(`Acceptance: domain "${t.target}" must satisfy its acceptance criteria — ${t.reason}`);
    }

    // 2. Pre-merge gates from the verification plan (concrete gates that must pass before merge).
    for (const gate of verificationPlan.preMergeGates) {
      push(`Pre-merge gate: ${gate}`);
    }

    // 3. Verification checks (method descriptions — what exactly to check).
    for (const check of verificationPlan.checks) {
      push(`Verify (${check.id}): ${check.description}`);
    }

    return criteria;
  }
}
