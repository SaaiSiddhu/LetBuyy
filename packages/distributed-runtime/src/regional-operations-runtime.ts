import type { RuntimeTenantScope } from './event-envelope-runtime';
import type { RegionDescriptor, ReplicationContract, TenantRegionAffinity } from './global-execution-runtime';
import { routeGlobalExecution } from './global-execution-runtime';

export interface RegionalExecutionDiagnostic {
  region: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  acceptsReads: boolean;
  acceptsWrites: boolean;
  queueLagMs: number;
  replicationLagMs: number;
  reason: string;
}

export interface RegionalFailoverPlan {
  siteId?: string | null;
  fromRegion: string;
  toRegion: string;
  mode: 'read' | 'write' | 'replay';
  replayRequired: boolean;
  reason: string;
}

export function diagnoseRegion(input: RegionDescriptor & { queueLagMs: number; replicationLagMs: number }): RegionalExecutionDiagnostic {
  const status =
    !input.healthy
      ? 'unavailable'
      : input.queueLagMs > 300_000 || input.replicationLagMs > 300_000
        ? 'degraded'
        : 'healthy';

  return {
    region: input.region,
    status,
    acceptsReads: input.acceptsReads,
    acceptsWrites: input.acceptsWrites,
    queueLagMs: input.queueLagMs,
    replicationLagMs: input.replicationLagMs,
    reason: status === 'healthy' ? 'region is within operational thresholds' : 'region health or lag threshold exceeded',
  };
}

export function planRegionalFailover(input: {
  tenant?: RuntimeTenantScope | null;
  affinity?: TenantRegionAffinity | null;
  regions: RegionDescriptor[];
  mode: 'read' | 'write' | 'replay';
  replication?: ReplicationContract | null;
}): RegionalFailoverPlan {
  const route = routeGlobalExecution(input);
  return {
    siteId: input.tenant?.siteId || null,
    fromRegion: input.affinity?.primaryRegion || route.region,
    toRegion: route.region,
    mode: input.mode,
    replayRequired: route.failover && Boolean(input.replication?.replayRequiredOnFailover),
    reason: route.reason,
  };
}

export class RegionalOperationsRuntime {
  route(input: {
    tenant?: RuntimeTenantScope | null;
    affinity?: TenantRegionAffinity | null;
    regions: RegionDescriptor[];
    mode: 'read' | 'write' | 'replay';
  }) {
    return routeGlobalExecution(input);
  }

  failoverPlan(input: {
    tenant?: RuntimeTenantScope | null;
    affinity?: TenantRegionAffinity | null;
    regions: RegionDescriptor[];
    mode: 'read' | 'write' | 'replay';
    replication?: ReplicationContract | null;
  }): RegionalFailoverPlan {
    return planRegionalFailover(input);
  }
}
