import type { CartItem, OrderModel } from '@letbuyy/checkout-core';
import type { ProductModel } from '@letbuyy/commerce-core';
import type { StoreModel } from '@letbuyy/tenant-core';
import type { StoreTemplateConfig } from '@letbuyy/theme-engine';
import type { RuntimeProjection } from '../src/projection';

export interface StorefrontQueryLayerInput {
  subdomain: string;
  path: string;
  previewToken?: string;
  customerId?: string;
}

export interface StorefrontProjection {
  store: StoreModel;
  template: StoreTemplateConfig;
  products?: ProductModel[];
  cart?: CartItem[];
  order?: OrderModel;
  content?: Record<string, unknown>;
}

export type StorefrontRuntimeProjection = RuntimeProjection<StorefrontProjection>;
