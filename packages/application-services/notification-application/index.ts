import type { NotificationDispatchInput, NotificationTemplate } from '@letbuyy/notification-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';
import { defineExecutionPipelines } from '../src/execution-pipeline';
export { isValidWebhookTarget } from '@letbuyy/notification-core';
export {
  RUNTIME_QUEUE_NAMES as PLATFORM_QUEUE_NAMES,
  buildDomainEventEnvelope,
  eventMatchesSubscription,
  eventRetryDelaySeconds,
  queueNamesForEvent,
} from '@letbuyy/orchestration';
export type {
  DomainEventEnvelopeInput,
  RuntimeQueueName as PlatformQueueName,
} from '@letbuyy/orchestration';

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
