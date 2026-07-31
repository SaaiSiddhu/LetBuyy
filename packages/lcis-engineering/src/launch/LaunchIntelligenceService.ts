/**
 * LaunchIntelligenceService — EINS Phase 7.
 *
 * Composes eis.launch.evaluateLaunch (lcis-execution) and ops.operationsReport()
 * (lcis-operations) to produce a unified launch intelligence view: the full LaunchPlan,
 * engineering blocker findings that merge launch blockers with operational risks, and
 * plain-language operational impact lines.
 *
 * EINS composes — it NEVER reimplements launch or operations logic.
 * Read-only. No fetch, no spawn, no eval, no writeFile, no network, no DB-write.
 * Deterministic. No AI. No placeholders. No stubs.
 */
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import { createEisEngine, type EisEngine, type LaunchPlan, type ChangeRequest } from '@letbuyy/lcis-execution';
import { createOperationsEngine, type OperationsEngine, type OperationsReport } from '@letbuyy/lcis-operations';
import {
  defaultNow,
  EngineeringEvidenceBuilder,
  EngineeringFindingBuilder,
  type EngineeringFinding,
} from '../shared/index';

export class LaunchIntelligenceService {
  private readonly eis: EisEngine;
  private readonly ops: OperationsEngine;
  private readonly ev: EngineeringEvidenceBuilder;
  private readonly fb: EngineeringFindingBuilder;

  constructor(
    core: LcisEngine = getEngine(),
    private readonly now: () => string = defaultNow,
  ) {
    this.eis = createEisEngine({ core, now });
    this.ops = createOperationsEngine({ core, now });
    this.ev = new EngineeringEvidenceBuilder();
    this.fb = new EngineeringFindingBuilder();
  }

  /**
   * planLaunch — delegates entirely to eis.launch.evaluateLaunch.
   * Returns the real LaunchPlan (GO / CONDITIONAL_GO / NO_GO) with full provenance.
   */
  async planLaunch(req: ChangeRequest): Promise<LaunchPlan> {
    return this.eis.launch.evaluateLaunch(req);
  }

  /**
   * launchBlockers — merges:
   *   1. The launch plan's blockers (from eis.launch — the structural + artifact-derived blockers)
   *   2. The operations report's atRisk / failing answers (from ops.operationsReport — the
   *      operational risks a launch must respect)
   *
   * Each finding cites reuse-evidence. UNKNOWN launch items remain UNKNOWN; they are
   * surfaced as 'gap' findings, never silently converted to passes.
   */
  async launchBlockers(req: ChangeRequest): Promise<EngineeringFinding[]> {
    const [plan, opsReport] = await Promise.all([
      this.eis.launch.evaluateLaunch(req),
      Promise.resolve(this.ops.operationsReport()),
    ]);

    const findings: EngineeringFinding[] = [];

    // ── 1. From the launch plan's blockers (eis.launch) ─────────────────────
    for (const b of plan.blockers) {
      const isUnknown = b.state === 'UNKNOWN';
      findings.push(
        this.fb.build({
          category: isUnknown ? 'gap' : 'blocker',
          kind: 'launch-blocker',
          severity: this.mapSeverity(b.severity),
          subject: b.id,
          title: b.title,
          detail: isUnknown
            ? `UNKNOWN — cannot determine from current artifacts. State: UNKNOWN. Never silently passed.`
            : `KNOWN blocker from launch plan. Severity: ${b.severity}. Must be resolved before launch.`,
          evidence: [
            this.ev.reuse(
              'lcis-execution',
              'eis.launch.evaluateLaunch',
              `LaunchBlocker[${b.id}] state=${b.state} severity=${b.severity}`,
            ),
            ...b.evidence,
          ],
        }),
      );
    }

    // ── 2. From the go/no-go decision unknowns (UNKNOWN items from eis.launch) ─
    for (const unknown of plan.decision.unknowns) {
      const id = this.fb.stableId('launch-unknown', unknown.slice(0, 48).replace(/\s+/g, '-'));
      // Avoid duplicating a blocker already captured above
      if (findings.some((f) => f.id === id)) continue;
      findings.push(
        this.fb.build({
          id,
          category: 'gap',
          kind: 'launch-unknown',
          severity: 'medium',
          subject: unknown.slice(0, 64),
          title: `UNKNOWN: ${unknown.slice(0, 80)}`,
          detail: `Cannot be determined from current artifacts — surfaced as an UNKNOWN gap, never a pass. Source: eis.launch.evaluateLaunch.`,
          evidence: [
            this.ev.reuse(
              'lcis-execution',
              'eis.launch.evaluateLaunch',
              `decision.unknowns: ${unknown}`,
            ),
          ],
        }),
      );
    }

    // ── 3. From ops.operationsReport — atRisk answers ───────────────────────
    for (const atRisk of opsReport.answers.atRisk) {
      findings.push(
        this.fb.build({
          category: 'risk',
          kind: 'ops-at-risk',
          severity: 'high',
          subject: atRisk.slice(0, 64),
          title: `Operational risk at launch: ${atRisk.slice(0, 80)}`,
          detail: `Operational risk that must be considered at launch time. Source: ops.operationsReport().answers.atRisk. Live connection: ${opsReport.liveConnected ? 'CONNECTED' : 'NOT_CONNECTED'}.`,
          evidence: [
            this.ev.reuse(
              'lcis-operations',
              'ops.operationsReport',
              `answers.atRisk: ${atRisk}`,
            ),
            ...opsReport.evidence.slice(0, 1),
          ],
        }),
      );
    }

    // ── 4. From ops.operationsReport — failing answers ───────────────────────
    for (const failing of opsReport.answers.failing) {
      findings.push(
        this.fb.build({
          category: 'blocker',
          kind: 'ops-failing',
          severity: 'critical',
          subject: failing.slice(0, 64),
          title: `Failing operational area at launch: ${failing.slice(0, 80)}`,
          detail: `A failing operational area detected by LCOS. Launching into a known-failing area is a blocker. Source: ops.operationsReport().answers.failing. Live connection: ${opsReport.liveConnected ? 'CONNECTED' : 'NOT_CONNECTED'}.`,
          evidence: [
            this.ev.reuse(
              'lcis-operations',
              'ops.operationsReport',
              `answers.failing: ${failing}`,
            ),
            ...opsReport.evidence.slice(0, 1),
          ],
        }),
      );
    }

    return findings;
  }

  /**
   * operationalImpact — plain-language operational impact lines derived from
   * ops.operationsReport().answers. Each line is cites the source method.
   * Never fabricates; NOT_CONNECTED signals are reported as such.
   */
  async operationalImpact(_req: ChangeRequest): Promise<string[]> {
    const opsReport: OperationsReport = this.ops.operationsReport();
    const liveNote = opsReport.liveConnected
      ? '(live data CONNECTED)'
      : '(live data NOT_CONNECTED — structural topology only; source: ops.operationsReport)';

    const lines: string[] = [];

    if (opsReport.answers.failing.length > 0) {
      lines.push(
        `FAILING ${liveNote}: ${opsReport.answers.failing.join('; ')}`,
      );
    }
    if (opsReport.answers.degraded.length > 0) {
      lines.push(
        `DEGRADED ${liveNote}: ${opsReport.answers.degraded.join('; ')}`,
      );
    }
    if (opsReport.answers.atRisk.length > 0) {
      lines.push(
        `AT RISK ${liveNote}: ${opsReport.answers.atRisk.join('; ')}`,
      );
    }
    if (opsReport.answers.investigate.length > 0) {
      lines.push(
        `INVESTIGATE ${liveNote}: ${opsReport.answers.investigate.join('; ')}`,
      );
    }
    if (opsReport.answers.healthy.length > 0) {
      lines.push(
        `HEALTHY ${liveNote}: ${opsReport.answers.healthy.join('; ')}`,
      );
    }
    if (opsReport.answers.changed.length > 0) {
      lines.push(
        `CHANGED ${liveNote}: ${opsReport.answers.changed.join('; ')}`,
      );
    }

    if (lines.length === 0) {
      lines.push(
        `No operational signals connected ${liveNote}. Wire live telemetry adapters for real-time impact.`,
      );
    }

    return lines;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private mapSeverity(
    level: 'low' | 'medium' | 'high' | 'critical',
  ): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    return level;
  }
}
