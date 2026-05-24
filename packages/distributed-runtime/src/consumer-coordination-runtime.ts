export type ConsumerStatus = 'starting' | 'active' | 'draining' | 'stalled' | 'stopped';

export interface ConsumerRegistration {
  consumerId: string;
  queueName: string;
  workerRuntime: string;
  partitionIndexes: number[];
  status: ConsumerStatus;
  heartbeatAt: string;
  metadata: Record<string, unknown>;
}

export interface ConsumerCoordinationPort {
  register(consumer: ConsumerRegistration): Promise<void>;
  heartbeat(consumerId: string, heartbeatAt: string): Promise<void>;
  rebalance(queueName: string): Promise<ConsumerRegistration[]>;
  stop(consumerId: string, reason: string): Promise<void>;
}

export function isConsumerStalled(consumer: ConsumerRegistration, now = new Date(), timeoutSeconds = 90): boolean {
  return now.getTime() - new Date(consumer.heartbeatAt).getTime() > timeoutSeconds * 1000;
}

export class ConsumerCoordinationRuntime {
  constructor(private readonly coordination: ConsumerCoordinationPort) {}

  async register(input: Omit<ConsumerRegistration, 'heartbeatAt' | 'status'>): Promise<ConsumerRegistration> {
    const consumer: ConsumerRegistration = {
      ...input,
      status: 'active',
      heartbeatAt: new Date().toISOString(),
    };
    await this.coordination.register(consumer);
    return consumer;
  }

  heartbeat(consumerId: string): Promise<void> {
    return this.coordination.heartbeat(consumerId, new Date().toISOString());
  }
}
