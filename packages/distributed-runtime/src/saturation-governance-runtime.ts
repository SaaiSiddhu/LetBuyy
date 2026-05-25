import { replayPayloadChecksum } from './event-envelope-runtime';

export type SaturationBudgetKind =
  | 'orchestration'
  | 'rollback'
  | 'replay'
  | 'queue-rebuild'
  | 'reconciliation'
  | 'dag-execution'
  | 'projection-rebuild'
  | 'queue-recovery';

export interface RuntimeSaturationBudget {
  kind: SaturationBudgetKind;
  maxConcurrency: number;
  rateLimitPerMinute: number;
  deterministicThrottle: 'token-bucket-with-stable-ordering';
}

export interface SaturationDecision {
  kind: SaturationBudgetKind;
  allowed: boolean;
  availableConcurrency: number;
  decisionChecksum: string;
}

export function decideSaturation(
  budget: RuntimeSaturationBudget,
  inFlight: number,
  requestedConcurrency = 1,
): SaturationDecision {
  const availableConcurrency = Math.max(0, budget.maxConcurrency - inFlight);
  const allowed = budget.deterministicThrottle === 'token-bucket-with-stable-ordering'
    && requestedConcurrency <= availableConcurrency
    && budget.rateLimitPerMinute > 0;
  return {
    kind: budget.kind,
    allowed,
    availableConcurrency,
    decisionChecksum: replayPayloadChecksum({
      kind: budget.kind,
      allowed,
      availableConcurrency,
      requestedConcurrency,
      maxConcurrency: budget.maxConcurrency,
      rateLimitPerMinute: budget.rateLimitPerMinute,
    }),
  };
}

export function assertSaturationGovernance(budgets: RuntimeSaturationBudget[]): void {
  const kinds = new Set<SaturationBudgetKind>();
  for (const budget of budgets) {
    if (kinds.has(budget.kind)) throw new Error(`Runtime saturation duplicate budget: ${budget.kind}`);
    kinds.add(budget.kind);
    if (budget.maxConcurrency < 1 || budget.rateLimitPerMinute < 1) {
      throw new Error(`Runtime saturation uncontrolled for ${budget.kind}`);
    }
    if (budget.deterministicThrottle !== 'token-bucket-with-stable-ordering') {
      throw new Error(`Runtime saturation lacks deterministic throttling contract: ${budget.kind}`);
    }
  }
}
