import type { CreateProductCommand, ListProductsInput, ProductModel } from '@letbuyy/commerce-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';
import { defineExecutionPipelines } from '../src/execution-pipeline';

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
  inventoryLedgerSync: {
    name: 'commerce.inventory-ledger-sync',
    owner: 'commerce-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: false,
    emitsEvents: false,
    coordinatesDomains: ['commerce', 'search'],
  },
});

export const COMMERCE_EXECUTION_PIPELINES = defineExecutionPipelines({
  createProduct: {
    workflow: COMMERCE_APPLICATION_WORKFLOWS.createProduct,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'audit-required',
    steps: [
      { name: 'verify-store-ownership', stage: 'authorize', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'assert-product-quota', stage: 'validate', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'insert-product-record', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
      { name: 'sync-options-variants-inventory', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
      { name: 'record-product-usage', stage: 'audit', ownsTransaction: false, emitsEvent: true, requiresIdempotency: true },
    ],
  },
  updateProduct: {
    workflow: COMMERCE_APPLICATION_WORKFLOWS.updateProduct,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'trace-required',
    steps: [
      { name: 'load-owned-product', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'plan-product-field-update', stage: 'plan', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'apply-product-field-update', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: false },
      { name: 'sync-product-inventory', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: false },
    ],
  },
  bulkProductAction: {
    workflow: COMMERCE_APPLICATION_WORKFLOWS.bulkProductAction,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'audit-required',
    steps: [
      { name: 'load-bulk-product-ownership', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'plan-bulk-product-mutation', stage: 'plan', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'apply-bulk-product-mutation', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
      { name: 'record-product-metering-delta', stage: 'audit', ownsTransaction: false, emitsEvent: true, requiresIdempotency: true },
    ],
  },
  inventoryLedgerSync: {
    workflow: COMMERCE_APPLICATION_WORKFLOWS.inventoryLedgerSync,
    executionBoundary: 'application-service',
    transactionBoundary: 'database-rpc',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'queue',
    observabilityBoundary: 'trace-required',
    steps: [
      { name: 'resolve-inventory-source', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'write-inventory-ledger', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
    ],
  },
});

export const PRODUCT_UPDATE_FIELDS = [
  'name',
  'description',
  'price',
  'compare_price',
  'cost_per_item',
  'images',
  'category',
  'product_type',
  'vendor',
  'stock',
  'track_inventory',
  'sku',
  'barcode',
  'sell_when_oos',
  'is_physical',
  'weight',
  'weight_unit',
  'country_of_origin',
  'hs_code',
  'url_handle',
  'seo_title',
  'seo_description',
  'charge_tax',
  'is_active',
  'is_featured',
  'tags',
  'variants',
  'display_order',
] as const;

export type ProductUpdateField = (typeof PRODUCT_UPDATE_FIELDS)[number];

export interface ProductUpdatePlan {
  safeUpdates: Record<string, unknown>;
  hasOptionUpdates: boolean;
  hasVariantUpdates: boolean;
  hasInventoryUpdate: boolean;
}

export function generateProductSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

export function planProductUpdate(updates: Record<string, unknown>): ProductUpdatePlan {
  const safeUpdates: Record<string, unknown> = {};

  for (const key of PRODUCT_UPDATE_FIELDS) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key];
  }

  if (typeof safeUpdates.name === 'string' && updates.url_handle === undefined) {
    safeUpdates.url_handle = generateProductSlug(safeUpdates.name);
  }

  if (typeof safeUpdates.is_active === 'boolean' && updates.status === undefined) {
    safeUpdates.status = safeUpdates.is_active ? 'active' : 'draft';
  }

  return {
    safeUpdates,
    hasOptionUpdates: updates.product_options !== undefined,
    hasVariantUpdates: Array.isArray(updates.variants),
    hasInventoryUpdate: typeof updates.stock === 'number',
  };
}
