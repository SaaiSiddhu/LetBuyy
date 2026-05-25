import type {
  ProjectionCachePolicy,
  ProjectionFreshnessMetadata,
  ProjectionIdentity,
  ProjectionStoreRecord,
} from '@letbuyy/projection-runtime';

export interface RuntimeProjectionCachePolicy extends ProjectionCachePolicy {
  key: string;
  tenantScoped: boolean;
  ttlSeconds: number;
  staleWhileRevalidateSeconds?: number;
  tags: string[];
}

export interface RuntimeProjection<TData = Record<string, unknown>> {
  projectionName: string;
  projectionVersion: number;
  cachePolicy?: RuntimeProjectionCachePolicy;
  freshness?: ProjectionFreshnessMetadata;
  data: TData;
}

export type RuntimeProjectionIdentity = ProjectionIdentity;
export type RuntimeProjectionStoreRecord<TData = Record<string, unknown>> = ProjectionStoreRecord<TData>;
