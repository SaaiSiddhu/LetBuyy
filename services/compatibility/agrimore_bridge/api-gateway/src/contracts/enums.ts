// GENERATED CODE - DO NOT EDIT BY HAND.
// Run `dart run scripts/gen_contracts.dart`.

export const USER_ROLE = [
  'customer',
  'rider',
  'store_operator',
  'seller',
  'admin',
  'super_admin',
] as const;

export type UserRole = typeof USER_ROLE[number];

export function parseUserRole(value: unknown): UserRole {
  if (typeof value === 'string' && (USER_ROLE as readonly string[]).includes(value)) {
    return value as UserRole;
  }
  throw new Error(`Unknown UserRole value: ${String(value)}`);
}

export const ORDER_STATUS = [
  'draft',
  'quote_created',
  'payment_pending',
  'confirmed',
  'picking',
  'packing',
  'ready_for_pickup',
  'rider_assigned',
  'picked_up',
  'arriving',
  'delivered',
  'cancelled',
  'failed',
  'returned',
  'refunded',
] as const;

export type OrderStatus = typeof ORDER_STATUS[number];

export function parseOrderStatus(value: unknown): OrderStatus {
  if (typeof value === 'string' && (ORDER_STATUS as readonly string[]).includes(value)) {
    return value as OrderStatus;
  }
  throw new Error(`Unknown OrderStatus value: ${String(value)}`);
}

export const PAYMENT_STATUS = [
  'pending',
  'authorized',
  'captured',
  'failed',
  'refunded',
  'partially_refunded',
] as const;

export type PaymentStatus = typeof PAYMENT_STATUS[number];

export function parsePaymentStatus(value: unknown): PaymentStatus {
  if (typeof value === 'string' && (PAYMENT_STATUS as readonly string[]).includes(value)) {
    return value as PaymentStatus;
  }
  throw new Error(`Unknown PaymentStatus value: ${String(value)}`);
}

export const RIDER_STATUS = [
  'offline',
  'available',
  'assigned',
  'on_trip',
  'paused',
  'blocked',
] as const;

export type RiderStatus = typeof RIDER_STATUS[number];

export function parseRiderStatus(value: unknown): RiderStatus {
  if (typeof value === 'string' && (RIDER_STATUS as readonly string[]).includes(value)) {
    return value as RiderStatus;
  }
  throw new Error(`Unknown RiderStatus value: ${String(value)}`);
}

export const DELIVERY_STATUS = [
  'pending_assignment',
  'assigned',
  'accepted',
  'rejected',
  'arriving_at_store',
  'picked_up',
  'arriving_at_customer',
  'delivered',
  'failed',
  'returned',
] as const;

export type DeliveryStatus = typeof DELIVERY_STATUS[number];

export function parseDeliveryStatus(value: unknown): DeliveryStatus {
  if (typeof value === 'string' && (DELIVERY_STATUS as readonly string[]).includes(value)) {
    return value as DeliveryStatus;
  }
  throw new Error(`Unknown DeliveryStatus value: ${String(value)}`);
}
