/**
 * AgentIntelligenceService — EAOS Phase 8, the agent orchestration intelligence layer.
 *
 * Consumes a frozen EINS EngineeringPackage and derives execution-state overlays for the
 * agent task graph. DECOUPLED from any live execution tracker; structural signals are CONNECTED
 * (an AgentTask existing = ASSIGNED); live agent activity (WORKING/FINISHED/utilization) is
 * NOT_CONNECTED — carried with the exact would-be source, confidence 0.
 *
 * READ-ONLY P0 contract: no fetch / child_process / spawn / exec / eval / writeFile /
 * network / DB-write. Pure synchronous deterministic transform. No AI. No stubs/TODOs.
 */
import { type LcisEngine } from '@letbuyy/lcis-core';
import { type EngineeringPackage } from '@letbuyy/lcis-engineering';
import {
  execution,
  ExecutionEvidenceBuilder,
  ExecutionConfidenceCalculator,
  ExecutionRuleRegistry,
  defaultNow,
  type AgentReport,
  type ExecutionAgent,
  type ExecutionFinding,
  type ExecutionHealth,
} from '../shared/index';

// ── Constants ─────────────────────────────────────────────────────────────────

/** The canonical live source for agent run-state — no adapter wired, always NOT_CONNECTED. */
const LIVE_AGENT_SOURCE = 'agent-execution-tracker (CI/git/fleet dispatcher — not wired)';
const LIVE_UTILIZATION_SOURCE = 'per-agent-load-tracker (fleet dispatcher — not wired)';

// ── AgentIntelligenceService ─────────────────────────────────────────────────

export class AgentIntelligenceService {
  private readonly ev: ExecutionEvidenceBuilder;
  private readonly conf: ExecutionConfidenceCalculator;
  private readonly rules: ExecutionRuleRegistry;

  constructor(
    // core is carried for future composition; not queried by this service directly.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private readonly core: LcisEngine,
    private readonly now = defaultNow,
  ) {
    this.ev = new ExecutionEvidenceBuilder();
    this.conf = new ExecutionConfidenceCalculator();
    this.rules = new ExecutionRuleRegistry();
  }

  // ── agentAssignments ───────────────────────────────────────────────────────

  /**
   * Map each AgentTask in pkg.agentPlan.tasks → one ExecutionAgent.
   *
   * ASSIGNED is CONNECTED (a task existing in the plan is an assignment).
   * Live activity (WORKING/FINISHED/utilization) is NOT_CONNECTED — the tracking store
   * is not wired; confidence is 0 for those values.
   */
  agentAssignments(pkg: EngineeringPackage): ExecutionAgent[] {
    return pkg.agentPlan.tasks.map((at): ExecutionAgent => {
      const ev = [
        this.ev.agent(at.id, `agentType=${at.agentType} taskRef=${at.taskRef}`),
        this.ev.reuse('lcis-engineering', 'AgentPlan.tasks', `agent task ${at.id}`),
      ];
      return {
        id: at.id,
        agentType: at.agentType,
        taskRef: at.taskRef,
        dependsOn: at.dependsOn,
        acceptance: at.acceptance,
        // ASSIGNED is structurally derivable from the plan existing
        status: 'ASSIGNED',
        connection: 'CONNECTED',
        // Live run-state (WORKING/FINISHED) needs a tracker — NOT_CONNECTED
        liveSource: LIVE_AGENT_SOURCE,
        evidence: ev,
      };
    });
  }

  // ── agentOwnership ─────────────────────────────────────────────────────────

  /**
   * Reuse pkg.blueprint.ownership (coverage/gaps) from lcis-governance.
   * Raises EO01 for any agent task whose taskRef has no owner in the ownership coverage map.
   * Cite lcis-governance as the reuse source.
   */
  agentOwnership(pkg: EngineeringPackage): ExecutionFinding[] {
    const findings: ExecutionFinding[] = [];
    const eo01 = this.rules.get('EO01')!;
    const ownership = pkg.blueprint.ownership;

    // Coverage map keys are domain/service/etc names. Build a set of covered subjects.
    const coveredSubjects = new Set<string>(Object.keys(ownership.coverage));

    let idx = 0;
    for (const at of pkg.agentPlan.tasks) {
      // Determine the domain coordinate for the corresponding engineering task
      const engTask = pkg.tasks.find((t) => t.id === at.taskRef);
      const domain = engTask?.domain ?? null;

      // Check whether the task's domain is covered in ownership
      const isCovered = domain !== null && coveredSubjects.has(domain);
      if (!isCovered) {
        const subject = domain ?? at.taskRef;
        findings.push({
          id: `EO01-agent-${idx++}`,
          category: 'ownership',
          kind: 'agent-task-no-owner',
          severity: eo01.severity,
          subject: at.id,
          title: `Agent task has no declared owner (domain: ${subject})`,
          detail: `Agent task ${at.id} (taskRef: ${at.taskRef}) references domain '${subject}' which has no entry in the ownership coverage map. Ownership must be declared in CODEOWNERS or the manifest.`,
          rule: 'EO01',
          connection: 'CONNECTED',
          confidence: this.conf.structural(),
          evidence: [
            this.ev.reuse('lcis-governance', 'OwnershipReport.coverage', `domain '${subject}' absent from coverage`),
            this.ev.agent(at.id, `taskRef=${at.taskRef} domain=${domain ?? 'null'}`),
          ],
        });
      }
    }

    // Surface governance gaps as additional EO01 findings
    for (const gap of ownership.gaps) {
      findings.push({
        id: `EO01-gap-${idx++}`,
        category: 'ownership',
        kind: 'governance-ownership-gap',
        severity: eo01.severity,
        subject: gap.subject,
        title: `Ownership gap: ${gap.entityType} '${gap.subject}'`,
        detail: `The governance ownership report flags ${gap.entityType} '${gap.subject}' as unowned. Severity from lcis-governance: ${gap.severity}.`,
        rule: 'EO01',
        connection: 'CONNECTED',
        confidence: this.conf.structural(),
        evidence: [
          this.ev.reuse('lcis-governance', 'OwnershipReport.gaps', `${gap.entityType}:${gap.subject}`),
        ],
      });
    }

    return findings;
  }

  // ── agentHealth ────────────────────────────────────────────────────────────

  /**
   * Compute agent-area ExecutionHealth.
   * Structural signals: how many agent tasks are CONNECTED (ASSIGNED).
   * Live signals: utilization/activity — NOT_CONNECTED (count = 0 connected-live, all not-connected).
   */
  agentHealth(pkg: EngineeringPackage): ExecutionHealth {
    const total = pkg.agentPlan.tasks.length;
    // All assignments are structurally CONNECTED (ASSIGNED)
    const connectedSignals = total;
    // Utilization/live-activity adds one NOT_CONNECTED signal per agent
    const notConnectedSignals = total;

    // Score: 100 if no EO01 findings would be raised (all owned), scaled by coverage
    const ownershipFindings = this.agentOwnership(pkg);
    const unownedCount = ownershipFindings.filter((f) => f.rule === 'EO01').length;

    let score: number | null = null;
    let band: 'healthy' | 'degraded' | 'failing' | 'unknown' = 'unknown';
    if (total === 0) {
      score = 100;
      band = 'healthy';
    } else {
      score = Math.max(0, Math.round(((total - unownedCount) / total) * 100));
      band = score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'failing';
    }

    return {
      area: 'agent',
      score,
      band,
      connectedSignals,
      notConnectedSignals,
    };
  }

  // ── agentUtilization ──────────────────────────────────────────────────────

  /**
   * Returns per-agent utilization data.
   * This is entirely NOT_CONNECTED — per-agent load requires a live fleet dispatcher tracker.
   * Returns a provenance-stamped object that is honest about what is unknown.
   */
  agentUtilization(pkg: EngineeringPackage): {
    readonly connection: 'NOT_CONNECTED';
    readonly liveSource: string;
    readonly confidence: number;
    readonly liveConnected: boolean;
    readonly byAgentType: Readonly<Record<string, number>>;
    readonly utilization: null;
    readonly evidence: readonly ReturnType<ExecutionEvidenceBuilder['notConnected']>[];
  } {
    const evItems = [
      this.ev.notConnected('agent-utilization', LIVE_UTILIZATION_SOURCE),
    ];
    return {
      connection: 'NOT_CONNECTED',
      liveSource: LIVE_UTILIZATION_SOURCE,
      confidence: 0,
      liveConnected: false,
      // The structural breakdown by type is CONNECTED (from the plan)
      byAgentType: pkg.agentPlan.byAgentType,
      // Actual load/utilization per agent cannot be derived without a live tracker
      utilization: null,
      evidence: evItems,
    };
  }

  // ── agentBlocking ─────────────────────────────────────────────────────────

  /**
   * Find agent tasks whose taskRef is in pkg.graph.blocked.
   * This is CONNECTED (structural graph topology).
   */
  agentBlocking(pkg: EngineeringPackage): ExecutionFinding[] {
    const blockedSet = new Set<string>(pkg.graph.blocked);
    const eo02 = this.rules.get('EO02')!;
    const findings: ExecutionFinding[] = [];

    let idx = 0;
    for (const at of pkg.agentPlan.tasks) {
      if (blockedSet.has(at.taskRef)) {
        findings.push({
          id: `EO02-agent-${idx++}`,
          category: 'blocked',
          kind: 'agent-task-blocked',
          severity: eo02.severity,
          subject: at.id,
          title: `Agent task blocked: ${at.title}`,
          detail: `Agent task ${at.id} (taskRef: ${at.taskRef}) corresponds to an engineering task that is in the structural blocked set (unmet or cyclic dependency detected by EINS graph).`,
          rule: 'EO02',
          connection: 'CONNECTED',
          confidence: this.conf.structural(),
          evidence: [
            this.ev.agent(at.id, `taskRef=${at.taskRef} is in graph.blocked`),
            this.ev.reuse('lcis-engineering', 'EngineeringGraph.blocked', `task ${at.taskRef} blocked`),
          ],
        });
      }
    }

    return findings;
  }

  // ── agentDependencyGraph ──────────────────────────────────────────────────

  /**
   * Return the agent-task dependsOn edges as a dependency graph adjacency list.
   * CONNECTED — pure transform over the plan's static edges.
   */
  agentDependencyGraph(pkg: EngineeringPackage): {
    readonly nodes: readonly { readonly id: string; readonly agentType: string; readonly taskRef: string }[];
    readonly edges: readonly { readonly from: string; readonly to: string; readonly relation: 'depends-on' }[];
    readonly connection: 'CONNECTED';
  } {
    const nodes = pkg.agentPlan.tasks.map((at) => ({
      id: at.id,
      agentType: at.agentType,
      taskRef: at.taskRef,
    }));

    const edges = pkg.agentPlan.tasks.flatMap((at) =>
      at.dependsOn.map((dep) => ({
        from: dep,
        to: at.id,
        relation: 'depends-on' as const,
      })),
    );

    return { nodes, edges, connection: 'CONNECTED' };
  }

  // ── workDistribution ──────────────────────────────────────────────────────

  /**
   * Return byAgentType breakdown directly from the pkg.agentPlan.
   * CONNECTED — the plan already carries the structural count.
   */
  workDistribution(pkg: EngineeringPackage): {
    readonly byAgentType: Readonly<Record<string, number>>;
    readonly connection: 'CONNECTED';
    readonly totalTasks: number;
  } {
    return {
      byAgentType: pkg.agentPlan.byAgentType,
      connection: 'CONNECTED',
      totalTasks: pkg.agentPlan.tasks.length,
    };
  }

  // ── orphanAgents ──────────────────────────────────────────────────────────

  /**
   * Agent tasks with no/empty taskRef, or engineering tasks with no corresponding agent task.
   * Both are EO01 (ownership/assignment gap).
   */
  orphanAgents(pkg: EngineeringPackage): ExecutionFinding[] {
    const findings: ExecutionFinding[] = [];
    const eo01 = this.rules.get('EO01')!;
    let idx = 0;

    // 1. Agent tasks with no/empty taskRef
    for (const at of pkg.agentPlan.tasks) {
      if (!at.taskRef || at.taskRef.trim() === '') {
        findings.push({
          id: `EO01-orphan-agent-${idx++}`,
          category: 'ownership',
          kind: 'orphan-agent-no-task-ref',
          severity: eo01.severity,
          subject: at.id,
          title: `Orphan agent task: no taskRef (${at.id})`,
          detail: `Agent task ${at.id} has no taskRef — it is not backed by any engineering task. This is a planning gap.`,
          rule: 'EO01',
          connection: 'CONNECTED',
          confidence: this.conf.structural(),
          evidence: [
            this.ev.agent(at.id, 'taskRef is empty'),
          ],
        });
      }
    }

    // 2. Engineering tasks with no corresponding agent task
    const agentTaskRefs = new Set<string>(pkg.agentPlan.tasks.map((at) => at.taskRef));
    for (const engTask of pkg.tasks) {
      if (!agentTaskRefs.has(engTask.id)) {
        findings.push({
          id: `EO01-orphan-engtask-${idx++}`,
          category: 'ownership',
          kind: 'orphan-engineering-task-no-agent',
          severity: eo01.severity,
          subject: engTask.id,
          title: `Engineering task has no agent assignment: ${engTask.title}`,
          detail: `Engineering task ${engTask.id} has no agent task in the agent plan. Every engineering task must have a corresponding agent task for complete assignment coverage.`,
          rule: 'EO01',
          connection: 'CONNECTED',
          confidence: this.conf.structural(),
          evidence: [
            this.ev.task(engTask.id, 'not found in agentPlan.tasks[].taskRef'),
            this.ev.reuse('lcis-engineering', 'AgentPlan', `task ${engTask.id} has no agent`),
          ],
        });
      }
    }

    return findings;
  }

  // ── generateAgentReport ───────────────────────────────────────────────────

  /**
   * Generate the full AgentReport via execution() stamping.
   * Composes: assignments + ownership findings + blocking findings + orphan findings + health.
   */
  generateAgentReport(pkg: EngineeringPackage): AgentReport {
    const agents = this.agentAssignments(pkg);
    const ownershipFindings = this.agentOwnership(pkg);
    const blockingFindings = this.agentBlocking(pkg);
    const orphanFindings = this.orphanAgents(pkg);
    const health = this.agentHealth(pkg);

    const allFindings: ExecutionFinding[] = [
      ...ownershipFindings,
      ...blockingFindings,
      ...orphanFindings,
    ];

    const critical = allFindings.filter((f) => f.severity === 'critical').length;
    const high = allFindings.filter((f) => f.severity === 'high').length;
    const blockedCount = blockingFindings.length;

    const summary =
      agents.length === 0
        ? 'Agent plan is empty — no engineering tasks to assign (honest).'
        : [
            `${agents.length} agent task(s) ASSIGNED across ${Object.keys(pkg.agentPlan.byAgentType).length} agent type(s).`,
            blockedCount > 0 ? `${blockedCount} blocked.` : '',
            allFindings.length > 0
              ? `${allFindings.length} finding(s): ${critical} critical, ${high} high.`
              : 'No findings.',
            `Live agent activity: NOT_CONNECTED (${LIVE_AGENT_SOURCE}).`,
          ]
            .filter(Boolean)
            .join(' ');

    // Evidence: one citation per agent + reuse of governance ownership
    const reportEvidence = [
      this.ev.reuse('lcis-engineering', 'AgentPlan', `${agents.length} agent tasks composed from EngineeringPackage`),
      this.ev.reuse('lcis-governance', 'OwnershipReport', 'ownership/gaps reused — not reimplemented'),
      this.ev.notConnected('agent.status.live', LIVE_AGENT_SOURCE),
      ...agents.map((a) => this.ev.agent(a.id, `agentType=${a.agentType} ASSIGNED CONNECTED`)),
    ];

    return execution(
      {
        request: pkg.request,
        agents,
        byAgentType: pkg.agentPlan.byAgentType,
        findings: allFindings,
        health,
        summary,
      },
      {
        evidence: reportEvidence,
        now: this.now,
        liveConnected: false,
      },
    );
  }
}
