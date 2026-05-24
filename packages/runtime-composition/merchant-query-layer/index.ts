import type { OrderModel } from '@letbuyy/checkout-core';
import type { ProductModel } from '@letbuyy/commerce-core';
import type { RuntimeTenantContext, StoreModel } from '@letbuyy/tenant-core';
import type { RuntimeProjection } from '../src/projection';

export interface MerchantQueryLayerInput {
  tenant: RuntimeTenantContext;
  view: 'dashboard' | 'products' | 'orders' | 'customers' | 'themes' | 'analytics' | 'settings';
  filters?: Record<string, string | number | boolean | undefined>;
}

export interface MerchantProjection {
  store: StoreModel;
  products?: ProductModel[];
  orders?: OrderModel[];
  metrics?: Record<string, number>;
  pendingActions?: string[];
}

export type MerchantRuntimeProjection = RuntimeProjection<MerchantProjection>;
