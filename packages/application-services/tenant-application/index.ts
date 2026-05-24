import type { RuntimeTenantContext, StoreModel } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';
import { defineExecutionPipelines } from '../src/execution-pipeline';

export interface TenantApplicationPorts {
  resolveBySubdomain(command: CorrelatedCommand<{ subdomain: string }>): Promise<{ tenant: RuntimeTenantContext | null; store: StoreModel | null }>;
  resolveOwnedTenant(command: CorrelatedCommand<{ siteId: string; actorId: string }>): Promise<RuntimeTenantContext>;
  loadRuntimeStore(command: CorrelatedCommand<{ tenant: RuntimeTenantContext }>): Promise<StoreModel>;
}

export interface TenantExecutionPolicy {
  requireSiteIdForMerchantRecords: true;
  allowStoreTerminologyOnlyAtRuntimeEdges: true;
  customDomainsRequireOwnershipProof: boolean;
}

export const TENANT_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
  resolveTenantContext: {
    name: 'tenant.resolve-context',
    owner: 'tenant-application',
    version: '1.0.0',
    requiresTenantScope: false,
    requiresIdempotency: false,
    emitsEvents: false,
    coordinatesDomains: ['tenant', 'billing'],
  },
  loadStorefrontRuntime: {
    name: 'tenant.load-storefront-runtime',
    owner: 'tenant-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: false,
    emitsEvents: false,
    coordinatesDomains: ['tenant', 'theme', 'cms'],
  },
});

export const TENANT_EXECUTION_PIPELINES = defineExecutionPipelines({
  resolveTenantContext: {
    workflow: TENANT_APPLICATION_WORKFLOWS.resolveTenantContext,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'none',
    asyncBoundary: 'inline',
    observabilityBoundary: 'correlation-required',
    stateContract: {
      stateName: 'tenant.resolve-context',
      version: '1.0.0',
      checkpointRequired: false,
      recoveryStrategy: 'resume',
    },
    steps: [
      { name: 'normalize-tenant-lookup', stage: 'validate', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'bind-runtime-tenant-context', stage: 'complete', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
    ],
  },
  loadStorefrontRuntime: {
    workflow: TENANT_APPLICATION_WORKFLOWS.loadStorefrontRuntime,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'none',
    asyncBoundary: 'inline',
    observabilityBoundary: 'trace-required',
    stateContract: {
      stateName: 'tenant.load-storefront-runtime',
      version: '1.0.0',
      checkpointRequired: false,
      recoveryStrategy: 'resume',
    },
    steps: [
      { name: 'load-runtime-store-context', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'bind-merchant-ownership-metadata', stage: 'complete', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
    ],
  },
});
