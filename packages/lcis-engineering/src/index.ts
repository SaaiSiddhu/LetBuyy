/**
 * @letbuyy/lcis-engineering — EINS, the Engineering Intelligence System.
 *
 * The read-only, deterministic synthesis layer that answers "what exactly must be changed to
 * safely implement a feature?" by COMPOSING lcis-core/live/execution/governance/operations
 * (no duplication, no new engine) and adding net-new engineering tasks + an agent task graph +
 * the unified blueprint. EINS plans/analyzes/verifies/recommends — it never executes, generates
 * code, modifies files, runs migrations, or deploys.
 */
export * from './shared/index';
export { FeatureIntelligenceService } from './feature/index';
export { ChangeIntelligenceService } from './change/index';
export { MigrationIntelligenceService } from './migration/index';
export { VerificationIntelligenceService } from './verification/index';
export { LaunchIntelligenceService } from './launch/index';
export { RollbackIntelligenceService } from './rollback/index';
export { TaskIntelligenceService } from './task/index';
export { AgentIntelligenceService } from './agent/index';
export { EngineeringGraphService } from './graph/index';
export {
  type EngineeringEngine,
  type EngineeringEngineOptions,
  createEngineeringEngine,
  getEngineeringEngine,
  resetEngineeringEngine,
} from './engine';
