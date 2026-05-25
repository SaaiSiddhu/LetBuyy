import { replayPayloadChecksum } from './event-envelope-runtime';
import type { DurableExecutionWal } from './durable-execution-runtime';
import type { OrchestrationLease } from './lease-fencing-runtime';
import type { PersistentSagaRecoveryPlan } from './saga-recovery-runtime';

export interface ExecutionReconciliationInput {
  executionId: string;
  runtimeStateChecksum: string;
  wal: DurableExecutionWal;
  lease: OrchestrationLease;
  saga?: PersistentSagaRecoveryPlan | null;
}

export interface ExecutionReconciliationPlan {
  executionId: string;
  actions: Array<'restore-from-wal' | 'renew-lease' | 'resume-saga' | 'verify-equilibrium'>;
  fixedPointChecksum: string;
  reconciliationChecksum: string;
}

export function reconcileExecutionState(input: ExecutionReconciliationInput): ExecutionReconciliationPlan {
  const actions: ExecutionReconciliationPlan['actions'] = [];
  if (input.runtimeStateChecksum !== input.wal.walChecksum) actions.push('restore-from-wal');
  if (input.lease.expiresAtMs > 0) actions.push('renew-lease');
  if (input.saga && input.saga.remainingSteps.length > 0) actions.push('resume-saga');
  actions.push('verify-equilibrium');
  const fixedPointChecksum = replayPayloadChecksum({
    executionId: input.executionId,
    runtimeStateChecksum: input.runtimeStateChecksum,
    walChecksum: input.wal.walChecksum,
    leaseChecksum: input.lease.leaseChecksum,
    sagaChecksum: input.saga?.recoveryChecksum || null,
    actions,
  });
  return {
    executionId: input.executionId,
    actions,
    fixedPointChecksum,
    reconciliationChecksum: replayPayloadChecksum({ executionId: input.executionId, fixedPointChecksum, actions }),
  };
}

export function assertExecutionReconciliationStable(plan: ExecutionReconciliationPlan): void {
  if (!plan.actions.includes('verify-equilibrium')) {
    throw new Error('Execution equilibrium unstable: missing fixed-point verification');
  }
  if (!plan.fixedPointChecksum || !plan.reconciliationChecksum) {
    throw new Error('Execution reconciliation checksum missing');
  }
  if (new Set(plan.actions).size !== plan.actions.length) {
    throw new Error('Execution reconciliation oscillation exists');
  }
}
