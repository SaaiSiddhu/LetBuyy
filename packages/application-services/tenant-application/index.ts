import type { RuntimeTenantContext, StoreModel } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';

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
