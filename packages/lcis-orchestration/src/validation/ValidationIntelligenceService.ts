/**
 * ValidationIntelligenceService — EAOS Phase 8.
 *
 * A pure, synchronous, READ-ONLY transform over an EngineeringPackage that maps governance
 * compliance evaluations into EAOS validation state, surfaces structural findings, and reports
 * verification coverage — all without executing, deploying, mutating, or running validators.
 *
 * CONNECTED: static governance gates from pkg.blueprint.compliance.evaluations (structural
 *   evaluation by lcis-governance ComplianceService over the graph).
 *   COMPLIANT  → ValidationStatus PASSED  (CONNECTED)
 *   VIOLATED   → ValidationStatus FAILED  (CONNECTED)
 *   PARTIAL / UNKNOWN → ValidationStatus PENDING (the live confirmation is NOT_CONNECTED)
 *
 * NOT_CONNECTED: per-task gate live CI run results, actual test pass/fail counts, live probe
 *   results. These carry connection:'NOT_CONNECTED' + liveSource + confidence 0.
 *
 * Composition rule: imports and calls lcis-governance results through the EngineeringPackage
 * blueprint; does NOT reimplement compliance evaluation, drift detection, or readiness scoring.
 *
 * NO fetch/spawn/exec/eval/writeFile/network — pure deterministic sync transform.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';
import type { EngineeringPackage } from '@letbuyy/lcis-engineering';
import {
  ExecutionEvidenceBuilder,
  ExecutionConfidenceCalculator,
  ExecutionSeverityScorer,
  ExecutionRuleRegistry,
  execution,
  defaultNow,
  type ExecutionValidation,
  type ExecutionFinding,
  type ExecutionHealth,
  type ValidationReport,
  type HealthBand,
} from '../shared/index';

/** The live source for per-task gate CI runs — not wired yet. */
const LIVE_CI_SOURCE = 'GitHub Actions CI (validator gate run)';

/** The live source for verification confirmation. */
const LIVE_VERIFY_SOURCE = 'CI test suite / coverage tool';

export class ValidationIntelligenceService {
  private readonly eb = new ExecutionEvidenceBuilder();
  private readonly cc = new ExecutionConfidenceCalculator();
  private readonly ss = new ExecutionSeverityScorer();
  private readonly rr = new ExecutionRuleRegistry();

  constructor(
    // core is accepted for constructor contract parity; validation reads from pkg.blueprint.*
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Map a ComplianceStatus to ValidationStatus + Connection.
   * COMPLIANT  → PASSED  CONNECTED
   * VIOLATED   → FAILED  CONNECTED
   * PARTIAL    → PENDING NOT_CONNECTED (live confirmation needed)
   * UNKNOWN    → PENDING NOT_CONNECTED (cannot evaluate from static graph)
   */
  private mapComplianceStatus(status: string): { vs: 'PASSED' | 'FAILED' | 'PENDING'; conn: 'CONNECTED' | 'NOT_CONNECTED' } {
    if (status === 'COMPLIANT') return { vs: 'PASSED', conn: 'CONNECTED' };
    if (status === 'VIOLATED') return { vs: 'FAILED', conn: 'CONNECTED' };
    // PARTIAL | UNKNOWN — live confirmation NOT_CONNECTED
    return { vs: 'PENDING', conn: 'NOT_CONNECTED' };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Map compliance.evaluations → ExecutionValidation[] (governance rules R001–R008).
   * Each COMPLIANT/VIOLATED evaluation is CONNECTED. PARTIAL/UNKNOWN are PENDING NOT_CONNECTED.
   *
   * Then append one PENDING NOT_CONNECTED ExecutionValidation per unique task gate — the live
   * CI run for that gate is NOT_CONNECTED (no GitHub Actions adapter wired).
   */
  validationStatus(pkg: EngineeringPackage): ExecutionValidation[] {
    const validations: ExecutionValidation[] = [];

    // 1. Governance compliance evaluations (CONNECTED static graph evaluation)
    for (const eval_ of pkg.blueprint.compliance.evaluations) {
      const { vs, conn } = this.mapComplianceStatus(eval_.status);
      const reuseEv = this.eb.reuse(
        'lcis-governance',
        `ComplianceService.${eval_.rule.id}`,
        `Rule ${eval_.rule.id} (${eval_.rule.title}) evaluated by lcis-governance — status: ${eval_.status}`,
      );
      const confidence = conn === 'CONNECTED'
        ? this.cc.forConnection('CONNECTED', [reuseEv])
        : 0;

      validations.push({
        id: `validation-compliance-${eval_.rule.id}`,
        subject: eval_.rule.title,
        gate: eval_.rule.id,
        status: vs,
        connection: conn,
        severity: eval_.rule.severity as ExecutionValidation['severity'],
        liveSource: conn === 'NOT_CONNECTED' ? LIVE_CI_SOURCE : null,
        evidence: [reuseEv],
        // Add NOT_CONNECTED evidence when live confirmation needed
        ...(conn === 'NOT_CONNECTED'
          ? { evidence: [reuseEv, this.eb.notConnected(`gate:${eval_.rule.id}:live`, LIVE_CI_SOURCE)] }
          : {}),
      } satisfies ExecutionValidation);
    }

    // 2. Per-task gate PENDING NOT_CONNECTED (live CI run not wired)
    const seenGates = new Set<string>();
    for (const task of pkg.tasks) {
      if (seenGates.has(task.gate)) continue;
      seenGates.add(task.gate);

      const gateEv = this.eb.gate(task.gate, `Validator gate declared by task "${task.title}" (${task.id})`);
      const ncEv = this.eb.notConnected(`gate:${task.gate}:ci-run`, LIVE_CI_SOURCE);

      validations.push({
        id: `validation-gate-${task.gate}`,
        subject: task.gate,
        gate: task.gate,
        status: 'PENDING',
        connection: 'NOT_CONNECTED',
        severity: 'medium',
        liveSource: LIVE_CI_SOURCE,
        evidence: [gateEv, ncEv],
      } satisfies ExecutionValidation);
    }

    return validations;
  }

  /**
   * ExecutionHealth over the compliance score and violation count.
   * Score is CONNECTED (structural compliance score from pkg.blueprint.compliance.score).
   * connectedSignals: compliance score + violations count; notConnectedSignals: per-gate CI runs.
   */
  validatorHealth(pkg: EngineeringPackage): ExecutionHealth {
    const complianceScore = pkg.blueprint.compliance.score;
    const violationCount = pkg.blueprint.compliance.violations.length;
    const uniqueGates = new Set(pkg.tasks.map((t) => t.gate)).size;

    // Health score: penalise heavily for violations, start from compliance score
    const penaltyPerViolation = 5;
    const rawScore = Math.max(0, complianceScore - violationCount * penaltyPerViolation);
    const score = Math.round(rawScore);

    let band: HealthBand = 'unknown';
    if (score >= 80) band = 'healthy';
    else if (score >= 50) band = 'degraded';
    else band = 'failing';

    return {
      area: 'validation',
      score,
      band,
      connectedSignals: 2, // compliance.score + violations.length
      notConnectedSignals: uniqueGates, // each gate's live CI run
    } satisfies ExecutionHealth;
  }

  /**
   * EO03 findings from compliance.violations (CONNECTED structural failures).
   * Also surfaces security drift findings from pkg.blueprint.security.findings (CONNECTED).
   * Reuse-cites lcis-governance for both.
   */
  failedValidations(pkg: EngineeringPackage): ExecutionFinding[] {
    const rule = this.rr.get('EO03')!;
    const findings: ExecutionFinding[] = [];

    // Compliance violations (CONNECTED)
    for (const [i, violation] of pkg.blueprint.compliance.violations.entries()) {
      const reuseEv = this.eb.reuse(
        'lcis-governance',
        `ComplianceService.violations`,
        `Violation: ${violation.title} — rule ${violation.rule ?? 'unset'} on subject "${violation.subject}"`,
      );
      findings.push({
        id: `EO03-compliance-${i + 1}`,
        category: rule.category,
        kind: `compliance-violation:${violation.kind}`,
        severity: this.ss.forFinding({ failedValidation: true }),
        subject: violation.subject,
        title: `Compliance violated: ${violation.title}`,
        detail: `${violation.detail} [Rule: ${violation.rule ?? 'none'}, Severity: ${violation.severity}]`,
        rule: rule.id,
        connection: 'CONNECTED',
        confidence: this.cc.forConnection('CONNECTED', [reuseEv]),
        evidence: [reuseEv],
      } satisfies ExecutionFinding);
    }

    // Security drift findings (CONNECTED structural)
    for (const [i, finding] of pkg.blueprint.security.findings.entries()) {
      const reuseEv = this.eb.reuse(
        'lcis-governance',
        `SecurityDriftService.findings`,
        `Security finding: ${finding.title} — kind: ${finding.kind} on subject "${finding.subject}"`,
      );
      findings.push({
        id: `EO03-security-${i + 1}`,
        category: 'validation',
        kind: `security-drift:${finding.kind}`,
        severity: this.ss.forFinding({ failedValidation: true }),
        subject: finding.subject,
        title: `Security drift: ${finding.title}`,
        detail: `${finding.detail} [Kind: ${finding.kind}, Confidence: ${finding.confidence}]`,
        rule: rule.id,
        connection: 'CONNECTED',
        confidence: this.cc.forConnection('CONNECTED', [reuseEv]),
        evidence: [reuseEv],
      } satisfies ExecutionFinding);
    }

    return findings;
  }

  /**
   * ExecutionValidation[] whose live CI gate result is NOT_CONNECTED (confidence 0).
   * Every per-task gate is PENDING NOT_CONNECTED until an execution-tracking adapter is wired.
   */
  pendingValidations(pkg: EngineeringPackage): ExecutionValidation[] {
    return this.validationStatus(pkg).filter(
      (v) => v.connection === 'NOT_CONNECTED',
    );
  }

  /**
   * Validations ordered along the engineering build/milestone order.
   * Compliance gates appear in rule order (R001..R008); per-task gate validations appear
   * in the pkg.graph.implementationOrder (build layer order).
   */
  validationTimeline(pkg: EngineeringPackage): ExecutionValidation[] {
    const all = this.validationStatus(pkg);

    // Compliance validations (R001..R008) first — sorted by rule id
    const complianceValidations = all
      .filter((v) => v.id.startsWith('validation-compliance-'))
      .sort((a, b) => a.gate.localeCompare(b.gate));

    // Gate validations in implementationOrder
    const orderMap = new Map(pkg.graph.implementationOrder.map((id, idx) => [id, idx]));
    const taskToGate = new Map(pkg.tasks.map((t) => [t.id, t.gate]));

    // Build sorted gate validations by their earliest task in implementationOrder
    const gateOrder = new Map<string, number>();
    for (const taskId of pkg.graph.implementationOrder) {
      const gate = taskToGate.get(taskId);
      if (gate && !gateOrder.has(gate)) {
        gateOrder.set(gate, orderMap.get(taskId) ?? Infinity);
      }
    }

    const gateValidations = all
      .filter((v) => v.id.startsWith('validation-gate-'))
      .sort((a, b) => {
        const aOrd = gateOrder.get(a.gate) ?? Infinity;
        const bOrd = gateOrder.get(b.gate) ?? Infinity;
        return aOrd - bOrd;
      });

    return [...complianceValidations, ...gateValidations];
  }

  /**
   * EO08 findings from readiness gaps and the verification plan.
   * ReadinessFactor present=false or 'UNKNOWN' indicates a verification coverage gap.
   * CONNECTED for structural readiness evaluation (honest UNKNOWN for undeterminable factors).
   */
  verificationCoverage(pkg: EngineeringPackage): ExecutionFinding[] {
    const rule = this.rr.get('EO08')!;
    const findings: ExecutionFinding[] = [];

    for (const [si, score] of pkg.blueprint.readiness.scores.entries()) {
      for (const factor of score.factors) {
        if (factor.present === false || factor.present === 'UNKNOWN') {
          const reuseEv = this.eb.reuse(
            'lcis-governance',
            `ReadinessService.${factor.key}`,
            `Readiness factor "${factor.key}" for subject "${score.subject}": present=${String(factor.present)}`,
          );
          const isUnknown = factor.present === 'UNKNOWN';
          findings.push({
            id: `EO08-${si + 1}-${factor.key}`,
            category: rule.category,
            kind: isUnknown ? `verification-gap:unknown:${factor.key}` : `verification-gap:missing:${factor.key}`,
            severity: rule.severity,
            subject: score.subject,
            title: isUnknown
              ? `Verification factor undeterminable: ${factor.key}`
              : `Verification gap: ${factor.key} missing for ${score.subject}`,
            detail: isUnknown
              ? `ReadinessFactor "${factor.key}" for "${score.subject}" is UNKNOWN — cannot determine presence from the static graph; a live probe would require ${LIVE_VERIFY_SOURCE}.`
              : `ReadinessFactor "${factor.key}" for "${score.subject}" is absent. Weight: ${factor.weight}. This is a verification coverage gap.`,
            rule: rule.id,
            connection: isUnknown ? 'NOT_CONNECTED' : 'CONNECTED',
            confidence: isUnknown ? 0 : this.cc.forConnection('CONNECTED', [reuseEv]),
            evidence: isUnknown
              ? [reuseEv, this.eb.notConnected(`readiness:${factor.key}:live`, LIVE_VERIFY_SOURCE)]
              : [reuseEv],
          } satisfies ExecutionFinding);
        }
      }
    }

    return findings;
  }

  /**
   * Compose a full ValidationReport via execution() — carries validations, findings,
   * health, and provenance. liveConnected = false (no live tracker wired).
   */
  generateValidationReport(pkg: EngineeringPackage): ValidationReport {
    const validations = this.validationStatus(pkg);
    const findings = [
      ...this.failedValidations(pkg),
      ...this.verificationCoverage(pkg),
    ];
    const health = this.validatorHealth(pkg);

    const reuseEv = this.eb.reuse(
      'lcis-governance',
      'ComplianceService + SecurityDriftService + ReadinessService',
      'Validation intelligence reuses lcis-governance evaluation results from pkg.blueprint — EAOS does not reimplement them',
    );
    const ncEv = this.eb.notConnected('validation:ci-gate-runs', LIVE_CI_SOURCE);

    const passedCount = validations.filter((v) => v.status === 'PASSED').length;
    const failedCount = validations.filter((v) => v.status === 'FAILED').length;
    const pendingCount = validations.filter((v) => v.status === 'PENDING').length;
    const violationCount = pkg.blueprint.compliance.violations.length;
    const securityCount = pkg.blueprint.security.findings.length;
    const verGapCount = findings.filter((f) => f.category === 'verification').length;

    const summary = [
      `Feature: "${pkg.request.text}".`,
      `Validations: ${passedCount} PASSED, ${failedCount} FAILED, ${pendingCount} PENDING.`,
      `Compliance score: ${pkg.blueprint.compliance.score}/100 (${violationCount} violation(s)).`,
      `Security drift: ${securityCount} finding(s).`,
      `Verification coverage gaps: ${verGapCount}.`,
      `Live CI gate results NOT_CONNECTED — source: ${LIVE_CI_SOURCE}.`,
    ].join(' ');

    return execution(
      {
        request: pkg.request,
        validations,
        findings,
        health,
        summary,
      },
      {
        evidence: [reuseEv, ncEv],
        liveConnected: false,
        now: this.now,
      },
    );
  }
}
