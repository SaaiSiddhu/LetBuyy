/**
 * AbuseComplianceService — LSAS abuse + compliance area. Composes:
 *   - lcis-operations SecurityOperationsService (via OperationsEngine) for live abuse signals
 *     (detectAbuseSignals / detectAuthAnomalies / detectCredentialEvents / detectSecuritySpikes)
 *   - lcis-governance ComplianceService (via GovernanceEngine) for rule evaluations (R001..R008)
 *
 * Maps OperationalFinding[] → AbuseSignal[] and RuleEvaluation[] (+ violation Findings) →
 * ComplianceItem[], preserving the exact connection status and live-source citations.
 *
 * Hard rules enforced:
 *   - READ-ONLY: no fetch, no exec, no fs writes, no DB.
 *   - Deterministic: same core + same now → same output.
 *   - Injectable clock: constructor(core, now = defaultNow).
 *   - Honesty: AbuseSignals from ops findings are NOT_CONNECTED live signals — never claim
 *     CONNECTED without evidence. ComplianceItems carry evidence from governance.
 *   - Services return plain typed arrays; the FACADE (engine.ts) wraps SecurityReport.
 *   - try/catch on each delegate call → honest empty, never throw.
 */
import { type LcisEngine } from '@letbuyy/lcis-core';
import { createOperationsEngine } from '@letbuyy/lcis-operations';
import { createGovernanceEngine } from '@letbuyy/lcis-governance';
import { defaultNow } from '../shared/envelope';
import type { AbuseSignal, ComplianceItem, Connection } from '../shared/types';
import type { OperationalFinding } from '@letbuyy/lcis-operations';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive a liveSource string from a finding's not-connected evidence entries.
 * Returns the first env-var (evidence.source) found in not-connected evidence,
 * or a joined list of all sources, or null when none exists.
 */
function liveSourceFromFinding(finding: OperationalFinding): string | null {
  const ncEvidence = finding.evidence.filter((e) => e.kind === 'not-connected');
  if (ncEvidence.length === 0) return null;
  // Prefer `source` (the env var name); fall back to `ref`
  const sources = ncEvidence
    .map((e) => e.source ?? e.ref)
    .filter((s): s is string => typeof s === 'string' && s.length > 0);
  if (sources.length === 0) return null;
  return [...new Set(sources)].join(', ');
}

/**
 * Map an OperationalFinding's status to a Connection.
 * Ops findings use OperationalStatus ('CONNECTED' | 'PARTIAL' | 'NOT_CONNECTED' | 'UNKNOWN' | 'NOT_DETECTABLE').
 * AbuseSignal only has 'CONNECTED' | 'NOT_CONNECTED'.
 * Preserve the ops finding's exact connection for NOT_CONNECTED; everything else is CONNECTED.
 */
function opsStatusToConnection(status: string): Connection {
  return status === 'NOT_CONNECTED' ? 'NOT_CONNECTED' : 'CONNECTED';
}

// ── AbuseComplianceService ────────────────────────────────────────────────────

export class AbuseComplianceService {
  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {}

  /**
   * Abuse signals: the union of all four ops security detect methods:
   *   detectAbuseSignals + detectAuthAnomalies + detectCredentialEvents + detectSecuritySpikes
   *
   * Each OperationalFinding → AbuseSignal:
   *   kind     ← finding.kind
   *   subject  ← finding.subject
   *   detail   ← finding.detail
   *   connection ← preserve the finding's NOT_CONNECTED (live signals are NOT_CONNECTED by design)
   *   liveSource ← extracted from finding's not-connected evidence source (env var name)
   *   evidence ← finding.evidence (verbatim)
   *
   * On any error → honest empty [].
   */
  abuseSignals(): readonly AbuseSignal[] {
    try {
      const ops = createOperationsEngine({ core: this.core, now: this.now });
      const secOps = ops.securityOps;

      const findings: OperationalFinding[] = [
        ...secOps.detectAbuseSignals(),
        ...secOps.detectAuthAnomalies(),
        ...secOps.detectCredentialEvents(),
        ...secOps.detectSecuritySpikes(),
      ];

      return findings.map((f): AbuseSignal => ({
        kind: f.kind,
        subject: f.subject,
        detail: f.detail,
        connection: opsStatusToConnection(f.status),
        liveSource: liveSourceFromFinding(f),
        evidence: f.evidence,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Compliance items: from the governance compliance report.
   *   generateComplianceReport() → evaluations (RuleEvaluation[])
   *
   * Each RuleEvaluation → one ComplianceItem for the rule-level status:
   *   rule    ← evaluation.rule.id
   *   title   ← evaluation.rule.title
   *   status  ← map ComplianceStatus → 'COMPLIANT' | 'VIOLATED' | 'UNKNOWN'
   *             ('PARTIAL' → 'UNKNOWN' — partial determinability is honest unknown)
   *   detail  ← evaluation summary: checked/passed counts + first violation title if any
   *   evidence ← evaluation.evidence
   *
   * Violations within each evaluation are NOT expanded into separate items; the evaluation
   * item captures the rule-level status and cites its violations in the detail field.
   *
   * On any error → honest empty [].
   */
  compliance(): readonly ComplianceItem[] {
    try {
      const gov = createGovernanceEngine({ core: this.core, now: this.now });
      const report = gov.compliance.generateComplianceReport();

      return report.evaluations.map((ev): ComplianceItem => {
        const govStatus = ev.status;
        let status: 'COMPLIANT' | 'VIOLATED' | 'UNKNOWN';
        if (govStatus === 'COMPLIANT') {
          status = 'COMPLIANT';
        } else if (govStatus === 'VIOLATED') {
          status = 'VIOLATED';
        } else {
          // 'PARTIAL' | 'UNKNOWN' → UNKNOWN (honest — partial determinability)
          status = 'UNKNOWN';
        }

        const violationCount = ev.violations.length;
        const firstViolation = violationCount > 0 ? ` First violation: ${ev.violations[0]!.title}.` : '';
        const detail =
          `Rule ${ev.rule.id}: ${ev.rule.description} ` +
          `Checked: ${ev.checked}, passed: ${ev.passed}, violated: ${violationCount}.` +
          firstViolation;

        return {
          rule: ev.rule.id,
          title: ev.rule.title,
          status,
          detail,
          evidence: ev.evidence,
        };
      });
    } catch {
      return [];
    }
  }
}
