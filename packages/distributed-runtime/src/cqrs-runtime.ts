import type { RuntimeCorrelationContext, RuntimeTenantScope } from './event-envelope-runtime';

export interface CommandConsistencyContract {
  commandAuthority: 'application-services';
  eventPersistenceAuthority: 'distributed-runtime';
  idempotencyRequired: boolean;
  emitsEvents: boolean;
}

export interface QueryConsistencyContract {
  queryAuthority: 'runtime-composition' | 'projection-runtime';
  readModelVersion: number;
  consistency: 'strong' | 'read-your-writes' | 'eventual';
  stalenessBudgetMs: number;
}

export interface DistributedCommandEnvelope<TPayload = Record<string, unknown>> {
  commandId: string;
  commandName: string;
  payload: TPayload;
  tenant?: RuntimeTenantScope | null;
  idempotencyKey: string;
  correlation: RuntimeCorrelationContext;
  consistency: CommandConsistencyContract;
  submittedAt: string;
}

export interface DistributedQueryEnvelope<TParams = Record<string, unknown>> {
  queryId: string;
  queryName: string;
  params: TParams;
  tenant?: RuntimeTenantScope | null;
  correlation: RuntimeCorrelationContext;
  consistency: QueryConsistencyContract;
  submittedAt: string;
}

export interface CommandExecutionReceipt {
  commandId: string;
  status: 'accepted' | 'completed' | 'rejected';
  eventIds: string[];
  checkpointId?: string | null;
  completedAt?: string | null;
  reason?: string;
}

export interface CommandJournalRecord<TPayload = Record<string, unknown>> {
  command: DistributedCommandEnvelope<TPayload>;
  status: CommandExecutionReceipt['status'];
  eventIds: string[];
  checkpointId?: string | null;
  recordedAt: string;
}

export interface QueryExecutionReceipt<TReadModel = Record<string, unknown>> {
  queryId: string;
  status: 'served' | 'stale' | 'rejected';
  readModel: TReadModel;
  readModelVersion: number;
  consistency: QueryConsistencyContract;
  servedAt: string;
}

export interface CommandHandlerPort<TPayload = Record<string, unknown>> {
  execute(command: DistributedCommandEnvelope<TPayload>): Promise<CommandExecutionReceipt>;
}

export interface CommandJournalPort<TPayload = Record<string, unknown>> {
  loadByIdempotencyKey(idempotencyKey: string): Promise<CommandJournalRecord<TPayload> | null>;
  persist(record: CommandJournalRecord<TPayload>): Promise<void>;
}

export interface QueryHandlerPort<TParams = Record<string, unknown>, TReadModel = Record<string, unknown>> {
  execute(query: DistributedQueryEnvelope<TParams>): Promise<QueryExecutionReceipt<TReadModel>>;
}

export function commandRequiresDurability(command: DistributedCommandEnvelope): boolean {
  return command.consistency.idempotencyRequired || command.consistency.emitsEvents;
}

export function queryIsWithinStalenessBudget(lastUpdatedAt: string, contract: QueryConsistencyContract, now = Date.now()): boolean {
  if (contract.consistency === 'strong') return true;
  return now - new Date(lastUpdatedAt).getTime() <= contract.stalenessBudgetMs;
}

export class CommandRuntime<TPayload = Record<string, unknown>> {
  constructor(
    private readonly handler: CommandHandlerPort<TPayload>,
    private readonly journal?: CommandJournalPort<TPayload>,
  ) {}

  async execute(command: DistributedCommandEnvelope<TPayload>): Promise<CommandExecutionReceipt> {
    if (!command.idempotencyKey && command.consistency.idempotencyRequired) {
      throw new Error(`Command ${command.commandName} requires an idempotency key`);
    }

    if (this.journal) {
      const existing = await this.journal.loadByIdempotencyKey(command.idempotencyKey);
      if (existing) {
        return {
          commandId: existing.command.commandId,
          status: existing.status,
          eventIds: existing.eventIds,
          checkpointId: existing.checkpointId,
          completedAt: existing.recordedAt,
        };
      }
    }

    const receipt = await this.handler.execute(command);
    await this.journal?.persist({
      command,
      status: receipt.status,
      eventIds: receipt.eventIds,
      checkpointId: receipt.checkpointId,
      recordedAt: receipt.completedAt || new Date().toISOString(),
    });
    return receipt;
  }
}

export class QueryRuntime<TParams = Record<string, unknown>, TReadModel = Record<string, unknown>> {
  constructor(private readonly handler: QueryHandlerPort<TParams, TReadModel>) {}

  execute(query: DistributedQueryEnvelope<TParams>): Promise<QueryExecutionReceipt<TReadModel>> {
    return this.handler.execute(query);
  }
}
