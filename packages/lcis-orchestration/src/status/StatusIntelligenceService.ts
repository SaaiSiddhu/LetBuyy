/**
 * StatusIntelligenceService — EAOS Phase 8.
 *
 * A pure, synchronous, read-only transform over an EngineeringPackage. It produces
 * ProgressMetric values and a StatusReport for all execution axes.
 *
 * Honesty contract (enforced structurally, not aspirationally):
 *  - planned counts are CONNECTED — they are a direct structural count of tasks/agents/
 *    artifacts/validations declared in the package at build time.
 *  - READY and BLOCKED counts are CONNECTED — derivable from EngineeringGraph.parallelizable
 *    and EngineeringGraph.blocked without a live execution store.
 *  - completed counts are NOT_CONNECTED — there is no live execution-tracking store wired
 *    in this repo; completed is always null, never fabricated.
 *  - Static-gate validation results (ComplianceReport.evaluations) are CONNECTED for
 *    structural PASS/FAIL (COMPLIANT / VIOLATED / PARTIAL / UNKNOWN from lcis-governance).
 *    Live CI test run counts are NOT_CONNECTED.
 *  - ETA is NOT_CONNECTED — requires actual execution durations from a live tracker.
 *
 * No I/O, no fetch, no child_process, no eval, no writeFile. No AI. No stubs.
 */

import type { LcisEngine } from '@letbuyy/lcis-core';
import type { EngineeringPackage } from '@letbuyy/lcis-engineering';
import {
  execution,
  ExecutionEvidenceBuilder,
  ExecutionSeverityScorer,
  defaultNow,
  type ProgressMetric,
  type StatusReport,
  type ExecutionFinding,
  type Connection,
} from '../shared/index';

// ── internal helpers ──────────────────────────────────────────────────────────

function notConnectedMetric(
  label: string,
  planned: number,
  liveSource: string,
): ProgressMetric {
  return {
    label,
    planned,
    completed: null,
    connection: 'NOT_CONNECTED' as Connection,
    liveSource,
  };
}

function connectedMetric(
  label: string,
  planned: number,
  completed: number,
  liveSource: string | null = null,
): ProgressMetric {
  return {
    label,
    planned,
    completed,
    connection: 'CONNECTED' as Connection,
    liveSource,
  };
}

// ── service ───────────────────────────────────────────────────────────────────

export class StatusIntelligenceService {
  readonly #eb: ExecutionEvidenceBuilder;
  readonly #scorer: ExecutionSeverityScorer;
  readonly #now: () => string;

  constructor(
    _core: LcisEngine,
    now: () => string = defaultNow,
  ) {
    this.#eb = new ExecutionEvidenceBuilder();
    this.#scorer = new ExecutionSeverityScorer();
    this.#now = now;
  }

  // ── executionProgress ──────────────────────────────────────────────────────

  /**
   * Progress over EngineeringPackage.tasks (the ordered engineering task list).
   * planned = CONNECTED (tasks.length is structural).
   * READY + BLOCKED sub-counts are CONNECTED from graph.parallelizable / graph.blocked.
   * completed = NOT_CONNECTED (requires live execution-tracking store).
   */
  executionProgress(pkg: EngineeringPackage): ProgressMetric {
    const total = pkg.tasks.length;
    const ready = pkg.graph.parallelizable.length;
    const blocked = pkg.graph.blocked.length;
    return notConnectedMetric(
      `Execution: ${total} tasks planned (${ready} ready, ${blocked} blocked — CONNECTED; completed NOT_CONNECTED)`,
      total,
      'execution-tracking store (CI / git artifact presence)',
    );
  }

  // ── taskProgress ──────────────────────────────────────────────────────────

  /**
   * Progress over the engineering task list (same axis as executionProgress,
   * surfaced separately per spec as the "task" dimension).
   */
  taskProgress(pkg: EngineeringPackage): ProgressMetric {
    const total = pkg.tasks.length;
    return notConnectedMetric(
      `Tasks: ${total} planned`,
      total,
      'execution-tracking store',
    );
  }

  // ── agentProgress ─────────────────────────────────────────────────────────

  /**
   * Progress over AgentPlan.tasks.
   * ASSIGNED status is CONNECTED (structural); WORKING/FINISHED are NOT_CONNECTED.
   */
  agentProgress(pkg: EngineeringPackage): ProgressMetric {
    const total = pkg.agentPlan.tasks.length;
    return notConnectedMetric(
      `Agents: ${total} assigned (CONNECTED); working/finished NOT_CONNECTED`,
      total,
      'live agent execution signal',
    );
  }

  // ── artifactProgress ──────────────────────────────────────────────────────

  /**
   * Progress over planned artifacts (one per EngineeringTask, inferred from task.layer).
   * Planned count is CONNECTED (structural). On-disk existence is NOT_CONNECTED.
   */
  artifactProgress(pkg: EngineeringPackage): ProgressMetric {
    const total = pkg.tasks.length; // one artifact per task (by layer)
    return notConnectedMetric(
      `Artifacts: ${total} planned`,
      total,
      'git-probe / filesystem artifact presence',
    );
  }

  // ── validationProgress ───────────────────────────────────────────────────

  /**
   * Progress over validation gates.
   *
   * Two distinct sub-populations:
   *  1. Static-gate evaluations from pkg.blueprint.compliance.evaluations:
   *     COMPLIANT / VIOLATED / PARTIAL are CONNECTED (structural governance output).
   *     We count COMPLIANT evaluations as "passed" — CONNECTED partial real signal.
   *  2. Live CI test runs for each task gate: NOT_CONNECTED.
   *
   * Returns a metric whose completed = static COMPLIANT count (CONNECTED partial signal)
   * but whose connection is 'NOT_CONNECTED' because the live CI dimension is absent.
   * The label makes both sub-populations explicit.
   */
  validationProgress(pkg: EngineeringPackage): ProgressMetric {
    const evaluations = pkg.blueprint.compliance.evaluations;
    const totalGates = pkg.tasks.length; // one gate per task
    const staticEvals = evaluations.length;
    const staticPassed = evaluations.filter((e) => e.status === 'COMPLIANT').length;
    const staticViolated = evaluations.filter((e) => e.status === 'VIOLATED').length;
    // Static-gate results are CONNECTED; live CI runs are NOT_CONNECTED.
    // We expose staticPassed as a partial real signal in the label, but overall
    // completed remains null (live CI gate completion is NOT_CONNECTED).
    return notConnectedMetric(
      `Validations: ${totalGates} task gates planned; static-gate results CONNECTED ` +
        `(${staticEvals} evaluated, ${staticPassed} COMPLIANT, ${staticViolated} VIOLATED); ` +
        `live CI gate runs NOT_CONNECTED`,
      totalGates,
      'CI run result (live CI gate execution)',
    );
  }

  // ── overallProgress ───────────────────────────────────────────────────────

  /**
   * Aggregate planned count across all four axes.
   * completed = NOT_CONNECTED (no live tracker).
   */
  overallProgress(pkg: EngineeringPackage): ProgressMetric {
    const taskCount = pkg.tasks.length;
    const agentCount = pkg.agentPlan.tasks.length;
    const artifactCount = pkg.tasks.length;
    const gateCount = pkg.tasks.length;
    const totalPlanned = taskCount + agentCount + artifactCount + gateCount;
    return notConnectedMetric(
      `Overall: ${totalPlanned} planned work items across tasks/agents/artifacts/gates`,
      totalPlanned,
      'execution-tracking store (CI / git / live agent signal)',
    );
  }

  // ── eta ──────────────────────────────────────────────────────────────────

  /**
   * ETA is NOT_CONNECTED — requires actual execution durations from a live tracker.
   * Never a fabricated date.
   */
  eta(_pkg: EngineeringPackage): {
    connection: Connection;
    value: string | null;
    liveSource: string;
  } {
    return {
      connection: 'NOT_CONNECTED',
      value: null,
      liveSource: 'execution-tracking durations',
    };
  }

  // ── blockedReasons ───────────────────────────────────────────────────────

  /**
   * CONNECTED blocked task ids from EngineeringGraph.blocked (structural dependency analysis)
   * + CONNECTED decision.blockers from the engineering package verdict.
   */
  blockedReasons(pkg: EngineeringPackage): string[] {
    const graphBlocked = pkg.graph.blocked.map(
      (id) => `task:${id} — blocked by unresolved dependency (EngineeringGraph.blocked)`,
    );
    const decisionBlocked = pkg.decision.blockers.map(
      (b) => `decision-blocker: ${b}`,
    );
    return [...graphBlocked, ...decisionBlocked];
  }

  // ── generateStatusReport ─────────────────────────────────────────────────

  /**
   * Synthesises all progress axes into a StatusReport via execution().
   * All NOT_CONNECTED values are surfaced with their liveSource; nothing is fabricated.
   */
  generateStatusReport(pkg: EngineeringPackage): StatusReport {
    const taskProg = this.taskProgress(pkg);
    const agentProg = this.agentProgress(pkg);
    const artifactProg = this.artifactProgress(pkg);
    const validationProg = this.validationProgress(pkg);
    const overall = this.overallProgress(pkg);
    const execProg = this.executionProgress(pkg);
    const etaValue = this.eta(pkg);
    const blocked = this.blockedReasons(pkg);

    const metrics: ProgressMetric[] = [
      execProg,
      taskProg,
      agentProg,
      artifactProg,
      validationProg,
    ];

    // ── findings ──────────────────────────────────────────────────────────

    const findings: ExecutionFinding[] = [];

    // Blocked tasks → high severity, CONNECTED
    for (const id of pkg.graph.blocked) {
      findings.push({
        id: `EO-STATUS-BLOCKED-${id}`,
        category: 'blocked',
        kind: 'task-blocked',
        severity: this.#scorer.forFinding({ blocked: true }),
        subject: id,
        title: `Task ${id} is blocked`,
        detail: `EngineeringGraph.blocked contains ${id}. Dependency resolution required before execution can proceed.`,
        rule: 'EO03',
        connection: 'CONNECTED',
        confidence: 0.85,
        evidence: [this.#eb.task(id, 'appears in EngineeringGraph.blocked')],
      });
    }

    // Decision blockers → high severity, CONNECTED
    for (const b of pkg.decision.blockers) {
      findings.push({
        id: `EO-STATUS-DECISION-${b.slice(0, 32).replace(/\s+/g, '-')}`,
        category: 'blocked',
        kind: 'decision-blocker',
        severity: this.#scorer.forFinding({ blocked: true }),
        subject: 'decision',
        title: `Engineering decision blocker: ${b.slice(0, 80)}`,
        detail: b,
        rule: 'EO03',
        connection: 'CONNECTED',
        confidence: 0.9,
        evidence: [
          this.#eb.reuse(
            'lcis-engineering',
            'decision.blockers',
            `blocker: ${b.slice(0, 60)}`,
          ),
        ],
      });
    }

    // Violated compliance evaluations → critical, CONNECTED
    const evaluations = pkg.blueprint.compliance.evaluations;
    for (const ev of evaluations) {
      if (ev.status === 'VIOLATED') {
        findings.push({
          id: `EO-STATUS-COMPLIANCE-${ev.rule.id}`,
          category: 'validation',
          kind: 'compliance-violated',
          severity: this.#scorer.forFinding({ failedValidation: true }),
          subject: ev.rule.id,
          title: `Compliance gate violated: ${ev.rule.title}`,
          detail: `Rule ${ev.rule.id} (${ev.rule.category}) status=VIOLATED — ${ev.rule.description}`,
          rule: 'EO04',
          connection: 'CONNECTED',
          confidence: 0.9,
          evidence: [...ev.evidence],
        });
      }
    }

    // NOT_CONNECTED signal: remind that completed counts require live tracking
    findings.push({
      id: 'EO-STATUS-NOT-CONNECTED-COMPLETION',
      category: 'verification',
      kind: 'live-tracking-absent',
      severity: 'info',
      subject: 'execution-tracking store',
      title: 'Completed task counts are NOT_CONNECTED — no live execution tracker wired',
      detail:
        'Progress % and ETA require a live execution-tracking store (CI run IDs, git artifact presence, agent completion events). ' +
        'Until one is wired, completed=null and eta.value=null are the honest values.',
      rule: 'EO08',
      connection: 'NOT_CONNECTED',
      confidence: 0,
      evidence: [
        this.#eb.notConnected(
          'execution-tracking',
          'execution-tracking store (CI / git / live agent signal)',
        ),
      ],
    });

    // ── summary ───────────────────────────────────────────────────────────

    const verdict = pkg.decision.verdict;
    const readyCount = pkg.graph.parallelizable.length;
    const blockedCount = pkg.graph.blocked.length;
    const totalTasks = pkg.tasks.length;
    const totalAgents = pkg.agentPlan.tasks.length;
    const staticPassed = evaluations.filter((e) => e.status === 'COMPLIANT').length;
    const staticViolated = evaluations.filter((e) => e.status === 'VIOLATED').length;

    const summary =
      `Engineering package: ${totalTasks} tasks, ${totalAgents} agents, verdict=${verdict}. ` +
      `Execution state: ${readyCount} READY, ${blockedCount} BLOCKED (CONNECTED). ` +
      `Static compliance gates: ${staticPassed} COMPLIANT, ${staticViolated} VIOLATED (CONNECTED). ` +
      `Completed counts and ETA: NOT_CONNECTED (no live execution tracker wired).`;

    // ── build report ──────────────────────────────────────────────────────

    const evidence = [
      this.#eb.reuse(
        'lcis-engineering',
        'EngineeringPackage',
        `tasks=${totalTasks}, agents=${totalAgents}, verdict=${verdict}`,
      ),
      this.#eb.reuse(
        'lcis-engineering',
        'EngineeringGraph.parallelizable+blocked',
        `ready=${readyCount}, blocked=${blockedCount}`,
      ),
      this.#eb.reuse(
        'lcis-governance',
        'ComplianceReport.evaluations',
        `evaluated=${evaluations.length}, compliant=${staticPassed}, violated=${staticViolated}`,
      ),
      this.#eb.notConnected(
        'execution-tracking',
        'execution-tracking store (CI / git / live agent signal)',
      ),
    ];

    return execution(
      {
        request: pkg.blueprint.request,
        metrics,
        overall,
        eta: etaValue,
        blockedReasons: blocked,
        findings,
        summary,
      },
      {
        evidence,
        liveConnected: false,
        now: this.#now,
      },
    ) as StatusReport;
  }
}
