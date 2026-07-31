/**
 * EngineeringEngine — the EINS composition facade. Wires the lcis-core engine + the reused
 * lcis-execution / lcis-governance / lcis-operations engines + the eight EINS services + the
 * engineering graph, and composes them into the unified blueprint and the full engineering
 * package. Pure composition — no new engine, no duplicated reasoning. EINS plans/analyzes;
 * it never executes, generates code, modifies files, runs migrations, or deploys.
 */
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import { createEisEngine, type EisEngine, type LaunchPlan, type RollbackPlan, type VerificationPlan } from '@letbuyy/lcis-execution';
import { createGovernanceEngine, type GovernanceEngine } from '@letbuyy/lcis-governance';
import { createOperationsEngine, type OperationsEngine } from '@letbuyy/lcis-operations';
import { AgentIntelligenceService } from './agent/index';
import { ChangeIntelligenceService } from './change/index';
import { FeatureIntelligenceService } from './feature/index';
import { EngineeringGraphService } from './graph/index';
import { LaunchIntelligenceService } from './launch/index';
import { MigrationIntelligenceService } from './migration/index';
import { RollbackIntelligenceService } from './rollback/index';
import {
  EngineeringEvidenceBuilder,
  defaultNow,
  engineering,
  type AgentPlan,
  type EngineeringBlueprint,
  type EngineeringFinding,
  type EngineeringGraph,
  type EngineeringImpact,
  type EngineeringPackage,
  type EngineeringTask,
  type FeatureRequest,
} from './shared/index';
import { TaskIntelligenceService } from './task/index';
import { VerificationIntelligenceService } from './verification/index';

export interface EngineeringEngine {
  readonly core: LcisEngine;
  readonly feature: FeatureIntelligenceService;
  readonly change: ChangeIntelligenceService;
  readonly migration: MigrationIntelligenceService;
  readonly verification: VerificationIntelligenceService;
  readonly launch: LaunchIntelligenceService;
  readonly rollback: RollbackIntelligenceService;
  readonly task: TaskIntelligenceService;
  readonly agent: AgentIntelligenceService;
  readonly graph: EngineeringGraphService;
  analyzeFeature(req: FeatureRequest): EngineeringImpact;
  generateTasks(req: FeatureRequest): EngineeringTask[];
  generateExecutionGraph(req: FeatureRequest): EngineeringGraph;
  generateAgentPlan(req: FeatureRequest): AgentPlan;
  generateVerificationPlan(req: FeatureRequest): VerificationPlan;
  generateRollbackPlan(req: FeatureRequest): RollbackPlan;
  generateLaunchPlan(req: FeatureRequest): Promise<LaunchPlan>;
  generateBlueprint(req: FeatureRequest): Promise<EngineeringBlueprint>;
  generateFullEngineeringPackage(req: FeatureRequest): Promise<EngineeringPackage>;
}

export interface EngineeringEngineOptions {
  readonly core?: LcisEngine;
  readonly now?: () => string;
}

class EngineeringEngineImpl implements EngineeringEngine {
  readonly core: LcisEngine;
  readonly feature: FeatureIntelligenceService;
  readonly change: ChangeIntelligenceService;
  readonly migration: MigrationIntelligenceService;
  readonly verification: VerificationIntelligenceService;
  readonly launch: LaunchIntelligenceService;
  readonly rollback: RollbackIntelligenceService;
  readonly task: TaskIntelligenceService;
  readonly agent: AgentIntelligenceService;
  readonly graph: EngineeringGraphService;
  private readonly eis: EisEngine;
  private readonly gov: GovernanceEngine;
  private readonly ops: OperationsEngine;
  private readonly now: () => string;
  private readonly eb = new EngineeringEvidenceBuilder();

  constructor(opts: EngineeringEngineOptions = {}) {
    this.core = opts.core ?? getEngine();
    this.now = opts.now ?? defaultNow;
    const core = this.core;
    const now = this.now;
    this.eis = createEisEngine({ core, now });
    this.gov = createGovernanceEngine({ core, now });
    this.ops = createOperationsEngine({ core, now });
    this.feature = new FeatureIntelligenceService(core, now);
    this.change = new ChangeIntelligenceService(core, now);
    this.migration = new MigrationIntelligenceService(core, now);
    this.verification = new VerificationIntelligenceService(core, now);
    this.launch = new LaunchIntelligenceService(core, now);
    this.rollback = new RollbackIntelligenceService(core, now);
    this.task = new TaskIntelligenceService(core, now);
    this.agent = new AgentIntelligenceService(core, now);
    this.graph = new EngineeringGraphService(core, now);
  }

  analyzeFeature(req: FeatureRequest): EngineeringImpact {
    return this.feature.analyzeFeature(req);
  }
  generateTasks(req: FeatureRequest): EngineeringTask[] {
    return this.task.generateTasks(req);
  }
  generateExecutionGraph(req: FeatureRequest): EngineeringGraph {
    return this.graph.build(this.task.generateTasks(req));
  }
  generateAgentPlan(req: FeatureRequest): AgentPlan {
    return this.agent.generateAgentPlan(this.task.generateTasks(req));
  }
  generateVerificationPlan(req: FeatureRequest): VerificationPlan {
    return this.verification.planVerification(req);
  }
  generateRollbackPlan(req: FeatureRequest): RollbackPlan {
    return this.rollback.planRollback(req);
  }
  generateLaunchPlan(req: FeatureRequest): Promise<LaunchPlan> {
    return this.launch.planLaunch(req);
  }

  async generateBlueprint(req: FeatureRequest): Promise<EngineeringBlueprint> {
    const impact = this.feature.analyzeFeature(req);
    const change = this.eis.analyze(req);
    const migration = this.migration.planMigration(req);
    const tests = this.verification.planTests(req);
    const verification = this.verification.planVerification(req);
    const rollback = this.rollback.planRollback(req);
    const launch = await this.launch.planLaunch(req);
    const executionGraph = this.eis.execution.generateExecutionGraph(req);
    const ownership = this.gov.ownership.generateOwnershipReport();
    const compliance = this.gov.compliance.generateComplianceReport();
    const security = this.gov.security.generateSecurityDriftReport();
    const readiness = await this.gov.readiness.generateReadinessReport();
    const operations = this.ops.operationsReport();
    const gates: EngineeringFinding[] = [
      ...this.change.analyzeChange(req),
      ...this.migration.migrationGates(req),
      ...this.verification.coverageGaps(req),
      ...this.rollback.rollbackBlockers(req),
      ...(await this.launch.launchBlockers(req)),
    ];
    const evidence = [
      this.eb.reuse('lcis-execution', 'eis.analyze', 'change surface'),
      this.eb.reuse('lcis-governance', 'gov.{ownership,compliance,security,readiness}', 'engineering gates'),
      this.eb.reuse('lcis-operations', 'ops.operationsReport', 'operational impact'),
    ];
    return engineering(
      {
        request: req,
        impact,
        change,
        migration,
        tests,
        verification,
        rollback,
        launch,
        executionGraph,
        ownership,
        compliance,
        security,
        readiness,
        operations,
        gates,
        summary:
          `Blueprint for "${req.text}": ${impact.domains.length} domain(s), ${impact.tables.length} table(s), ` +
          `${gates.length} gate(s)/blocker(s); complexity ${impact.complexity.band}, risk ${impact.risk.level}; ` +
          `launch ${launch.decision.decision}.`,
      },
      { evidence, now: this.now },
    );
  }

  async generateFullEngineeringPackage(req: FeatureRequest): Promise<EngineeringPackage> {
    const blueprint = await this.generateBlueprint(req);
    const tasks = this.task.generateTasks(req);
    const agentPlan = this.agent.generateAgentPlan(tasks);
    const graph = this.graph.build(tasks);

    const blockerFindings = blueprint.gates.filter((g) => g.category === 'blocker');
    const criticalGates = blueprint.gates.filter(
      (g) => g.severity === 'critical' && (g.category === 'blocker' || g.category === 'gate'),
    );
    const launchVerdict = blueprint.launch.decision.decision;
    const verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO' =
      launchVerdict === 'NO_GO' || criticalGates.length > 0
        ? 'NO_GO'
        : launchVerdict === 'CONDITIONAL_GO' || blueprint.gates.some((g) => g.severity === 'high')
          ? 'CONDITIONAL_GO'
          : 'GO';
    const blockers = [
      ...new Set([
        ...blockerFindings.map((g) => `[${g.rule ?? g.kind}] ${g.title}`),
        ...(launchVerdict === 'NO_GO' ? ['launch decision: NO_GO'] : []),
      ]),
    ];

    return engineering(
      {
        request: req,
        blueprint,
        tasks,
        agentPlan,
        graph,
        decision: { verdict, blockers },
        summary:
          `Engineering package for "${req.text}": ${tasks.length} task(s) across ${graph.milestones.length} milestone(s), ` +
          `${agentPlan.tasks.length} agent task(s); decision ${verdict}` +
          (blockers.length > 0 ? ` (${blockers.length} blocker(s))` : '') + '.',
      },
      { evidence: blueprint.evidence.slice(0, 3), now: this.now },
    );
  }
}

export function createEngineeringEngine(opts?: EngineeringEngineOptions): EngineeringEngine {
  return new EngineeringEngineImpl(opts);
}

let shared: EngineeringEngine | null = null;

/** Process-wide singleton EINS engine (reuses the lcis-core singleton + its warm graph). */
export function getEngineeringEngine(opts?: EngineeringEngineOptions): EngineeringEngine {
  if (shared === null) shared = createEngineeringEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetEngineeringEngine(): void {
  shared = null;
}
