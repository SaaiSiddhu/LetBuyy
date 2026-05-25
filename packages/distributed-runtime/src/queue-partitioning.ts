import type { RuntimeTenantScope } from './event-envelope-runtime';

export interface QueuePartitioningPolicy {
  queueName: string;
  partitionCount: number;
  tenantIsolated: boolean;
  regionAware: boolean;
  ordering: 'tenant' | 'aggregate' | 'best-effort';
}

export interface QueuePartitionRoute {
  queueName: string;
  partitionKey: string;
  partitionIndex: number;
  tenantScoped: boolean;
  region?: string | null;
}

function hashPartitionKey(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function routeQueuePartition(input: {
  policy: QueuePartitioningPolicy;
  tenant?: RuntimeTenantScope | null;
  aggregateId?: string | null;
  explicitPartitionKey?: string | null;
}): QueuePartitionRoute {
  const partitionKey =
    input.explicitPartitionKey ||
    (input.policy.ordering === 'tenant' ? input.tenant?.tenantPartitionKey : input.aggregateId) ||
    input.tenant?.tenantPartitionKey ||
    input.policy.queueName;
  const partitionCount = Math.max(1, input.policy.partitionCount);

  return {
    queueName: input.policy.queueName,
    partitionKey,
    partitionIndex: hashPartitionKey(partitionKey) % partitionCount,
    tenantScoped: Boolean(input.tenant?.siteId && input.policy.tenantIsolated),
    region: input.policy.regionAware ? input.tenant?.region || null : null,
  };
}

export function tenantQueueName(queueName: string, tenant?: RuntimeTenantScope | null): string {
  if (!tenant?.siteId) return queueName;
  return `${queueName}:tenant:${tenant.tenantPartitionKey}`;
}
