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
});

export const StorefrontRazorpayVerifySchema = z.object({
  orderId: UuidSchema,
  razorpay_order_id: z.string().min(1).max(200),
  razorpay_payment_id: z.string().min(1).max(200),
  razorpay_signature: z.string().min(1).max(500),
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

export const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

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
