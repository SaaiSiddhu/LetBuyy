import { z } from 'zod';
import {
  AddressSchema,
  EmailSchema,
  MoneySchema,
  PaginationQuery,
  UuidSchema,
} from '@letbuyy/shared-types';
import type { Address } from '@letbuyy/shared-types';
import type { ProductModel } from '@letbuyy/commerce-core';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'returned';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export const OrderItemInput = z.object({
  product_id: UuidSchema,
  variant_id: UuidSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999),
});

export const CreateOrderSchema = z.object({
  store_id: UuidSchema,
  idempotency_key: z.string().min(8).max(200),
  customer_email: EmailSchema,
  customer_name: z.string().min(1).max(200).trim(),
  customer_phone: z.string().max(20).optional(),
  shipping_address: AddressSchema.optional(),
  items: z.array(OrderItemInput).min(1).max(50),
  payment_method: z.enum(['razorpay', 'stripe', 'cod']).default('cod'),
  shipping_method: z.enum(['standard', 'express']).default('standard'),
  notes: z.string().max(1000).optional(),
  coupon_code: z.string().max(50).optional(),
  gift_card_code: z.string().min(6).max(100).optional(),
});

export const StorefrontCreateOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(1).max(200).trim(),
    email: EmailSchema,
    phone: z.string().max(20).optional(),
    address: z.object({
      address: z.string().min(1).max(500),
      city: z.string().min(1).max(100),
      state: z.string().min(1).max(100),
      pincode: z.string().min(3).max(20),
    }),
  }),
  items: z.array(z.object({
    productId: UuidSchema,
    variantId: UuidSchema.optional().nullable(),
    quantity: z.number().int().min(1).max(999),
  })).min(1).max(50),
  paymentMethod: z.enum(['razorpay', 'stripe', 'paypal', 'cod']).default('cod'),
  deliveryOption: z.enum(['standard', 'express']).default('standard'),
  notes: z.string().max(1000).optional(),
  couponCode: z.string().max(50).optional(),
  giftCardCode: z.string().min(6).max(100).optional(),
  idempotencyKey: z.string().min(8).max(200),
});

export const StorefrontRazorpayOrderSchema = z.object({
  orderId: UuidSchema,
  idempotencyKey: z.string().min(8).max(200),
  amount: MoneySchema.optional(),
  amountMinorUnits: z.number().int().positive().optional(),
});

export const StorefrontRazorpayVerifySchema = z.object({
  orderId: UuidSchema,
  razorpay_order_id: z.string().min(1).max(200),
  razorpay_payment_id: z.string().min(1).max(200),
  razorpay_signature: z.string().min(1).max(500),
  idempotencyKey: z.string().min(8).max(200),
});

export const StorefrontStripeCheckoutSchema = z.object({
  orderId: UuidSchema,
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  customerEmail: EmailSchema.optional(),
  idempotencyKey: z.string().min(8).max(200),
});

export const StorefrontPayPalOrderSchema = z.object({
  orderId: UuidSchema,
  returnUrl: z.string().url(),
  cancelUrl: z.string().url(),
  idempotencyKey: z.string().min(8).max(200),
});

export const StorefrontPayPalCaptureSchema = z.object({
  orderId: UuidSchema,
  paypalOrderId: z.string().min(1).max(200),
  idempotencyKey: z.string().min(8).max(200),
});

export const UpdateOrderStatusSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  status: z.enum([
    'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded',
  ]),
  tracking_number: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
  cancellation_reason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  version: z.number().int().positive('Version required for concurrent safety').optional(),
});

export const FulfillmentLineSchema = z.object({
  order_item_id: UuidSchema,
  quantity: z.number().int().min(1).max(999),
});

export const FulfillOrderSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  location_id: UuidSchema.optional().nullable(),
  lines: z.array(FulfillmentLineSchema).min(1).max(100).optional(),
  carrier: z.string().max(100).optional(),
  tracking_number: z.string().max(100).optional(),
  tracking_url: z.string().url().optional(),
});

export const RefundLineSchema = z.object({
  order_item_id: UuidSchema,
  quantity: z.number().int().min(1).max(999),
  restock_quantity: z.number().int().min(0).max(999).optional(),
});

export const RefundOrderSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  lines: z.array(RefundLineSchema).min(1).max(100).optional(),
  reason: z.string().max(500).optional(),
  refund_method: z.enum(['original_payment', 'gift_card', 'manual']).default('original_payment'),
  restock: z.boolean().default(false),
});

export const CompleteRefundSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  refund_id: UuidSchema,
  provider_refund_id: z.string().max(200).optional(),
  provider_event_id: z.string().max(200).optional(),
});

export interface CheckoutOrderItemCommand {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

export interface CreateCheckoutOrderCommand {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  shipping_address?: Record<string, unknown>;
  items: CheckoutOrderItemCommand[];
  payment_method: string;
  shipping_method?: 'standard' | 'express';
  notes?: string;
  coupon_code?: string;
  gift_card_code?: string;
  idempotency_key: string;
}

export interface FulfillmentLineCommand {
  order_item_id: string;
  quantity: number;
}

export interface FulfillOrderCommand {
  idempotency_key: string;
  location_id?: string | null;
  lines?: FulfillmentLineCommand[];
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
}

export interface RefundLineCommand {
  order_item_id: string;
  quantity: number;
  restock_quantity?: number;
}

export interface RefundOrderCommand {
  idempotency_key: string;
  lines?: RefundLineCommand[];
  reason?: string;
  refund_method: 'original_payment' | 'gift_card' | 'manual';
  restock: boolean;
}

export interface CompleteRefundCommand {
  idempotency_key: string;
  refund_id: string;
  provider_refund_id?: string;
  provider_event_id?: string;
}

export const ListOrdersQuery = z.object({
  store_id: UuidSchema.optional(),
  status: z
    .enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'all'])
    .default('all'),
  payment_status: z.enum(['pending', 'paid', 'failed', 'refunded', 'all']).default('all'),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['created_at', 'total', 'status']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const RazorpayVerifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  order_id: UuidSchema,
  idempotency_key: z.string().min(8).max(200),
});

export const RazorpayOrderSchema = z.object({
  order_id: UuidSchema,
  idempotency_key: z.string().min(8).max(200),
  amount: MoneySchema.optional(),
  amount_minor_units: z.number().int().positive().optional(),
});

export const StripeCheckoutSchema = z.object({
  order_id: UuidSchema,
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
  idempotency_key: z.string().min(8).max(200),
});

export const CreateShippingZoneSchema = z.object({
  store_id: UuidSchema,
  name: z.string().min(1).max(100).trim(),
  countries: z.array(z.string().min(2).max(100).trim()).min(1).max(250),
  states: z.array(z.string().max(100)).max(100).optional(),
  zip_codes: z.array(z.string().max(20)).max(500).optional(),
});

export const CreateShippingRateSchema = z.object({
  zone_id: UuidSchema,
  name: z.string().min(1).max(100).trim(),
  type: z.enum(['flat', 'weight_based', 'price_based', 'free']),
  price: MoneySchema.default(0),
  min_weight_grams: z.number().int().min(0).optional(),
  max_weight_grams: z.number().int().min(0).optional(),
  min_order_amount: MoneySchema.optional(),
  max_order_amount: MoneySchema.optional(),
  estimated_days_min: z.number().int().min(0).optional(),
  estimated_days_max: z.number().int().min(0).optional(),
  is_active: z.boolean().default(true),
});

export const CreateTaxRateSchema = z.object({
  store_id: UuidSchema,
  name: z.string().min(1).max(100).trim(),
  rate: z.number().min(0).max(100),
  country: z.string().length(2).toUpperCase().default('IN'),
  state: z.string().max(100).optional(),
  hsn_code: z.string().max(20).optional(),
  applies_to: z.enum(['all', 'shipping', 'products']).default('all'),
  is_compound: z.boolean().default(false),
  is_shipping: z.boolean().default(false),
  priority: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const CreateCouponSchema = z.object({
  store_id: UuidSchema,
  code: z.string().min(3).max(50).toUpperCase().regex(/^[A-Z0-9_-]+$/, 'Code must be alphanumeric'),
  description: z.string().max(500).optional(),
  type: z.enum(['percentage', 'fixed', 'free_shipping']),
  value: z.number().min(0),
  minimum_order_amount: MoneySchema.optional(),
  maximum_discount: MoneySchema.optional(),
  usage_limit: z.number().int().min(1).optional(),
  per_customer_limit: z.number().int().min(1).default(1),
  applicable_products: z.array(UuidSchema).max(100).optional(),
  applicable_categories: z.array(z.string().max(100)).max(20).optional(),
  starts_at: z.coerce.date().optional(),
  expires_at: z.coerce.date().optional(),
  is_active: z.boolean().default(true),
}).refine(
  (data) => data.type !== 'percentage' || (data.value >= 0 && data.value <= 100),
  { message: 'Percentage discount must be between 0 and 100', path: ['value'] },
);

export const ValidateCouponSchema = z.object({
  store_id: UuidSchema,
  code: z.string().min(1).max(50),
  order_total: MoneySchema,
  product_ids: z.array(UuidSchema).optional(),
  customer_id: UuidSchema.optional(),
});

export const ListCouponsQuery = PaginationQuery.extend({
  store_id: UuidSchema.optional(),
  status: z.enum(['active', 'expired', 'all']).default('all'),
});

export interface CouponRecord extends Record<string, unknown> {
  code?: string | null;
  type?: string | null;
  value?: number | string | null;
  minimum_order_amount?: number | string | null;
  maximum_discount?: number | string | null;
  per_customer_limit?: number | string | null;
  discount_type?: string | null;
  discount_value?: number | string | null;
  min_order_amount?: number | string | null;
  max_discount?: number | string | null;
  per_user_limit?: number | string | null;
  starts_at?: string | Date | null;
  expires_at?: string | Date | null;
  usage_limit?: number | string | null;
  usage_count?: number | string | null;
}

export interface NormalizedCouponRecord extends CouponRecord {
  type: string | null;
  value: number | string | null;
  minimum_order_amount: number | string | null;
  maximum_discount: number | string | null;
  per_customer_limit: number | string | null;
}

export interface CouponCreatePlan {
  couponInsert: Record<string, unknown>;
}

export interface CouponUpdatePlan {
  updates: Record<string, unknown>;
}

export type CouponValidationFailureCode =
  | 'expired'
  | 'not_started'
  | 'usage_limit_reached'
  | 'minimum_order_not_met';

export interface CouponValidationPlan {
  valid: boolean;
  failureCode?: CouponValidationFailureCode;
  coupon: {
    code: string;
    type: string | null;
    value: number;
    minimumOrderAmount: number;
    maximumDiscount: number | null;
    discount: number;
    freeShipping: boolean;
  };
  pricingAuthority: 'checkout';
}

const COUPON_UPDATE_FIELDS = [
  'code',
  'type',
  'description',
  'value',
  'minimum_order_amount',
  'maximum_discount',
  'usage_limit',
  'per_customer_limit',
  'starts_at',
  'expires_at',
  'is_active',
] as const;

const COUPON_COLUMN_MAP: Record<string, string> = {
  type: 'discount_type',
  value: 'discount_value',
  minimum_order_amount: 'min_order_amount',
  maximum_discount: 'max_discount',
  per_customer_limit: 'per_user_limit',
};

function toCouponIsoTimestamp(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toCouponNumber(value: number | string | null | undefined, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalCouponNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isCouponDateBefore(value: CouponRecord['expires_at'], date: Date) {
  if (!value) return false;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return !Number.isNaN(parsed.getTime()) && parsed < date;
}

function isCouponDateAfter(value: CouponRecord['starts_at'], date: Date) {
  if (!value) return false;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return !Number.isNaN(parsed.getTime()) && parsed > date;
}

export function normalizeCouponRecord(coupon: unknown): unknown {
  if (!coupon || typeof coupon !== 'object') {
    return coupon;
  }

  const row = coupon as CouponRecord;

  return {
    ...row,
    type: row.type ?? row.discount_type ?? null,
    value: row.value ?? row.discount_value ?? null,
    minimum_order_amount: row.minimum_order_amount ?? row.min_order_amount ?? null,
    maximum_discount: row.maximum_discount ?? row.max_discount ?? null,
    per_customer_limit: row.per_customer_limit ?? row.per_user_limit ?? 1,
  } satisfies NormalizedCouponRecord;
}

export function planCouponCreate(input: CreateCouponInput): CouponCreatePlan {
  return {
    couponInsert: {
      store_id: input.store_id,
      code: input.code,
      description: input.description ?? null,
      discount_type: input.type,
      discount_value: input.value,
      min_order_amount: input.minimum_order_amount ?? null,
      max_discount: input.maximum_discount ?? null,
      usage_limit: input.usage_limit ?? null,
      usage_count: 0,
      per_user_limit: input.per_customer_limit ?? 1,
      starts_at: toCouponIsoTimestamp(input.starts_at),
      expires_at: toCouponIsoTimestamp(input.expires_at),
      is_active: input.is_active,
    },
  };
}

export function planCouponUpdate(patch: Record<string, unknown>): CouponUpdatePlan {
  const updates: Record<string, unknown> = {};

  for (const key of COUPON_UPDATE_FIELDS) {
    if (patch[key] === undefined) continue;

    const column = COUPON_COLUMN_MAP[key] || key;
    updates[column] = key === 'starts_at' || key === 'expires_at'
      ? toCouponIsoTimestamp(patch[key])
      : patch[key];
  }

  return { updates };
}

export function planCouponValidation(
  coupon: CouponRecord,
  input: { subtotal?: number; now?: Date; enforceMinimumOrder?: boolean } = {},
): CouponValidationPlan {
  const now = input.now || new Date();
  const subtotal = Number.isFinite(input.subtotal) ? Math.max(Number(input.subtotal), 0) : 0;
  const type = coupon.type ?? coupon.discount_type ?? null;
  const value = toCouponNumber(coupon.value ?? coupon.discount_value);
  const minimumOrderAmount = toCouponNumber(coupon.minimum_order_amount ?? coupon.min_order_amount);
  const maximumDiscount = toOptionalCouponNumber(coupon.maximum_discount ?? coupon.max_discount);
  const usageLimit = toOptionalCouponNumber(coupon.usage_limit);
  const usageCount = toCouponNumber(coupon.usage_count);

  let failureCode: CouponValidationFailureCode | undefined;
  if (isCouponDateBefore(coupon.expires_at, now)) {
    failureCode = 'expired';
  } else if (isCouponDateAfter(coupon.starts_at, now)) {
    failureCode = 'not_started';
  } else if (usageLimit !== null && usageLimit > 0 && usageCount >= usageLimit) {
    failureCode = 'usage_limit_reached';
  } else if (input.enforceMinimumOrder && minimumOrderAmount > 0 && subtotal < minimumOrderAmount) {
    failureCode = 'minimum_order_not_met';
  }

  let discount = 0;
  if (!failureCode && type === 'percentage') {
    discount = Math.round(subtotal * (value / 100));
    if (maximumDiscount !== null && maximumDiscount > 0) discount = Math.min(discount, maximumDiscount);
  } else if (!failureCode && (type === 'fixed' || type === 'fixed_amount')) {
    discount = Math.min(value, subtotal);
  }

  return {
    valid: !failureCode,
    failureCode,
    coupon: {
      code: coupon.code || '',
      type,
      value,
      minimumOrderAmount,
      maximumDiscount,
      discount,
      freeShipping: type === 'free_shipping',
    },
    pricingAuthority: 'checkout',
  };
}

export function couponValidationReason(code: CouponValidationFailureCode | undefined): string {
  switch (code) {
    case 'expired':
      return 'Coupon has expired';
    case 'not_started':
      return 'Coupon is not yet active';
    case 'usage_limit_reached':
      return 'Coupon usage limit reached';
    case 'minimum_order_not_met':
      return 'Minimum order amount not met';
    default:
      return 'Coupon is invalid';
  }
}

export function storefrontCouponValidationError(
  code: CouponValidationFailureCode | undefined,
  minimumOrderAmount: number,
): string {
  switch (code) {
    case 'expired':
      return 'This coupon has expired';
    case 'not_started':
      return 'This coupon is not yet active';
    case 'usage_limit_reached':
      return 'This coupon has reached its usage limit';
    case 'minimum_order_not_met':
      return `Minimum purchase of ₹${minimumOrderAmount.toLocaleString('en-IN')} required`;
    default:
      return 'Invalid coupon code';
  }
}

export const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export interface OrderStatusTransitionPlan {
  allowed: boolean;
  allowedTransitions: string[];
  updates: Record<string, unknown>;
  delegatesToFulfillment: boolean;
  requiresInventoryRelease: boolean;
}

export function planOrderStatusTransition(
  currentStatus: string,
  newStatus: string,
  metadata: Record<string, unknown> = {},
): OrderStatusTransitionPlan {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
  const allowed = allowedTransitions.includes(newStatus);
  const updates: Record<string, unknown> = allowed ? { status: newStatus } : {};

  if (allowed && newStatus === 'delivered') {
    updates.payment_status = 'paid';
  }

  if (allowed && newStatus === 'cancelled') {
    updates.payment_status = 'refunded';
    updates.notes = metadata.cancellation_reason || 'Order cancelled';
  }

  return {
    allowed,
    allowedTransitions,
    updates,
    delegatesToFulfillment: newStatus === 'shipped',
    requiresInventoryRelease: allowed && newStatus === 'cancelled',
  };
}

export interface OrderItemSourceRow extends Record<string, unknown> {
  product_id?: string | null;
  variant_id?: string | null;
  title?: string | null;
  name?: string | null;
  product_name?: string | null;
  variant_title?: string | null;
  sku?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  price?: number | string | null;
  total?: number | string | null;
  image?: string | null;
  image_url?: string | null;
  product_snapshot?: Record<string, unknown> | string | null;
}

export interface OrderSourceRow extends Record<string, unknown> {
  id: string;
  store_id: string;
  order_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  subtotal?: number | string | null;
  shipping_cost?: number | string | null;
  tax?: number | string | null;
  discount?: number | string | null;
  total?: number | string | null;
  coupon_code?: string | null;
  coupon_discount?: number | string | null;
  tracking_number?: string | null;
  shipping_method?: string | null;
  shipping_address?: Record<string, unknown> | string | null;
  items?: unknown;
  order_items?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

function toCheckoutRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function toCheckoutArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function toCheckoutText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function toCheckoutNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstImageFromOrderSnapshot(snapshot: Record<string, unknown>) {
  const images = snapshot.images;
  if (Array.isArray(images) && typeof images[0] === 'string') return images[0];
  return toCheckoutText(snapshot.image || snapshot.image_url);
}

export function normalizeOrderItemRecord(value: unknown) {
  const item = toCheckoutRecord(value) as OrderItemSourceRow;
  const snapshot = toCheckoutRecord(item.product_snapshot);
  const quantity = toCheckoutNumber(item.quantity, 0);
  const unitPrice = toCheckoutNumber(item.unit_price ?? item.price, 0);
  const total = toCheckoutNumber(item.total, unitPrice * quantity);

  return {
    product_id: toCheckoutText(item.product_id),
    variant_id: toCheckoutText(item.variant_id) || null,
    title: toCheckoutText(item.title || item.name || item.product_name || snapshot.name, 'Item'),
    variant_title: toCheckoutText(item.variant_title) || null,
    sku: toCheckoutText(item.sku || snapshot.sku) || null,
    quantity,
    unit_price: unitPrice,
    total,
    image: toCheckoutText(item.image || item.image_url) || firstImageFromOrderSnapshot(snapshot) || null,
  };
}

export function normalizeOrderRecord<TOrder extends OrderSourceRow>(row: TOrder) {
  const relationalItems = toCheckoutArray(row.order_items);
  const legacyItems = toCheckoutArray(row.items);
  const items = (relationalItems.length > 0 ? relationalItems : legacyItems).map(normalizeOrderItemRecord);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    ...row,
    order_number: row.order_number || '',
    customer_name: row.customer_name || '',
    customer_email: row.customer_email || '',
    customer_phone: row.customer_phone || '',
    status: row.status || 'pending',
    payment_status: row.payment_status || 'pending',
    payment_method: row.payment_method || 'cod',
    subtotal: toCheckoutNumber(row.subtotal),
    shipping_cost: toCheckoutNumber(row.shipping_cost),
    tax: toCheckoutNumber(row.tax),
    discount: toCheckoutNumber(row.discount ?? row.coupon_discount),
    total: toCheckoutNumber(row.total),
    coupon_code: row.coupon_code || null,
    coupon_discount: toCheckoutNumber(row.coupon_discount ?? row.discount),
    tracking_number: row.tracking_number || null,
    shipping_method: row.shipping_method || null,
    shipping_address: toCheckoutRecord(row.shipping_address),
    items,
    order_items: items,
    item_count: itemCount,
  };
}

export interface Order {
  id: string;
  store_id: string;
  order_number: string;
  customer_email: string;
  customer_phone?: string;
  customer_name?: string;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  tax_amount: number;
  total: number;
  currency: string;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  payment_method?: string;
  payment_gateway?: string;
  payment_id?: string;
  shipping_address?: Address;
  billing_address?: Address;
  shipping_method?: string;
  tracking_number?: string;
  notes?: string;
  coupon_code?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id?: string;
  variant_id?: string;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  total?: number;
  productId?: string;
  image?: string;
  variant?: Record<string, string>;
}

export interface CartItem extends ProductModel {
  quantity: number;
  selectedVariant?: Record<string, string>;
}

export interface OrderModel {
  id: string;
  storeId: string;
  sellerId: string;
  subdomain: string;
  orderNumber: string;
  customer: OrderCustomer;
  items: OrderItem[];
  pricing: OrderPricing;
  payment: OrderPayment;
  status: OrderStatus;
  tracking?: OrderTracking;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
  address: ShippingAddress;
}

export interface ShippingAddress {
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderPricing {
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  total: number;
}

export interface OrderPayment {
  method: 'razorpay' | 'stripe' | 'paypal' | 'cod';
  status: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  stripeSessionId?: string;
  paypalOrderId?: string;
}

export interface OrderTracking {
  number?: string;
  carrier?: string;
  url?: string;
  updatedAt?: string;
}

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type StorefrontCreateOrderInput = z.infer<typeof StorefrontCreateOrderSchema>;
export type StorefrontRazorpayOrderInput = z.infer<typeof StorefrontRazorpayOrderSchema>;
export type StorefrontRazorpayVerifyInput = z.infer<typeof StorefrontRazorpayVerifySchema>;
export type StorefrontStripeCheckoutInput = z.infer<typeof StorefrontStripeCheckoutSchema>;
export type StorefrontPayPalOrderInput = z.infer<typeof StorefrontPayPalOrderSchema>;
export type StorefrontPayPalCaptureInput = z.infer<typeof StorefrontPayPalCaptureSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
export type FulfillOrderInput = z.infer<typeof FulfillOrderSchema>;
export type RefundOrderInput = z.infer<typeof RefundOrderSchema>;
export type CompleteRefundInput = z.infer<typeof CompleteRefundSchema>;
export type ListOrdersInput = z.infer<typeof ListOrdersQuery>;
export type RazorpayVerifyInput = z.infer<typeof RazorpayVerifySchema>;
export type RazorpayOrderInput = z.infer<typeof RazorpayOrderSchema>;
export type StripeCheckoutInput = z.infer<typeof StripeCheckoutSchema>;
export type CreateShippingZoneInput = z.infer<typeof CreateShippingZoneSchema>;
export type CreateShippingRateInput = z.infer<typeof CreateShippingRateSchema>;
export type CreateTaxRateInput = z.infer<typeof CreateTaxRateSchema>;
export type CreateCouponInput = z.infer<typeof CreateCouponSchema>;
export type ValidateCouponInput = z.infer<typeof ValidateCouponSchema>;
export type ListCouponsInput = z.infer<typeof ListCouponsQuery>;

export interface ShippingZoneCreatePlan {
  zoneInsert: Record<string, unknown>;
}

export interface ShippingZoneUpdatePlan {
  updates: Record<string, unknown>;
}

export interface ShippingRateCreatePlan {
  rateInsert: Record<string, unknown>;
}

export interface ShippingRateUpdatePlan {
  updates: Record<string, unknown>;
}

export interface TaxRateCreatePlan {
  taxRateInsert: Record<string, unknown>;
}

export interface TaxRateUpdatePlan {
  updates: Record<string, unknown>;
}

const SHIPPING_ZONE_UPDATE_FIELDS = ['name', 'countries', 'states'] as const;
const SHIPPING_RATE_UPDATE_FIELDS = [
  'name',
  'description',
  'price',
  'min_order_amount',
  'max_order_amount',
  'min_weight_grams',
  'max_weight_grams',
  'estimated_days_min',
  'estimated_days_max',
  'type',
  'is_active',
] as const;
const TAX_RATE_UPDATE_FIELDS = ['name', 'rate', 'country', 'state', 'is_compound', 'is_shipping', 'priority', 'is_active'] as const;

export function planShippingZoneCreate(input: CreateShippingZoneInput): ShippingZoneCreatePlan {
  return {
    zoneInsert: {
      store_id: input.store_id,
      name: input.name,
      countries: input.countries,
      states: input.states || [],
    },
  };
}

export function planShippingZoneUpdate(patch: Record<string, unknown>): ShippingZoneUpdatePlan {
  const updates: Record<string, unknown> = {};
  for (const key of SHIPPING_ZONE_UPDATE_FIELDS) {
    if (patch[key] !== undefined) updates[key] = patch[key];
  }
  return { updates };
}

export function planShippingRateCreate(input: CreateShippingRateInput): ShippingRateCreatePlan {
  return {
    rateInsert: {
      zone_id: input.zone_id,
      name: input.name,
      price: input.price || 0,
      min_order_amount: input.min_order_amount || null,
      max_order_amount: input.max_order_amount || null,
      estimated_days_min: input.estimated_days_min || null,
      estimated_days_max: input.estimated_days_max || null,
      type: input.type,
      is_active: input.is_active ?? true,
    },
  };
}

export function planShippingRateUpdate(patch: Record<string, unknown>): ShippingRateUpdatePlan {
  const updates: Record<string, unknown> = {};
  for (const key of SHIPPING_RATE_UPDATE_FIELDS) {
    if (patch[key] !== undefined) updates[key] = patch[key];
  }
  return { updates };
}

export function planTaxRateCreate(input: CreateTaxRateInput): TaxRateCreatePlan {
  return {
    taxRateInsert: {
      store_id: input.store_id,
      name: input.name,
      rate: input.rate,
      country: input.country || 'IN',
      state: input.state || null,
      is_compound: input.is_compound ?? false,
      is_shipping: input.is_shipping ?? false,
      priority: input.priority || 0,
      is_active: input.is_active ?? true,
    },
  };
}

export function planTaxRateUpdate(patch: Record<string, unknown>): TaxRateUpdatePlan {
  const updates: Record<string, unknown> = {};
  for (const key of TAX_RATE_UPDATE_FIELDS) {
    if (patch[key] !== undefined) updates[key] = patch[key];
  }
  return { updates };
}
