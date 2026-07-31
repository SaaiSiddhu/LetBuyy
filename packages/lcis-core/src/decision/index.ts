/**
 * Decision module public surface.
 * Import the class and types; do NOT import from deeper sub-paths.
 */
export { DecisionService } from './DecisionService';
// Canonical Decision/Evidence/Severity/RankedRisk/RankedFix/InrImpactTier are exported
// from contracts. Here we expose only the decision-specific result/readiness types.
// (The decision module uses artifact-shaped local variants internally — e.g. emoji
// severities — that intentionally differ from the canonical contract types.)
export type {
  DimensionReadiness,
  LaunchVerdict,
  PrioritizedItem,
  ScaleTiers,
  ScoringFactors,
  SystemReadiness,
} from './types';
export {
  MONEY_DOMAINS,
  fixFormulaString,
  fixScore,
  inrImpactTier,
  inrTierWeight,
  riskFormulaString,
  riskScore,
  severityWeight,
} from './scoring';
