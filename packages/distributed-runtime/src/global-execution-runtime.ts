import type { RuntimeTenantScope } from './event-envelope-runtime';

export interface RegionDescriptor {
  region: string;
  priority: number;
  acceptsWrites: boolean;
  acceptsReads: boolean;
  healthy: boolean;
}

export interface TenantRegionAffinity {
  siteId: string;
  primaryRegion: string;
  replicaRegions: string[];
  failoverRegion?: string | null;
}

export interface GlobalExecutionRoute {
  region: string;
  reason: string;
  failover: boolean;
  locality: 'tenant-primary' | 'tenant-replica' | 'global-default';
}

export interface ReplicationContract {
  streamName: string;
  sourceRegion: string;
  targetRegions: string[];
  maxLagMs: number;
  replayRequiredOnFailover: boolean;
}

export function routeGlobalExecution(input: {
  tenant?: RuntimeTenantScope | null;
  affinity?: TenantRegionAffinity | null;
  regions: RegionDescriptor[];
  mode: 'read' | 'write' | 'replay';
}): GlobalExecutionRoute {
  const eligible = input.regions
    .filter((region) => region.healthy)
    .filter((region) => input.mode === 'read' ? region.acceptsReads : region.acceptsWrites)
    .sort((left, right) => left.priority - right.priority);

  const primary = input.affinity
    ? eligible.find((region) => region.region === input.affinity?.primaryRegion)
    : undefined;
  if (primary) {
    return {
      region: primary.region,
      reason: 'tenant primary region is healthy',
      failover: false,
      locality: 'tenant-primary',
    };
  }

  const replica = input.affinity
    ? eligible.find((region) => input.affinity?.replicaRegions.includes(region.region))
    : undefined;
  if (replica) {
    return {
      region: replica.region,
      reason: 'tenant primary unavailable; routing to replica',
      failover: true,
      locality: 'tenant-replica',
    };
  }

  const fallback = eligible[0];
  if (!fallback) throw new Error(`No healthy region accepts ${input.mode} execution`);

  return {
    region: fallback.region,
    reason: 'using global fallback region',
    failover: Boolean(input.tenant?.siteId),
    locality: 'global-default',
  };
}
