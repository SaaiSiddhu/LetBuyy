import type { DistributedEventEnvelope } from './event-envelope-runtime';

export interface EventVersionDescriptor {
  eventType: string;
  version: number;
  ownerPackage: string;
  introducedAt: string;
  deprecatedAt?: string | null;
  compatibleWith: number[];
  replaySafe: boolean;
  migrationRequiredFrom: number[];
}

export interface EventVersionResolution {
  status: 'current' | 'compatible' | 'requires-migration' | 'unsupported';
  descriptor?: EventVersionDescriptor;
  reason: string;
}

export interface EventVersionRegistryPort {
  descriptors(eventType: string): Promise<EventVersionDescriptor[]>;
}

export function resolveEventVersion(
  descriptors: EventVersionDescriptor[],
  eventType: string,
  version: number,
): EventVersionResolution {
  const sorted = descriptors
    .filter((descriptor) => descriptor.eventType === eventType)
    .sort((left, right) => right.version - left.version);
  const current = sorted[0];
  const exact = sorted.find((descriptor) => descriptor.version === version);

  if (!current) {
    return { status: 'unsupported', reason: `No event version registered for ${eventType}` };
  }

  if (current.version === version) {
    return { status: 'current', descriptor: current, reason: 'event version is current' };
  }

  if (exact?.compatibleWith.includes(current.version) || current.compatibleWith.includes(version)) {
    return { status: 'compatible', descriptor: exact || current, reason: 'event version is compatible with current consumer' };
  }

  if (current.migrationRequiredFrom.includes(version)) {
    return { status: 'requires-migration', descriptor: current, reason: 'event payload migration is required before replay' };
  }

  return { status: 'unsupported', descriptor: exact || current, reason: 'event version is not supported by this runtime' };
}

export async function resolveEnvelopeVersion(
  registry: EventVersionRegistryPort,
  envelope: DistributedEventEnvelope,
): Promise<EventVersionResolution> {
  return resolveEventVersion(
    await registry.descriptors(envelope.event_type),
    envelope.event_type,
    envelope.schema_version,
  );
}

export function assertReplayVersionAllowed(resolution: EventVersionResolution): void {
  if (resolution.status === 'unsupported' || resolution.status === 'requires-migration') {
    throw new Error(`Event replay blocked: ${resolution.reason}`);
  }

  if (resolution.descriptor && resolution.descriptor.replaySafe !== true) {
    throw new Error(`Event replay blocked: ${resolution.descriptor.eventType} v${resolution.descriptor.version} is not marked replay-safe`);
  }
}
