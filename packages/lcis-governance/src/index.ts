/**
 * @letbuyy/lcis-governance — the Governance & Drift Intelligence System (GDIS).
 *
 * The read-only constitutional layer over @letbuyy/lcis-core + @letbuyy/lcis-execution:
 * architecture / security / ownership / test / governance / operational / compliance DRIFT
 * detection, compliance (R001-R008), ownership coverage, security drift, and readiness.
 * LCIS observes, analyzes, verifies, plans, enforces — it NEVER executes, mutates, or deploys.
 */
export * from './shared/index';
export { DriftDetectionService } from './drift/index';
export { ComplianceService } from './compliance/index';
export { OwnershipService } from './ownership/index';
export { SecurityDriftService } from './security/index';
export { ReadinessService } from './readiness/index';
export {
  type GovernanceEngine,
  type GovernanceEngineOptions,
  createGovernanceEngine,
  getGovernanceEngine,
  resetGovernanceEngine,
} from './engine';
