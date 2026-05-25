import type { CreateSubscriptionInput, InvoiceDto, SubscriptionContract } from '@letbuyy/billing-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';
import { defineExecutionPipelines } from '../src/execution-pipeline';

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

export const BILLING_EXECUTION_PIPELINES = defineExecutionPipelines({
  resolveEntitlements: {
    workflow: BILLING_APPLICATION_WORKFLOWS.resolveEntitlements,
    executionBoundary: 'application-service',
    transactionBoundary: 'database-rpc',
    retryBoundary: 'none',
    asyncBoundary: 'inline',
    observabilityBoundary: 'correlation-required',
    steps: [
      { name: 'load-site-entitlements', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'normalize-entitlement-snapshot', stage: 'complete', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
    ],
  },
  recordUsage: {
    workflow: BILLING_APPLICATION_WORKFLOWS.recordUsage,
    executionBoundary: 'application-service',
    transactionBoundary: 'database-rpc',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'audit-required',
    steps: [
      { name: 'normalize-usage-meter', stage: 'validate', ownsTransaction: false, emitsEvent: false, requiresIdempotency: true },
      { name: 'record-usage-ledger', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
    ],
  },
});

export function normalizeBillingStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function normalizeBillingObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
