/**
 * ExecutionOrchestrationEngine — the EAOS composition facade. Wires the lcis-core engine +
 * the seven orchestration intelligence services (execution / agent / artifact / validation /
 * status / rollout / timeline) over the EINS EngineeringPackage, and composes them into the
 * full ExecutionPackage. Pure composition — no new engine, no duplicated reasoning.
 *
 * EAOS TRACKS execution; it NEVER executes. Humans/agents execute. No fetch/spawn/exec/
 * writeFile/network/DB-write anywhere in this package. Live execution progress is honestly
 * NOT_CONNECTED until an execution-tracking source is wired.
 */
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import type { EngineeringPackage } from '@letbuyy/lcis-engineering';
import { AgentIntelligenceService } from '../agent/index';
import { ArtifactIntelligenceService } from '../artifact/index';
import { ExecutionIntelligenceService } from '../execution/index';
import { RolloutIntelligenceService } from '../rollout/index';
import { StatusIntelligenceService } from '../status/index';
import { TimelineIntelligenceService } from '../timeline/index';
import { ValidationIntelligenceService } from '../validation/index';
import {
  ExecutionEvidenceBuilder,
  buildEngineeringPackage,
  defaultNow,
  execution,
  isEngineeringPackage,
  type AgentReport,
  type ArtifactReport,
  type ExecutionFinding,
  type ExecutionHealth,
  type ExecutionPackage,
  type ExecutionReport,
  type FeatureRequest,
  type HealthBand,
  type OrchestrationArtifact,
  type RolloutReport,
  type StatusReport,
  type TimelineReport,
  type ValidationReport,
} from '../shared/index';

/** The EAOS input: a natural-language feature request (same vocabulary as EINS). */
export type OrchestrationRequest = FeatureRequest;

/** Either a fresh request (EAOS builds the EINS package) or a pre-built EngineeringPackage. */
export type OrchestrationInput = OrchestrationRequest | EngineeringPackage;

/** Composition view for the `blockers` access surface: what cannot proceed, and why. */
export interface BlockersReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly blockedTasks: readonly ExecutionFinding[];
  readonly launchBlockers: readonly string[];
  readonly reasons: readonly string[];
  readonly summary: string;
}

/** Composition view for the `health` access surface: per-area healths + merged overall. */
export interface HealthReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly areas: readonly ExecutionHealth[];
  readonly overall: ExecutionHealth;
  readonly summary: string;
}

export interface OrchestrationEngine {
  readonly core: LcisEngine;
  readonly execution: ExecutionIntelligenceService;
  readonly agent: AgentIntelligenceService;
  readonly artifact: ArtifactIntelligenceService;
  readonly validation: ValidationIntelligenceService;
  readonly status: StatusIntelligenceService;
  readonly rollout: RolloutIntelligenceService;
  readonly timeline: TimelineIntelligenceService;
  /** Resolve the input: pass-through for a pre-built package, EINS build for a request. */
  resolvePackage(input: OrchestrationInput): Promise<EngineeringPackage>;
  generateExecutionReport(input: OrchestrationInput): Promise<ExecutionReport>;
  generateAgentReport(input: OrchestrationInput): Promise<AgentReport>;
  generateArtifactReport(input: OrchestrationInput): Promise<ArtifactReport>;
  generateValidationReport(input: OrchestrationInput): Promise<ValidationReport>;
  generateStatusReport(input: OrchestrationInput): Promise<StatusReport>;
  generateRolloutReport(input: OrchestrationInput): Promise<RolloutReport>;
  generateTimelineReport(input: OrchestrationInput): Promise<TimelineReport>;
  generateFullExecutionPackage(input: OrchestrationInput): Promise<ExecutionPackage>;
  /** Composition helpers shared by the four access layers (CLI/MCP/API/PR-check). */
  generateBlockersReport(input: OrchestrationInput): Promise<BlockersReport>;
  generateHealthReport(input: OrchestrationInput): Promise<HealthReport>;
}

export interface OrchestrationEngineOptions {
  readonly core?: LcisEngine;
  readonly now?: () => string;
}

/**
 * Merge per-area healths into the 'overall' area. Score = mean of non-null area scores
 * (null when every area is null — honest unknown); signals are summed; band from score.
 */
export function mergeHealth(areas: readonly ExecutionHealth[]): ExecutionHealth {
  const scored = areas.filter((a): a is ExecutionHealth & { score: number } => a.score !== null);
  const score =
    scored.length === 0 ? null : Math.round(scored.reduce((sum, a) => sum + a.score, 0) / scored.length);
  let band: HealthBand = 'unknown';
  if (score !== null) {
    if (score >= 80) band = 'healthy';
    else if (score >= 50) band = 'degraded';
    else band = 'failing';
  }
  return {
    area: 'overall',
    score,
    band,
    connectedSignals: areas.reduce((n, a) => n + a.connectedSignals, 0),
    notConnectedSignals: areas.reduce((n, a) => n + a.notConnectedSignals, 0),
  } satisfies ExecutionHealth;
}

export class ExecutionOrchestrationEngine implements OrchestrationEngine {
  readonly core: LcisEngine;
  readonly execution: ExecutionIntelligenceService;
  readonly agent: AgentIntelligenceService;
  readonly artifact: ArtifactIntelligenceService;
  readonly validation: ValidationIntelligenceService;
  readonly status: StatusIntelligenceService;
  readonly rollout: RolloutIntelligenceService;
  readonly timeline: TimelineIntelligenceService;
  private readonly now: () => string;
  private readonly eb = new ExecutionEvidenceBuilder();

  constructor(opts: OrchestrationEngineOptions = {}) {
    this.core = opts.core ?? getEngine();
    this.now = opts.now ?? defaultNow;
    const core = this.core;
    const now = this.now;
    this.execution = new ExecutionIntelligenceService(core, now);
    this.agent = new AgentIntelligenceService(core, now);
    this.artifact = new ArtifactIntelligenceService(core, now);
    this.validation = new ValidationIntelligenceService(core, now);
    this.status = new StatusIntelligenceService(core, now);
    this.rollout = new RolloutIntelligenceService(core, now);
    this.timeline = new TimelineIntelligenceService(core, now);
  }

  resolvePackage(input: OrchestrationInput): Promise<EngineeringPackage> {
    if (isEngineeringPackage(input)) return Promise.resolve(input);
    return buildEngineeringPackage(this.core, input, this.now);
  }

  async generateExecutionReport(input: OrchestrationInput): Promise<ExecutionReport> {
    return this.execution.generateExecutionReport(await this.resolvePackage(input));
  }
  async generateAgentReport(input: OrchestrationInput): Promise<AgentReport> {
    return this.agent.generateAgentReport(await this.resolvePackage(input));
  }
  async generateArtifactReport(input: OrchestrationInput): Promise<ArtifactReport> {
    return this.artifact.generateArtifactReport(await this.resolvePackage(input));
  }
  async generateValidationReport(input: OrchestrationInput): Promise<ValidationReport> {
    return this.validation.generateValidationReport(await this.resolvePackage(input));
  }
  async generateStatusReport(input: OrchestrationInput): Promise<StatusReport> {
    return this.status.generateStatusReport(await this.resolvePackage(input));
  }
  async generateRolloutReport(input: OrchestrationInput): Promise<RolloutReport> {
    return this.rollout.generateRolloutReport(await this.resolvePackage(input));
  }
  async generateTimelineReport(input: OrchestrationInput): Promise<TimelineReport> {
    return this.timeline.generateTimelineReport(await this.resolvePackage(input));
  }

  /** What cannot proceed and why: blocked tasks (EO02) + launch blockers + status reasons. */
  async generateBlockersReport(input: OrchestrationInput): Promise<BlockersReport> {
    const pkg = await this.resolvePackage(input);
    const blockedTasks = this.execution.blockedWork(pkg);
    const launchBlockers = this.rollout.launchBlockers(pkg).map((f) => `[${f.rule ?? f.kind}] ${f.title}`);
    const reasons = this.status.blockedReasons(pkg);
    const summary =
      `Blockers for "${pkg.request.text}": ${blockedTasks.length} blocked task(s), ` +
      `${launchBlockers.length} launch blocker(s), ${reasons.length} reason(s). ` +
      `Structural only — live unblock events NOT_CONNECTED.`;
    return execution(
      { request: pkg.request, blockedTasks, launchBlockers, reasons, summary },
      {
        evidence: [
          this.eb.reuse('lcis-orchestration', 'execution.blockedWork/rollout.launchBlockers/status.blockedReasons', 'Composed blocker view — no new reasoning'),
          this.eb.notConnected('execution:live-unblock-events', 'execution-tracking store (CI / git)'),
        ],
        liveConnected: false,
        now: this.now,
      },
    );
  }

  /** Per-area healths (execution/agent/validation/rollout) + merged overall. */
  async generateHealthReport(input: OrchestrationInput): Promise<HealthReport> {
    const pkg = await this.resolvePackage(input);
    const areas = [
      this.execution.executionHealth(pkg),
      this.agent.agentHealth(pkg),
      this.validation.validatorHealth(pkg),
      this.rollout.rolloutHealth(pkg),
    ];
    const overall = mergeHealth(areas);
    const summary =
      `Execution health for "${pkg.request.text}": overall ${overall.band}` +
      `${overall.score !== null ? ` (${overall.score})` : ''} — ` +
      areas.map((a) => `${a.area} ${a.band}${a.score !== null ? ` (${a.score})` : ''}`).join(', ') +
      `. ${overall.notConnectedSignals} live signal(s) NOT_CONNECTED.`;
    return execution(
      { request: pkg.request, areas, overall, summary },
      {
        evidence: [
          this.eb.reuse('lcis-orchestration', 'executionHealth/agentHealth/validatorHealth/rolloutHealth', 'Composed health view — mergeHealth over per-area scores'),
          this.eb.notConnected('execution:live-health-signals', 'execution-tracking store (CI / git)'),
        ],
        liveConnected: false,
        now: this.now,
      },
    );
  }

  /**
   * The EAOS flagship: build the EINS package ONCE, run all seven services over it,
   * and compose the ExecutionPackage with merged overall health + provenance.
   */
  async generateFullExecutionPackage(input: OrchestrationInput): Promise<ExecutionPackage> {
    const pkg = await this.resolvePackage(input);

    const executionReport = this.execution.generateExecutionReport(pkg);
    const agentReport = this.agent.generateAgentReport(pkg);
    const artifactReport = this.artifact.generateArtifactReport(pkg);
    const validationReport = this.validation.generateValidationReport(pkg);
    const statusReport = this.status.generateStatusReport(pkg);
    const rolloutReport = this.rollout.generateRolloutReport(pkg);
    const timelineReport = this.timeline.generateTimelineReport(pkg);

    const health = mergeHealth([
      executionReport.health,
      agentReport.health,
      validationReport.health,
      rolloutReport.health,
    ]);

    const findingCount =
      executionReport.findings.length +
      agentReport.findings.length +
      artifactReport.findings.length +
      validationReport.findings.length +
      statusReport.findings.length +
      rolloutReport.findings.length;

    const summary =
      `Execution package for "${pkg.request.text}": ${pkg.tasks.length} task(s), ` +
      `${agentReport.agents.length} agent assignment(s), ${artifactReport.artifacts.length} planned artifact(s), ` +
      `${validationReport.validations.length} validation(s); ${findingCount} finding(s); ` +
      `overall health ${health.band}${health.score !== null ? ` (${health.score})` : ''}; ` +
      `launch ${rolloutReport.launchVerdict}, rollback ${rolloutReport.rollbackReadiness}. ` +
      `Live execution progress NOT_CONNECTED — EAOS tracks; humans/agents execute.`;

    const evidence = [
      this.eb.reuse(
        'lcis-engineering',
        'EngineeringPackage',
        'Single composed input — built once, consumed by all seven EAOS services',
      ),
      this.eb.reuse(
        'lcis-orchestration',
        'execution/agent/artifact/validation/status/rollout/timeline',
        'Seven pure read-only transforms composed into the ExecutionPackage',
      ),
      this.eb.notConnected('execution:live-progress', 'execution-tracking store (CI / git)'),
    ];

    return execution(
      {
        request: pkg.request,
        execution: executionReport,
        agent: agentReport,
        artifact: artifactReport,
        validation: validationReport,
        status: statusReport,
        rollout: rolloutReport,
        timeline: timelineReport,
        health,
        summary,
      },
      { evidence, liveConnected: false, now: this.now },
    );
  }
}

export function createOrchestrationEngine(opts?: OrchestrationEngineOptions): OrchestrationEngine {
  return new ExecutionOrchestrationEngine(opts);
}

let shared: OrchestrationEngine | null = null;

/** Process-wide singleton EAOS engine (reuses the lcis-core singleton + its warm graph). */
export function getOrchestrationEngine(opts?: OrchestrationEngineOptions): OrchestrationEngine {
  if (shared === null) shared = createOrchestrationEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetOrchestrationEngine(): void {
  shared = null;
}
