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

export interface DistributedCacheEntry<TValue = Record<string, unknown>> {
  value: TValue;
  cachedAt: string;
  expiresAt: string;
  staleUntil: string;
  consistency: DistributedCachePolicy['consistency'];
}

export interface CacheReadThroughResult<TValue = Record<string, unknown>> {
  value: TValue;
  source: 'cache' | 'origin' | 'stale-cache';
  policy: DistributedCachePolicy;
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

export function cacheEntryState<TValue>(entry: DistributedCacheEntry<TValue>, now = new Date()): 'fresh' | 'stale' | 'expired' {
  const current = now.getTime();
  if (new Date(entry.expiresAt).getTime() > current) return 'fresh';
  if (new Date(entry.staleUntil).getTime() > current) return 'stale';
  return 'expired';
}

export class CacheOrchestrationRuntime {
  constructor(private readonly cache: DistributedCachePort) {}

  async readThrough<TValue>(input: {
    policy: DistributedCachePolicy;
    load: () => Promise<TValue>;
    now?: Date;
  }): Promise<CacheReadThroughResult<TValue>> {
    const cached = await this.cache.read<DistributedCacheEntry<TValue>>(input.policy);
    if (cached) {
      const state = cacheEntryState(cached, input.now);
      if (state === 'fresh') {
        return { value: cached.value, source: 'cache', policy: input.policy };
      }
      if (state === 'stale' && input.policy.staleWhileRevalidateSeconds > 0) {
        return { value: cached.value, source: 'stale-cache', policy: input.policy };
      }
    }

    const value = await input.load();
    const now = input.now || new Date();
    await this.cache.write(input.policy, {
      value,
      cachedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + input.policy.ttlSeconds * 1000).toISOString(),
      staleUntil: new Date(now.getTime() + (input.policy.ttlSeconds + input.policy.staleWhileRevalidateSeconds) * 1000).toISOString(),
      consistency: input.policy.consistency,
    } satisfies DistributedCacheEntry<TValue>);

    return { value, source: 'origin', policy: input.policy };
  }

  invalidate(plan: CacheInvalidationPlan): Promise<void> {
    return this.cache.invalidate(plan);
  }
}
