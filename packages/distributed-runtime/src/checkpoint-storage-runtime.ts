import type { RuntimeCorrelationContext } from './event-envelope-runtime';

export type RuntimeCheckpointKind = 'event-replay' | 'queue-consumer' | 'workflow' | 'projection' | 'provider-call';

export interface RuntimeCheckpoint<TState = Record<string, unknown>> {
  checkpointId: string;
  ownerRuntime: string;
  kind: RuntimeCheckpointKind;
  executionId: string;
  stepName?: string | null;
  state: TState;
  cursor?: Record<string, unknown>;
  attempt: number;
  fencingToken?: string | null;
  correlation: RuntimeCorrelationContext;
  recordedAt: string;
}

export interface CheckpointStoragePort<TState = Record<string, unknown>> {
  persist(checkpoint: RuntimeCheckpoint<TState>): Promise<void>;
  latest(executionId: string, kind?: RuntimeCheckpointKind): Promise<RuntimeCheckpoint<TState> | null>;
  listByOwner(ownerRuntime: string, limit: number): Promise<Array<RuntimeCheckpoint<TState>>>;
}

export class CheckpointStorageRuntime<TState = Record<string, unknown>> {
  constructor(private readonly store: CheckpointStoragePort<TState>) {}

  async record(input: Omit<RuntimeCheckpoint<TState>, 'recordedAt'>): Promise<RuntimeCheckpoint<TState>> {
    const checkpoint: RuntimeCheckpoint<TState> = {
      ...input,
      recordedAt: new Date().toISOString(),
    };
    await this.store.persist(checkpoint);
    return checkpoint;
  }

  latest(executionId: string, kind?: RuntimeCheckpointKind): Promise<RuntimeCheckpoint<TState> | null> {
    return this.store.latest(executionId, kind);
  }
}
