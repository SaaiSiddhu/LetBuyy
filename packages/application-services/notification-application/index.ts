import type { NotificationDispatchInput, NotificationTemplate } from '@letbuyy/notification-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';
import { defineExecutionPipelines } from '../src/execution-pipeline';

export interface NotificationApplicationPorts {
  dispatch(command: CorrelatedCommand<{ tenant?: RuntimeTenantContext; input: NotificationDispatchInput }>): Promise<{ providerMessageId?: string; status: 'queued' | 'sent' | 'skipped' }>;
  renderTemplate(command: CorrelatedCommand<{ template: NotificationTemplate; data: Record<string, unknown> }>): Promise<{ subject?: string; html?: string; text?: string }>;
}

export interface NotificationExecutionPolicy {
  honorTenantPreferences: true;
  redactSecretsInPayloads: true;
  retainProviderReferences: true;
}

export const NOTIFICATION_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
  emitDomainEvent: {
    name: 'notification.emit-domain-event',
    owner: 'notification-application',
    version: '1.0.0',
    requiresTenantScope: false,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['event', 'notification'],
  },
  dispatchWebhook: {
    name: 'notification.dispatch-webhook',
    owner: 'notification-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['event', 'notification'],
  },
});

export const NOTIFICATION_EXECUTION_PIPELINES = defineExecutionPipelines({
  emitDomainEvent: {
    workflow: NOTIFICATION_APPLICATION_WORKFLOWS.emitDomainEvent,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'correlation-required',
    steps: [
      { name: 'normalize-event-envelope', stage: 'plan', ownsTransaction: false, emitsEvent: false, requiresIdempotency: true },
      { name: 'persist-outbox-event', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
      { name: 'publish-queue-fanout', stage: 'publish', ownsTransaction: false, emitsEvent: true, requiresIdempotency: true },
    ],
  },
  dispatchWebhook: {
    workflow: NOTIFICATION_APPLICATION_WORKFLOWS.dispatchWebhook,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'queue',
    observabilityBoundary: 'trace-required',
    steps: [
      { name: 'claim-webhook-delivery', stage: 'load', ownsTransaction: true, emitsEvent: false, requiresIdempotency: true },
      { name: 'send-signed-webhook', stage: 'publish', ownsTransaction: false, emitsEvent: true, requiresIdempotency: true },
      { name: 'record-delivery-outcome', stage: 'audit', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
    ],
  },
});

export const PLATFORM_QUEUE_NAMES = [
  'payment-events',
  'inventory-jobs',
  'webhook-deliveries',
  'analytics-events',
  'search-indexing',
  'fulfillment-jobs',
  'bulk-admin-jobs',
] as const;

export type PlatformQueueName = (typeof PLATFORM_QUEUE_NAMES)[number];

export interface DomainEventEnvelopeInput {
  event_id: string;
  event_type: string;
  site_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  created_at: string;
  request_id: string | null;
  trace_id: string | null;
  idempotency_key: string;
  schema_version: number;
  payload: Record<string, unknown>;
}

export function eventRetryDelaySeconds(attempt: number, baseSeconds = 30): number {
  const exponent = Math.max(0, Math.min(attempt - 1, 8));
  return Math.min(3600, baseSeconds * 2 ** exponent);
}

export function isValidWebhookTarget(targetUrl: string): boolean {
  try {
    const url = new URL(targetUrl);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function eventMatchesSubscription(eventType: string, eventTypes: string[]): boolean {
  return eventTypes.some((candidate) => {
    if (candidate === '*') return true;
    if (candidate === eventType) return true;
    if (!candidate.endsWith('.*')) return false;
    return eventType.startsWith(candidate.slice(0, -1));
  });
}

export function queueNamesForEvent(eventType: string): PlatformQueueName[] {
  const queues = new Set<PlatformQueueName>();

  if (eventType.startsWith('payment.') || eventType.startsWith('refund.')) queues.add('payment-events');
  if (eventType.startsWith('inventory.') || eventType.startsWith('po.') || eventType.startsWith('transfer.')) queues.add('inventory-jobs');
  if (eventType.startsWith('fulfillment.') || eventType.startsWith('shipment.') || eventType.startsWith('return.') || eventType.includes('.fulfillment.')) queues.add('fulfillment-jobs');
  if (eventType.startsWith('product.') || eventType.startsWith('collection.') || eventType.startsWith('category.') || eventType.startsWith('customer.') || eventType.startsWith('order.') || eventType.startsWith('theme.')) queues.add('search-indexing');

  queues.add('analytics-events');
  return [...queues];
}

export function buildDomainEventEnvelope(event: DomainEventEnvelopeInput): Record<string, unknown> {
  return {
    id: event.event_id,
    type: event.event_type,
    site_id: event.site_id,
    aggregate: {
      type: event.aggregate_type,
      id: event.aggregate_id,
    },
    occurred_at: event.created_at,
    request_id: event.request_id,
    trace_id: event.trace_id,
    idempotency_key: event.idempotency_key,
    schema_version: event.schema_version,
    payload: event.payload,
  };
}
