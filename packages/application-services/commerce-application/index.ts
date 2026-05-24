import type { CreateProductCommand, ListProductsInput, ProductModel } from '@letbuyy/commerce-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';

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

export const COMMERCE_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
  createProduct: {
    name: 'commerce.create-product',
    owner: 'commerce-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['commerce', 'billing'],
  },
  updateProduct: {
    name: 'commerce.update-product',
    owner: 'commerce-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: false,
    emitsEvents: true,
    coordinatesDomains: ['commerce', 'search'],
  },
  bulkProductAction: {
    name: 'commerce.bulk-product-action',
    owner: 'commerce-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['commerce', 'search'],
  },
  inventoryProjection: {
    name: 'commerce.inventory-projection',
    owner: 'commerce-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: false,
    emitsEvents: false,
    coordinatesDomains: ['commerce', 'search'],
  },
});
