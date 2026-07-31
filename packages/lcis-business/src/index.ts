/**
 * @letbuyy/lcis-business — LBIS, the Business Intelligence System (LCIS Phase 16).
 *
 * Read-only, deterministic business intelligence composed over the operations
 * merchant/commerce/customer/forecast services, the dependency twin, and the money adapters.
 * NEVER fabricates a business number — every magnitude stays NOT_CONNECTED with its exact
 * source until a data source is wired. Advisory-only; never mutates.
 */
export * from './shared/index';
export { MerchantIntelService } from './merchant/index';
export { RevenueOrderService } from './revenue/index';
export { CustomerRetentionService } from './customer/index';
export { GrowthMarketingService } from './growth/index';
export { FinanceForecastService } from './finance/index';
export { ExecutiveHealthService, type ExecutiveKpiInput } from './executive/index';
export {
  createBusinessIntelligenceEngine,
  getBusinessIntelligenceEngine,
  resetBusinessIntelligenceEngine,
  type BusinessIntelligenceEngine,
  type BusinessIntelligenceEngineOptions,
} from './engine';
