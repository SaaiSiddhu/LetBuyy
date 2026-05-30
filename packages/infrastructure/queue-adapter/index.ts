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

export interface CloudflareQueueSendOptions {
  contentType?: 'json' | 'text' | 'bytes' | 'v8';
  delaySeconds?: number;
}

export interface CloudflareQueueBinding<TPayload = unknown> {
  send(message: TPayload, options?: CloudflareQueueSendOptions): Promise<unknown>;
}

export interface CloudflareQueueProducerPort {
  enqueue<TPayload = Record<string, unknown>>(message: QueueMessage<TPayload>, options?: CloudflareQueueSendOptions): Promise<void>;
}

export function createCloudflareQueueProducer(
  binding: CloudflareQueueBinding<Record<string, unknown>>,
): CloudflareQueueProducerPort {
  return {
    enqueue<TPayload = Record<string, unknown>>(message: QueueMessage<TPayload>, options?: CloudflareQueueSendOptions) {
      return binding.send({
        messageId: message.id,
        queueName: message.queueName,
        payload: message.payload as Record<string, unknown>,
        attempts: message.attempts,
        availableAt: message.availableAt || null,
        correlationId: message.correlationId || null,
      }, options).then(() => undefined);
    },
  };
}
