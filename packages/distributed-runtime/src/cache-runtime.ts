import type { RuntimeTenantScope } from './event-envelope-runtime';

export interface DistributedCachePolicy {
  cacheName: string;
  key: string;
  tags: string[];
  tenant?: RuntimeTenantScope | null;
  ttlSeconds: number;
  staleWhileRevalidateSeconds: number;
  consistency: 'event-invalidated' | 'time-bound' | 'manual';
}

export interface CacheInvalidationPlan {
  cacheName: string;
  keys: string[];
  tags: string[];
  tenant?: RuntimeTenantScope | null;
  sourceEventId?: string | null;
  replayAware: boolean;
  reason: string;
}

export interface DistributedCachePort {
  read<TValue>(policy: DistributedCachePolicy): Promise<TValue | null>;
  write<TValue>(policy: DistributedCachePolicy, value: TValue): Promise<void>;
  invalidate(plan: CacheInvalidationPlan): Promise<void>;
}

export function tenantCacheKey(policy: DistributedCachePolicy): string {
  const tenantPart = policy.tenant?.tenantPartitionKey || 'global';
  return [policy.cacheName, tenantPart, policy.key].map(encodeURIComponent).join(':');
}

export function planCacheInvalidation(input: {
  cacheName: string;
  tenant?: RuntimeTenantScope | null;
  sourceEventId?: string | null;
  tags?: string[];
  keys?: string[];
  replayAware?: boolean;
  reason: string;
}): CacheInvalidationPlan {
  return {
    cacheName: input.cacheName,
    tenant: input.tenant || null,
    sourceEventId: input.sourceEventId || null,
    tags: input.tags || [],
    keys: input.keys || [],
    replayAware: input.replayAware ?? true,
    reason: input.reason,
  };
}
