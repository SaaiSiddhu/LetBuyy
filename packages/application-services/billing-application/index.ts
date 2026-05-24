import type { CreateSubscriptionInput, InvoiceDto, SubscriptionContract } from '@letbuyy/billing-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';

export interface BillingApplicationPorts {
  createSubscription(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; input: CreateSubscriptionInput }>): Promise<SubscriptionContract>;
  recordInvoice(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; invoice: InvoiceDto }>): Promise<void>;
  reconcileProviderPayment(command: CorrelatedCommand<{ provider: string; providerEventId: string }>): Promise<void>;
}

export interface BillingExecutionPolicy {
  providerEventsAreIdempotent: true;
  invoicesAreImmutable: true;
  entitlementsRefreshAfterPayment: true;
}

export const BILLING_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
  resolveEntitlements: {
    name: 'billing.resolve-entitlements',
    owner: 'billing-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: false,
    emitsEvents: false,
    coordinatesDomains: ['billing', 'tenant'],
  },
  recordUsage: {
    name: 'billing.record-usage',
    owner: 'billing-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['billing', 'event'],
  },
});
