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
  data: TData;
}
