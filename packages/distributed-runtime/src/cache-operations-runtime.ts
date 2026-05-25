import type { RuntimeCorrelationContext } from './event-envelope-runtime';
import type { CacheInvalidationPlan, DistributedCacheEntry, DistributedCachePolicy } from './cache-runtime';
import { cacheEntryState, tenantCacheKey } from './cache-runtime';

export interface CacheOperationalSnapshot {
  cacheName: string;
  key: string;
  tenantKey: string;
  state: 'fresh' | 'stale' | 'expired';
  tags: string[];
  sizeBytes?: number;
  sampledAt: string;
}

export interface CacheConsistencyResult {
  cacheName: string;
  key: string;
  consistent: boolean;
  reason: string;
}

export interface CacheOperationsPort {
  inspect(policy: DistributedCachePolicy): Promise<DistributedCacheEntry | null>;
  invalidate(plan: CacheInvalidationPlan, context: RuntimeCorrelationContext): Promise<void>;
  recordSnapshot(snapshot: CacheOperationalSnapshot): Promise<void>;
}

export function createCacheOperationalSnapshot<TValue>(
  policy: DistributedCachePolicy,
  entry: DistributedCacheEntry<TValue> | null,
  now = new Date(),
): CacheOperationalSnapshot {
  return {
    cacheName: policy.cacheName,
    key: policy.key,
    tenantKey: tenantCacheKey(policy),
    state: entry ? cacheEntryState(entry, now) : 'expired',
    tags: policy.tags,
    sampledAt: now.toISOString(),
  };
}

export function verifyCacheConsistency<TValue>(
  policy: DistributedCachePolicy,
  entry: DistributedCacheEntry<TValue> | null,
  now = new Date(),
): CacheConsistencyResult {
  const state = entry ? cacheEntryState(entry, now) : 'expired';
  return {
    cacheName: policy.cacheName,
    key: policy.key,
    consistent: policy.consistency === 'time-bound' ? state !== 'expired' : state === 'fresh',
    reason: entry ? `cache entry is ${state}` : 'cache entry is missing',
  };
}

export class CacheOperationsRuntime {
  constructor(private readonly operations: CacheOperationsPort) {}

  async inspect(policy: DistributedCachePolicy): Promise<CacheOperationalSnapshot> {
    const entry = await this.operations.inspect(policy);
    const snapshot = createCacheOperationalSnapshot(policy, entry);
    await this.operations.recordSnapshot(snapshot);
    return snapshot;
  }

  invalidate(plan: CacheInvalidationPlan, context: RuntimeCorrelationContext): Promise<void> {
    return this.operations.invalidate(plan, context);
  }
}
