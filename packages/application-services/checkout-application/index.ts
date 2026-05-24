import type { CreateCheckoutOrderCommand, Order, OrderPayment, RefundOrderCommand } from '@letbuyy/checkout-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';

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
