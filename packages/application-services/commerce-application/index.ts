import type { CreateProductCommand, ListProductsInput, ProductModel } from '@letbuyy/commerce-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';

export interface CommerceApplicationPorts {
  createProduct(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; input: CreateProductCommand }>): Promise<ProductModel>;
  coordinateInventory(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; productId: string; delta: number; reason: string }>): Promise<void>;
  assembleCatalog(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; query: ListProductsInput }>): Promise<{ products: ProductModel[]; total: number }>;
}

export interface CommerceExecutionPolicy {
  requireOwnershipCheck: true;
  enforceInventoryLedger: boolean;
  publishCatalogEvents: boolean;
}
