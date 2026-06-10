export interface RuntimeProjectionTenantScope {
  tenantPartitionKey?: string;
  tenantId?: string;
  siteId?: string;
  [key: string]: unknown;
}

export interface RuntimeProjectionIdentity {
  projectionName: string;
  projectionVersion: number;
  tenant?: RuntimeProjectionTenantScope | null;
  objectType: string;
  objectId: string;
}

export interface RuntimeProjectionFreshnessMetadata {
  sourceEventId?: string | null;
  sourceGlobalPosition?: number | null;
  sourceStreamPosition?: number | null;
  projectedAt: string;
  staleAfter?: string | null;
}

export interface RuntimeProjectionCachePolicy {
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
  freshness?: RuntimeProjectionFreshnessMetadata;
  data: TData;
}

export interface RuntimeProjectionStoreRecord<TData = Record<string, unknown>> {
  identity: RuntimeProjectionIdentity;
  readModel: TData;
  freshness: RuntimeProjectionFreshnessMetadata;
  cachePolicy?: RuntimeProjectionCachePolicy;
  lifecycleStatus: 'active' | 'stale' | 'rebuilding' | 'invalidated' | 'deleted';
}
