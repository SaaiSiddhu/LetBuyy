import type { CorrelationContext, DeadLetterPolicy, RetryPolicy } from './index';
import { nextRetryIso } from './outbox-runtime';

export interface RetryExecutionState {
  executionId: string;
  attempts: number;
  lastError?: string;
}

export interface RetryExecutionDecision {
  action: 'retry' | 'dead-letter';
  availableAt?: string;
  reason: string;
}

export function decideRetryExecution(state: RetryExecutionState, policy: RetryPolicy): RetryExecutionDecision {
  if (state.attempts >= policy.maxAttempts) {
    return {
      action: 'dead-letter',
      reason: state.lastError || 'retry attempts exhausted',
    };
  }

  return {
    action: 'retry',
    availableAt: nextRetryIso(state.attempts, policy),
    reason: state.lastError || 'retryable execution failure',
  };
}

export interface DeadLetterRecord<TPayload = Record<string, unknown>> {
  executionId: string;
  target: string;
  payload: TPayload;
  reason: string;
  correlation: CorrelationContext;
  createdAt: string;
  retainUntil: string;
}

export interface DeadLetterStorePort<TPayload = Record<string, unknown>> {
  append(record: DeadLetterRecord<TPayload>): Promise<void>;
}

export class DeadLetterExecutionRuntime<TPayload = Record<string, unknown>> {
  constructor(
    private readonly store: DeadLetterStorePort<TPayload>,
    private readonly policy: DeadLetterPolicy,
  ) {}

  async record(input: {
    executionId: string;
    payload: TPayload;
    reason: string;
    correlation: CorrelationContext;
  }): Promise<DeadLetterRecord<TPayload>> {
    const createdAt = new Date();
    const retainUntil = new Date(createdAt.getTime() + this.policy.retainForDays * 24 * 60 * 60 * 1000);
    const record: DeadLetterRecord<TPayload> = {
      executionId: input.executionId,
      target: this.policy.target,
      payload: input.payload,
      reason: input.reason,
      correlation: input.correlation,
      createdAt: createdAt.toISOString(),
      retainUntil: retainUntil.toISOString(),
    };

    await this.store.append(record);
    return record;
  }
}

export interface IdempotencyExecutionState<TValue = Record<string, unknown>> {
  key: string;
  status: 'processing' | 'completed' | 'failed';
  result?: TValue;
  lockedUntil?: string;
}

export interface IdempotencyStorePort<TValue = Record<string, unknown>> {
  claim(key: string, context: CorrelationContext): Promise<IdempotencyExecutionState<TValue>>;
  complete(key: string, result: TValue): Promise<void>;
  fail(key: string, reason: string): Promise<void>;
}

export class IdempotencyExecutionRuntime<TValue = Record<string, unknown>> {
  constructor(private readonly store: IdempotencyStorePort<TValue>) {}

  async claimOrReplay(key: string, context: CorrelationContext): Promise<{ status: 'claimed' } | { status: 'replay'; result?: TValue }> {
    const state = await this.store.claim(key, context);
    if (state.status === 'completed') return { status: 'replay', result: state.result };
    return { status: 'claimed' };
  }

  complete(key: string, result: TValue): Promise<void> {
    return this.store.complete(key, result);
  }

  fail(key: string, reason: string): Promise<void> {
    return this.store.fail(key, reason);
  }
}
