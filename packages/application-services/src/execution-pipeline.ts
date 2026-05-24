import type { ApplicationWorkflowDescriptor, ApplicationWorkflowOwner } from './workflow-descriptor';

export type ExecutionStage =
  | 'authorize'
  | 'validate'
  | 'load'
  | 'plan'
  | 'mutate'
  | 'publish'
  | 'audit'
  | 'complete';

export interface WorkflowExecutionStep {
  name: string;
  stage: ExecutionStage;
  ownsTransaction: boolean;
  emitsEvent: boolean;
  requiresIdempotency: boolean;
}

export interface WorkflowExecutionPipeline {
  workflow: ApplicationWorkflowDescriptor;
  executionBoundary: 'application-service';
  transactionBoundary: 'application-service-declared' | 'database-rpc' | 'runtime-adapter';
  retryBoundary: 'application-service' | 'orchestration-runtime' | 'provider-adapter' | 'none';
  asyncBoundary: 'outbox' | 'queue' | 'webhook' | 'inline' | 'none';
  observabilityBoundary: 'correlation-required' | 'trace-required' | 'audit-required';
  steps: WorkflowExecutionStep[];
}

export interface RuntimeBridgeContract {
  kind: 'runtime-bridge';
  adapter: string;
  workflowAuthority: ApplicationWorkflowOwner;
  allowedResponsibilities: Array<'transport' | 'database-rpc' | 'provider-adapter-wiring' | 'queue-claim' | 'webhook-delivery' | 'response-formatting'>;
  forbiddenResponsibilities: Array<'workflow-ownership' | 'business-sequencing' | 'query-aggregation' | 'provider-sdk' | 'ui-rendering'>;
}

export function defineExecutionPipeline<const T extends WorkflowExecutionPipeline>(pipeline: T): T {
  return pipeline;
}

export function defineExecutionPipelines<const T extends Record<string, WorkflowExecutionPipeline>>(pipelines: T): T {
  return pipelines;
}

export function defineRuntimeBridge<const T extends RuntimeBridgeContract>(contract: T): T {
  return contract;
}
