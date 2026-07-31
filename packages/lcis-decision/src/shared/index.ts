/** Shared LDSS foundation — the frozen contract + envelope + strategy tables. */
export * from './types';
export { decision, confidenceFrom, defaultNow, composite, AXES, AXIS_WEIGHTS } from './envelope';
export { STRATEGY_TABLE, type StrategySpec } from './strategies';
