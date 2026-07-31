/** Shared LBIS foundation — the frozen contract + rules + envelope. */
export * from './types';
export { BUSINESS_RULES, BusinessRuleRegistry, type BusinessRule } from './rules';
export { business, confidenceFrom, defaultNow } from './envelope';
