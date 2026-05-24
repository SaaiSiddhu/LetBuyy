import type { RuntimeTenantScope } from './event-envelope-runtime';

export interface TenantWorkloadMetrics {
  siteId: string;
  queueDepth: number;
  runningExecutions: number;
  errorRate: number;
  retryRate: number;
  p95LatencyMs: number;
  sampledAt: string;
}

export interface TenantExecutionQuota {
  siteId: string;
  maxConcurrentExecutions: number;
  maxQueuedJobs: number;
  maxRequestsPerMinute: number;
  burstMultiplier: number;
}

export interface TenantScalingDecision {
  siteId: string;
  action: 'allow' | 'throttle' | 'isolate' | 'shed-low-priority';
  reason: string;
  retryAfterSeconds?: number;
  partitionOverride?: string;
}

export interface TenantWorkloadRouterPolicy {
  defaultQueueName: string;
  isolatedQueuePrefix: string;
  enterpriseQueueName?: string;
}

export interface TenantExecutionAdmission {
  accepted: boolean;
  queueName: string;
  partitionKey: string;
  decision: TenantScalingDecision;
}

export interface TenantResourceGovernance {
  tenant: RuntimeTenantScope;
  quota: TenantExecutionQuota;
  noisyNeighborProtection: boolean;
  priorityClass: 'standard' | 'growth' | 'enterprise' | 'platform-critical';
}

export function decideTenantScaling(
  governance: TenantResourceGovernance,
  metrics: TenantWorkloadMetrics,
): TenantScalingDecision {
  if (metrics.runningExecutions >= governance.quota.maxConcurrentExecutions) {
    return {
      siteId: governance.tenant.siteId,
      action: governance.noisyNeighborProtection ? 'isolate' : 'throttle',
      reason: 'tenant concurrent execution quota reached',
      retryAfterSeconds: 30,
      partitionOverride: governance.noisyNeighborProtection ? governance.tenant.tenantPartitionKey : undefined,
    };
  }

  if (metrics.queueDepth >= governance.quota.maxQueuedJobs) {
    return {
      siteId: governance.tenant.siteId,
      action: 'shed-low-priority',
      reason: 'tenant queue depth quota reached',
      retryAfterSeconds: 60,
    };
  }

  if (metrics.errorRate > 0.2 || metrics.retryRate > 0.35) {
    return {
      siteId: governance.tenant.siteId,
      action: 'throttle',
      reason: 'tenant workload is creating elevated retries or failures',
      retryAfterSeconds: 120,
    };
  }

  return {
    siteId: governance.tenant.siteId,
    action: 'allow',
    reason: 'tenant workload is within quota',
  };
}

export function tenantScalingMetricKey(siteId: string, metricName: string): string {
  return ['tenant', encodeURIComponent(siteId), encodeURIComponent(metricName)].join(':');
}

export function routeTenantWorkload(
  governance: TenantResourceGovernance,
  metrics: TenantWorkloadMetrics,
  policy: TenantWorkloadRouterPolicy,
): TenantExecutionAdmission {
  const decision = decideTenantScaling(governance, metrics);
  const queueName =
    governance.priorityClass === 'enterprise' && policy.enterpriseQueueName
      ? policy.enterpriseQueueName
      : decision.action === 'isolate'
        ? `${policy.isolatedQueuePrefix}-${governance.tenant.siteId}`
        : policy.defaultQueueName;

  return {
    accepted: decision.action === 'allow' || decision.action === 'isolate',
    queueName,
    partitionKey: decision.partitionOverride || governance.tenant.tenantPartitionKey,
    decision,
  };
}

export class TenantScalabilityRuntime {
  decide(governance: TenantResourceGovernance, metrics: TenantWorkloadMetrics): TenantScalingDecision {
    return decideTenantScaling(governance, metrics);
  }

  route(
    governance: TenantResourceGovernance,
    metrics: TenantWorkloadMetrics,
    policy: TenantWorkloadRouterPolicy,
  ): TenantExecutionAdmission {
    return routeTenantWorkload(governance, metrics, policy);
  }
}
