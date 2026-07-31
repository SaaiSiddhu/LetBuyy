/**
 * @letbuyy/lcis-quality — LQAS, the Quality Analytics System (LCIS Phase 15).
 *
 * Read-only, deterministic quality intelligence composed over engineering verification, the
 * dependency twin, and change tracking: test/coverage/mutation/flaky analytics (values
 * NOT_CONNECTED until CI data is provided), documentation/API/architecture quality,
 * technical-debt hotspots (churn × complexity), maintainability, complexity, and a composite
 * quality score. Never mutates; advisory-only recommendations.
 */
export * from './shared/index';
export { TestAnalyticsService } from './test/index';
export { ComplexityService } from './complexity/index';
export { ArchitectureQualityService } from './architecture/index';
export { TechDebtService } from './techdebt/index';
export { DocApiQualityService } from './docapi/index';
export { QualityScoreService, type QualityScoreInput } from './score/index';
export {
  createQualityAnalyticsEngine,
  getQualityAnalyticsEngine,
  resetQualityAnalyticsEngine,
  type QualityAnalyticsEngine,
  type QualityAnalyticsEngineOptions,
} from './engine';
