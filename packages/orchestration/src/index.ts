import type { RuntimeEventEnvelope } from '@letbuyy/event-core';

export interface CorrelationContext {
  requestId: string;
  correlationId: string;
  causationId?: string;
  actorId?: string | null;
  siteId?: string | null;
}

export interface CorrelatedCommand<TPayload = Record<string, unknown>> {
  commandName: string;
  idempotencyKey: string;
  context: CorrelationContext;
  payload: TPayload;
}

export interface EventBusPublishInput<TPayload = Record<string, unknown>> {
  event: RuntimeEventEnvelope<TPayload>;
  idempotencyKey: string;
  retryPolicy?: RetryPolicy;
}

export interface EventBusPort {
  publish<TPayload = Record<string, unknown>>(input: EventBusPublishInput<TPayload>): Promise<void>;
}

export interface WorkflowStep<TState = Record<string, unknown>> {
  name: string;
  idempotencyKey: (state: TState) => string;
  execute: (state: TState, context: CorrelationContext) => Promise<TState>;
  compensate?: (state: TState, context: CorrelationContext) => Promise<TState>;
}

export interface WorkflowDefinition<TState = Record<string, unknown>> {
  name: string;
  version: string;
  replayable: boolean;
  steps: WorkflowStep<TState>[];
}

export interface WorkflowEnginePort {
  run<TState>(definition: WorkflowDefinition<TState>, initialState: TState, context: CorrelationContext): Promise<TState>;
}

export interface CommandPipelineMiddleware<TPayload = Record<string, unknown>> {
  name: string;
  handle(command: CorrelatedCommand<TPayload>, next: (command: CorrelatedCommand<TPayload>) => Promise<unknown>): Promise<unknown>;
}

export interface AsyncExecutionPolicy {
  queueName: string;
  requiresTenantScope: boolean;
  maxConcurrency?: number;
  retryPolicy: RetryPolicy;
  deadLetterPolicy: DeadLetterPolicy;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential';
  initialDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

export interface DeadLetterPolicy {
  target: string;
  retainForDays: number;
  alertAfterFailures: number;
}

export interface SagaDefinition<TState = Record<string, unknown>> extends WorkflowDefinition<TState> {
  consistencyBoundary: 'single-tenant' | 'cross-tenant' | 'provider-reconciled';
  compensationRequired: boolean;
}

export interface EventContract<TPayload = Record<string, unknown>> {
  eventType: string;
  version: number;
  ownerPackage: string;
  replayable: boolean;
  payloadExample: TPayload;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  backoff: 'exponential',
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  retryableErrors: ['TIMEOUT', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE'],
};

export * from './event-runtime';
export * from './outbox-runtime';
export * from './observability-runtime';
export * from './replay-runtime';
export * from './workflow-recovery-runtime';
export * from './async-execution-runtime';
export * from './reliability-runtime';
export * from './workflow-checkpoint-runtime';
