import type { RuntimeTenantScope } from '@letbuyy/distributed-runtime';

export interface ProjectionIdentity {
  projectionName: string;
  projectionVersion: number;
  tenant?: RuntimeTenantScope | null;
  objectType: string;
  objectId: string;
}

export interface ProjectionFreshnessMetadata {
  sourceEventId?: string | null;
  sourceGlobalPosition?: number | null;
  sourceStreamPosition?: number | null;
  projectedAt: string;
  staleAfter?: string | null;
}

export interface ProjectionCachePolicy {
  key: string;
  tenantScoped: boolean;
  ttlSeconds: number;
  staleWhileRevalidateSeconds?: number;
  tags: string[];
}

export interface ProjectionStoreRecord<TReadModel = Record<string, unknown>> {
  identity: ProjectionIdentity;
  readModel: TReadModel;
  freshness: ProjectionFreshnessMetadata;
  cachePolicy?: ProjectionCachePolicy;
  lifecycleStatus: 'active' | 'stale' | 'rebuilding' | 'invalidated' | 'deleted';
}

export interface ProjectionStorePort<TReadModel = Record<string, unknown>> {
  load(identity: ProjectionIdentity): Promise<ProjectionStoreRecord<TReadModel> | null>;
  upsert(record: ProjectionStoreRecord<TReadModel>): Promise<void>;
  markStale(identity: ProjectionIdentity, reason: string): Promise<void>;
  delete(identity: ProjectionIdentity, reason: string): Promise<void>;
}

export function projectionStoreKey(identity: ProjectionIdentity): string {
  return [
    identity.projectionName,
    String(identity.projectionVersion),
    identity.tenant?.tenantPartitionKey || 'global',
    identity.objectType,
    identity.objectId,
  ].map(encodeURIComponent).join(':');
}

export class ProjectionStoreRuntime<TReadModel = Record<string, unknown>> {
  constructor(private readonly store: ProjectionStorePort<TReadModel>) {}

  load(identity: ProjectionIdentity): Promise<ProjectionStoreRecord<TReadModel> | null> {
    return this.store.load(identity);
  }

  upsert(record: ProjectionStoreRecord<TReadModel>): Promise<void> {
    if (!record.identity.projectionName || record.identity.projectionVersion < 1) {
      throw new Error('Projection store record requires a name and version');
    }
    return this.store.upsert(record);
  }

  markStale(identity: ProjectionIdentity, reason: string): Promise<void> {
    return this.store.markStale(identity, reason);
  }

  delete(identity: ProjectionIdentity, reason: string): Promise<void> {
    return this.store.delete(identity, reason);
  }

  async loadFresh(identity: ProjectionIdentity, now = new Date()): Promise<ProjectionStoreRecord<TReadModel> | null> {
    const record = await this.store.load(identity);
    if (!record) return null;
    if (record.lifecycleStatus !== 'active') return null;
    if (record.freshness.staleAfter && new Date(record.freshness.staleAfter) <= now) {
      await this.store.markStale(identity, 'projection stale_after elapsed');
      return null;
    }
    return record;
  }
}
