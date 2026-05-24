import type { CreateCheckoutOrderCommand, Order, OrderPayment, RefundOrderCommand } from '@letbuyy/checkout-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';

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
