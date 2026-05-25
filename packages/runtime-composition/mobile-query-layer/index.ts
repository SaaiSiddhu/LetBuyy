import type { RuntimeTenantContext, StoreModel } from '@letbuyy/tenant-core';
import type { RuntimeProjection } from '../src/projection';

export interface MobileQueryLayerInput {
  tenant?: RuntimeTenantContext;
  deviceId?: string;
  surface: 'shopper' | 'merchant' | 'operator';
  syncCursor?: string;
}

export interface MobileProjection {
  store?: StoreModel;
  syncCursor?: string;
  payload: Record<string, unknown>;
}

export type MobileRuntimeProjection = RuntimeProjection<MobileProjection>;
