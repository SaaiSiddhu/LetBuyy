/**
 * TimelineIntelligenceService — EAOS Phase 8.
 *
 * A pure, synchronous, READ-ONLY transform over an EngineeringPackage that produces timeline
 * intelligence: milestone mapping, critical moments, planned state-transition model, and a full
 * TimelineReport.
 *
 * CONNECTED: milestone structure, task membership, critical-path intersection, PLANNED→READY/BLOCKED
 *   derivation — all come from pkg.graph (structural DAG from EngineeringGraphService).
 * NOT_CONNECTED: actual durations, real start/end timestamps, historical execution, live transitions
 *   (RUNNING→COMPLETED) — none has a live source wired; each is surfaced with
 *   connection:'NOT_CONNECTED' + liveSource naming the would-be source, never fabricated.
 *
 * The `now` parameter is the ONLY permitted clock source — used exclusively for the envelope
 * timestamp. No runtime clock reads inside this file.
 *
 * NO fetch/spawn/exec/eval/file-write/network/DB-write — pure deterministic sync transform.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';
import type { EngineeringPackage } from '@letbuyy/lcis-engineering';
import {
  ExecutionEvidenceBuilder,
  ExecutionConfidenceCalculator,
  execution,
  defaultNow,
  type TimelineMilestone,
  type TimelineReport,
  type ExecutionStatus,
} from '../shared/index';

/** The live source that would supply historical execution data. */
const EXEC_HISTORY_SOURCE = 'execution-history store (task_runs table / CI timeline)';

/** The planned state-transition model — one entry per edge in the state machine. */
interface PlannedStateTransition {
  readonly from: ExecutionStatus;
  readonly to: ExecutionStatus;
  /** Human note about derivability for this edge. */
  readonly note: string;
  /** CONNECTED = structurally derivable from the DAG; NOT_CONNECTED = needs live source. */
  readonly connection: 'CONNECTED' | 'NOT_CONNECTED';
  /** The would-be live source when NOT_CONNECTED. */
  readonly liveSource: string | null;
}

export class TimelineIntelligenceService {
  private readonly eb = new ExecutionEvidenceBuilder();
  private readonly cc = new ExecutionConfidenceCalculator();

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Map pkg.graph.milestones → TimelineMilestone[].
   *
   * The milestone STRUCTURE (id, title, tasks[], gate) is CONNECTED — directly from the
   * MILESTONE_DEFS constant in EngineeringGraphService.
   * Actual start/end timestamps and duration are NOT_CONNECTED (no execution-history store).
   */
  executionTimeline(pkg: EngineeringPackage): TimelineMilestone[] {
    return this._mapMilestones(pkg);
  }

  /**
   * Alias of executionTimeline — milestones as the canonical structural timeline unit.
   */
  milestones(pkg: EngineeringPackage): TimelineMilestone[] {
    return this._mapMilestones(pkg);
  }

  /**
   * Milestones that contain at least one task on the critical path (CONNECTED).
   *
   * A milestone is a "critical moment" when any of its tasks appears in pkg.graph.criticalPath.
   * Both the critical path and milestone membership are structurally derived.
   */
  criticalMoments(pkg: EngineeringPackage): TimelineMilestone[] {
    const criticalSet = new Set(pkg.graph.criticalPath);
    return this._mapMilestones(pkg).filter((m) =>
      m.tasks.some((tid) => criticalSet.has(tid)),
    );
  }

  /**
   * The PLANNED state-transition model per the EAOS state machine.
   *
   * Each entry describes one edge. PLANNED→READY and PLANNED→BLOCKED are CONNECTED
   * (derivable from EngineeringGraph.parallelizable / .blocked). All edges involving
   * RUNNING, COMPLETED, FAILED, etc. are NOT_CONNECTED (require live execution source).
   *
   * Returns the full planned model with per-edge connection flags — never fabricates a
   * live transition or timestamp.
   */
  stateTransitions(pkg: EngineeringPackage): PlannedStateTransition[] {
    // Counts for informative notes (CONNECTED)
    const readyCount = pkg.graph.parallelizable.length;
    const blockedCount = pkg.graph.blocked.length;
    const totalCount = pkg.tasks.length;

    return [
      {
        from: 'PLANNED',
        to: 'READY',
        note: `${readyCount} of ${totalCount} tasks promote to READY (not in graph.blocked, appear in implementationOrder). CONNECTED — derivable from EngineeringGraph.parallelizable.`,
        connection: 'CONNECTED',
        liveSource: null,
      },
      {
        from: 'PLANNED',
        to: 'BLOCKED',
        note: `${blockedCount} of ${totalCount} tasks are BLOCKED (dep outside task set or cycle). CONNECTED — derivable from EngineeringGraph.blocked.`,
        connection: 'CONNECTED',
        liveSource: null,
      },
      {
        from: 'READY',
        to: 'RUNNING',
        note: 'RUNNING transition requires a live execution signal (agent/CI start event). NOT_CONNECTED — no execution-tracking store wired.',
        connection: 'NOT_CONNECTED',
        liveSource: EXEC_HISTORY_SOURCE,
      },
      {
        from: 'RUNNING',
        to: 'REVIEW',
        note: 'REVIEW transition requires a PR/review-system event. NOT_CONNECTED — no review-event stream wired.',
        connection: 'NOT_CONNECTED',
        liveSource: EXEC_HISTORY_SOURCE,
      },
      {
        from: 'RUNNING',
        to: 'COMPLETED',
        note: 'COMPLETED transition requires git/artifact presence or CI completion event. NOT_CONNECTED — no execution-history store wired.',
        connection: 'NOT_CONNECTED',
        liveSource: EXEC_HISTORY_SOURCE,
      },
      {
        from: 'RUNNING',
        to: 'FAILED',
        note: 'FAILED transition requires a CI/execution failure event. NOT_CONNECTED — no execution-tracking store wired.',
        connection: 'NOT_CONNECTED',
        liveSource: EXEC_HISTORY_SOURCE,
      },
      {
        from: 'REVIEW',
        to: 'VERIFIED',
        note: 'VERIFIED_LIVE transition requires CI gate result. NOT_CONNECTED. Note: VERIFIED_STRUCTURAL is CONNECTED for static governance gates (lcis-governance ComplianceReport) — but this edge reflects the live CI path.',
        connection: 'NOT_CONNECTED',
        liveSource: EXEC_HISTORY_SOURCE,
      },
      {
        from: 'VERIFIED',
        to: 'COMPLETED',
        note: 'COMPLETED after verification requires merge/CI acceptance event. NOT_CONNECTED — no execution-history store wired.',
        connection: 'NOT_CONNECTED',
        liveSource: EXEC_HISTORY_SOURCE,
      },
      {
        from: 'RUNNING',
        to: 'WAITING',
        note: 'WAITING transition requires a live agent/CI poll signal. NOT_CONNECTED — no execution-tracking store wired.',
        connection: 'NOT_CONNECTED',
        liveSource: EXEC_HISTORY_SOURCE,
      },
      {
        from: 'WAITING',
        to: 'RUNNING',
        note: 'Resume from WAITING requires a live dependency-resolved signal. NOT_CONNECTED — no execution-tracking store wired.',
        connection: 'NOT_CONNECTED',
        liveSource: EXEC_HISTORY_SOURCE,
      },
    ];
  }

  /**
   * Duration analysis.
   *
   * No execution-history store exists; all durations are NOT_CONNECTED.
   * Returns honest metadata: task count (CONNECTED), duration values null (NOT_CONNECTED).
   */
  durationAnalysis(pkg: EngineeringPackage): {
    totalTasks: number;
    totalDuration: null;
    averageDurationPerTask: null;
    criticalPathDuration: null;
    connection: 'NOT_CONNECTED';
    liveSource: string;
    note: string;
  } {
    return {
      totalTasks: pkg.tasks.length,
      totalDuration: null,
      averageDurationPerTask: null,
      criticalPathDuration: null,
      connection: 'NOT_CONNECTED',
      liveSource: EXEC_HISTORY_SOURCE,
      note: 'Duration analysis requires historical execution data. No execution-history store is wired. Would-be source: ' + EXEC_HISTORY_SOURCE,
    };
  }

  /**
   * Historical view of past executions.
   *
   * No execution-history store exists; always NOT_CONNECTED.
   */
  historicalView(pkg: EngineeringPackage): {
    taskCount: number;
    previousRuns: null;
    velocityData: null;
    connection: 'NOT_CONNECTED';
    liveSource: string;
    note: string;
  } {
    return {
      taskCount: pkg.tasks.length,
      previousRuns: null,
      velocityData: null,
      connection: 'NOT_CONNECTED',
      liveSource: EXEC_HISTORY_SOURCE,
      note: 'Historical execution view requires an execution-history store (e.g. task_runs Postgres table or CI run history). No such store is wired. Would-be source: ' + EXEC_HISTORY_SOURCE,
    };
  }

  /**
   * Generate a full TimelineReport via execution().
   *
   * Contains: milestones (CONNECTED structure), criticalPath (CONNECTED), stateTransitions
   * (per-edge connection flags), and honest NOT_CONNECTED notes for all live fields.
   */
  generateTimelineReport(pkg: EngineeringPackage): TimelineReport {
    const milestones = this._mapMilestones(pkg);
    const transitions = this.stateTransitions(pkg);

    const reuseEv = this.eb.reuse(
      'lcis-engineering',
      'EngineeringGraphService',
      'Milestone structure (M1–M6), criticalPath, and task membership — reused verbatim from EngineeringGraph',
    );
    const pkgEv = this.eb.reuse(
      'lcis-engineering',
      'EngineeringPackage.graph.milestones',
      `${milestones.length} milestone(s) mapped; ${pkg.graph.criticalPath.length} critical-path task(s) identified`,
    );
    const ncEv = this.eb.notConnected(
      'timeline:actual-durations',
      EXEC_HISTORY_SOURCE,
    );

    const criticalMomentCount = this.criticalMoments(pkg).length;
    const connectedTransitions = transitions.filter((t) => t.connection === 'CONNECTED').length;
    const notConnectedTransitions = transitions.length - connectedTransitions;

    const summary = [
      `Feature: "${pkg.request.text}".`,
      `Timeline: ${milestones.length} milestone(s), ${criticalMomentCount} on the critical path.`,
      `State machine: ${connectedTransitions} CONNECTED transition(s) (PLANNED→READY/BLOCKED), ${notConnectedTransitions} NOT_CONNECTED (require live execution source).`,
      `Actual durations, timestamps, and historical execution are NOT_CONNECTED — source: ${EXEC_HISTORY_SOURCE}.`,
    ].join(' ');

    // stateTransitions in the TimelineReport type uses the simpler shape {from, to, note}
    const reportTransitions = transitions.map((t) => ({
      from: t.from,
      to: t.to,
      note: `[${t.connection}] ${t.note}`,
    }));

    return execution(
      {
        request: pkg.request,
        milestones,
        criticalPath: [...pkg.graph.criticalPath],
        stateTransitions: reportTransitions,
        summary,
      },
      {
        evidence: [reuseEv, pkgEv, ncEv],
        liveConnected: false,
        now: this.now,
      },
    );
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Map every EngineeringMilestone → TimelineMilestone with honest NOT_CONNECTED for live fields. */
  private _mapMilestones(pkg: EngineeringPackage): TimelineMilestone[] {
    return pkg.graph.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      tasks: [...m.tasks],
      gate: m.gate,
      // Structure is CONNECTED; actual timestamps/duration are NOT_CONNECTED
      connection: 'NOT_CONNECTED' as const,
      liveSource: EXEC_HISTORY_SOURCE,
    } satisfies TimelineMilestone));
  }
}
