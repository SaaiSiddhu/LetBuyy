/**
 * @letbuyy/lcis-operations — LCOS, the LetBuyy Central Operations System.
 *
 * The read-only real-time operational intelligence layer answering "what is happening right now?"
 * across runtime, commerce, merchant, customer, deployment, incident, security, and forecast —
 * by observing/analyzing/correlating/explaining/reporting. It composes lcis-core/live/execution/
 * governance (no duplication) and NEVER deploys, executes, mutates, writes, fixes, or remediates.
 * Every live value is honestly NOT_CONNECTED + its exact source until adapters are credentialed.
 */
export * from './shared/index';
export { RuntimeOperationsService } from './runtime/index';
export { CommerceOperationsService } from './commerce/index';
export { MerchantOperationsService } from './merchant/index';
export { CustomerOperationsService } from './customer/index';
export { DeploymentOperationsService } from './deployment/index';
export { IncidentOperationsService } from './incident/index';
export { SecurityOperationsService } from './security/index';
export { ForecastOperationsService } from './forecast/index';
export { movingAverage, linearTrend, confidenceInterval } from './forecast/index';
export {
  type OperationsEngine,
  type OperationsEngineOptions,
  createOperationsEngine,
  getOperationsEngine,
  resetOperationsEngine,
} from './engine';
