/** Shared GDIS foundation — the frozen contract + the read-only governance artifact reader + builders. */
export * from './types';
export * from './artifact-store';
export { RULES, GovernanceRuleRegistry } from './rules';
export { FindingBuilder, type FindingInput } from './finding';
export { SeverityScorer } from './severity';
export { GovernanceEvidenceBuilder } from './evidence';
export { ConfidenceCalculator } from './confidence';
export { governance, defaultNow } from './envelope';
