/** Shared LRAS foundation — the frozen contract + taxonomy + rules + envelope. */
export * from './types';
export { SYMPTOM_TAXONOMY, type TaxonomyEntry } from './taxonomy';
export { ROOT_CAUSE_RULES, RootCauseRuleRegistry, type RootCauseRule } from './rules';
export { rootcause, confidenceFrom, defaultNow } from './envelope';
