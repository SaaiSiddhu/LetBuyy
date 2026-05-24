import type { RuntimeCorrelationContext, RuntimeTenantScope } from '@letbuyy/distributed-runtime';

export interface QuerySnapshotIdentity {
  queryName: string;
  queryVersion: number;
  cacheKey: string;
  tenant?: RuntimeTenantScope | null;
}

export interface QuerySnapshot<TData = Record<string, unknown>> {
  identity: QuerySnapshotIdentity;
  data: TData;
  sourceProjectionName: string;
  sourceProjectionVersion: number;
  consistency: 'strong' | 'read-your-writes' | 'eventual';
  createdAt: string;
  expiresAt?: string | null;
  correlation: RuntimeCorrelationContext;
}

export interface QuerySnapshotStorePort<TData = Record<string, unknown>> {
  read(identity: QuerySnapshotIdentity): Promise<QuerySnapshot<TData> | null>;
  write(snapshot: QuerySnapshot<TData>): Promise<void>;
  invalidate(identity: QuerySnapshotIdentity, reason: string): Promise<void>;
}

export function querySnapshotKey(identity: QuerySnapshotIdentity): string {
  return [
    identity.queryName,
    String(identity.queryVersion),
    identity.tenant?.tenantPartitionKey || 'global',
    identity.cacheKey,
  ].map(encodeURIComponent).join(':');
}

export class QuerySnapshotRuntime<TData = Record<string, unknown>> {
  constructor(private readonly store: QuerySnapshotStorePort<TData>) {}

  async read(identity: QuerySnapshotIdentity, now = new Date()): Promise<QuerySnapshot<TData> | null> {
    const snapshot = await this.store.read(identity);
    if (!snapshot) return null;
    if (snapshot.expiresAt && new Date(snapshot.expiresAt) <= now) {
      await this.store.invalidate(identity, 'query snapshot expired');
      return null;
    }
    return snapshot;
  }

  write(snapshot: QuerySnapshot<TData>): Promise<void> {
    return this.store.write(snapshot);
  }

  invalidate(identity: QuerySnapshotIdentity, reason: string): Promise<void> {
    return this.store.invalidate(identity, reason);
  }
}
