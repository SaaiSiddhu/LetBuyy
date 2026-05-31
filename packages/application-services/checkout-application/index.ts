import type { CreateCheckoutOrderCommand, Order, OrderPayment, RefundOrderCommand } from '@letbuyy/checkout-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';
import { defineExecutionPipelines } from '../src/execution-pipeline';
export { planOrderStatusTransition, type OrderStatusTransitionPlan } from '@letbuyy/checkout-core';

export interface CheckoutApplicationPorts {
  createOrder(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; input: CreateCheckoutOrderCommand }>): Promise<Order>;
  priceCheckout(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; input: CreateCheckoutOrderCommand }>): Promise<{ subtotal: number; shipping: number; tax: number; discounts: number; total: number; currency: string }>;
  attachPayment(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; orderId: string; payment: OrderPayment }>): Promise<void>;
  refundOrder(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; orderId: string; input: RefundOrderCommand }>): Promise<void>;
}

export interface CheckoutExecutionPolicy {
  serverSidePricingRequired: true;
  idempotencyRequired: true;
  inventoryReservationRequired: boolean;
  providerSignatureRequired: true;
}

export const CHECKOUT_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
  createCheckoutOrder: {
    name: 'checkout.create-order',
    owner: 'checkout-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['checkout', 'commerce', 'billing'],
  },
  transitionOrderStatus: {
    name: 'checkout.transition-order-status',
    owner: 'checkout-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['checkout', 'commerce'],
  },
  attachPaymentReference: {
    name: 'checkout.attach-payment-reference',
    owner: 'checkout-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['checkout', 'billing'],
  },
  confirmPayment: {
    name: 'checkout.confirm-payment',
    owner: 'checkout-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['checkout', 'billing', 'commerce'],
  },
  refundOrder: {
    name: 'checkout.refund-order',
    owner: 'checkout-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['checkout', 'billing', 'commerce'],
  },
});

export const CHECKOUT_EXECUTION_PIPELINES = defineExecutionPipelines({
  createCheckoutOrder: {
    workflow: CHECKOUT_APPLICATION_WORKFLOWS.createCheckoutOrder,
    executionBoundary: 'application-service',
    transactionBoundary: 'database-rpc',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'audit-required',
    steps: [
      { name: 'assert-order-quota', stage: 'authorize', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'create-checkout-order-rpc', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
      { name: 'record-usage-meter', stage: 'audit', ownsTransaction: false, emitsEvent: false, requiresIdempotency: true },
    ],
  },
  transitionOrderStatus: {
    workflow: CHECKOUT_APPLICATION_WORKFLOWS.transitionOrderStatus,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'audit-required',
    steps: [
      { name: 'load-owned-order', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'resolve-status-transition', stage: 'plan', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'apply-status-transition', stage: 'mutate', ownsTransaction: false, emitsEvent: true, requiresIdempotency: true },
    ],
  },
  attachPaymentReference: {
    workflow: CHECKOUT_APPLICATION_WORKFLOWS.attachPaymentReference,
    executionBoundary: 'application-service',
    transactionBoundary: 'database-rpc',
    retryBoundary: 'provider-adapter',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'trace-required',
    steps: [
      { name: 'load-payable-order', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'attach-provider-reference', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
    ],
  },
  confirmPayment: {
    workflow: CHECKOUT_APPLICATION_WORKFLOWS.confirmPayment,
    executionBoundary: 'application-service',
    transactionBoundary: 'database-rpc',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'audit-required',
    steps: [
      { name: 'verify-provider-result', stage: 'validate', ownsTransaction: false, emitsEvent: false, requiresIdempotency: true },
      { name: 'confirm-payment-ledger', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
      { name: 'release-dependent-events', stage: 'publish', ownsTransaction: false, emitsEvent: true, requiresIdempotency: true },
    ],
  },
  refundOrder: {
    workflow: CHECKOUT_APPLICATION_WORKFLOWS.refundOrder,
    executionBoundary: 'application-service',
    transactionBoundary: 'database-rpc',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'audit-required',
    steps: [
      { name: 'create-refund-ledger', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
      { name: 'complete-provider-refund', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
    ],
  },
});
