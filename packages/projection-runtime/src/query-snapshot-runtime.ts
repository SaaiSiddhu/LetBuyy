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

  read(identity: QuerySnapshotIdentity): Promise<QuerySnapshot<TData> | null> {
    return this.store.read(identity);
  }

  write(snapshot: QuerySnapshot<TData>): Promise<void> {
    return this.store.write(snapshot);
  }
}
