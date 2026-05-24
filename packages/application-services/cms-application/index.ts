import type { CreatePageInput, ReplaceNavigationInput } from '@letbuyy/cms-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';

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
