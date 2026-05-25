import { replayPayloadChecksum } from './event-envelope-runtime';

export type RecoveryPressureKind = 'replay' | 'compensation' | 'queue-rebuild' | 'orchestration' | 'projection-rebuild';

export interface RecoveryPressureSignal {
  kind: RecoveryPressureKind;
  backlog: number;
  errorRate: number;
  priority: number;
}

export interface AdaptiveRecoveryBudget {
  kind: RecoveryPressureKind;
  allocatedTokens: number;
  maxTokens: number;
  refillPerMinute: number;
  scheduleChecksum: string;
}

export function allocateAdaptiveRecoveryBudgets(input: {
  totalTokens: number;
  signals: RecoveryPressureSignal[];
}): AdaptiveRecoveryBudget[] {
  if (input.totalTokens < 1) {
    throw new Error('throttling nondeterministic: total tokens must be positive');
  }
  const ordered = [...input.signals].sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority;
    return left.kind.localeCompare(right.kind);
  });
  const totalWeight = ordered.reduce((sum, signal) => sum + Math.max(1, signal.backlog + Math.ceil(signal.errorRate * 100) + signal.priority), 0);
  return ordered.map((signal) => {
    const weight = Math.max(1, signal.backlog + Math.ceil(signal.errorRate * 100) + signal.priority);
    const allocatedTokens = Math.max(1, Math.floor((input.totalTokens * weight) / totalWeight));
    const maxTokens = Math.max(allocatedTokens, signal.backlog || allocatedTokens);
    return {
      kind: signal.kind,
      allocatedTokens,
      maxTokens,
      refillPerMinute: Math.max(1, Math.ceil(allocatedTokens / 2)),
      scheduleChecksum: replayPayloadChecksum({
        kind: signal.kind,
        allocatedTokens,
        maxTokens,
        totalTokens: input.totalTokens,
      }),
    };
  });
}

export function assertAdaptiveRecoveryThrottling(budgets: AdaptiveRecoveryBudget[]): void {
  const seen = new Set<RecoveryPressureKind>();
  for (const budget of budgets) {
    if (seen.has(budget.kind)) {
      throw new Error(`recovery starvation exists for ${budget.kind}`);
    }
    seen.add(budget.kind);
    if (budget.allocatedTokens < 1 || budget.refillPerMinute < 1 || budget.allocatedTokens > budget.maxTokens) {
      throw new Error(`replay storms possible for ${budget.kind}`);
    }
    if (!budget.scheduleChecksum) {
      throw new Error(`compensation storms possible for ${budget.kind}`);
    }
  }
}
