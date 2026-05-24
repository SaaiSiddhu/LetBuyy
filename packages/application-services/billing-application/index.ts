import type { CreateSubscriptionInput, InvoiceDto, SubscriptionContract } from '@letbuyy/billing-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';

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
