import { replayPayloadChecksum } from './event-envelope-runtime';

export interface QueueConvergenceEventPosition {
  eventId: string;
  idempotencyKey: string;
  streamName: string;
  globalPosition: number;
  checksum: string;
}

export interface QueueProcessingCheckpoint {
  queueName: string;
  eventId: string;
  delivered: boolean;
  attempts: number;
  checkpointChecksum: string;
}

export interface ProjectionConvergenceCheckpoint {
  projectionName: string;
  eventId: string;
  sourceGlobalPosition: number;
  integrityHash: string;
}

export interface QueueConvergencePlan {
  status: 'converged' | 'requires-redrive' | 'requires-projection-rebuild' | 'blocked';
  queueHash: string;
  projectionHash: string;
  eventStoreHash: string;
  actions: Array<'redrive-undelivered' | 'rebuild-stale-projection' | 'block-missing-idempotency'>;
}

export function planQueueConvergence(input: {
  eventStore: QueueConvergenceEventPosition[];
  queueCheckpoints: QueueProcessingCheckpoint[];
  projections: ProjectionConvergenceCheckpoint[];
}): QueueConvergencePlan {
  const orderedEvents = [...input.eventStore].sort((left, right) => left.globalPosition - right.globalPosition || left.eventId.localeCompare(right.eventId));
  const orderedQueues = [...input.queueCheckpoints].sort((left, right) => left.queueName.localeCompare(right.queueName) || left.eventId.localeCompare(right.eventId));
  const orderedProjections = [...input.projections].sort((left, right) => left.projectionName.localeCompare(right.projectionName) || left.eventId.localeCompare(right.eventId));

  const actions = new Set<QueueConvergencePlan['actions'][number]>();
  const deliveredEvents = new Set(orderedQueues.filter((checkpoint) => checkpoint.delivered).map((checkpoint) => checkpoint.eventId));
  const projectedEvents = new Set(orderedProjections.map((projection) => projection.eventId));

  for (const event of orderedEvents) {
    if (!event.idempotencyKey) actions.add('block-missing-idempotency');
    if (!deliveredEvents.has(event.eventId)) actions.add('redrive-undelivered');
    if (!projectedEvents.has(event.eventId)) actions.add('rebuild-stale-projection');
  }

  const eventStoreHash = replayPayloadChecksum(orderedEvents.map((event) => event.checksum));
  const queueHash = replayPayloadChecksum(orderedQueues.map((checkpoint) => checkpoint.checkpointChecksum));
  const projectionHash = replayPayloadChecksum(orderedProjections.map((projection) => projection.integrityHash));

  let status: QueueConvergencePlan['status'] = 'converged';
  if (actions.has('block-missing-idempotency')) status = 'blocked';
  else if (actions.has('redrive-undelivered')) status = 'requires-redrive';
  else if (actions.has('rebuild-stale-projection')) status = 'requires-projection-rebuild';

  return {
    status,
    queueHash,
    projectionHash,
    eventStoreHash,
    actions: [...actions].sort(),
  };
}

export function assertQueueConvergence(plan: QueueConvergencePlan): void {
  if (plan.status === 'blocked') {
    throw new Error('Queue convergence blocked by missing idempotency proof');
  }
  if (!plan.queueHash || !plan.projectionHash || !plan.eventStoreHash) {
    throw new Error('Queue convergence requires queue, projection, and event-store hashes');
  }
}
