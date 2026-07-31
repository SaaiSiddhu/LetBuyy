/**
 * @letbuyy/lcis-performance — LPAS, the Performance Analytics System (LCIS Phase 13).
 *
 * Read-only performance intelligence: a metric catalog bound to exact live sources (values
 * honestly NOT_CONNECTED until real series are provided), pure statistics, structural
 * latency models, forecasts delegated to lcis-operations, and ADVISORY-ONLY
 * recommendations. Never mutates infrastructure; never fabricates a measurement.
 */
export * from './shared/index';
export { StatisticsService } from './statistics/index';
export { MetricCatalogService } from './catalog/index';
export { LatencyModelService } from './latency/index';
export { CapacityService } from './capacity/index';
export { CostService } from './cost/index';
export { RecommendationService } from './recommend/index';
export {
  createPerformanceEngine,
  getPerformanceEngine,
  resetPerformanceEngine,
  type PerformanceEngine,
  type PerformanceEngineOptions,
  type SeriesInput,
} from './engine';
