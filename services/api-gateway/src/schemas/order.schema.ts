import { z } from 'zod';
import { UuidSchema, EmailSchema, PhoneSchema, AddressSchema } from './common.schema';

export const OrderItemInput = z.object({
    product_id: UuidSchema,
    variant_id: UuidSchema.optional().nullable(),
    quantity: z.number().int().min(1).max(999),
    // NOTE: price is NOT accepted from client — always calculated server-side
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

// Valid order status transitions (state machine)
export const VALID_TRANSITIONS: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'],
    delivered: ['refunded'],
    cancelled: [],
    refunded: [],
};
