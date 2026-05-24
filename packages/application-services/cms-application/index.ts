import type { CreatePageInput, ReplaceNavigationInput } from '@letbuyy/cms-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';

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
