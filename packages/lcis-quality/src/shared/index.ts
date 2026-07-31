/** Shared LQAS foundation — the frozen contract + rules + envelope. */
export * from './types';
export { QUALITY_RULES, QualityRuleRegistry, type QualityRule } from './rules';
export { quality, confidenceFrom, defaultNow } from './envelope';
