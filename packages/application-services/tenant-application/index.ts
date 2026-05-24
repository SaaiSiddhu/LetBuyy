import type { RuntimeTenantContext, StoreModel } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';

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
