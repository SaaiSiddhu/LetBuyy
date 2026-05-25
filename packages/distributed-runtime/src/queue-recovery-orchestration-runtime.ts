export interface QueueRecoverySnapshot {
  queueName: string;
  deadLetterQueue: string;
  retrying: number;
  deadLettered: number;
  poisonMessages: number;
  oldestAvailableAt: string;
}

export interface QueueRecoveryOrchestrationPolicy {
  queueName: string;
  maxRetrying: number;
  maxDeadLetteredBeforeQuarantine: number;
  maxPoisonMessages: number;
}

export interface QueueRecoveryOrchestrationAction {
  queueName: string;
  action: 'none' | 'reconcile-retries' | 'quarantine-poison' | 'operator-redrive-review';
  reason: string;
}

export function planQueueRecoveryOrchestration(
  snapshot: QueueRecoverySnapshot,
  policy: QueueRecoveryOrchestrationPolicy,
): QueueRecoveryOrchestrationAction {
  if (snapshot.queueName !== policy.queueName) {
    throw new Error(`Queue recovery policy mismatch: ${snapshot.queueName} !== ${policy.queueName}`);
  }

  if (snapshot.poisonMessages > policy.maxPoisonMessages) {
    return {
      queueName: snapshot.queueName,
      action: 'quarantine-poison',
      reason: 'poison-message threshold exceeded',
    };
  }

  if (snapshot.deadLettered > policy.maxDeadLetteredBeforeQuarantine) {
    return {
      queueName: snapshot.queueName,
      action: 'operator-redrive-review',
      reason: 'dead-letter threshold requires approved dry-run redrive',
    };
  }

  if (snapshot.retrying > policy.maxRetrying) {
    return {
      queueName: snapshot.queueName,
      action: 'reconcile-retries',
      reason: 'retry backlog exceeds deterministic recovery threshold',
    };
  }

  return {
    queueName: snapshot.queueName,
    action: 'none',
    reason: 'queue recovery state is within policy',
  };
}
