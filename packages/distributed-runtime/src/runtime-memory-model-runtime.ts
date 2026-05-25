import { replayPayloadChecksum } from './event-envelope-runtime';

export type RuntimeMemoryClass =
  | 'durable-state'
  | 'ephemeral-state'
  | 'replay-owned-state'
  | 'projection-owned-state'
  | 'queue-owned-state'
  | 'orchestration-owned-state'
  | 'reconciliation-owned-state';

export interface RuntimeMemoryOwnership {
  memoryClass: RuntimeMemoryClass;
  owner: string;
  resources: string[];
  lifecycle: 'append-only' | 'rebuildable' | 'derived' | 'ephemeral' | 'checkpointed';
}

export interface RuntimeMemoryModel {
  ownership: RuntimeMemoryOwnership[];
  memoryChecksum: string;
}

export function compileRuntimeMemoryModel(ownership: RuntimeMemoryOwnership[]): RuntimeMemoryModel {
  const ordered = ownership
    .map((item) => ({
      ...item,
      resources: [...item.resources].sort(),
    }))
    .sort((left, right) => {
      const classDiff = left.memoryClass.localeCompare(right.memoryClass);
      if (classDiff !== 0) return classDiff;
      return left.owner.localeCompare(right.owner);
    });
  return {
    ownership: ordered,
    memoryChecksum: replayPayloadChecksum(ordered),
  };
}

export function assertRuntimeMemoryModel(model: RuntimeMemoryModel): void {
  const resourceOwners = new Map<string, string>();
  for (const owner of model.ownership) {
    for (const resource of owner.resources) {
      const existing = resourceOwners.get(resource);
      if (existing && existing !== owner.owner) {
        throw new Error(`Runtime memory ownership overlap exists: ${resource}`);
      }
      resourceOwners.set(resource, owner.owner);
    }
    if (!owner.lifecycle) {
      throw new Error(`Runtime memory lifecycle ambiguous: ${owner.owner}`);
    }
  }
  for (const memoryClass of ['durable-state', 'ephemeral-state', 'replay-owned-state', 'projection-owned-state', 'queue-owned-state', 'orchestration-owned-state', 'reconciliation-owned-state'] as const) {
    if (!model.ownership.some((owner) => owner.memoryClass === memoryClass)) {
      throw new Error(`Runtime memory model missing class: ${memoryClass}`);
    }
  }
}
