/**
 * ExecutionIntelligenceService — EAOS Phase 8.
 *
 * A pure, synchronous, READ-ONLY transform over an EngineeringPackage that derives execution
 * state, findings, health, and progress — all without executing, deploying, or mutating anything.
 *
 * CONNECTED: status derived from pkg.graph.parallelizable / pkg.graph.blocked (structural DAG).
 * NOT_CONNECTED: live run-state (RUNNING/COMPLETED/FAILED), completion %, ETA, real artifact
 *   presence — none of these have a live source wired; they are surfaced with
 *   connection:'NOT_CONNECTED' + a named liveSource, and confidence 0.
 *
 * NO fetch/spawn/exec/eval/writeFile/network/DB-write — pure deterministic transform.
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
  type ExecutionReport,
  type ExecutionGraph,
  type ExecutionNode,
  type ExecutionFinding,
  type ProgressMetric,
  type ExecutionHealth,
  type ExecutionEdge,
  type HealthBand,
} from '../shared/index';

/** The live source that would provide per-task run-state (CI/execution-tracking store / git). */
const LIVE_RUN_SOURCE = 'execution-tracking store (CI / git)';

export class ExecutionIntelligenceService {
  private readonly eb = new ExecutionEvidenceBuilder();
  private readonly cc = new ExecutionConfidenceCalculator();
  private readonly ss = new ExecutionSeverityScorer();
  private readonly rr = new ExecutionRuleRegistry();

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Map pkg.graph.nodes → ExecutionNode[] overlaying derived structural status.
   * CONNECTED: READY / BLOCKED / PLANNED — from the DAG.
   * live run-state is NOT_CONNECTED → liveSource names the would-be source.
   */
  buildExecutionGraph(pkg: EngineeringPackage): ExecutionGraph {
    const parallelSet = new Set(pkg.graph.parallelizable);
    const blockedSet = new Set(pkg.graph.blocked);

    const taskMap = new Map(pkg.tasks.map((t) => [t.id, t]));

    const nodes: ExecutionNode[] = pkg.graph.nodes.map((node) => {
      const task = taskMap.get(node.id);
      const derivedStatus = blockedSet.has(node.id)
        ? ('BLOCKED' as const)
        : parallelSet.has(node.id)
          ? ('READY' as const)
          : ('PLANNED' as const);

      return {
        id: node.id,
        title: node.title,
        layer: node.layer,
        domain: task?.domain ?? null,
        dependsOn: task?.dependsOn ?? [],
        depth: node.depth,
        onCriticalPath: node.onCriticalPath,
        agentType: task?.agentType ?? 'backend',
        gate: task?.gate ?? 'unknown-gate',
        status: derivedStatus,
        connection: 'CONNECTED',
        liveSource: LIVE_RUN_SOURCE,
      } satisfies ExecutionNode;
    });

    const edges: ExecutionEdge[] = pkg.graph.edges.map((e) => ({
      from: e.from,
      to: e.to,
      relation: 'depends-on',
    }));

    const reuseEv = this.eb.reuse(
      'lcis-engineering',
      'EngineeringGraphService',
      'DAG topology, critical path, parallelizable, blocked sets — reused verbatim',
    );
    const taskEv = this.eb.reuse(
      'lcis-engineering',
      'EngineeringPackage.tasks',
      `${pkg.tasks.length} tasks mapped to ExecutionNodes with derived status`,
    );

    const nodeCount = nodes.length;
    const readyCount = nodes.filter((n) => n.status === 'READY').length;
    const blockedCount = nodes.filter((n) => n.status === 'BLOCKED').length;

    return execution(
      {
        nodes,
        edges,
        implementationOrder: pkg.graph.implementationOrder,
        criticalPath: pkg.graph.criticalPath,
        parallelizable: pkg.graph.parallelizable,
        blocked: pkg.graph.blocked,
        summary: `Execution graph: ${nodeCount} tasks — ${readyCount} READY, ${blockedCount} BLOCKED; live run-state NOT_CONNECTED (source: ${LIVE_RUN_SOURCE}).`,
      },
      {
        evidence: [reuseEv, taskEv],
        liveConnected: false,
        now: this.now,
      },
    );
  }

  /**
   * Current structural state: CONNECTED counts (planned / ready / blocked) plus an honest note
   * that live run-state (RUNNING / COMPLETED / FAILED) is NOT_CONNECTED.
   */
  currentExecutionState(pkg: EngineeringPackage): {
    planned: number;
    ready: number;
    blocked: number;
    connection: 'CONNECTED';
    liveRunStateNote: string;
    liveSource: string;
  } {
    const parallelSet = new Set(pkg.graph.parallelizable);
    const blockedSet = new Set(pkg.graph.blocked);

    let ready = 0;
    let blocked = 0;
    for (const node of pkg.graph.nodes) {
      if (blockedSet.has(node.id)) blocked++;
      else if (parallelSet.has(node.id)) ready++;
    }
    const total = pkg.graph.nodes.length;
    const planned = total - ready - blocked;

    return {
      planned,
      ready,
      blocked,
      connection: 'CONNECTED',
      liveRunStateNote:
        'Live run-state (RUNNING / COMPLETED / FAILED) is NOT_CONNECTED — no execution-tracking store wired.',
      liveSource: LIVE_RUN_SOURCE,
    };
  }

  /**
   * EO02 finding for each blocked task in pkg.graph.blocked.
   * Connection CONNECTED (structural DAG finding).
   */
  blockedWork(pkg: EngineeringPackage): ExecutionFinding[] {
    const rule = this.rr.get('EO02')!;
    return pkg.graph.blocked.map((id, i) => {
      const task = pkg.tasks.find((t) => t.id === id);
      const ev = this.eb.task(id, `Task ${id} is in EngineeringGraph.blocked — dep outside batch or cycle`);
      return {
        id: `EO02-${i + 1}`,
        category: rule.category,
        kind: rule.title,
        severity: this.ss.forFinding({ blocked: true }),
        subject: id,
        title: `Blocked task: ${task?.title ?? id}`,
        detail: `Task "${task?.title ?? id}" (${id}) is blocked — one or more dependencies are outside the task set or form a cycle. Layer: ${task?.layer ?? 'unknown'}. Gate: ${task?.gate ?? 'unknown'}.`,
        rule: rule.id,
        connection: 'CONNECTED',
        confidence: this.cc.forConnection('CONNECTED', [ev]),
        evidence: [ev],
      } satisfies ExecutionFinding;
    });
  }

  /**
   * The critical path task ids (CONNECTED — from pkg.graph.criticalPath).
   */
  criticalPath(pkg: EngineeringPackage): string[] {
    return [...pkg.graph.criticalPath];
  }

  /**
   * Ids of tasks that can be executed in parallel (CONNECTED — depth === 0).
   */
  parallelizableWork(pkg: EngineeringPackage): string[] {
    return [...pkg.graph.parallelizable];
  }

  /**
   * Completion percentage. planned = tasks.length (CONNECTED).
   * completed = null (NOT_CONNECTED — no live tracker).
   */
  completionPercentage(pkg: EngineeringPackage): ProgressMetric {
    const nc = this.eb.notConnected(
      'task:completed-count',
      LIVE_RUN_SOURCE,
    );
    return {
      label: 'Task completion',
      planned: pkg.tasks.length,
      completed: null,
      connection: 'NOT_CONNECTED',
      liveSource: LIVE_RUN_SOURCE,
    } satisfies ProgressMetric;
  }

  /**
   * Honest: all planned tasks are remaining since completion is NOT_CONNECTED.
   * Returns them as ExecutionNodes with structurally-derived status.
   */
  remainingWork(pkg: EngineeringPackage): ExecutionNode[] {
    const graph = this.buildExecutionGraph(pkg);
    return [...graph.nodes];
  }

  /**
   * ExecutionHealth computed from blocked count and structural findings.
   * Score is computed over CONNECTED signals only; not-connected signals are counted honestly.
   */
  executionHealth(pkg: EngineeringPackage): ExecutionHealth {
    const totalTasks = pkg.graph.nodes.length;
    const blockedCount = pkg.graph.blocked.length;
    const readyCount = pkg.graph.parallelizable.length;

    const connectedSignals = 3;
    const notConnectedSignals = 3;

    let score: number | null = null;
    let band: HealthBand = 'unknown';

    if (totalTasks > 0) {
      const blockedFraction = blockedCount / totalTasks;
      const rawScore = Math.round((1 - blockedFraction) * 100);
      score = Math.max(0, Math.min(100, rawScore));
      if (score >= 80) band = 'healthy';
      else if (score >= 50) band = 'degraded';
      else band = 'failing';
    }

    return {
      area: 'execution',
      score,
      band,
      connectedSignals,
      notConnectedSignals,
    } satisfies ExecutionHealth;
  }

  /**
   * Compose a full ExecutionReport via execution() — carries graph, findings, health,
   * completion, and provenance. liveConnected = false (always).
   */
  generateExecutionReport(pkg: EngineeringPackage): ExecutionReport {
    const graph = this.buildExecutionGraph(pkg);
    const findings = this.blockedWork(pkg);
    const health = this.executionHealth(pkg);
    const completion = this.completionPercentage(pkg);

    const state = this.currentExecutionState(pkg);

    const reuseEv = this.eb.reuse(
      'lcis-engineering',
      'EngineeringPackage',
      'Primary input: EINS package consumed verbatim — EAOS derives execution state, never rebuilds it',
    );
    const graphEv = this.eb.reuse(
      'lcis-engineering',
      'EngineeringGraphService',
      'Graph topology, critical path, parallelizable/blocked sets',
    );
    const ncEv = this.eb.notConnected('execution:live-run-state', LIVE_RUN_SOURCE);

    const blockedCount = pkg.graph.blocked.length;
    const criticalCount = pkg.graph.criticalPath.length;

    const summary = [
      `Feature: "${pkg.request.text}".`,
      `${pkg.tasks.length} tasks total.`,
      `Structural: ${state.ready} READY, ${state.blocked} BLOCKED, ${state.planned} PLANNED.`,
      `Critical path: ${criticalCount} task(s).`,
      blockedCount > 0
        ? `${blockedCount} blocked task(s) require dependency resolution before they can start.`
        : 'No structurally blocked tasks.',
      `Decision: ${pkg.decision.verdict}.`,
      `Live run-state (RUNNING/COMPLETED/FAILED) NOT_CONNECTED — source: ${LIVE_RUN_SOURCE}.`,
    ].join(' ');

    return execution(
      {
        request: pkg.request,
        graph,
        findings,
        health,
        completion,
        summary,
      },
      {
        evidence: [reuseEv, graphEv, ncEv],
        liveConnected: false,
        now: this.now,
      },
    );
  }
}
