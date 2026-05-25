import { planCacheInvalidation, type CacheInvalidationPlan, type DistributedEventEnvelope } from '@letbuyy/distributed-runtime';
import type { ProjectionIdentity, ProjectionStorePort } from './projection-store';

export interface ProjectionInvalidationRule {
  projectionName: string;
  eventTypes: string[];
  tags: string[];
  objectType?: string;
  replayAware: boolean;
}

export interface ProjectionInvalidationPlan {
  identities: ProjectionIdentity[];
  cacheInvalidation: CacheInvalidationPlan;
  reason: string;
}

export function eventMatchesProjectionInvalidation(eventType: string, rule: ProjectionInvalidationRule): boolean {
  return rule.eventTypes.some((candidate) => {
    if (candidate === '*') return true;
    if (candidate === eventType) return true;
    if (candidate.endsWith('.*')) return eventType.startsWith(candidate.slice(0, -1));
    return false;
  });
}

export function planProjectionInvalidation(
  event: DistributedEventEnvelope,
  rules: ProjectionInvalidationRule[],
): ProjectionInvalidationPlan[] {
  return rules
    .filter((rule) => eventMatchesProjectionInvalidation(event.event_type, rule))
    .map((rule) => {
      const identity: ProjectionIdentity = {
        projectionName: rule.projectionName,
        projectionVersion: event.schema_version,
        tenant: event.site_id ? { siteId: event.site_id, tenantPartitionKey: event.site_id } : null,
        objectType: rule.objectType || event.aggregate_type || 'event',
        objectId: event.aggregate_id || event.event_id,
      };

      return {
        identities: [identity],
        cacheInvalidation: planCacheInvalidation({
          cacheName: rule.projectionName,
          tenant: identity.tenant,
          sourceEventId: event.event_id,
          tags: rule.tags,
          replayAware: rule.replayAware,
          reason: `projection invalidated by ${event.event_type}`,
        }),
        reason: `projection invalidated by ${event.event_type}`,
      };
    });
}

export class ProjectionInvalidationRuntime<TReadModel = Record<string, unknown>> {
  constructor(private readonly store: ProjectionStorePort<TReadModel>) {}

  async invalidate(plan: ProjectionInvalidationPlan): Promise<void> {
    for (const identity of plan.identities) {
      await this.store.markStale(identity, plan.reason);
    }
  }
}
