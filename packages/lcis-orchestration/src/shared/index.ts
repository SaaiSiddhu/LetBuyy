/** Shared EAOS foundation — the frozen contract + the read-only catalog reader + builders. */
export * from './types';
export { OrchestrationArtifactStore } from './artifact-store';
export { ExecutionRuleRegistry, EXECUTION_RULES, type ExecutionRule } from './rules';
export { ExecutionEvidenceBuilder } from './evidence';
export { ExecutionConfidenceCalculator } from './confidence';
export { ExecutionSeverityScorer } from './severity';
export { execution, envelope, defaultNow } from './envelope';
export { buildEngineeringPackage, isEngineeringPackage } from './package';
