import type { RuntimeTenantScope } from './event-envelope-runtime';
import type { TenantExecutionAdmission, TenantResourceGovernance, TenantWorkloadMetrics, TenantWorkloadRouterPolicy } from './tenant-scalability-runtime';
import { routeTenantWorkload } from './tenant-scalability-runtime';

export interface TenantOperationalProjection {
  tenant: RuntimeTenantScope;
  queueDepth: number;
  runningExecutions: number;
  throttledExecutions: number;
  deadLetteredExecutions: number;
  p95LatencyMs: number;
  fairnessScore: number;
  projectedAt: string;
}

export interface TenantFairnessDecision {
  siteId: string;
  action: 'allow' | 'throttle' | 'isolate' | 'rebalance';
  fairnessScore: number;
  reason: string;
}

export interface TenantOperationsPort {
  loadMetrics(siteId: string): Promise<TenantWorkloadMetrics>;
  persistProjection(projection: TenantOperationalProjection): Promise<void>;
}

export function calculateTenantFairnessScore(metrics: TenantWorkloadMetrics, governance: TenantResourceGovernance): number {
  const concurrencyPressure = metrics.runningExecutions / Math.max(1, governance.quota.maxConcurrentExecutions);
  const queuePressure = metrics.queueDepth / Math.max(1, governance.quota.maxQueuedJobs);
  const failurePressure = Math.max(metrics.errorRate, metrics.retryRate);
  return Math.max(0, Math.min(1, 1 - (concurrencyPressure * 0.4 + queuePressure * 0.3 + failurePressure * 0.3)));
}

export function decideTenantFairness(metrics: TenantWorkloadMetrics, governance: TenantResourceGovernance): TenantFairnessDecision {
  const fairnessScore = calculateTenantFairnessScore(metrics, governance);
  if (fairnessScore < 0.25) {
    return {
      siteId: governance.tenant.siteId,
      action: governance.noisyNeighborProtection ? 'isolate' : 'throttle',
      fairnessScore,
      reason: 'tenant workload threatens shared runtime fairness',
    };
  }

  if (fairnessScore < 0.6) {
    return {
      siteId: governance.tenant.siteId,
      action: 'rebalance',
      fairnessScore,
      reason: 'tenant workload should be rebalanced across partitions',
    };
  }

  return {
    siteId: governance.tenant.siteId,
    action: 'allow',
    fairnessScore,
    reason: 'tenant workload is fair',
  };
}

export class TenantOperationsRuntime {
  constructor(
    private readonly operations: TenantOperationsPort,
    private readonly routingPolicy: TenantWorkloadRouterPolicy,
  ) {}

  async admit(governance: TenantResourceGovernance): Promise<TenantExecutionAdmission> {
    const metrics = await this.operations.loadMetrics(governance.tenant.siteId);
    return routeTenantWorkload(governance, metrics, this.routingPolicy);
  }

  async project(governance: TenantResourceGovernance): Promise<TenantOperationalProjection> {
    const metrics = await this.operations.loadMetrics(governance.tenant.siteId);
    const fairness = decideTenantFairness(metrics, governance);
    const projection: TenantOperationalProjection = {
      tenant: governance.tenant,
      queueDepth: metrics.queueDepth,
      runningExecutions: metrics.runningExecutions,
      throttledExecutions: fairness.action === 'throttle' || fairness.action === 'isolate' ? 1 : 0,
      deadLetteredExecutions: 0,
      p95LatencyMs: metrics.p95LatencyMs,
      fairnessScore: fairness.fairnessScore,
      projectedAt: new Date().toISOString(),
    };
    await this.operations.persistProjection(projection);
    return projection;
  }
}
