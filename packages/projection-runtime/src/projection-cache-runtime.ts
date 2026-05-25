import type { CacheInvalidationPlan, DistributedCachePolicy, DistributedCachePort } from '@letbuyy/distributed-runtime';
import type { ProjectionStoreRecord } from './projection-store';

export interface ProjectionCacheWritePlan<TReadModel = Record<string, unknown>> {
  policy: DistributedCachePolicy;
  record: ProjectionStoreRecord<TReadModel>;
}

export function projectionCachePolicyFromRecord<TReadModel>(
  record: ProjectionStoreRecord<TReadModel>,
): DistributedCachePolicy | null {
  if (!record.cachePolicy) return null;
  return {
    cacheName: record.identity.projectionName,
    key: record.cachePolicy.key,
    tags: record.cachePolicy.tags,
    tenant: record.identity.tenant || null,
    ttlSeconds: record.cachePolicy.ttlSeconds,
    staleWhileRevalidateSeconds: record.cachePolicy.staleWhileRevalidateSeconds || 0,
    consistency: 'event-invalidated',
  };
}

export class ProjectionCacheRuntime<TReadModel = Record<string, unknown>> {
  constructor(private readonly cache: DistributedCachePort) {}

  async write(record: ProjectionStoreRecord<TReadModel>): Promise<void> {
    const policy = projectionCachePolicyFromRecord(record);
    if (!policy) return;
    await this.cache.write(policy, record.readModel);
  }

  async invalidate(plan: CacheInvalidationPlan): Promise<void> {
    await this.cache.invalidate(plan);
  }
}
