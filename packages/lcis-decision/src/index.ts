/**
 * @letbuyy/lcis-decision — LDSS, the Decision Support System (LCIS Phase 17, the capstone).
 *
 * Read-only, deterministic decision intelligence composing ALL prior LCIS systems: for a
 * deploy/migration/rollback/scaling/business/architecture decision it generates strategy
 * alternatives, scores them on risk/cost/readiness/blast-radius tradeoff axes, resolves the
 * affected surface via the dependency twin, and recommends — with evidence, confidence,
 * alternatives, and tradeoffs. It NEVER executes, deploys, or acts; it only recommends.
 */
export * from './shared/index';
export { AlternativeService } from './alternative/index';
export { TradeoffService } from './tradeoff/index';
export { ComparisonService } from './comparison/index';
export { AffectedSurfaceService } from './affected/index';
export { DecisionGraphService } from './graph/index';
export { DecisionEngineService, CONDITIONAL_MARGIN, type RankingResult } from './decision-engine/index';
export {
  createDecisionSupportEngine,
  getDecisionSupportEngine,
  resetDecisionSupportEngine,
  type DecisionSupportEngine,
  type DecisionSupportEngineOptions,
} from './engine';
