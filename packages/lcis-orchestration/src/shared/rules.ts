/**
 * ExecutionRuleRegistry — the declarative execution-orchestration rules EO01..EO08. The rules are
 * metadata; the services evaluate them over the EINS package + the derived execution state. No rule
 * executes anything.
 */
import type { ExecutionFinding, Severity } from './types';

export interface ExecutionRule {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: Severity;
  readonly category: ExecutionFinding['category'];
}

export const EXECUTION_RULES: readonly ExecutionRule[] = [
  { id: 'EO01', title: 'Task ownership', description: 'Every task must have a declared owner/agent type.', severity: 'high', category: 'ownership' },
  { id: 'EO02', title: 'Blocked tasks', description: 'Tasks blocked by unmet or cyclic dependencies.', severity: 'high', category: 'blocked' },
  { id: 'EO03', title: 'Failed validation', description: 'A required validation gate is failing.', severity: 'critical', category: 'validation' },
  { id: 'EO04', title: 'Missing artifacts', description: 'A planned artifact has no producing task or is absent.', severity: 'medium', category: 'artifact' },
  { id: 'EO05', title: 'Execution drift', description: 'Execution diverges from the planned engineering graph.', severity: 'medium', category: 'drift' },
  { id: 'EO06', title: 'Stale execution', description: 'Execution state is stale / not progressing (live signal).', severity: 'medium', category: 'stale' },
  { id: 'EO07', title: 'Incomplete rollout', description: 'Rollout / launch is not release-ready.', severity: 'high', category: 'rollout' },
  { id: 'EO08', title: 'Missing verification', description: 'A verification-coverage gap exists before completion.', severity: 'high', category: 'verification' },
];

export class ExecutionRuleRegistry {
  list(): readonly ExecutionRule[] {
    return EXECUTION_RULES;
  }
  get(id: string): ExecutionRule | undefined {
    return EXECUTION_RULES.find((r) => r.id === id);
  }
  byCategory(category: ExecutionFinding['category']): readonly ExecutionRule[] {
    return EXECUTION_RULES.filter((r) => r.category === category);
  }
}
