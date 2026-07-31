/**
 * EisEngine — the Execution Intelligence composition facade. Wires the lcis-core engine
 * + a shared ChangeAnalyzer + the six intelligence services so a change is analysed once
 * and every plan (execution / migration / test / rollback / launch / verification) is a
 * pure function of that single analysis.
 *
 * This is NOT a new engine or capability — it is composition over lcis-core + the EIS
 * services. It plans; it never executes, mutates, migrates, or deploys.
 */
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import { ExecutionGraphService, ExecutionIntelligenceService } from './execution/index';
import { LaunchIntelligenceService, VerificationPlanner } from './launch/index';
import { MigrationIntelligenceService } from './migration/index';
import { RollbackIntelligenceService } from './rollback/index';
import { ChangeAnalyzer, defaultNow } from './shared/index';
import type {
  ChangeAnalysis,
  ChangeRequest,
  ExecutionGraph,
  ExecutionPlan,
  LaunchPlan,
  MigrationPlan,
  RollbackPlan,
  TestPlan,
  VerificationPlan,
} from './shared/index';
import { TestingIntelligenceService } from './testing/index';

/** The complete EIS answer for a change request — every plan, each self-describing with provenance. */
export interface FullPlan {
  readonly change: ChangeAnalysis;
  readonly execution: ExecutionPlan;
  readonly executionGraph: ExecutionGraph;
  readonly migration: MigrationPlan;
  readonly tests: TestPlan;
  readonly rollback: RollbackPlan;
  readonly launch: LaunchPlan;
  readonly verification: VerificationPlan;
}

export interface EisEngine {
  readonly core: LcisEngine;
  readonly analyzer: ChangeAnalyzer;
  readonly execution: ExecutionIntelligenceService;
  readonly executionGraph: ExecutionGraphService;
  readonly migration: MigrationIntelligenceService;
  readonly testing: TestingIntelligenceService;
  readonly rollback: RollbackIntelligenceService;
  readonly launch: LaunchIntelligenceService;
  readonly verification: VerificationPlanner;
  /** Resolve + analyse a change once (the backbone every plan is derived from). */
  analyze(req: ChangeRequest): ChangeAnalysis;
  /** The full plan: analyse once, then derive every downstream plan. */
  planAll(req: ChangeRequest): Promise<FullPlan>;
}

export interface EisOptions {
  /** Override the underlying lcis-core engine (e.g. test fixtures). Defaults to the singleton. */
  readonly core?: LcisEngine;
  /** Injectable clock for deterministic output. */
  readonly now?: () => string;
}

class EisEngineImpl implements EisEngine {
  readonly core: LcisEngine;
  readonly analyzer: ChangeAnalyzer;
  readonly execution: ExecutionIntelligenceService;
  readonly executionGraph: ExecutionGraphService;
  readonly migration: MigrationIntelligenceService;
  readonly testing: TestingIntelligenceService;
  readonly rollback: RollbackIntelligenceService;
  readonly launch: LaunchIntelligenceService;
  readonly verification: VerificationPlanner;

  constructor(opts: EisOptions = {}) {
    this.core = opts.core ?? getEngine();
    const now = opts.now ?? defaultNow;
    this.analyzer = new ChangeAnalyzer(this.core, now);
    this.execution = new ExecutionIntelligenceService(this.core, now);
    this.executionGraph = new ExecutionGraphService(this.core, now);
    this.migration = new MigrationIntelligenceService(this.core, now);
    this.testing = new TestingIntelligenceService(this.core, now);
    this.rollback = new RollbackIntelligenceService(this.core, now);
    this.launch = new LaunchIntelligenceService(this.core, now);
    this.verification = new VerificationPlanner(this.core, now);
  }

  analyze(req: ChangeRequest): ChangeAnalysis {
    return this.analyzer.analyze(req);
  }

  async planAll(req: ChangeRequest): Promise<FullPlan> {
    const change = this.analyzer.analyze(req); // analysed once, shared with every plan
    return {
      change,
      execution: this.execution.planImplementation(change),
      executionGraph: this.executionGraph.build(change),
      migration: this.migration.analyzeMigration(change),
      tests: this.testing.generateTestPlan(change),
      rollback: this.rollback.generateRollbackPlan(req),
      launch: await this.launch.evaluateLaunch(change),
      verification: this.verification.buildVerificationPlan(change),
    };
  }
}

export function createEisEngine(opts?: EisOptions): EisEngine {
  return new EisEngineImpl(opts);
}

let shared: EisEngine | null = null;

/** Process-wide singleton EIS engine (reuses the lcis-core singleton + its warm graph). */
export function getEisEngine(opts?: EisOptions): EisEngine {
  if (shared === null) shared = createEisEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetEisEngine(): void {
  shared = null;
}
