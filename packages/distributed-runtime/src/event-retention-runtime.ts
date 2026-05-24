import type { DistributedEventEnvelope, EventRetentionClass } from './event-envelope-runtime';

export interface EventRetentionPolicy {
  retentionClass: EventRetentionClass;
  retainForDays: number | 'indefinite';
  allowReplay: boolean;
  allowCompaction: boolean;
  archiveAfterDays?: number;
}

export interface EventRetentionDecision {
  eventId: string;
  retentionClass: EventRetentionClass;
  action: 'retain-hot' | 'archive' | 'compact' | 'purge-blocked' | 'legal-hold';
  eligibleAt?: string;
  reason: string;
}

export const DEFAULT_EVENT_RETENTION_POLICIES: Record<EventRetentionClass, EventRetentionPolicy> = {
  hot: {
    retentionClass: 'hot',
    retainForDays: 30,
    allowReplay: true,
    allowCompaction: false,
    archiveAfterDays: 7,
  },
  warm: {
    retentionClass: 'warm',
    retainForDays: 365,
    allowReplay: true,
    allowCompaction: true,
    archiveAfterDays: 30,
  },
  archive: {
    retentionClass: 'archive',
    retainForDays: 'indefinite',
    allowReplay: true,
    allowCompaction: true,
  },
  'legal-hold': {
    retentionClass: 'legal-hold',
    retainForDays: 'indefinite',
    allowReplay: false,
    allowCompaction: false,
  },
};

export function retentionCutoffIso(occurredAt: string, days: number): string {
  return new Date(new Date(occurredAt).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function decideEventRetention(
  event: DistributedEventEnvelope,
  policy: EventRetentionPolicy = DEFAULT_EVENT_RETENTION_POLICIES[event.retention_class],
  now = new Date(),
): EventRetentionDecision {
  if (policy.retentionClass === 'legal-hold') {
    return {
      eventId: event.event_id,
      retentionClass: policy.retentionClass,
      action: 'legal-hold',
      reason: 'event is under legal hold',
    };
  }

  if (policy.archiveAfterDays !== undefined) {
    const archiveAt = new Date(retentionCutoffIso(event.occurred_at, policy.archiveAfterDays));
    if (now >= archiveAt) {
      return {
        eventId: event.event_id,
        retentionClass: policy.retentionClass,
        action: 'archive',
        eligibleAt: archiveAt.toISOString(),
        reason: 'event is eligible for archival storage',
      };
    }
  }

  if (policy.retainForDays !== 'indefinite') {
    const retainUntil = new Date(retentionCutoffIso(event.occurred_at, policy.retainForDays));
    if (now >= retainUntil && policy.allowCompaction) {
      return {
        eventId: event.event_id,
        retentionClass: policy.retentionClass,
        action: 'compact',
        eligibleAt: retainUntil.toISOString(),
        reason: 'event exceeded retention window and can be compacted',
      };
    }
  }

  return {
    eventId: event.event_id,
    retentionClass: policy.retentionClass,
    action: 'retain-hot',
    reason: 'event remains in active retention window',
  };
}
