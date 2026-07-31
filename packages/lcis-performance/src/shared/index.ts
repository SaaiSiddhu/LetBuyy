/** Shared LPAS foundation — the frozen contract + rules + envelope. */
export * from './types';
export { PERFORMANCE_RULES, PerformanceRuleRegistry, type PerformanceRule } from './rules';
export { performance, confidenceFrom, defaultNow } from './envelope';
