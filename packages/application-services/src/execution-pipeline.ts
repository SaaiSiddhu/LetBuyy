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
  compensation?: string;
  checkpoint?: string;
}

export interface ApplicationExecutionMetadata {
  requestId: string;
  correlationId: string;
  causationId?: string;
  siteId?: string | null;
  actorId?: string | null;
  idempotencyKey?: string;
  workflowName: string;
  workflowVersion: string;
}

export interface ExecutionMetadataPropagation {
  requiredKeys: Array<keyof ApplicationExecutionMetadata>;
  propagatesToEvents: boolean;
  propagatesToAsyncJobs: boolean;
  propagatesToProviderCalls: boolean;
}

export interface WorkflowStateContract {
  stateName: string;
  version: string;
  checkpointRequired: boolean;
  recoveryStrategy: 'resume' | 'retry-step' | 'compensate' | 'dead-letter';
}

export interface WorkflowRecoveryContract {
  checkpointOwner: 'application-service' | 'orchestration-runtime';
  replayOwner: 'orchestration-runtime' | 'not-replayable';
  recoveryOwner: 'application-service';
  deadLetterOwner: 'orchestration-runtime';
}

export interface WorkflowCompensationContract {
  required: boolean;
  compensationOwner: ApplicationWorkflowOwner;
  compensatingSteps: string[];
}

export interface ExecutionPlanningContract {
  policyOwner: ApplicationWorkflowOwner;
  transactionOwner: 'application-service' | 'database-rpc' | 'runtime-adapter';
  retryOwner: 'application-service' | 'orchestration-runtime' | 'provider-adapter' | 'none';
  asyncOwner: 'outbox' | 'queue' | 'webhook' | 'inline' | 'none';
}

export interface OrchestrationStateContract {
  workflowState: WorkflowStateContract;
  compensation: WorkflowCompensationContract;
  metadataPropagation: Array<keyof ApplicationExecutionMetadata>;
  recovery?: WorkflowRecoveryContract;
}

export interface ExecutionBoundaryContract {
  workflowAuthority: ApplicationWorkflowOwner;
  runtimeBoundary: 'app' | 'service' | 'package';
  orchestrationBoundary: 'application-service';
  queryBoundary: 'runtime-composition';
  providerBoundary: 'infrastructure-adapter';
}

export interface WorkflowExecutionPipeline {
  workflow: ApplicationWorkflowDescriptor;
  executionBoundary: 'application-service';
  transactionBoundary: 'application-service-declared' | 'database-rpc' | 'runtime-adapter';
  retryBoundary: 'application-service' | 'orchestration-runtime' | 'provider-adapter' | 'none';
  asyncBoundary: 'outbox' | 'queue' | 'webhook' | 'inline' | 'none';
  observabilityBoundary: 'correlation-required' | 'trace-required' | 'audit-required';
  stateContract?: WorkflowStateContract;
  compensation?: WorkflowCompensationContract;
  executionPlan?: ExecutionPlanningContract;
  metadataPropagation?: ExecutionMetadataPropagation;
  recovery?: WorkflowRecoveryContract;
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

export function defineWorkflowStateContract<const T extends WorkflowStateContract>(contract: T): T {
  return contract;
}

export function defineExecutionBoundaryContract<const T extends ExecutionBoundaryContract>(contract: T): T {
  return contract;
}

export function defineOrchestrationStateContract<const T extends OrchestrationStateContract>(contract: T): T {
  return contract;
}

export function defineWorkflowRecoveryContract<const T extends WorkflowRecoveryContract>(contract: T): T {
  return contract;
}
