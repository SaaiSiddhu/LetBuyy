import type { CreatePageInput, ReplaceNavigationInput } from '@letbuyy/cms-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';
import { defineExecutionPipelines } from '../src/execution-pipeline';

export const CMS_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
  createPage: {
    name: 'cms.create-page',
    owner: 'cms-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['cms-core', 'tenant-core', 'event-core'],
  },
  replaceNavigation: {
    name: 'cms.replace-navigation',
    owner: 'cms-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['cms-core', 'tenant-core', 'event-core'],
  },
  assembleContentRoute: {
    name: 'cms.assemble-content-route',
    owner: 'cms-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: false,
    emitsEvents: false,
    coordinatesDomains: ['cms-core', 'tenant-core', 'theme-engine'],
  },
});

export const CMS_EXECUTION_PIPELINES = defineExecutionPipelines({
  createPage: {
    workflow: CMS_APPLICATION_WORKFLOWS.createPage,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'audit-required',
    stateContract: {
      stateName: 'cms.create-page',
      version: '1.0.0',
      checkpointRequired: true,
      recoveryStrategy: 'retry-step',
    },
    steps: [
      { name: 'validate-page-command', stage: 'validate', ownsTransaction: false, emitsEvent: false, requiresIdempotency: true },
      { name: 'persist-page-content', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
      { name: 'publish-content-event', stage: 'publish', ownsTransaction: false, emitsEvent: true, requiresIdempotency: true },
    ],
  },
  replaceNavigation: {
    workflow: CMS_APPLICATION_WORKFLOWS.replaceNavigation,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'audit-required',
    stateContract: {
      stateName: 'cms.replace-navigation',
      version: '1.0.0',
      checkpointRequired: true,
      recoveryStrategy: 'retry-step',
    },
    steps: [
      { name: 'validate-navigation-command', stage: 'validate', ownsTransaction: false, emitsEvent: false, requiresIdempotency: true },
      { name: 'persist-navigation-tree', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
      { name: 'publish-navigation-event', stage: 'publish', ownsTransaction: false, emitsEvent: true, requiresIdempotency: true },
    ],
  },
  assembleContentRoute: {
    workflow: CMS_APPLICATION_WORKFLOWS.assembleContentRoute,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'none',
    asyncBoundary: 'inline',
    observabilityBoundary: 'correlation-required',
    stateContract: {
      stateName: 'cms.assemble-content-route',
      version: '1.0.0',
      checkpointRequired: false,
      recoveryStrategy: 'resume',
    },
    steps: [
      { name: 'resolve-content-route-scope', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'delegate-content-read-composition', stage: 'complete', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
    ],
  },
});

export interface CmsApplicationPorts {
  createPage(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; input: CreatePageInput }>): Promise<Record<string, unknown>>;
  replaceNavigation(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; input: ReplaceNavigationInput }>): Promise<void>;
  assembleContentRoute(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; path: string }>): Promise<Record<string, unknown> | null>;
}

export interface CmsExecutionPolicy {
  publishWorkflowRequired: boolean;
  navigationChangesAreAudited: true;
  contentPreviewRequiresToken: true;
}
