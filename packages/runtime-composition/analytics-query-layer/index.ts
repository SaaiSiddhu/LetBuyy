import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { RuntimeProjection } from '../src/projection';

export interface AnalyticsQueryLayerInput {
  tenant: RuntimeTenantContext;
  range: { from: string; to: string };
  grain: 'hour' | 'day' | 'week' | 'month';
  metrics: string[];
}

export interface AnalyticsProjection {
  range: { from: string; to: string };
  totals: Record<string, number>;
  series: Array<{ timestamp: string; values: Record<string, number> }>;
  dimensions?: Record<string, string[]>;
}

export type AnalyticsRuntimeProjection = RuntimeProjection<AnalyticsProjection>;
