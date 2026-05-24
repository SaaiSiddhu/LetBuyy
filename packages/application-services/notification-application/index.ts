import type { NotificationDispatchInput, NotificationTemplate } from '@letbuyy/notification-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';

export interface NotificationApplicationPorts {
  dispatch(command: CorrelatedCommand<{ tenant?: RuntimeTenantContext; input: NotificationDispatchInput }>): Promise<{ providerMessageId?: string; status: 'queued' | 'sent' | 'skipped' }>;
  renderTemplate(command: CorrelatedCommand<{ template: NotificationTemplate; data: Record<string, unknown> }>): Promise<{ subject?: string; html?: string; text?: string }>;
}

export interface NotificationExecutionPolicy {
  honorTenantPreferences: true;
  redactSecretsInPayloads: true;
  retainProviderReferences: true;
}
