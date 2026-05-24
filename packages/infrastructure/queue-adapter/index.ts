export interface QueueMessage<TPayload = Record<string, unknown>> {
  id: string;
  queueName: string;
  payload: TPayload;
  attempts: number;
  availableAt?: string;
  correlationId?: string;
}

export interface QueueAdapterPort {
  enqueue<TPayload = Record<string, unknown>>(message: QueueMessage<TPayload>): Promise<void>;
  acknowledge(messageId: string): Promise<void>;
  deadLetter(messageId: string, reason: string): Promise<void>;
}
