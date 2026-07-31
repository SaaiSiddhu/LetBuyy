/** Shared EIS foundation — the frozen contract + the deterministic change-analysis backbone. */
export * from './types';
export { plan, planConfidence, defaultNow } from './envelope';
export { assessComplexity, assessRisk } from './scoring';
export { SeedResolver, tokenizeRequest } from './seed-resolver';
export { ChangeAnalyzer, toAnalysis } from './change-analysis';
